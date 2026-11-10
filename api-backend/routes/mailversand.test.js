// routes/mailversand.js — Einstellungen → E-Mail-Versand (AUFTRAG-MAILVERSAND, 09.11.2026).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-test-key';
process.env.DATA_ENCRYPTION_KEY ||= 'c'.repeat(64);
const { createMailversandRouter, pruefeMailEingabe, istInterneAdresse, pruefZiel } = await import('./mailversand.js');
const { verschluesselePasswort } = await import('../lib/mail.js');

const OWNER = 'aaaaaaaa-0000-4000-8000-000000000001';

function fakeDb() {
  const t = { praxis_mailversand: [], profiles: [{ id: OWNER, email: 'inhaber@example.invalid', business_name: 'Praxis Test', b2b_from_email: null }] };
  const rpcs = [];
  return {
    t, rpcs,
    rpc: async (name) => { rpcs.push(name); return { data: null, error: null }; },
    from(name) {
      const f = []; let op = 'select'; let wert = null;
      const rows = () => (t[name] ||= []);
      const b = {
        select() { return b; },
        limit() { return b; },
        eq(k, v) { f.push(r => r[k] === v); return b; }, or(expr) { const teile = String(expr).split(','); f.push(r => teile.some(x => { const [k, op, ...rest] = x.split('.'); const v = rest.join('.'); return op === 'is' ? r[k] == null : op === 'lt' ? (r[k] != null && r[k] < v) : false; })); return b; },
        update(w) { op = 'update'; wert = w; return b; },
        upsert(w) { op = 'upsert'; wert = w; return b; },
        maybeSingle() { return b.run(true); },
        then(ok, no) { return b.run(false).then(ok, no); },
        async run(einzeln) {
          if (op === 'upsert') {
            const i = rows().findIndex(r => r.owner_id === wert.owner_id);
            if (i >= 0) rows()[i] = { ...rows()[i], ...wert }; else rows().push({ ...wert });
            return { data: null, error: null };
          }
          const hit = rows().filter(r => f.every(x => x(r)));
          if (op === 'update' && wert.letzter_test_at && Object.keys(wert).length === 1 && t.claimFehler) return { data: null, error: { code: 'DB_TEST_FEHLER' } };
          if (op === 'update') { hit.forEach(r => Object.assign(r, wert)); return { data: hit, error: null }; }
          return { data: einzeln ? hit[0] || null : hit, error: null };
        },
      };
      return b;
    },
  };
}

