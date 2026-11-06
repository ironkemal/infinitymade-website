import test from 'node:test';
import assert from 'node:assert/strict';
import { T, T2, MA, JA, jetzt, ENV, fakeDb, basis } from './terminerinnerung-testdaten.js';

process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-test-key';
const { erinnerungsLauf, starteTerminerinnerung } = await import('./terminerinnerung-job.js');


function umgebung(opt = {}) {
  const db = fakeDb(opt.tabellen || basis(), opt);
  const mails = []; const logs = [];
  const transportFabrik = () => ({
    async verify() { const c = opt.verifyFehler?.(); if (c) throw Object.assign(new Error('verify'), { code: c }); },
    async sendMail(m) {
      const f = opt.sendFehler?.();
      if (f) throw Object.assign(new Error('x'), typeof f === 'string' ? { code: f } : f);
      mails.push(m);
    },
  });
  const log = { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')) };
  const lauf = (extra = {}) => erinnerungsLauf(db, { jetzt, env: ENV, kutu: true, transportFabrik, log, ...extra });
  return { db, mails, logs, lauf };
}

// ── Grundfall + G-2 + Mandantengrenzen ────────────────────────────────────────────────────────────────
test('Lauf: genau eine Mail (Einwilligung v6 + gueltige Adresse) mit korrektem Inhalt; Rest auf die Anrufliste', async () => {
  const u = umgebung();
  const r = await u.lauf();
  assert.equal(r.gesendet, 1); assert.equal(r.anruf, 3); // b2 v5, b3 Adressliste, b4 kein Patient
  assert.equal(r.mandanten, 1);                          // nur T: Schalter AUS (T2) und Mitarbeiter-Zeile zaehlen nicht
  assert.equal(u.mails.length, 1);
  const m = u.mails[0];
  assert.equal(m.to, 'patient-eins@example.invalid');
  assert.equal(m.subject, 'Terminerinnerung – Physio Test');
  assert.match(m.text, /Freitag, 11\.12\.2026 um 10:00 Uhr bei Physio Test\./);
  assert.match(m.text, /telefonisch ab: 0221 123\./);
  const prot = u.db.tabellen.termin_mitteilungen;
  assert.equal(prot.length, 1); assert.equal(prot[0].anlass, 'erinnerung_vortag'); assert.equal(prot[0].status, 'gesendet');
  assert.equal(prot[0].freigegeben_von, null); assert.equal(prot[0].owner_id, T);
});

test('G-2 ohne gueltige Einwilligung / widerrufen / ohne Option: keine Mail', async () => {
  const t = basis();
  t.patient_consents[0].revoked_at = '2026-11-07';                       // l1 widerrufen
  const u = umgebung({ tabellen: t });
  const r = await u.lauf();
  assert.equal(r.gesendet, 0); assert.equal(u.mails.length, 0);
  const t2 = basis(); t2.patient_consents[0].text_snapshot = 'Kopf\n[ ] Terminerinnerungen: NEIN';
  const u2 = umgebung({ tabellen: t2 });
  assert.equal((await u2.lauf()).gesendet, 0); assert.equal(u2.mails.length, 0);
});

test('Standort wird nur bei mehreren Standorten genannt', async () => {
  const t = basis();
  t.businesses.push({ id: 'biz2', owner_id: T, business_name: 'Zweitstandort', street: 'Ring', house_number: '2', zip: '50668', city: 'Köln' });
  const u = umgebung({ tabellen: t });
  await u.lauf();
  assert.match(u.mails[0].text, /\(Physio Test, Weg 1, 50667 Köln\)/);
  const einzel = umgebung(); await einzel.lauf();
  assert.doesNotMatch(einzel.mails[0].text, /50667/);
});

// ── G-5 ohne SMTP / ausserhalb Fenster ───────────────────────────────────────────────────────────
test('G-5 ohne Praxis-SMTP, in der SaaS (Gmail) und ausserhalb des Fensters: kein DB-Zugriff, keine Mail, kein Fehler', async () => {
  for (const [opt, grund] of [
    [{ env: {}, kutu: true }, 'kein_smtp'],
    [{ env: ENV, kutu: false }, 'kein_smtp'],
    [{ jetzt: new Date('2026-12-10T16:59:59Z') }, 'ausserhalb_fenster'],
    [{ jetzt: new Date('2026-12-10T21:00:00Z') }, 'ausserhalb_fenster'],
  ]) {
    const u = umgebung();
    const r = await u.lauf(opt);
    assert.equal(r.uebersprungen, grund); assert.equal(r.gesendet, 0);
    assert.equal(u.db.aufrufe.length, 0, 'keine Datenbankabfrage'); assert.equal(u.mails.length, 0); assert.equal(u.logs.length, 0);
  }
});

// ── G-1 Doppelversand ────────────────────────────────────────────────────────────────────────────
test('G-1 zweiter Lauf und zwei gleichzeitige Laeufe senden nie doppelt', async () => {
  const u = umgebung();
  await u.lauf(); await u.lauf();
  assert.equal(u.mails.length, 1);
  const p = umgebung();
  const [r1, r2] = await Promise.all([p.lauf(), p.lauf()]);
  assert.equal(p.mails.length, 1);
  assert.equal(r1.gesendet + r2.gesendet, 1);
});

test('G-1 Reservierung ohne Abschluss (Absturz): nie erneut senden, Anrufliste', async () => {
  const t = basis();
  t.termin_mitteilungen.push({ id: 'z', owner_id: T, booking_id: 'b1', anlass: 'erinnerung_vortag', termin_beginn: '2026-12-11T09:00:00Z', status: 'fehler', fehler_code: 'IN_ARBEIT' });
  const u = umgebung({ tabellen: t });
  const r = await u.lauf();
  assert.equal(u.mails.length, 0); assert.equal(r.gesendet, 0); assert.equal(r.anruf, 4);
});

test('G-1 Sondertag-Protokoll derselben Buchung blockiert die Erinnerung nicht (eigener Anlass)', async () => {
  const t = basis();
  t.termin_mitteilungen.push({ id: 'z', owner_id: T, booking_id: 'b1', anlass: 'sondertag_geschlossen', termin_beginn: '2026-12-11T09:00:00Z', status: 'gesendet', fehler_code: null });
  const u = umgebung({ tabellen: t });
  assert.equal((await u.lauf()).gesendet, 1);
});

test('Verschobener Termin (neue Startzeit) bekommt eine neue Erinnerung', async () => {
  const t = basis();
  t.termin_mitteilungen.push({ id: 'z', owner_id: T, booking_id: 'b1', anlass: 'erinnerung_vortag', termin_beginn: '2026-12-11T08:00:00Z', status: 'gesendet', fehler_code: null });
  const u = umgebung({ tabellen: t });
  assert.equal((await u.lauf()).gesendet, 1);
});

// ── Fehlerpfade ──────────────────────────────────────────────────────────────────────────────────
test('Mailserver nicht erreichbar (verify scheitert): keine Reservierung, Abbruch, spaeter am selben Abend genau einmal', async () => {
  const t = basis();
  let aus = true;
  const u = umgebung({ tabellen: t, verifyFehler: () => (aus ? 'ECONNREFUSED' : null) });
  const r1 = await u.lauf();
  assert.equal(r1.abgebrochen, true); assert.equal(u.mails.length, 0);
  assert.equal(t.termin_mitteilungen.length, 0, 'nichts reserviert, nichts verloren');
  aus = false;
  const r2 = await u.lauf();
  assert.equal(r2.gesendet, 1); assert.equal(u.mails.length, 1);
  await u.lauf(); assert.equal(u.mails.length, 1);
});

test('Timeout beim Senden (Mail evtl. schon angenommen): nie erneut senden, auch nicht beim naechsten Tick (G-1)', async () => {
  const t = basis();
  let n = 0;
  const u = umgebung({ tabellen: t, sendFehler: () => (++n === 1 ? { code: 'ETIMEDOUT', command: 'CONN' } : null) });
  const r1 = await u.lauf();
  assert.equal(r1.fehler, 1); assert.equal(t.termin_mitteilungen[0].fehler_code, 'ETIMEDOUT');
  const r2 = await u.lauf();
  assert.equal(r2.gesendet, 0); assert.equal(u.mails.length, 0);
});

test('Server lehnt voruebergehend ab (4xx, Greylisting): als SMTP_4XX gespeichert und am selben Abend erneut versucht', async () => {
  const t = basis();
  let n = 0;
  const u = umgebung({ tabellen: t, sendFehler: () => (++n === 1 ? { code: 'EENVELOPE', responseCode: 450, command: 'RCPT TO' } : null) });
  const r1 = await u.lauf();
  assert.equal(r1.fehler, 1); assert.equal(t.termin_mitteilungen[0].fehler_code, 'SMTP_4XX');
  const r2 = await u.lauf();
  assert.equal(r2.gesendet, 1); assert.equal(u.mails.length, 1);
  assert.equal(t.termin_mitteilungen[0].status, 'gesendet');
});

test('Endgueltiger Fehler (Empfaenger abgelehnt): kein erneuter Versuch, Lauf geht weiter', async () => {
  const t = basis();
  let n = 0;
  const u = umgebung({ tabellen: t, sendFehler: () => (++n === 1 ? 'EENVELOPE' : null) });
  const r1 = await u.lauf();
  assert.equal(r1.fehler, 1); assert.equal(r1.abgebrochen, false);
  const r2 = await u.lauf();
  assert.equal(r2.gesendet, 0); assert.equal(u.mails.length, 0); // nie erneut
});

test('Tagesgrenze 1000 je Anlass: Erinnerung gestoppt, Sondertag-Zeilen zaehlen nicht mit', async () => {
  const t = basis();
  for (let i = 0; i < 1000; i++) t.termin_mitteilungen.push({ id: `e${i}`, owner_id: T, booking_id: `fremd${i}`, anlass: 'erinnerung_vortag', termin_beginn: '2026-12-10T09:00:00Z', status: 'gesendet', created_at: '2026-12-10T10:00:00.000Z' });
  const u = umgebung({ tabellen: t });
  const r = await u.lauf();
  assert.equal(r.deckel, 1); assert.equal(u.mails.length, 0);

  const t2 = basis();
  for (let i = 0; i < 1000; i++) t2.termin_mitteilungen.push({ id: `s${i}`, owner_id: T, booking_id: `fremd${i}`, anlass: 'sondertag_geschlossen', termin_beginn: '2026-12-10T09:00:00Z', status: 'gesendet', created_at: '2026-12-10T10:00:00.000Z' });
  const u2 = umgebung({ tabellen: t2 });
  assert.equal((await u2.lauf()).gesendet, 1);
});

test('DB-Fehler bei einem Mandanten stoppt die anderen nicht', async () => {
  const t = basis();
  t.profiles.find(p => p.id === T2).terminerinnerung_aktiv = true;
  const u = umgebung({ tabellen: t, fehlerBei: (name, eqs) => name === 'bookings' && eqs.owner_id === T });
  const r = await u.lauf();
  assert.equal(r.fehler, 1); assert.equal(r.gesendet, 1); // T scheitert, T2 versendet
  assert.equal(u.mails[0].to, 'fremd@example.invalid');
});

// ── G-4 Logs ─────────────────────────────────────────────────────────────────────────────────────
test('G-4 Logs enthalten nur Anzahlen/Codes – keine Adresse, kein Termin, kein Praxisname', async () => {
  const t = basis();
  let n = 0;
  const u = umgebung({ tabellen: t, sendFehler: () => (++n === 1 ? 'EENVELOPE' : null) });
  await u.lauf(); await u.lauf();
  const u2 = umgebung({ tabellen: basis(), fehlerBei: name => name === 'bookings' });
  await u2.lauf();
  const alle = [...u.logs, ...u2.logs].join('\n');
  assert.ok(alle.length > 0, 'es wurde etwas geloggt');
  assert.doesNotMatch(alle, /example\.invalid|patient-|Physio Test|2026-12-11|@/);
});

// ── Zeitjob ──────────────────────────────────────────────────────────────────────────────────────
test('Zeitjob: nur Worker 0; ueberlappende Ticks starten keinen zweiten Lauf; Timer sind entkoppelt', async () => {
  const db = fakeDb(basis()); const mails = [];
  const mk = (instance) => starteTerminerinnerung({
    supabase: db, env: { ...ENV, NODE_APP_INSTANCE: instance }, jetzt: () => jetzt.getTime(), kutu: true,
    transportFabrik: () => ({ async sendMail(m) { mails.push(m); } }), log: { log() {}, error() {}, warn() {} },
    timer: { setTimeout: () => ({ unref() {} }), setInterval: () => ({ unref() {} }), clearTimeout() {}, clearInterval() {} },
  });
  assert.equal(mk('1'), null);
  assert.equal(starteTerminerinnerung({ supabase: null }), null);
  const job = mk('0'); assert.ok(job);
  await Promise.all([job.tick(), job.tick()]);
  assert.equal(mails.length, 1);
  await job.tick(); assert.equal(mails.length, 1);
});

// ── Echte Mail (RFC 822) ─────────────────────────────────────────────────────────────────────────────
test('G-4 echte MIME-Nachricht (nodemailer streamTransport): Header, Zeichensatz, kein Name/Grund, keine Header-Injektion', async () => {
  const { default: nodemailer } = await import('nodemailer');
  const t = basis();
  t.profiles[0].business_name = 'Physio Nord\r\nBcc: boese@example.invalid';
  const roh = [];
  const stream = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
  const u = umgebung({ tabellen: t });
  const alt = process.env.SMTP_FROM; process.env.SMTP_FROM = 'praxis@example.invalid';
  try {
    await u.lauf({ transportFabrik: () => ({ async sendMail(m) { const info = await stream.sendMail(m); roh.push(info.message.toString('utf8')); } }) });
  } finally { if (alt === undefined) delete process.env.SMTP_FROM; else process.env.SMTP_FROM = alt; }
  assert.equal(roh.length, 1);
  const mime = roh[0];
  const [kopfRoh, ...rest] = mime.split('\r\n\r\n');
  const kopf = kopfRoh.replace(/\r\n[ \t]+/g, ' '); // RFC-5322-Faltung aufheben
  assert.match(kopf, /^From: .*<praxis@example\.invalid>/m);
  assert.match(kopf, /^To: patient-eins@example\.invalid$/m);
  assert.match(kopf, /^Subject: =\?UTF-8\?Q\?.*\?=/m, 'Betreff mit Gedankenstrich ist korrekt kodiert');
  assert.equal(kopf.split('\r\n').filter(z => /^[A-Za-z-]+:/.test(z)).map(z => z.split(':')[0]).filter(h => /^(bcc|cc)$/i.test(h)).length, 0);
  assert.doesNotMatch(kopf, /^Bcc:/mi, 'keine eingeschleuste Header-Zeile');
  assert.equal(kopf.split('\r\n').filter(z => /^(To|Cc|Bcc|Reply-To): /i.test(z)).length, 1, 'genau ein Empfaengerheader (To)');
  assert.match(kopf, /Content-Type: text\/plain; charset=utf-8/i);
  const koerper = rest.join('\r\n\r\n');
  assert.match(koerper, /Guten Tag,/);
  assert.doesNotMatch(mime, /Rezept|Diagnose|Behandlung|Herr |Frau /);
});

test('Grosser Mandant: IN-Listen in Bloecken <= 50 (URL-Laenge), alle 130 Termine werden erinnert', async () => {
  const t = basis();
  t.bookings = []; t.leads = []; t.patient_consents = [];
  for (let i = 0; i < 130; i++) {
    t.bookings.push({ id: `g${i}`, owner_id: T, start_time: `2026-12-11T${String(7 + (i % 12)).padStart(2, '0')}:${i % 2 ? '00' : '30'}:00Z`, status: 'confirmed', lead_id: `gl${i}`, created_at: '2026-12-01T08:00:00Z' });
    t.leads.push({ id: `gl${i}`, owner_id: T, email: `p${i}@example.invalid` });
    t.patient_consents.push({ patient_id: `gl${i}`, owner_id: T, consent_type: 'datenschutz', text_version: 'datenschutz-v6-2026-11-05', text_snapshot: JA, consented_at: '2026-11-06', revoked_at: null });
  }
  const u = umgebung({ tabellen: t });
  const r = await u.lauf();
  assert.equal(r.gesendet, 130); assert.equal(u.mails.length, 130);
  assert.ok(u.db.stand.maxIn <= 50, `groesster IN-Block: ${u.db.stand.maxIn}`);
});

test('Antwort an der Zeilengrenze (>= 1000 Termine): laut abbrechen statt Termine stillschweigend auszulassen', async () => {
  const t = basis();
  t.bookings = Array.from({ length: 1000 }, (_, i) => ({ id: `z${i}`, owner_id: T, start_time: '2026-12-11T09:00:00Z', status: 'confirmed', lead_id: null, created_at: '2026-12-01T08:00:00Z' }));
  const u = umgebung({ tabellen: t });
  const r = await u.lauf();
  assert.equal(r.fehler, 1); assert.equal(u.mails.length, 0);
  assert.match(u.logs.join('\n'), /Mandantenlauf fehlgeschlagen: ZEILENGRENZE/);
});
