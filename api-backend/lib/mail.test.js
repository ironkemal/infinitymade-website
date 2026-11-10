// lib/mail.js — EIN Selektor fuer Patientenmails (AUFTRAG-MAILVERSAND, 09.11.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATA_ENCRYPTION_KEY ||= 'b'.repeat(64);
const {
  speichereGmailMailversand, mailKanal, verschluesselePasswort, fehlerHinweis, SMTP_PRESETS, transportFabrikFuer, envSmtpAnzeige, meldeVerbindungsfehler,
} = await import('./mail.js');

const zeile = (extra = {}) => ({
  owner_id: 'o1', modus: 'smtp', preset: 'ionos', smtp_host: 'smtp.ionos.de', smtp_port: 465, smtp_sicherheit: 'ssl',
  smtp_benutzer: 'praxis@example.invalid', smtp_passwort: verschluesselePasswort('s3cret!'),
  absender_email: 'praxis@example.invalid', absender_name: 'Praxis Test', ...extra,
});

test('Reihenfolge: Einstellung der Praxis > SMTP_* > kein', async () => {
  const db = await mailKanal({ zeile: zeile(), env: { SMTP_HOST: 'smtp.env.invalid' }, kutu: true });
  assert.equal(db.weg, 'smtp'); assert.equal(db.quelle, 'db');
  assert.equal(db.smtp.host, 'smtp.ionos.de'); assert.equal(db.smtp.secure, true); assert.equal(db.smtp.pass, 's3cret!');
  assert.equal(db.from('Ignoriert'), '"Praxis Test" <praxis@example.invalid>');

  const env = await mailKanal({ zeile: null, env: { SMTP_HOST: 'smtp.env.invalid' }, kutu: true });
  assert.equal(env.weg, 'smtp'); assert.equal(env.quelle, 'env'); assert.equal(env.smtp, null);

  const kein = await mailKanal({ zeile: null, env: {}, kutu: true });
  assert.equal(kein.weg, 'kein');
  const aus = await mailKanal({ zeile: zeile({ modus: 'aus' }), env: {}, kutu: true });
  assert.equal(aus.weg, 'kein', 'getrenntes Postfach faellt auf SMTP_* bzw. kein zurueck');
});

test('SaaS ohne Einstellung: Verhalten wie vorher (Booking via SMTP_*, Dokument via Gmail, Erinnerung nie)', async () => {
  const env = { SMTP_HOST: 'smtp.praxura.invalid' };
  assert.equal((await mailKanal({ zeile: null, env, kutu: false, zweck: 'booking' })).weg, 'smtp');
  assert.equal((await mailKanal({ zeile: null, env: {}, kutu: false, zweck: 'booking' })).weg, 'kein');
  const dok = await mailKanal({ zeile: null, env, kutu: false, zweck: 'dokument' });
  assert.equal(dok.weg, 'gmail'); assert.equal(dok.quelle, 'saas_gmail');
  assert.equal((await mailKanal({ zeile: null, env, kutu: false, zweck: 'erinnerung' })).weg, 'kein');
  // Mit eigenem Postfach auch im SaaS das Postfach der Praxis — nie der Praxura-Server
  const eigen = await mailKanal({ zeile: zeile(), env, kutu: false, zweck: 'dokument' });
  assert.equal(eigen.weg, 'smtp'); assert.equal(eigen.quelle, 'db');
  assert.equal((await mailKanal({ zeile: { modus: 'gmail_oauth' }, env, kutu: false })).weg, 'gmail');
  assert.equal((await mailKanal({ zeile: { modus: 'gmail_oauth' }, env: {}, kutu: true })).weg, 'kein', 'Google-OAuth nie in der Box (O-08)');
});