let server, base, db, rolle, verifyFehler, gesendet, kutuWert; const optionen = [];
before(async () => {
  db = fakeDb();
  const app = express(); app.use(express.json());
  const auth = (req, _res, next) => { req.auth = { userId: OWNER, tenantId: OWNER, role: rolle }; next(); };
  const owner = (req, res, next) => (req.auth.role === 'owner' ? next() : res.status(403).json({ error: 'Nur für Inhaber' }));
  const transportFabrik = (o) => (optionen.push(o), {
    async verify() { if (verifyFehler) throw Object.assign(new Error('x'), { code: verifyFehler }); },
    async sendMail(m) { gesendet.push(m); },
  });
  const lookup = async (h) => [{ address: h === 'intern.example.invalid' ? '10.0.0.5' : '203.0.113.7' }];
  app.use('/api', createMailversandRouter({ supabase: db, auth, owner, transportFabrik, kutu: () => kutuWert, env: {}, lookup }));
  server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server?.close());

const call = (method, pfad, body) => fetch(base + pfad, {
  method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
}).then(async r => ({ status: r.status, body: await r.json() }));

function reset({ r = 'owner', kutu = true } = {}) { rolle = r; verifyFehler = null; gesendet = []; kutuWert = kutu; db.t.praxis_mailversand.length = 0; }

test('Mitarbeiter: 403 auf allen Wegen', async () => {
  reset({ r: 'employee' });
  for (const [m, p] of [['GET', '/mailversand'], ['PUT', '/mailversand'], ['POST', '/mailversand/test'], ['DELETE', '/mailversand']]) {
    assert.equal((await call(m, p, m === 'PUT' ? {} : undefined)).status, 403, `${m} ${p}`);
  }
});

test('Speichern (Vorlage IONOS) + verify, Antwort und GET ohne Passwort', async () => {
  reset();
  const r = await call('PUT', '/mailversand', { preset: 'ionos', absender_email: 'praxis@example.invalid', passwort: 'Geheim-123', smtp_host: 'boese.invalid' });
  assert.equal(r.status, 200); assert.equal(r.body.verbunden, true);
  const z = db.t.praxis_mailversand[0];
  assert.equal(z.smtp_host, 'smtp.ionos.de', 'Host aus der Vorlage, nicht aus der Anfrage');
  assert.equal(z.status, 'verbunden');
  assert.match(z.smtp_passwort, /^\\x[0-9a-f]+$/); assert.ok(!z.smtp_passwort.includes('Geheim'));
  const g = await call('GET', '/mailversand');
  const s = JSON.stringify(g.body) + JSON.stringify(r.body);
  assert.ok(!s.includes('Geheim-123') && !s.includes(z.smtp_passwort.slice(2, 20)), 'kein Passwort, kein Chiffrat in Antworten');
  assert.equal(g.body.einstellung.passwortGespeichert, true); assert.equal(g.body.quelle, 'db');
});

test('Leeres Passwort behaelt das gespeicherte nur bei gleichem Zugang', async () => {
  reset();
  await call('PUT', '/mailversand', { preset: 'ionos', absender_email: 'praxis@example.invalid', passwort: 'pw1' });
  const alt = db.t.praxis_mailversand[0].smtp_passwort;
  assert.equal((await call('PUT', '/mailversand', { preset: 'ionos', absender_email: 'praxis@example.invalid', absender_name: 'Neu' })).status, 200);
  assert.equal(db.t.praxis_mailversand[0].smtp_passwort, alt);
  assert.equal((await call('PUT', '/mailversand', { preset: 'strato', absender_email: 'praxis@example.invalid' })).status, 400);
});

test('Falsches Passwort (T-Online): gespeichert als unterbrochen, Anbieter-Hinweis', async () => {
  reset(); verifyFehler = 'EAUTH';
  const r = await call('PUT', '/mailversand', { preset: 'telekom', absender_email: 'p@t-online.invalid', passwort: 'falsch' });
  assert.equal(r.status, 200); assert.equal(r.body.verbunden, false); assert.equal(r.body.code, 'EAUTH');
  assert.match(r.body.hinweis, /E-Mail-Passwort/);
  assert.equal(db.t.praxis_mailversand[0].status, 'unterbrochen');
});

test('Testmail geht an die Inhaber-Adresse, nie an eine Adresse aus der Anfrage', async () => {
  reset();
  await call('PUT', '/mailversand', { preset: 'gmx', absender_email: 'praxis@gmx.invalid', passwort: 'pw' });
  const r = await call('POST', '/mailversand/test', { an: 'fremd@example.invalid' });
  assert.equal(r.status, 200); assert.equal(gesendet.length, 1);
  assert.equal(gesendet[0].to, 'inhaber@example.invalid'); assert.equal(gesendet[0].from, '"Praxis Test" <praxis@gmx.invalid>');
  assert.equal(db.t.praxis_mailversand[0].letzter_test_ok, true);
  assert.equal((await call('POST', '/mailversand/test')).status, 429, 'Drossel 10 s');
});

test('Drossel gilt ueber Prozesse hinweg (2 Worker): zweiter Router mit eigenem Speicher bekommt 429', async () => {
  reset();
  await call('PUT', '/mailversand', { preset: 'gmx', absender_email: 'praxis@gmx.invalid', passwort: 'pw' });
  // zwei "Worker": je eigener Router = eigener Speicher, gleiche Datenbank
  const worker = async () => {
    const app2 = express(); app2.use(express.json());
    const auth = (req, _res, next) => { req.auth = { userId: OWNER, tenantId: OWNER, role: 'owner' }; next(); };
    app2.use('/api', createMailversandRouter({ supabase: db, auth, owner: (q, r, n) => n(), kutu: () => true, env: {},
      transportFabrik: () => ({ async verify() {}, async sendMail(m) { gesendet.push(m); } }) }));
    const s = app2.listen(0, '127.0.0.1'); await new Promise(r => s.once('listening', r)); return s;
  };
  const s1 = await worker(); const s2 = await worker();
  try {
    db.t.claimFehler = true;
    const fehler = await fetch(`http://127.0.0.1:${s1.address().port}/api/mailversand/test`, { method: 'POST' });
    assert.equal(fehler.status, 503, 'DB-Sperre nicht verfügbar: kein Versand');
    assert.equal(gesendet.length, 0);
    db.t.claimFehler = false;
    assert.equal((await fetch(`http://127.0.0.1:${s1.address().port}/api/mailversand/test`, { method: 'POST' })).status, 200);
    const r2 = await fetch(`http://127.0.0.1:${s2.address().port}/api/mailversand/test`, { method: 'POST' });
    assert.equal(r2.status, 429, 'anderer Prozess sieht den Anspruch in der DB');
    assert.equal(gesendet.length, 1, 'nur eine Testmail');
    db.t.praxis_mailversand[0].letzter_test_at = new Date(Date.now() - 11_000).toISOString();
    const r3 = await fetch(`http://127.0.0.1:${s2.address().port}/api/mailversand/test`, { method: 'POST' });
    assert.equal(r3.status, 200, 'nach 10 s wieder frei');
  } finally { db.t.claimFehler = false; s1.close(); s2.close(); }
});

test('Testmail ohne Postfach: 409 mit Code', async () => {
  reset();
  const r = await call('POST', '/mailversand/test');
  assert.equal(r.status, 409); assert.equal(r.body.code, 'VERSAND_NICHT_EINGERICHTET');
});

test('Trennen loescht Passwort; ?gmail=1 nur im SaaS', async () => {
  reset();
  await call('PUT', '/mailversand', { preset: 'ionos', absender_email: 'praxis@example.invalid', passwort: 'pw' });
  assert.equal((await call('DELETE', '/mailversand?gmail=1')).status, 200);
  const z = db.t.praxis_mailversand[0];
  assert.equal(z.modus, 'aus'); assert.equal(z.smtp_passwort, null);
  assert.equal(db.rpcs.length, 0, 'Box: kein Gmail');
  reset({ kutu: false });
  await call('DELETE', '/mailversand?gmail=1');
  assert.deepEqual(db.rpcs, ['clear_gmail_token']);
});

test('Ohne DATA_ENCRYPTION_KEY: 503, nichts gespeichert', async () => {
  reset();
  const alt = process.env.DATA_ENCRYPTION_KEY; delete process.env.DATA_ENCRYPTION_KEY;
  try {
    const r = await call('PUT', '/mailversand', { preset: 'ionos', absender_email: 'praxis@example.invalid', passwort: 'pw' });
    assert.equal(r.status, 503); assert.equal(r.body.code, 'VERSCHLUESSELUNG_FEHLT');
    assert.equal(db.t.praxis_mailversand.length, 0);
  } finally { process.env.DATA_ENCRYPTION_KEY = alt; }
});

test('pruefeMailEingabe: Andere verlangt Host/Port/Verschluesselung, keine Header-Injection', () => {
  assert.ok(pruefeMailEingabe({ preset: 'andere', absender_email: 'a@b.de' }).fehler);
  assert.ok(pruefeMailEingabe({ preset: 'andere', absender_email: 'a@b.de', smtp_host: 'mail.b.de', smtp_port: 99999, smtp_sicherheit: 'ssl' }).fehler);
  assert.ok(pruefeMailEingabe({ preset: 'andere', absender_email: 'a@b.de', smtp_host: 'mail.b.de', smtp_port: 22, smtp_sicherheit: 'ssl' }).fehler, 'nur Mail-Ports');
  assert.ok(pruefeMailEingabe({ preset: 'andere', absender_email: 'a@b.de', smtp_host: '10.0.0.5', smtp_port: 587, smtp_sicherheit: 'starttls' }).fehler, 'keine IP-Literale');
  const p465 = { preset: 'andere', absender_email: 'a@b.de', smtp_host: 'mail.b.de', smtp_port: 465, smtp_sicherheit: 'ssl' };
  assert.match(pruefeMailEingabe(p465, { kutu: false }).fehler, /587/, 'SaaS: 465 gesperrt, Hinweis auf 587');
  assert.ok(pruefeMailEingabe({ ...p465, smtp_port: 25 }, { kutu: false }).fehler, 'SaaS: 25 gesperrt');
  assert.ok(pruefeMailEingabe(p465, { kutu: true }).werte, 'Box: 465 erlaubt');
  assert.ok(pruefeMailEingabe({ ...p465, smtp_port: 587, smtp_sicherheit: 'starttls' }, { kutu: false }).werte, 'SaaS: 587 erlaubt');
  const ok = pruefeMailEingabe({ preset: 'andere', absender_email: 'a@b.de', smtp_host: 'Mail.B.de', smtp_port: '587', smtp_sicherheit: 'starttls', absender_name: 'X\r\nBcc: y' }).werte;
  assert.equal(ok.smtp_host, 'mail.b.de'); assert.equal(ok.smtp_port, 587); assert.equal(ok.absender_name, 'XBcc: y');
  assert.ok(pruefeMailEingabe({ preset: 'quatsch', absender_email: 'a@b.de' }).fehler);
  assert.ok(pruefeMailEingabe({ preset: 'ionos', absender_email: 'a@b.de\nBcc: c@d.de' }).fehler);
});

test('Tabelle noch nicht angewandt: GET verfuegbar=false, PUT 503', async () => {
  reset();
  const echt = db.from.bind(db);
  db.from = (name) => (name === 'praxis_mailversand'
    ? { select() { return this; }, eq() { return this; }, limit() { return this; },
        maybeSingle: async () => ({ data: null, error: { code: '42P01' } }), then(ok) { return Promise.resolve({ data: null, error: { code: '42P01' } }).then(ok); } }
    : echt(name));
  try {
    const g = await call('GET', '/mailversand');
    assert.equal(g.status, 200); assert.equal(g.body.verfuegbar, false);
    const p = await call('PUT', '/mailversand', { preset: 'ionos', absender_email: 'praxis@example.invalid', passwort: 'pw' });
    assert.equal(p.status, 503); assert.equal(p.body.code, 'NOCH_NICHT_VERFUEGBAR');
  } finally { db.from = echt; }
});

test('SSRF (O-244 Auflage 1): SaaS lehnt intern aufloesende Hosts ab, Box erlaubt Praxisnetz', async () => {
  for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.20.0.1', '192.168.1.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) assert.equal(istInterneAdresse(ip), true, ip);
  for (const ip of ['203.0.113.7', '8.8.8.8', '2a00:1450::1']) assert.equal(istInterneAdresse(ip), false, ip);
  const body = { preset: 'andere', absender_email: 'p@example.invalid', passwort: 'pw', smtp_host: 'intern.example.invalid', smtp_port: 587, smtp_sicherheit: 'starttls' };
  reset({ kutu: false });
  assert.equal((await call('PUT', '/mailversand', body)).status, 400);
  assert.equal(db.t.praxis_mailversand.length, 0);
  reset({ kutu: true });
  assert.equal((await call('PUT', '/mailversand', body)).status, 200, 'Box: Mailserver im Praxisnetz erlaubt');
});

