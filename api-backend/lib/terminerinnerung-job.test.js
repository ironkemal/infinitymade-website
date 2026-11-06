import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-test-key';
const { erinnerungsLauf, starteTerminerinnerung } = await import('./terminerinnerung-job.js');
const { MITTEILUNG_OPTION_TEXT } = await import('./sondertag-mitteilung.js');

const T = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';   // Inhaber, Schalter AN
const T2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';  // Inhaber, Schalter AUS
const MA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';  // Mitarbeiter-Zeile mit gesetztem Schalter (darf nicht zaehlen)
const JA = `Kopf\n[X] ${MITTEILUNG_OPTION_TEXT}: JA`;
const jetzt = new Date('2026-12-10T17:00:00Z');     // 18:00 MEZ, morgen = 11.12.2026
const ENV = { SMTP_HOST: 'smtp.example.invalid' };

/** PostgREST-Fake mit Schreiben, UNIQUE (booking_id, anlass, termin_beginn) und Zaehlabfrage (head). */
function fakeDb(tabellen, { fehlerBei = null } = {}) {
  let n = 0;
  const aufrufe = [];
  return {
    tabellen, aufrufe,
    from(name) {
      aufrufe.push(name);
      const f = []; let op = 'select'; let wert = null; let head = false;
      const rows = () => (tabellen[name] ||= []);
      const treffer = () => rows().filter(r => f.every(x => x(r)));
      const b = {
        select(_c, opt) { if (opt?.head) head = true; return b; },
        eq(k, v) { f.push(r => r[k] === v); b.eqs = { ...b.eqs, [k]: v }; return b; },
        neq(k, v) { f.push(r => r[k] !== v); return b; },
        in(k, v) { f.push(r => v.includes(r[k])); return b; },
        gte(k, v) { f.push(r => String(r[k]) >= v); return b; },
        lt(k, v) { f.push(r => String(r[k]) < v); return b; },
        lte(k, v) { f.push(r => String(r[k]) <= v); return b; },
        insert(w) { op = 'insert'; wert = w; return b; },
        update(w) { op = 'update'; wert = w; return b; },
        maybeSingle() { return b.ausfuehren(true); },
        then(ok, fehl) { return b.ausfuehren(false).then(ok, fehl); },
        async ausfuehren(einzeln) {
          await Promise.resolve(); // Verschachtelung paralleler Laeufe sichtbar machen
          if (fehlerBei?.(name, b.eqs || {}, op)) return { data: null, error: { code: 'DB_TEST_FEHLER' } };
          if (op === 'insert') {
            const dup = rows().some(r => r.booking_id === wert.booking_id && r.anlass === wert.anlass
              && new Date(r.termin_beginn).getTime() === new Date(wert.termin_beginn).getTime());
            if (dup) return { data: null, error: { code: '23505' } };
            const z = { id: `m${++n}`, created_at: jetzt.toISOString(), ...wert };
            rows().push(z);
            return { data: { id: z.id }, error: null };
          }
          if (op === 'update') {
            const t = treffer(); t.forEach(r => Object.assign(r, wert));
            return { data: einzeln ? (t[0] ? { id: t[0].id } : null) : t, error: null };
          }
          if (head) return { count: treffer().length, error: null };
          const d = treffer();
          return { data: einzeln ? d[0] || null : d, error: null };
        },
      };
      return b;
    },
  };
}

