#!/usr/bin/env node
// Box-nahe Abnahme der E-Mail-Versand-Funktion (AUFTRAG-MAILVERSAND) — lokal, ohne echtes Postfach und ohne echte Box.
// Startet stack.sh (Postgres + Storage + GoTrue + PostgREST, Migrationskette mit dem echten migrate.js), gateway.mjs, smtp-sink.mjs und den
// ECHTEN api-backend im Box-Modus (SUPABASE_PUBLIC_URL gesetzt), legt synthetische Konten/Daten an und prüft Ende zu Ende:
//   Einstellungen → E-Mail-Versand (Einrichten, falsches/richtiges Passwort, Testmail, Verschlüsselung in der DB, Drossel, Trennen),
//   Rechnung per Mail + Rechte (Mitarbeiter ohne/mit Modulrecht), Terminerinnerung (inkl. Doppelversand), Update-Alarm,
//   Transparenzseite, Rangfolge Praxis-Postfach > SMTP_* der Installation.
// Was es NICHT belegt: echte Anbieter (Gmail/IONOS/…), echtes Zertifikat (hier selbstsigniert, NODE_TLS_REJECT_UNAUTHORIZED=0 nur im Testprozess),
// echte Box-Installation (install.sh, Caddy, Kong), Netzwerk der Praxis. Voraussetzung: Docker + lokale Images (siehe stack.sh), openssl, node.
// Aufruf: node tools/box-abnahme-mail/abnahme.mjs        (ABN_KEEP=1 lässt den Stack zur Fehlersuche stehen)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import crypto from 'node:crypto'; import { fileURLToPath, pathToFileURL } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url)); const REPO = path.resolve(HIER, '../..'); const API_DIR = path.join(REPO, 'api-backend');
const BOX = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-box-abnahme-'));
const API_PORT = 3055; const SINK_PORT = 2525; const API = `http://127.0.0.1:${API_PORT}/api`;
const SCHLUESSEL = 'b'.repeat(64); const PASSWORT = 'Box-Test-12345'; const SINK_PASS = 'Praxis-Pass-1';
const kinder = []; let env; let keys;
let ok = 0; let fehl = 0;
const pr = (label, bed, extra = '') => { if (bed) ok += 1; else fehl += 1; console.log(`${bed ? '✓' : '✗'} ${label}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`); };
const warte = (ms) => new Promise(r => setTimeout(r, ms));

function aufraeumen() {
  for (const k of kinder) { try { k.kill(); } catch { /* schon beendet */ } }
  if (!process.env.ABN_KEEP) spawnSync('bash', [path.join(HIER, 'stack.sh'), 'down'], { stdio: 'ignore' });
  else console.log(`\nStack bleibt stehen (ABN_KEEP=1). Arbeitsordner: ${BOX}`);
}
process.on('exit', aufraeumen); process.on('SIGINT', () => process.exit(130));