test('Review 09.11.: verify/Testmail immer mit requireTLS', async () => {
  reset(); optionen.length = 0;
  await call('PUT', '/mailversand', { preset: 'gmx', absender_email: 'praxis@gmx.invalid', passwort: 'pw' });
  await new Promise(r => setTimeout(r, 0));
  assert.ok(optionen.length >= 1 && optionen.every(o => o.requireTLS === true && o.host === 'mail.gmx.net'));
});

test('Review 09.11.: gespeichertes, unlesbares Passwort behalten → 400 statt falschem „verbunden"', async () => {
  reset();
  db.t.praxis_mailversand.push({ owner_id: OWNER, modus: 'smtp', preset: 'ionos', smtp_host: 'smtp.ionos.de', smtp_port: 465, smtp_sicherheit: 'ssl',
    smtp_benutzer: 'praxis@example.invalid', smtp_passwort: '\\x00ff', absender_email: 'praxis@example.invalid', status: 'verbunden' });
  const g = await call('GET', '/mailversand');
  assert.equal(g.body.einstellung.status, 'unterbrochen'); assert.equal(g.body.fehler.code, 'PASSWORT_NICHT_LESBAR');
  const r = await call('PUT', '/mailversand', { preset: 'ionos', absender_email: 'praxis@example.invalid' });
  assert.equal(r.status, 400); assert.equal(r.body.code, 'PASSWORT_NICHT_LESBAR');
  const neu = await call('PUT', '/mailversand', { preset: 'ionos', absender_email: 'praxis@example.invalid', passwort: 'neu' });
  assert.equal(neu.status, 200); assert.equal(neu.body.verbunden, true);
});