const basis = () => ({
  profiles: [
    { id: T, role: 'owner', terminerinnerung_aktiv: true, business_name: 'Physio Test', phone: '0221 123' },
    { id: T2, role: 'owner', terminerinnerung_aktiv: false, business_name: 'Aus', phone: '1' },
    { id: MA, role: 'employee', terminerinnerung_aktiv: true, business_name: 'Mitarbeiter', phone: '2' },
  ],
  businesses: [{ id: 'biz1', owner_id: T, business_name: 'Physio Test', street: 'Weg', house_number: '1', zip: '50667', city: 'Köln' }],
  bookings: [
    { id: 'b1', owner_id: T, start_time: '2026-12-11T09:00:00Z', status: 'confirmed', lead_id: 'l1', business_id: 'biz1', created_at: '2026-12-01T08:00:00Z' },
    { id: 'b2', owner_id: T, start_time: '2026-12-11T10:00:00Z', status: 'confirmed', lead_id: 'l2', business_id: 'biz1', created_at: '2026-12-01T08:00:00Z' },
    { id: 'b3', owner_id: T, start_time: '2026-12-11T11:00:00Z', status: 'confirmed', lead_id: 'l3', business_id: 'biz1', created_at: '2026-12-01T08:00:00Z' },
    { id: 'b4', owner_id: T, start_time: '2026-12-11T12:00:00Z', status: 'confirmed', lead_id: null, business_id: 'biz1', created_at: '2026-12-01T08:00:00Z' },
    { id: 'b5', owner_id: T, start_time: '2026-12-11T13:00:00Z', status: 'cancelled', lead_id: 'l1', business_id: 'biz1', created_at: '2026-12-01T08:00:00Z' },
    { id: 'bx', owner_id: T2, start_time: '2026-12-11T09:00:00Z', status: 'confirmed', lead_id: 'lx', created_at: '2026-12-01T08:00:00Z' },
    { id: 'bm', owner_id: MA, start_time: '2026-12-11T09:00:00Z', status: 'confirmed', lead_id: 'lm', created_at: '2026-12-01T08:00:00Z' },
  ],
  leads: [
    { id: 'l1', owner_id: T, email: 'patient-eins@example.invalid' },
    { id: 'l2', owner_id: T, email: 'patient-zwei@example.invalid' },
    { id: 'l3', owner_id: T, email: 'keine adresse, a@b.de' },
    { id: 'lx', owner_id: T2, email: 'fremd@example.invalid' },
    { id: 'lm', owner_id: MA, email: 'ma@example.invalid' },
  ],
  patient_consents: [
    { patient_id: 'l1', owner_id: T, consent_type: 'datenschutz', text_version: 'datenschutz-v6-2026-11-05', text_snapshot: JA, consented_at: '2026-11-06', revoked_at: null },
    { patient_id: 'l2', owner_id: T, consent_type: 'datenschutz', text_version: 'datenschutz-v5-2026-10-30', text_snapshot: JA, consented_at: '2026-11-06', revoked_at: null },
    { patient_id: 'l3', owner_id: T, consent_type: 'datenschutz', text_version: 'datenschutz-v6-2026-11-05', text_snapshot: JA, consented_at: '2026-11-06', revoked_at: null },
    { patient_id: 'lx', owner_id: T2, consent_type: 'datenschutz', text_version: 'datenschutz-v6-2026-11-05', text_snapshot: JA, consented_at: '2026-11-06', revoked_at: null },
    { patient_id: 'lm', owner_id: MA, consent_type: 'datenschutz', text_version: 'datenschutz-v6-2026-11-05', text_snapshot: JA, consented_at: '2026-11-06', revoked_at: null },
  ],
  termin_mitteilungen: [],
});

function umgebung(opt = {}) {
  const db = fakeDb(opt.tabellen || basis(), opt);
  const mails = []; const logs = [];
  const transportFabrik = () => ({ async sendMail(m) { if (opt.sendFehler) { const e = new Error('x'); e.code = opt.sendFehler(); if (e.code) throw e; } mails.push(m); } });
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
test('SMTP nicht erreichbar: Lauf bricht ab, spaeter am selben Abend wird nachgeholt – genau einmal', async () => {
  const t = basis();
  let aus = true;
  const u = umgebung({ tabellen: t, sendFehler: () => (aus ? 'ECONNREFUSED' : null) });
  const r1 = await u.lauf();
  assert.equal(r1.abgebrochen, true); assert.equal(u.mails.length, 0);
  assert.equal(t.termin_mitteilungen[0].fehler_code, 'ECONNREFUSED');
  aus = false;
  const r2 = await u.lauf();
  assert.equal(r2.gesendet, 1); assert.equal(u.mails.length, 1);
  assert.equal(t.termin_mitteilungen[0].status, 'gesendet');
  await u.lauf(); assert.equal(u.mails.length, 1);
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
