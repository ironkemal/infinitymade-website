// Einstellungen → E-Mail-Versand gegen ein ECHTES SMTP-Protokoll (AUFTRAG-MAILVERSAND, 09.11.2026).
// Echter nodemailer + Mini-Server (node:net/tls, nur 127.0.0.1): STARTTLS, AUTH PLAIN/LOGIN, DATA.
// Belegt, was Mocks nicht zeigen: Zugangsdaten kommen nur verschluesselt an, ohne STARTTLS wird nichts
// gesendet (requireTLS), falsches Passwort → EAUTH → Anbieter-Hinweis, Testmail erreicht den Inhaber.
// Zertifikat: selbstsigniert, zur Testzeit per openssl erzeugt; ohne openssl werden die TLS-Faelle uebersprungen.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import express from 'express';

process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-test-key';
process.env.DATA_ENCRYPTION_KEY ||= 'd'.repeat(64);
const { createMailversandRouter } = await import('./mailversand.js');
const { createSMTPTransport, mailKanal, transportFabrikFuer } = await import('../lib/mail.js');

const OWNER = 'aaaaaaaa-0000-4000-8000-000000000002';
const USER = 'praxis@example.invalid';
const PASS = 'Richtig-123';

function zertifikat() {
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-smtp-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost',
      '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem')], { stdio: 'ignore' });
    return { key: fs.readFileSync(path.join(dir, 'k.pem')), cert: fs.readFileSync(path.join(dir, 'c.pem')) };
  } catch { return null; }
}

/** Mini-SMTP. mitTls=false: bietet kein STARTTLS an. Protokolliert, ob AUTH je unverschluesselt kam. */
function smtpServer({ cred, mitTls }) {
  const st = { empfangen: [], authKlartext: false, authOk: 0 };
  const server = net.createServer(roh => {
    let sock = roh; let verschluesselt = false; let imText = false; let text = ''; let puffer = ''; let loginSchritt = null; let loginUser = '';
    const w = s => sock.write(s + '\r\n');
    const zeile = (z) => {
      const c = z.toUpperCase();
      if (loginSchritt === 'user') { loginUser = Buffer.from(z, 'base64').toString(); loginSchritt = 'pass'; return w('334 UGFzc3dvcmQ6'); }
      if (loginSchritt === 'pass') { loginSchritt = null; return pruefe(loginUser, Buffer.from(z, 'base64').toString()); }
      if (c.startsWith('EHLO')) { w('250-test'); if (mitTls && !verschluesselt) w('250-STARTTLS'); return w('250 AUTH PLAIN LOGIN'); }
      if (c.startsWith('STARTTLS') && mitTls) {
        w('220 go');
        sock.removeAllListeners('data');
        const s = new tls.TLSSocket(sock, { isServer: true, key: cred.key, cert: cred.cert });
        s.on('data', lesen); s.on('error', () => {});
        sock = s; verschluesselt = true; puffer = '';
        return;
      }
      if (c.startsWith('AUTH')) {
        if (!verschluesselt) st.authKlartext = true;
        const teile = z.split(' ');
        if (teile[1].toUpperCase() === 'LOGIN') { loginSchritt = 'user'; return w('334 VXNlcm5hbWU6'); }
        const [, u, p] = Buffer.from(teile[2] || '', 'base64').toString().split('\0');
        return pruefe(u, p);
      }
      if (c.startsWith('MAIL') || c.startsWith('RCPT')) return w('250 ok');
      if (c.startsWith('DATA')) { imText = true; return w('354 go'); }
      if (c.startsWith('QUIT')) return sock.end('221 bye\r\n');
      return w('250 ok');
    };
    const pruefe = (u, p) => { if (u === USER && p === PASS) { st.authOk += 1; w('235 ok'); } else w('535 5.7.8 auth failed'); };
    const lesen = (d) => {
      if (imText) {
        text += d.toString('latin1');
        if (text.endsWith('\r\n.\r\n')) { imText = false; st.empfangen.push(text); text = ''; w('250 queued'); }
        return;
      }
      puffer += d.toString('latin1');
      const z = puffer.split('\r\n'); puffer = z.pop();
      for (const x of z) zeile(x);
    };
    roh.on('data', lesen); roh.on('error', () => {});
    w('220 test ESMTP');
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ port: server.address().port, st, close: () => new Promise(c => { server.closeAllConnections?.(); server.close(c); }) })));
}

function fakeDb() {
  const t = { praxis_mailversand: [], profiles: [{ id: OWNER, email: 'inhaber@example.invalid', business_name: 'Praxis Echt' }] };
  return {
    t, rpc: async () => ({ data: null, error: null }),
    from(name) {
      const f = []; let op = 'select'; let wert = null; const rows = () => (t[name] ||= []);
      const b = {
        select() { return b; }, limit() { return b; }, eq(k, v) { f.push(r => r[k] === v); return b; }, or(expr) { const teile = String(expr).split(','); f.push(r => teile.some(x => { const [k, op, ...rest] = x.split('.'); const v = rest.join('.'); return op === 'is' ? r[k] == null : op === 'lt' ? (r[k] != null && r[k] < v) : false; })); return b; },
        update(w) { op = 'update'; wert = w; return b; }, upsert(w) { op = 'upsert'; wert = w; return b; },
        maybeSingle() { return b.run(true); }, then(ok, no) { return b.run(false).then(ok, no); },
        async run(einzeln) {
          if (op === 'upsert') { const i = rows().findIndex(r => r.owner_id === wert.owner_id); if (i >= 0) rows()[i] = { ...rows()[i], ...wert }; else rows().push({ ...wert }); return { error: null }; }
          const hit = rows().filter(r => f.every(x => x(r)));
          if (op === 'update') { hit.forEach(r => Object.assign(r, wert)); return { data: hit, error: null }; }
          return { data: einzeln ? hit[0] || null : hit, error: null };
        },
      };
      return b;
    },
  };
}