const psql = (q) => execFileSync('docker', ['exec', 'praxura-abn-db', 'psql', '-U', 'supabase_admin', '-h', 'localhost', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
function jwt(role) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); const h = b({ alg: 'HS256', typ: 'JWT' });
  const p = b({ role, iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 * 30 });
  return `${h}.${p}.${crypto.createHmac('sha256', env.jwt).update(`${h}.${p}`).digest('base64url')}`;
}
const GW = () => `http://127.0.0.1:${env.pgw}`;
async function signup(email) {
  const r = await fetch(`${GW()}/auth/v1/signup`, { method: 'POST', headers: { apikey: keys.anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORT }) });
  const j = await r.json(); if (!j.user?.id) throw new Error('Signup fehlgeschlagen: ' + JSON.stringify(j).slice(0, 120)); return j.user.id;
}
async function login(email) {
  const r = await fetch(`${GW()}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: keys.anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORT }) });
  const j = await r.json(); if (!j.access_token) throw new Error('Login fehlgeschlagen ' + r.status); return j.access_token;
}
const call = async (tok, m, p, b) => {
  const r = await fetch(API + p, { method: m, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) });
  let j = null; try { j = await r.json(); } catch { /* kein JSON */ } return { s: r.status, j };
};
const mailDatei = () => fs.readdirSync(path.join(BOX, 'mails')).filter(f => f.endsWith('.eml')).sort();
const lies = (f) => fs.readFileSync(path.join(BOX, 'mails', f), 'latin1');

async function starteApi(smtpEnv = null) {
  for (const k of kinder.filter(x => x.__api)) { k.kill(); await warte(800); }
  const e = {
    PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production', PORT: String(API_PORT),
    SUPABASE_URL: GW(), SUPABASE_PUBLIC_URL: GW(), SUPABASE_SERVICE_ROLE_KEY: keys.service, DATA_ENCRYPTION_KEY: SCHLUESSEL,
    NODE_TLS_REJECT_UNAUTHORIZED: '0',
    ...(smtpEnv ? { SMTP_HOST: 'mail.localhost', SMTP_PORT: String(SINK_PORT), SMTP_USER: 'praxis@box.example.invalid', SMTP_PASS: SINK_PASS, SMTP_FROM: 'installation@box.example.invalid' } : {}),
  };
  const k = spawn('node', ['server.js'], { cwd: API_DIR, env: e, stdio: ['ignore', fs.openSync(path.join(BOX, 'api.log'), 'a'), fs.openSync(path.join(BOX, 'api.log'), 'a')] });
  k.__api = true; kinder.push(k);
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`${API}/krankenkassen`); if (r.ok) return; } catch { /* noch nicht bereit */ } await warte(500); }
  throw new Error('api-backend startet nicht, siehe ' + path.join(BOX, 'api.log'));
}
const skriptEnv = () => ({ PATH: process.env.PATH, HOME: process.env.HOME, SUPABASE_URL: GW(), SUPABASE_PUBLIC_URL: GW(), SUPABASE_SERVICE_ROLE_KEY: keys.service, DATA_ENCRYPTION_KEY: SCHLUESSEL, NODE_TLS_REJECT_UNAUTHORIZED: '0' });

// ── Aufbau ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
console.log(`Arbeitsordner: ${BOX}\n== Stack (kann einige Minuten dauern)`);
const up = spawnSync('bash', [path.join(HIER, 'stack.sh'), 'up', BOX], { stdio: 'inherit' });
if (up.status !== 0) { console.error('Stack konnte nicht gestartet werden (Docker/Images?)'); process.exit(2); }
env = JSON.parse(fs.readFileSync(path.join(BOX, 'env.json'), 'utf8')); keys = { anon: jwt('anon'), service: jwt('service_role') };
for (const [skript, args] of [['gateway.mjs', [env.prest, env.pauth, env.pgw]], ['smtp-sink.mjs', [SINK_PORT, BOX]]]) {
  const k = spawn('node', [path.join(HIER, skript), ...args.map(String)], { stdio: 'ignore' }); kinder.push(k);
}
await warte(2500);

console.log('\n== Testdaten (synthetisch)');
const ownerId = await signup('owner@box.example.invalid'); await signup('employee@box.example.invalid');
psql(`update public.profiles set role='owner', business_name='Praxis Box-Test', owner_first_name='Erika', owner_last_name='Muster', sector='podologie', plan_status='active' where email='owner@box.example.invalid'`);
psql(`update public.profiles set role='employee', is_active=true, owner_id=(select id from public.profiles where email='owner@box.example.invalid') where email='employee@box.example.invalid'`);
psql(`insert into public.businesses (owner_id, business_name) select id, 'Praxis Box-Test' from public.profiles where email='owner@box.example.invalid'`);
psql(`insert into public.employee_business_assignments(employee_id, business_id, group_id) select e.id, b.id, g.id from public.profiles e, public.businesses b, public.employee_groups g where e.email='employee@box.example.invalid' and g.business_id=b.id and g.name='Mitarbeiter'`);
psql(`insert into public.leads (owner_id, first_name, last_name, title, email) select id, 'Max', 'Mustermann', 'Max Mustermann', 'patient@box.example.invalid' from public.profiles where email='owner@box.example.invalid'`);
psql(`insert into public.invoices (owner_id, business_id, patient_id, patient_name, total_patient, status, invoice_type, line_items, subtotal) select o.id, b.id, l.id, 'Max Mustermann', 36.10, 'draft', 'privat', '[{"beschreibung":"Podologische Behandlung (klein)","menge":1,"preis":36.10}]'::jsonb, 36.10 from public.profiles o, public.businesses b, public.leads l where o.email='owner@box.example.invalid' and b.owner_id=o.id and l.owner_id=o.id`);
psql(`update public.invoices set status='sent', issued_at=now() where patient_name='Max Mustermann'`);
const text = 'Datenschutz-Einwilligung\n[X] Terminerinnerungen und Terminänderungen per E-Mail (unverschlüsselt, ohne Behandlungsangaben): JA';
psql(`insert into public.patient_consents (owner_id, patient_id, consent_type, text_version, text_snapshot, text_sha256, consented_at) select o.id, l.id, 'datenschutz', 'datenschutz-v6-2026-11-05', $abn$${text}$abn$, '${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}', now() from public.profiles o, public.leads l where o.email='owner@box.example.invalid' and l.owner_id=o.id`);
psql(`insert into public.bookings (owner_id, user_id, business_id, lead_id, customer_name, start_time, end_time, status, created_at) select o.id, o.id, b.id, l.id, 'Max Mustermann', (((now() at time zone 'Europe/Berlin')::date + 1)::timestamp + time '09:00') at time zone 'Europe/Berlin', (((now() at time zone 'Europe/Berlin')::date + 1)::timestamp + time '09:30') at time zone 'Europe/Berlin', 'confirmed', now() - interval '2 days' from public.profiles o, public.businesses b, public.leads l where o.email='owner@box.example.invalid' and b.owner_id=o.id and l.owner_id=o.id`);
psql(`update public.profiles set terminerinnerung_aktiv=true where email='owner@box.example.invalid'`);
psql(`update public.praxura_setup set token_sha256=repeat('0',64), verbraucht_am=now(), owner_user_id='${ownerId}', abgeschlossen_am=now() where id=1`);
const rechnungId = psql(`select id from public.invoices where patient_name='Max Mustermann'`);

// ── Phase A: Box OHNE SMTP_* der Installation ──────────────────────────────────────────────────────────────────────────────
console.log('\n== A) Einstellungen → E-Mail-Versand (Box ohne SMTP_* der Installation)');
await starteApi(false);
const tok = await login('owner@box.example.invalid'); const emp = await login('employee@box.example.invalid');
let g = await call(tok, 'GET', '/mailversand');
pr('GET ohne Postfach: Box, keine Quelle', g.s === 200 && g.j.kutu === true && g.j.quelle === null, `kutu=${g.j?.kutu} quelle=${g.j?.quelle}`);
let t = await call(tok, 'POST', '/mailversand/test');
pr('Testmail ohne Postfach → 409 VERSAND_NICHT_EINGERICHTET', t.s === 409 && t.j?.code === 'VERSAND_NICHT_EINGERICHTET', `${t.s} ${t.j?.code}`);
pr('Mitarbeiter: 403', (await call(emp, 'GET', '/mailversand')).s === 403);
let p = await call(tok, 'PUT', '/mailversand', { preset: 'andere', smtp_host: '127.0.0.1', smtp_port: SINK_PORT, smtp_sicherheit: 'starttls', absender_email: 'praxis@box.example.invalid', passwort: 'x' });
pr('IP-Adresse statt Servername wird abgelehnt (auch auf der Box)', p.s === 400 && /Servernamen/.test(p.j?.error || ''), `${p.s} ${p.j?.error}`);
const form = { preset: 'andere', smtp_host: 'mail.localhost', smtp_port: SINK_PORT, smtp_sicherheit: 'starttls', smtp_benutzer: 'praxis@box.example.invalid', absender_email: 'praxis@box.example.invalid', absender_name: 'Praxis Box-Test' };
p = await call(tok, 'PUT', '/mailversand', { ...form, passwort: 'falsches-Passwort' });
pr('Falsches Passwort → unterbrochen (EAUTH)', p.s === 200 && p.j.verbunden === false && p.j.code === 'EAUTH', `${p.s} ${p.j?.code || p.j?.error}`);
g = await call(tok, 'GET', '/mailversand'); pr('Status „unterbrochen“ gespeichert', g.j?.einstellung?.status === 'unterbrochen', g.j?.einstellung?.status);
p = await call(tok, 'PUT', '/mailversand', { ...form, passwort: SINK_PASS });
pr('Richtiges Passwort → verbunden (STARTTLS)', p.s === 200 && p.j.verbunden === true, `${p.s} ${p.j?.code || p.j?.error || ''}`);
g = await call(tok, 'GET', '/mailversand');
pr('GET: verbunden, Quelle db, Passwort nicht im JSON', g.j?.einstellung?.status === 'verbunden' && g.j?.quelle === 'db' && !JSON.stringify(g.j).includes(SINK_PASS), `${g.j?.einstellung?.status} ${g.j?.quelle}`);
const roh = psql(`select octet_length(smtp_passwort), position('${SINK_PASS}' in encode(smtp_passwort,'escape')) from public.praxis_mailversand`).split('|');
pr('Datenbank: Passwort verschlüsselt (kein Klartext)', Number(roh[0]) > 28 && Number(roh[1]) === 0, roh.join(' / '));
let vor = mailDatei().length;
t = await call(tok, 'POST', '/mailversand/test');
pr('Testmail → 200 an die Inhaber-Adresse', t.s === 200 && t.j?.gesendetAn === 'owner@box.example.invalid', `${t.s} ${JSON.stringify(t.j)}`);
let neu = mailDatei().slice(vor); let m = neu[0] ? lies(neu[0]) : '';
pr('Mail beim Empfänger: Absender der Praxis, Empfänger, Betreff', /^From: "?Praxis Box-Test"? <praxis@box\.example\.invalid>/m.test(m) && /^To: owner@box\.example\.invalid/m.test(m) && /Testmail/.test(m), neu.join(','));
const sink = () => fs.readFileSync(path.join(BOX, 'sink.log'), 'utf8');
pr('Zugangsdaten nur nach STARTTLS übertragen', !/AUTH KLARTEXT/.test(sink()) && /AUTH ok verschl=true/.test(sink()));
pr('Zweite Testmail sofort → 429 (Drossel)', (await call(tok, 'POST', '/mailversand/test')).s === 429);
const u = await call(tok, 'GET', '/ueber/verbindungen');
pr('Transparenzseite nennt das Postfach (Host:Port), kein Passwort', u.s === 200 && /mail\.localhost:2525/.test(JSON.stringify(u.j)) && !JSON.stringify(u.j).includes(SINK_PASS), `${u.s}`);

console.log('\n== B) Rechnung per Mail und Rechte');
let r = await call(tok, 'POST', '/dokument/rechnung', { aktion: 'vorschau', invoice_id: rechnungId });
pr('Inhaber: Rechnungsvorschau (PDF)', r.s === 200 && !!r.j?.pdf_base64, String(r.s));
vor = mailDatei().length;
r = await call(tok, 'POST', '/dokument/rechnung', { aktion: 'mail', invoice_id: rechnungId, an_email: 'patient@box.example.invalid' });
pr('Inhaber: Rechnung per Mail → gesendet über SMTP', r.s === 200 && r.j?.gesendet === true && r.j?.weg === 'smtp', `${r.s} ${JSON.stringify({ ...r.j, passwort: r.j?.passwort ? '***' : undefined })}`);
neu = mailDatei().slice(vor); m = neu[0] ? lies(neu[0]) : '';
pr('Patient: Mail mit PDF-Anhang, Absender der Praxis, keine Praxura-Adresse', /^To: patient@box\.example\.invalid/m.test(m) && /^From: "?Praxis Box-Test"? <praxis@box\.example\.invalid>/m.test(m) && /Content-Disposition: attachment/i.test(m) && !/noreply@praxura\.de/i.test(m), neu.join(','));
r = await call(emp, 'POST', '/dokument/rechnung', { aktion: 'vorschau', invoice_id: rechnungId });
pr('Mitarbeiter OHNE Modulrecht „abrechnung“ → 403 KEINE_BERECHTIGUNG', r.s === 403 && r.j?.code === 'KEINE_BERECHTIGUNG', `${r.s} ${r.j?.code}`);
psql(`insert into public.group_scopes(group_id, module, has_access) select g.id, 'abrechnung', true from public.employee_groups g where g.name='Mitarbeiter' on conflict do nothing`);
r = await call(emp, 'POST', '/dokument/rechnung', { aktion: 'vorschau', invoice_id: rechnungId });
pr('Mitarbeiter MIT Modulrecht → Vorschau 200', r.s === 200, String(r.s));

console.log('\n== C) Terminerinnerung und Update-Alarm');
const lauf = path.join(BOX, 'erinnerung-lauf.mjs');
fs.writeFileSync(lauf, `import { pathToFileURL } from 'node:url';
const { createClient } = await import(pathToFileURL(${JSON.stringify(path.join(API_DIR, 'node_modules/@supabase/supabase-js/dist/index.mjs'))}).href);
const { erinnerungsLauf } = await import(pathToFileURL(${JSON.stringify(path.join(API_DIR, 'lib/terminerinnerung-job.js'))}).href);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const heute = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
const r = await erinnerungsLauf(supabase, { jetzt: new Date(heute + 'T19:00:00+01:00'), env: {}, kutu: true, log: { log() {}, error: (...a) => console.error(...a) } });
console.log(JSON.stringify(r));
`);
const erinnerung = () => { const x = spawnSync('node', [lauf], { cwd: API_DIR, env: skriptEnv(), encoding: 'utf8' }); try { return JSON.parse(x.stdout.trim().split('\n').pop()); } catch { return { fehlerausgabe: (x.stderr || '').slice(-300) }; } };
vor = mailDatei().length; const e1 = erinnerung();
pr('Erinnerungslauf (19:00 Berlin): 1 Mail gesendet', e1.gesendet === 1 && e1.fehler === 0, JSON.stringify(e1));
neu = mailDatei().slice(vor); m = neu[0] ? lies(neu[0]) : '';
pr('Erinnerung beim Patienten: Absender der Praxis, Termin morgen 09:00', /^To: patient@box\.example\.invalid/m.test(m) && /^From: "?Praxis Box-Test"? <praxis@box\.example\.invalid>/m.test(m) && /09:00 Uhr/.test(Buffer.from(m.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1').toString('utf8')), neu.join(','));
pr('Protokollzeile „gesendet“ (Doppelversand-Schutz)', psql(`select status from public.termin_mitteilungen where anlass='erinnerung_vortag'`) === 'gesendet');
vor = mailDatei().length; const e2 = erinnerung();
pr('Zweiter Lauf sendet nichts doppelt', e2.gesendet === 0 && mailDatei().length === vor, JSON.stringify(e2));
vor = mailDatei().length;
const alarm = spawnSync('node', ['setup/update-alarm-mail.mjs', 'konflikt', 'owner@box.example.invalid', 'Praxis Box-Test'], { cwd: API_DIR, env: skriptEnv(), encoding: 'utf8' });
neu = mailDatei().slice(vor);
pr('Update-Alarm: Exit 0, Mail an den Inhaber über das Praxis-Postfach (aus der DB)', alarm.status === 0 && neu.length === 1 && /^To: owner@box\.example\.invalid/m.test(lies(neu[0])) && /^From: "?Praxis Box-Test"? <praxis@box\.example\.invalid>/m.test(lies(neu[0])), `exit=${alarm.status} mails=${neu.length}`);

console.log('\n== D) Rangfolge: Praxis-Postfach > SMTP_* der Installation');
await starteApi(true);
const tok2 = await login('owner@box.example.invalid');
g = await call(tok2, 'GET', '/mailversand');
pr('Einstellung UND Installation vorhanden → Quelle ist die Einstellung', g.j?.quelle === 'db' && g.j?.env?.host === 'mail.localhost', `quelle=${g.j?.quelle} env=${JSON.stringify(g.j?.env)}`);
pr('Trennen → 200', (await call(tok2, 'DELETE', '/mailversand')).s === 200);
g = await call(tok2, 'GET', '/mailversand');
pr('Nach Trennen: Quelle Installation (env), kein Passwort sichtbar', g.j?.quelle === 'env' && !JSON.stringify(g.j).includes(SINK_PASS), `quelle=${g.j?.quelle}`);
vor = mailDatei().length; t = await call(tok2, 'POST', '/mailversand/test');
pr('Testmail über die Installation → 200', t.s === 200, `${t.s}`);
neu = mailDatei().slice(vor); m = neu[0] ? lies(neu[0]) : '';
pr('Absender stammt aus SMTP_FROM der Installation', /^From: .*installation@box\.example\.invalid/m.test(m), (m.match(/^From:.*$/m) || [''])[0]);
const nach = psql(`select modus, smtp_passwort is null from public.praxis_mailversand`);
pr('Nach Trennen: Modus „aus“, Passwort in der Datenbank gelöscht', nach === 'aus|t', nach);

console.log(`\nErgebnis: ${ok} bestanden, ${fehl} fehlgeschlagen`);
process.exit(fehl ? 1 : 0);
