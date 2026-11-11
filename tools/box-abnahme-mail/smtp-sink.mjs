// Lokaler SMTP-Empfänger (nur ::1): STARTTLS (selbstsigniertes Zertifikat, per openssl erzeugt), AUTH PLAIN/LOGIN gegen feste Testdaten,
// speichert jede Mail als .eml. Args: <port> <ausgabeordner>. Protokoll: sink.log im Ausgabeordner.
import net from 'node:net'; import tls from 'node:tls'; import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const PORT = Number(process.argv[2] || 2525); const OUT = path.resolve(process.argv[3] || '.');
const USER = 'praxis@box.example.invalid'; const PASS = 'Praxis-Pass-1';
fs.mkdirSync(path.join(OUT, 'mails'), { recursive: true });
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-subj', '/CN=localhost', '-keyout', path.join(OUT, 'sink-key.pem'), '-out', path.join(OUT, 'sink-cert.pem')], { stdio: 'ignore' });
const cred = { key: fs.readFileSync(path.join(OUT, 'sink-key.pem')), cert: fs.readFileSync(path.join(OUT, 'sink-cert.pem')) };
let n = 0; const log = (...a) => fs.appendFileSync(path.join(OUT, 'sink.log'), a.join(' ') + '\n');
net.createServer((roh) => {
  let sock = roh; let verschl = false; let imText = false; let text = ''; let puffer = ''; let loginSchritt = null; let loginUser = ''; let authOk = false;
  const w = (s) => sock.write(s + '\r\n');
  const pruefe = (u, p) => { if (u === USER && p === PASS) { authOk = true; log('AUTH ok verschl=' + verschl); w('235 ok'); } else { log('AUTH FEHL'); w('535 5.7.8 auth failed'); } };
  const zeile = (z) => {
    const c = z.toUpperCase();
    if (loginSchritt === 'user') { loginUser = Buffer.from(z, 'base64').toString(); loginSchritt = 'pass'; return w('334 UGFzc3dvcmQ6'); }
    if (loginSchritt === 'pass') { loginSchritt = null; return pruefe(loginUser, Buffer.from(z, 'base64').toString()); }
    if (c.startsWith('EHLO')) { w('250-sink'); if (!verschl) w('250-STARTTLS'); return w('250 AUTH PLAIN LOGIN'); }
    if (c.startsWith('STARTTLS')) { w('220 go'); sock.removeAllListeners('data'); const s = new tls.TLSSocket(sock, { isServer: true, ...cred }); s.on('data', lesen); s.on('error', () => {}); sock = s; verschl = true; puffer = ''; return; }
    if (c.startsWith('AUTH')) { if (!verschl) log('AUTH KLARTEXT!'); const t = z.split(' '); if (t[1].toUpperCase() === 'LOGIN') { loginSchritt = 'user'; return w('334 VXNlcm5hbWU6'); } const [, u, p] = Buffer.from(t[2] || '', 'base64').toString().split('\0'); return pruefe(u, p); }
    if (c.startsWith('MAIL') || c.startsWith('RCPT')) return w(authOk ? '250 ok' : '530 5.7.0 Authentication required');
    if (c.startsWith('DATA')) { if (!authOk) return w('530 5.7.0 Authentication required'); imText = true; return w('354 go'); }
    if (c.startsWith('QUIT')) return sock.end('221 bye\r\n');
    return w('250 ok');
  };
  const lesen = (d) => {
    if (imText) { text += d.toString('latin1'); if (text.endsWith('\r\n.\r\n')) { imText = false; n += 1; fs.writeFileSync(path.join(OUT, 'mails', `${String(n).padStart(3, '0')}.eml`), text); log('MAIL gespeichert #' + n + ' verschl=' + verschl); text = ''; w('250 queued'); } return; }
    puffer += d.toString('latin1'); const z = puffer.split('\r\n'); puffer = z.pop(); for (const x of z) zeile(x);
  };
  roh.on('data', lesen); roh.on('error', () => {}); w('220 sink ESMTP');
}).listen(PORT, '::1', () => console.log('smtp-sink auf ' + PORT));