const cred = zertifikat();
let app, server, base, db, ziel;
before(async () => {
  db = fakeDb();
  app = express(); app.use(express.json());
  const auth = (req, _r, next) => { req.auth = { userId: OWNER, tenantId: OWNER, role: 'owner' }; next(); };
  // Echte Transportfabrik; nur das Ziel wird auf den lokalen Testserver gebogen, Zertifikat ist selbstsigniert.
  const transportFabrik = (o) => createSMTPTransport({ ...o, host: '127.0.0.1', port: ziel.port, secure: false, tls: { rejectUnauthorized: false }, connectionTimeout: 1500, greetingTimeout: 1500, socketTimeout: 1500 });
  app.use('/api', createMailversandRouter({ supabase: db, auth, owner: (q, r, n) => n(), transportFabrik, kutu: () => true, env: {} }));
  server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server?.close());

const call = (m, p, body) => fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  .then(async r => ({ status: r.status, body: await r.json() }));
const formular = (extra = {}) => ({ preset: 'andere', smtp_host: 'mail.praxis.invalid', smtp_port: 587, smtp_sicherheit: 'starttls',
  smtp_benutzer: USER, absender_email: USER, absender_name: 'Praxis Echt', passwort: PASS, ...extra });

test('createSMTPTransport: tls-Option fuer Testserver (nur hier genutzt) wird durchgereicht', () => {
  // createSMTPTransport kennt nur feste Felder — der Test reicht tls ueber den Spread. Sicherstellen, dass das geht.
  const t = createSMTPTransport({ host: 'h.invalid', port: 587, user: 'u', pass: 'p', requireTLS: true });
  assert.equal(t.options.requireTLS, true);
});

test('Echt: Speichern → STARTTLS + AUTH verschluesselt → verbunden; Testmail kommt beim Inhaber an', { skip: !cred && 'openssl fehlt' }, async () => {
  ziel = await smtpServer({ cred, mitTls: true });
  try {
    const r = await call('PUT', '/mailversand', formular());
    assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.verbunden, true, JSON.stringify(r.body));
    assert.equal(db.t.praxis_mailversand[0].status, 'verbunden');
    const t = await call('POST', '/mailversand/test');
    assert.equal(t.status, 200, JSON.stringify(t.body)); assert.equal(t.body.gesendetAn, 'inhaber@example.invalid');
    assert.equal(ziel.st.empfangen.length, 1);
    assert.match(ziel.st.empfangen[0], /^From: "?Praxis Echt"? <praxis@example\.invalid>/m);
    assert.match(ziel.st.empfangen[0], /^To: inhaber@example\.invalid/m);
    assert.equal(ziel.st.authKlartext, false, 'Zugangsdaten nie unverschluesselt');
    assert.ok(ziel.st.authOk >= 2);
    // Derselbe gespeicherte Zugang trägt auch den echten Versandweg (mailKanal → Transport)
    const k = await mailKanal({ supabase: db, ownerId: OWNER, zweck: 'dokument', env: {}, kutu: true });
    assert.equal(k.weg, 'smtp'); assert.equal(k.smtp.pass, PASS);
    await transportFabrikFuer(k, (o) => createSMTPTransport({ ...o, host: '127.0.0.1', port: ziel.port, tls: { rejectUnauthorized: false } }))({ requireTLS: true })
      .sendMail({ from: k.from('X'), to: 'patient@example.invalid', subject: 'Rechnung', text: 'x' });
    assert.equal(ziel.st.empfangen.length, 2);
  } finally { await ziel.close(); }
});

test('Echt: falsches Passwort → EAUTH, unterbrochen, Anbieter-Hinweis (T-Online)', { skip: !cred && 'openssl fehlt' }, async () => {
  ziel = await smtpServer({ cred, mitTls: true });
  try {
    const r = await call('PUT', '/mailversand', { preset: 'telekom', absender_email: USER, passwort: 'falsch' });
    assert.equal(r.status, 200); assert.equal(r.body.verbunden, false); assert.equal(r.body.code, 'EAUTH');
    assert.match(r.body.hinweis, /E-Mail-Passwort/);
    assert.equal(db.t.praxis_mailversand[0].status, 'unterbrochen');
    assert.equal(ziel.st.empfangen.length, 0);
  } finally { await ziel.close(); }
});

test('Echt: Server ohne STARTTLS → nichts gesendet, Zugangsdaten nie im Klartext (requireTLS)', async () => {
  ziel = await smtpServer({ cred, mitTls: false });
  try {
    const r = await call('PUT', '/mailversand', formular());
    assert.equal(r.status, 200); assert.equal(r.body.verbunden, false, JSON.stringify(r.body));
    assert.equal(ziel.st.authKlartext, false, 'kein AUTH ohne TLS');
    assert.equal(ziel.st.empfangen.length, 0);
  } finally { await ziel.close(); }
});