test('Passwort: nie im JSON des Kanals, unlesbar -> kein Versand mit Code', async () => {
  const k = await mailKanal({ zeile: zeile(), env: {}, kutu: true });
  const json = JSON.stringify(k);
  assert.ok(!json.includes('s3cret'), 'Passwort darf nicht serialisiert werden');
  assert.ok(!json.includes('smtp.ionos.de'), 'Zugangsdaten nicht aufzaehlbar');
  const kaputt = await mailKanal({ zeile: zeile({ smtp_passwort: '\\x00ff' }), env: {}, kutu: true });
  assert.equal(kaputt.weg, 'kein'); assert.equal(kaputt.fehler, 'PASSWORT_NICHT_LESBAR');
  assert.match(verschluesselePasswort('x'), /^\\x[0-9a-f]+$/);
});

test('Tabelle fehlt / DB-Fehler: wie keine Einstellung', async () => {
  const supabase = { from() { return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: null, error: { code: '42P01' } }) }; } };
  const k = await mailKanal({ supabase, ownerId: 'o1', env: { SMTP_HOST: 'h' }, kutu: true });
  assert.equal(k.quelle, 'env');
  const wirft = { from() { throw new Error('netz'); } };
  assert.equal((await mailKanal({ supabase: wirft, ownerId: 'o1', env: {}, kutu: true })).weg, 'kein');
});

test('transportFabrikFuer setzt Zugangsdaten + requireTLS ein', async () => {
  const k = await mailKanal({ zeile: zeile(), env: {}, kutu: true });
  let o;
  transportFabrikFuer(k, (x) => { o = x; return {}; })({ requireTLS: true });
  assert.deepEqual(o, { host: 'smtp.ionos.de', port: 465, secure: true, user: 'praxis@example.invalid', pass: 's3cret!', requireTLS: true });
  transportFabrikFuer(await mailKanal({ zeile: null, env: { SMTP_HOST: 'h' }, kutu: true }), (x) => { o = x; return {}; })({ requireTLS: true });
  assert.deepEqual(o, { requireTLS: true });
});

test('fehlerHinweis: anbieterspezifisch nur bei Anmeldefehlern, nie Rohmeldung', () => {
  assert.match(fehlerHinweis('EAUTH', 'telekom').hinweis, /E-Mail-Passwort/);
  // Live 10.11.2026: T-Online beendet bei falschen Zugangsdaten mit EPROTOCOL statt EAUTH
  assert.match(fehlerHinweis('EPROTOCOL', 'telekom').meldung, /unerwartet beendet/);
  assert.match(fehlerHinweis('EPROTOCOL', 'telekom').hinweis, /E-Mail-Passwort/);
  assert.match(fehlerHinweis('EAUTH', 'gmx').hinweis, /POP3\/IMAP/);
  assert.match(fehlerHinweis('EAUTH', 'webde').hinweis, /POP3\/IMAP/);
  assert.match(fehlerHinweis('EAUTH', 'gmail').hinweis, /App-Passwort/);
  assert.equal(fehlerHinweis('EDNS', 'gmx').hinweis, null);
  assert.match(fehlerHinweis('EAUTH', 'ionos').meldung, /abgelehnt/);
  assert.equal(fehlerHinweis('QUATSCH').meldung, 'Unbekannter Fehler beim Mailversand.');
});

test('Vorlagen: feste Hosts, keine Praxura-Adresse; Env-Anzeige ohne Zugangsdaten', () => {
  for (const [k, v] of Object.entries(SMTP_PRESETS)) {
    if (k === 'andere') continue;
    assert.match(v.host, /^[a-z0-9.-]+$/);
    // Live 10.11.2026: ausgehend 465 auf dem SaaS-VPS gesperrt → alle Vorlagen 587/STARTTLS
    assert.equal(v.port, 587, `${k}: Port 587`); assert.equal(v.sicherheit, 'starttls', `${k}: STARTTLS`);
    assert.ok(!/praxura/.test(v.host));
  }
  assert.deepEqual(envSmtpAnzeige({ SMTP_HOST: 'h', SMTP_PORT: '465', SMTP_USER: 'u', SMTP_PASS: 'p' }), { host: 'h', port: 465, absender: null });
  assert.equal(envSmtpAnzeige({}), null);
});