test('Review 09.11.: SSRF — IP festgenagelt mit tls.servername, Hex-Form erkannt', async () => {
  assert.equal(istInterneAdresse('::ffff:7f00:1'), true);
  assert.equal(istInterneAdresse('::ffff:cb00:7107'), false);
  const smtp = { host: 'mail.b.invalid', port: 587, secure: false, user: 'u', pass: 'p' };
  const lookup = async () => [{ address: '203.0.113.9' }];
  const z = await pruefZiel(smtp, { preset: 'andere', kutu: false, lookup });
  assert.equal(z.host, '203.0.113.9'); assert.equal(z.tls.servername, 'mail.b.invalid'); assert.equal(z.requireTLS, true);
  assert.equal(await pruefZiel(smtp, { preset: 'andere', kutu: false, lookup: async () => [{ address: '10.0.0.1' }] }), null);
  assert.equal((await pruefZiel(smtp, { preset: 'andere', kutu: true, lookup: async () => [{ address: '10.0.0.1' }] })).host, 'mail.b.invalid', 'Box: Praxisnetz erlaubt');
  assert.equal((await pruefZiel(smtp, { preset: 'ionos', kutu: false, lookup })).host, 'mail.b.invalid', 'Vorlagen nicht umgeschrieben');
});


test('Gmail-Auswahl im SaaS wird als DB-Quelle angezeigt, nicht als SMTP-Testziel', async () => {
  reset({ kutu: false });
  db.t.praxis_mailversand.push({ owner_id: OWNER, modus: 'gmail_oauth', preset: 'gmail', status: 'verbunden', absender_email: 'praxis@example.invalid' });
  const r = await call('GET', '/mailversand');
  assert.equal(r.status, 200);
  assert.equal(r.body.quelle, 'db');
  assert.equal(r.body.einstellung.modus, 'gmail_oauth');
  assert.equal(r.body.einstellung.passwortGespeichert, false);
  assert.equal((await call('POST', '/mailversand/test')).status, 409);
  assert.equal(gesendet.length, 0);
});