test('meldeVerbindungsfehler: nur Praxis-Postfach + Verbindungscode', async () => {
  const updates = [];
  const supabase = { from() { return { update(w) { updates.push(w); return { eq: async () => ({}) }; } }; } };
  await meldeVerbindungsfehler(supabase, 'o1', { quelle: 'db' }, { code: 'EAUTH' });
  await meldeVerbindungsfehler(supabase, 'o1', { quelle: 'env' }, { code: 'EAUTH' });
  await meldeVerbindungsfehler(supabase, 'o1', { quelle: 'db' }, { code: 'EENVELOPE' });
  assert.equal(updates.length, 1); assert.equal(updates[0].status, 'unterbrochen'); assert.equal(updates[0].letzter_fehler_code, 'EAUTH');
});

test('Review 09.11.: unlesbares Passwort faellt auf SMTP_* zurueck (Fehler bleibt sichtbar); Gmail der Praxis nur fuer Dokumente', async () => {
  const k = await mailKanal({ zeile: zeile({ smtp_passwort: '\\x00ff' }), env: { SMTP_HOST: 'smtp.env.invalid' }, kutu: true });
  assert.equal(k.weg, 'smtp'); assert.equal(k.quelle, 'env'); assert.equal(k.fehler, 'PASSWORT_NICHT_LESBAR');
  const env = { SMTP_HOST: 'smtp.praxura.invalid' };
  assert.equal((await mailKanal({ zeile: { modus: 'gmail_oauth' }, env, kutu: false, zweck: 'booking' })).quelle, 'env');
  assert.equal((await mailKanal({ zeile: { modus: 'gmail_oauth' }, env, kutu: false, zweck: 'dokument' })).weg, 'gmail');
});


test('Gmail-Auswahl: Vault zuerst, SMTP-Geheimnisse löschen, Fehler verhindern Erfolg', async () => {
  const schritte = []; let rpcFehler = null; let dbFehler = null; let vorhanden = 'alter-synthetischer-token';
  const db = {
    async rpc(name, args) { schritte.push({ name, args }); return { data: vorhanden, error: rpcFehler }; },
    from(table) { return { async upsert(werte, opts) { schritte.push({ table, werte, opts }); return { error: dbFehler }; } }; },
  };
  const args = { supabase: db, ownerId: 'o1', email: 'praxis@example.invalid' };
  await speichereGmailMailversand({ ...args, refreshToken: 'neuer-synthetischer-token' }); // secret-scan: ignore — synthetic test fixture
  assert.equal(schritte[0].name, 'set_gmail_token');
  assert.equal(schritte[1].table, 'praxis_mailversand');
  assert.equal(schritte[1].werte.modus, 'gmail_oauth');
  assert.equal(schritte[1].werte.status, 'verbunden');
  assert.equal(schritte[1].werte.owner_id, 'o1');
  assert.equal(schritte[1].werte.smtp_passwort, null);
  assert.equal(schritte[1].werte.oauth_refresh_token, null);
  assert.ok(!JSON.stringify(schritte[1]).includes('synthetischer-token'));
  schritte.length = 0;
  await speichereGmailMailversand(args);
  assert.equal(schritte[0].name, 'get_gmail_token');
  schritte.length = 0; vorhanden = null;
  await assert.rejects(speichereGmailMailversand(args), e => e.code === 'GMAIL_TOKEN_FEHLT');
  assert.equal(schritte.length, 1, 'kein Moduswechsel ohne nutzbaren Token');
  rpcFehler = { code: 'VAULT_FEHLER' }; schritte.length = 0;
  await assert.rejects(speichereGmailMailversand({ ...args, refreshToken: 'x' }), e => e.code === 'VAULT_FEHLER');
  assert.equal(schritte.length, 1);
  rpcFehler = null; dbFehler = { code: 'DB_FEHLER' };
  await assert.rejects(speichereGmailMailversand({ ...args, refreshToken: 'x' }), e => e.code === 'DB_FEHLER');
});
