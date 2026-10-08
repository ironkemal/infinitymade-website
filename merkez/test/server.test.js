import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { starte, post } from './helper.js';
import { hashCode, formatSetupCode, FORMAT_KUTU } from '../../api-backend/routes/mitarbeiter-zugang-code.js';
import { erzeugeKimlik, ladeKimlik } from '../../api-backend/merkez-istemci/kimlik.js';
import { merkezFetch } from '../../api-backend/merkez-istemci/merkez-fetch.js';
import { kayitAusfuehren } from '../../api-backend/merkez-istemci/kayit.js';
import { signiereAnfrage } from '../../api-backend/merkez-istemci/signatur.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'merkez-'));

// Box-Seite gegen echten Merkez-Server: kompletter Registrierungsablauf
async function registriere(s, { code = s.neuerCode() } = {}) {
  const kimlikDir = tmp(); const acmednsDir = tmp();
  const erg = await kayitAusfuehren({ code: formatSetupCode(code, FORMAT_KUTU), auto: true, kimlikDir, acmednsDir, baseUrl: s.basis });
  const kimlik = ladeKimlik({ dir: kimlikDir });
  return { code, kimlikDir, acmednsDir, kimlik, ...erg };
}
const signiert = (s, kimlik, pfad, body, opt = {}) => merkezFetch(pfad, { kimlik, baseUrl: s.basis, body, ...opt });

test('Vollablauf: Code → Vorschlag → Register → DNS-Einträge + Dateien auf der Box', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    assert.match(r.name, /^[a-z]+-[a-z]+-[1-9][0-9]?$/);
    assert.equal(r.fqdn, `${r.name}.box.example.org`);
    assert.equal(r.kimlik.ad, r.name);
    // DNS: Challenge-CNAME + CAA am Box-Namen, KEIN Apex-CAA
    assert.match(s.cloudflare.rec.get(`CNAME|_acme-challenge.${r.fqdn}`).ziel, /\.auth\.acme\.example\.org$/);
    assert.equal(s.cloudflare.rec.get(`CNAME|_acme-challenge.${r.fqdn}`).ttl, 600, "CNAME liest nur LE: TTL bleibt kurz");
    assert.deepEqual(s.cloudflare.rec.get(`CAA|${r.fqdn}`), { uri: null });
    assert.ok(![...s.cloudflare.rec.keys()].some((k) => k === 'CAA|box.example.org'));
    // acme-dns-Datei auf der Box
    const a = JSON.parse(fs.readFileSync(r.acmednsDatei, 'utf8'))[r.fqdn];
    assert.equal(a.server_url, 'https://acme.example.org');
    assert.ok(a.username && a.password && a.fulldomain && a.subdomain);
    // Merkez speichert Code nur als Hash, Passwort gar nicht
    const dump = JSON.stringify(s.db.raw.prepare('SELECT * FROM codes').all()) + JSON.stringify(s.db.raw.prepare('SELECT * FROM boxes').all());
    assert.ok(!dump.includes(r.code));
    assert.ok(!dump.includes(a.password));
    assert.ok(dump.includes(hashCode(r.code, FORMAT_KUTU)));
  } finally { await s.stop(); }
});

test('Code ist einmalig: zweite Registrierung scheitert', async () => {
  const s = await starte();
  try {
    const code = s.neuerCode();
    await registriere(s, { code });
    await assert.rejects(registriere(s, { code }), /code/i);
  } finally { await s.stop(); }
});

test('Ungültiger / abgelaufener / unbekannter Code → 401 ohne Details', async () => {
  const s = await starte();
  try {
    assert.equal((await post(s.basis, '/v1/vorschlag', { code: 'XXXX-XXXX-XXXX-XXXX' })).status, 401);
    assert.equal((await post(s.basis, '/v1/vorschlag', { code: 12 })).status, 401);
    assert.equal((await post(s.basis, '/v1/vorschlag', '{kaputt')).status, 400);
    const code = s.neuerCode('kurulum', null, 14);
    s.uhr.ms += 15 * 86400_000;
    assert.equal((await post(s.basis, '/v1/vorschlag', { code })).status, 401);
  } finally { await s.stop(); }
});

test('Vorschlag: höchstens 20 pro Code, neuer Vorschlag verwirft den alten', async () => {
  const s = await starte({ config: { limitVorschlag: 1000 } });
  try {
    const code = s.neuerCode();
    const ersterName = (await post(s.basis, '/v1/vorschlag', { code })).json.name;
    for (let i = 1; i < 20; i++) assert.equal((await post(s.basis, '/v1/vorschlag', { code })).status, 200);
    assert.equal((await post(s.basis, '/v1/vorschlag', { code })).status, 429);
    // Der erste Name ist verworfen → Register damit scheitert
    const kimlik = erzeugeKimlik({ dir: tmp() });
    const body = JSON.stringify({ code, name: ersterName, public_key: kimlik.publicKeyBase64url });
    const sig = signiereAnfrage({ method: 'POST', url: s.basis + '/v1/register', body, kimlik });
    const r = await post(s.basis, '/v1/register', body, sig.headers);
    assert.equal(r.status, 409);
    assert.equal(r.json.fehler, 'name');
  } finally { await s.stop(); }
});

test('Reservierung läuft nach 10 Minuten ab', async () => {
  const s = await starte();
  try {
    const code = s.neuerCode();
    const { name } = (await post(s.basis, '/v1/vorschlag', { code })).json;
    s.uhr.ms += 601_000;
    const kimlik = erzeugeKimlik({ dir: tmp() });
    const body = JSON.stringify({ code, name, public_key: kimlik.publicKeyBase64url });
    const sig = signiereAnfrage({ method: 'POST', url: s.basis + '/v1/register', body, kimlik, jetzt: s.uhr.ms });
    assert.equal((await post(s.basis, '/v1/register', body, sig.headers)).status, 409);
  } finally { await s.stop(); }
});

test('Register ohne gültige Signatur des NEUEN Schlüssels → 401 mit Serverzeit, Code bleibt nutzbar', async () => {
  const s = await starte();
  try {
    const code = s.neuerCode();
    const { name } = (await post(s.basis, '/v1/vorschlag', { code })).json;
    const kimlik = erzeugeKimlik({ dir: tmp() });
    const body = JSON.stringify({ code, name, public_key: kimlik.publicKeyBase64url });
    const r = await post(s.basis, '/v1/register', body); // keine Kopfzeilen
    assert.equal(r.status, 401);
    assert.equal(typeof r.json.serverzeit, 'number');
    // Signatur mit FREMDEM Schlüssel (kein Besitznachweis)
    const fremd = erzeugeKimlik({ dir: tmp() });
    const sig = signiereAnfrage({ method: 'POST', url: s.basis + '/v1/register', body, kimlik: { boxId: kimlik.boxId, privateKey: fremd.privateKey } });
    assert.equal((await post(s.basis, '/v1/register', body, sig.headers)).status, 401);
    // Code wurde nicht verbrannt
    const sig2 = signiereAnfrage({ method: 'POST', url: s.basis + '/v1/register', body, kimlik });
    assert.equal((await post(s.basis, '/v1/register', body, sig2.headers)).status, 200);
  } finally { await s.stop(); }
});

test('Register: gleiche Anfrage (Replay) wird abgelehnt', async () => {
  const s = await starte();
  try {
    const code = s.neuerCode();
    const { name } = (await post(s.basis, '/v1/vorschlag', { code })).json;
    const kimlik = erzeugeKimlik({ dir: tmp() });
    const body = JSON.stringify({ code, name, public_key: kimlik.publicKeyBase64url });
    const sig = signiereAnfrage({ method: 'POST', url: s.basis + '/v1/register', body, kimlik });
    assert.equal((await post(s.basis, '/v1/register', body, sig.headers)).status, 200);
    assert.equal((await post(s.basis, '/v1/register', body, sig.headers)).status, 401);
  } finally { await s.stop(); }
});

test('Register: Cloudflare fällt aus → 502, Code bleibt nutzbar, keine Box angelegt', async () => {
  const s = await starte();
  try {
    const code = s.neuerCode();
    s.cloudflare.fehler = true;
    await assert.rejects(registriere(s, { code }), /dienst/);
    assert.equal(s.db.boxenListe().length, 0);
    s.cloudflare.fehler = false;
    const r = await registriere(s, { code });
    assert.ok(r.name);
  } finally { await s.stop(); }
});

test('Register-Rate-Limit: 5 Fehlversuche/h/IP, danach 429; globaler Alarm über 20', async () => {
  const s = await starte({ config: { limitRegister: 5 } });
  try {
    const kimlik = erzeugeKimlik({ dir: tmp() });
    const body = JSON.stringify({ code: 'XXXX', name: 'a-b-1', public_key: kimlik.publicKeyBase64url });
    const stat = [];
    for (let i = 0; i < 7; i++) stat.push((await post(s.basis, '/v1/register', body)).status);
    assert.deepEqual(stat.slice(0, 5), [401, 401, 401, 401, 401]);
    assert.equal(stat[5], 429);
  } finally { await s.stop(); }

  const g = await starte({ config: { limitRegister: 1000 } });
  try {
    const kimlik = erzeugeKimlik({ dir: tmp() });
    const body = JSON.stringify({ code: 'XXXX', name: 'a-b-1', public_key: kimlik.publicKeyBase64url });
    for (let i = 0; i < 22; i++) await post(g.basis, '/v1/register', body);
    assert.equal(g.fehlerLog.filter((l) => l.includes('[ALARM]')).length, 1);
  } finally { await g.stop(); }
});

test('Vorschlag-Rate-Limit: 11. Anfrage pro Minute → 429', async () => {
  const s = await starte();
  try {
    const stat = [];
    for (let i = 0; i < 11; i++) stat.push((await post(s.basis, '/v1/vorschlag', { code: 'XXXX-XXXX-XXXX-XXXX' })).status);
    assert.equal(stat[9], 401);
    assert.equal(stat[10], 429);
  } finally { await s.stop(); }
});

test('Zu großer Body → 413 (vor dem Hashen)', async () => {
  const s = await starte();
  try {
    const r = await post(s.basis, '/v1/vorschlag', JSON.stringify({ code: 'x'.repeat(20000) }));
    assert.equal(r.status, 413);
  } finally { await s.stop(); }
});

test('/v1/ip lan: nur RFC1918; setzt A-Record TTL 600; Wiederholung ohne Änderung ruft Cloudflare nicht erneut', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    for (const ip of ['8.8.8.8', '127.0.0.1', '169.254.1.1', '0.0.0.0', 'abc', '']) {
      const x = await signiert(s, r.kimlik, '/v1/ip', { modus: 'lan', ip });
      assert.equal(x.status, 400, ip);
    }
    const ok = await signiert(s, r.kimlik, '/v1/ip', { modus: 'lan', ip: '192.168.2.111' });
    assert.equal(ok.status, 200);
    assert.deepEqual(s.cloudflare.rec.get(`A|${r.fqdn}`), { ip: '192.168.2.111', ttl: 3600 });
    s.cloudflare.rec.delete(`A|${r.fqdn}`);
    await signiert(s, r.kimlik, '/v1/ip', { modus: 'lan', ip: '192.168.2.111' });
    assert.equal(s.cloudflare.rec.has(`A|${r.fqdn}`), false, 'unverändert → kein erneuter Cloudflare-Aufruf');
    await signiert(s, r.kimlik, '/v1/ip', { modus: 'lan', ip: '192.168.2.112' });
    assert.equal(s.cloudflare.rec.get(`A|${r.fqdn}`).ip, '192.168.2.112');
  } finally { await s.stop(); }
});

test('/v1/ip internet: Quell-IP der Anfrage; Loopback/privat abgelehnt', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    // Quelle = 127.0.0.1 (Test-Client) → abgelehnt
    assert.equal((await signiert(s, r.kimlik, '/v1/ip', { modus: 'internet' })).status, 400);
    // Über Proxy-Kopfzeile (trustProxy: 1)
    const k = r.kimlik;
    const body = JSON.stringify({ modus: 'internet' });
    const sig = signiereAnfrage({ method: 'POST', url: s.basis + '/v1/ip', body, kimlik: k });
    const ok = await post(s.basis, '/v1/ip', body, { ...sig.headers, 'X-Forwarded-For': '93.184.216.34' });
    assert.equal(ok.status, 200);
    assert.equal(s.cloudflare.rec.get(`A|${r.fqdn}`).ip, '93.184.216.34');
    const sig2 = signiereAnfrage({ method: 'POST', url: s.basis + '/v1/ip', body, kimlik: k });
    assert.equal((await post(s.basis, '/v1/ip', body, { ...sig2.headers, 'X-Forwarded-For': '10.0.0.5' })).status, 400);
  } finally { await s.stop(); }
});

test('/v1/ip: Replay, manipulierter Body, falscher Pfad → 401', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    const body = JSON.stringify({ modus: 'lan', ip: '192.168.2.111' });
    const sig = signiereAnfrage({ method: 'POST', url: s.basis + '/v1/ip', body, kimlik: r.kimlik });
    assert.equal((await post(s.basis, '/v1/ip', body, sig.headers)).status, 200);
    assert.equal((await post(s.basis, '/v1/ip', body, sig.headers)).status, 401, 'Replay');
    const sig2 = signiereAnfrage({ method: 'POST', url: s.basis + '/v1/ip', body, kimlik: r.kimlik });
    assert.equal((await post(s.basis, '/v1/ip', JSON.stringify({ modus: 'lan', ip: '192.168.2.99' }), sig2.headers)).status, 401, 'Body');
    const sig3 = signiereAnfrage({ method: 'POST', url: s.basis + '/v1/caa', body, kimlik: r.kimlik });
    assert.equal((await post(s.basis, '/v1/ip', body, sig3.headers)).status, 401, 'Pfad');
    const sig4 = signiereAnfrage({ method: 'POST', url: s.basis + '/v1/ip?x=1', body, kimlik: r.kimlik });
    assert.equal((await post(s.basis, '/v1/ip', body, sig4.headers)).status, 401, 'Query');
    const sig5 = signiereAnfrage({ method: 'POST', url: s.basis + '/v1/ip', body, kimlik: r.kimlik, jetzt: s.uhr.ms - 400_000 });
    const alt = await post(s.basis, '/v1/ip', body, sig5.headers);
    assert.equal(alt.status, 401, 'Zeit');
    assert.equal(typeof alt.json.serverzeit, 'number');
  } finally { await s.stop(); }
});

test('Falscher Host-Header (Weiterleitung an anderen Merkez) → 401, wenn MERKEZ_HOST gesetzt', async () => {
  const s = await starte({ config: { hostErwartet: 'merkez.example.org' } });
  try {
    const kimlik = erzeugeKimlik({ dir: tmp() });
    const body = JSON.stringify({ code: 'x', name: 'a-b-1', public_key: kimlik.publicKeyBase64url });
    const sig = signiereAnfrage({ method: 'POST', url: s.basis + '/v1/register', body, kimlik });
    assert.equal((await post(s.basis, '/v1/register', body, sig.headers)).status, 401);
  } finally { await s.stop(); }
});

test('/v1/caa: nur LE-Konto-URI, setzt CAA mit accounturi am Box-Namen', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    for (const u of ['', 'https://evil.example/acct/1', 'https://acme-v02.api.letsencrypt.org/acme/acct/abc', 'https://acme-v02.api.letsencrypt.org/acme/acct/1; issue "evil.org"']) {
      assert.equal((await signiert(s, r.kimlik, '/v1/caa', { accountUri: u })).status, 400, u);
    }
    const uri = 'https://acme-v02.api.letsencrypt.org/acme/acct/123456';
    assert.equal((await signiert(s, r.kimlik, '/v1/caa', { accountUri: uri })).status, 200);
    assert.equal(s.cloudflare.rec.get(`CAA|${r.fqdn}`).uri, uri);
  } finally { await s.stop(); }
});

test('/v1/caa: gleicher Wert ohne Wirkung, Wechsel protokolliert + [ALARM], höchstens 3 Wechsel je 24 h (K2b.4b)', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    const u = (n) => `https://acme-v02.api.letsencrypt.org/acme/acct/${n}`;
    assert.equal((await signiert(s, r.kimlik, '/v1/caa', { accountUri: u(1) })).status, 200);
    assert.equal(s.fehlerLog.filter((l) => l.includes('[ALARM]')).length, 0, 'Erstbindung ohne Alarm');
    const gleich = await signiert(s, r.kimlik, '/v1/caa', { accountUri: u(1) });
    assert.equal(gleich.status, 200);
    assert.equal(gleich.json.unveraendert, true);
    assert.equal((await signiert(s, r.kimlik, '/v1/caa', { accountUri: u(2) })).status, 200);
    assert.ok(s.fehlerLog.some((l) => l.includes('[ALARM]') && l.includes(u(1)) && l.includes(u(2))), 'Wechsel → Alarm alt→neu');
    assert.equal(s.cloudflare.rec.get(`CAA|${r.fqdn}`).uri, u(2), 'überschrieben, kein zweiter issue');
    assert.equal((await signiert(s, r.kimlik, '/v1/caa', { accountUri: u(3) })).status, 200);
    assert.equal((await signiert(s, r.kimlik, '/v1/caa', { accountUri: u(4) })).status, 200, '3. Wechsel noch erlaubt (Erstbindung zählt nicht)');
    assert.equal((await signiert(s, r.kimlik, '/v1/caa', { accountUri: u(5) })).status, 429, '4. Wechsel in 24 h');
    assert.equal(s.cloudflare.rec.get(`CAA|${r.fqdn}`).uri, u(4));
    const log = s.db.adminLogLesen().filter((e) => e.aktion.startsWith('caa'));
    assert.deepEqual(log.map((e) => e.aktion), ['caa-bindung', 'caa-wechsel', 'caa-wechsel', 'caa-wechsel']);
    assert.deepEqual(JSON.parse(log[1].details), { alt: u(1), neu: u(2) });
    assert.equal(s.db.caaWechselZaehlen(r.kimlik.boxId, 0), 3);
  } finally { await s.stop(); }
});

test('Zwei Boxen: jede ändert nur ihre eigenen Einträge', async () => {
  const s = await starte();
  try {
    const a = await registriere(s); const b = await registriere(s);
    assert.notEqual(a.name, b.name);
    await signiert(s, a.kimlik, '/v1/ip', { modus: 'lan', ip: '192.168.1.10' });
    assert.equal(s.cloudflare.rec.get(`A|${a.fqdn}`).ip, '192.168.1.10');
    assert.equal(s.cloudflare.rec.has(`A|${b.fqdn}`), false);
  } finally { await s.stop(); }
});

test('Iptal: signierte Anfragen sofort 401 — bei JEDER Anfrage geprüft', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    assert.equal((await signiert(s, r.kimlik, '/v1/ip', { modus: 'lan', ip: '192.168.1.10' })).status, 200);
    s.db.boxIptal(r.name, 1);
    assert.equal((await signiert(s, r.kimlik, '/v1/ip', { modus: 'lan', ip: '192.168.1.11' })).status, 401);
    assert.equal((await signiert(s, r.kimlik, '/v1/caa', { accountUri: 'https://acme-v02.api.letsencrypt.org/acme/acct/1' })).status, 401);
    assert.equal(s.cloudflare.rec.get(`A|${r.fqdn}`).ip, '192.168.1.10', 'A-Eintrag unberührt');
  } finally { await s.stop(); }
});

test('Unbekannte Box → 401 (gleiche Antwort wie ungültige Signatur)', async () => {
  const s = await starte();
  try {
    const fremd = erzeugeKimlik({ dir: tmp() });
    const x = await signiert(s, fremd, '/v1/ip', { modus: 'lan', ip: '192.168.1.10' });
    assert.equal(x.status, 401);
    assert.equal(x.json.fehler, 'signatur');
  } finally { await s.stop(); }
});

test('Rebind: alter Schlüssel stirbt, gleicher Name, neues acme-dns-Konto', async () => {
  const s = await starte();
  try {
    const a = await registriere(s);
    const rebindCode = s.neuerCode('rebind', a.name, 3);
    const neu = await registriere(s, { code: rebindCode });
    assert.equal(neu.name, a.name);
    assert.notEqual(neu.kimlik.boxId, a.kimlik.boxId);
    assert.equal(s.acmedns.anzahl, 2);
    assert.equal(s.db.boxenListe().length, 1);
    assert.equal((await signiert(s, a.kimlik, '/v1/ip', { modus: 'lan', ip: '192.168.1.10' })).status, 401, 'alter Schlüssel');
    assert.equal((await signiert(s, neu.kimlik, '/v1/ip', { modus: 'lan', ip: '192.168.1.10' })).status, 200);
  } finally { await s.stop(); }
});

test('Namen werden nie doppelt vergeben: reservierte, vergebene und Grabstein-Namen', async () => {
  const s = await starte();
  try {
    const a = await registriere(s);
    s.db.grabstein('sonne-tal-42', 'test', 1);
    for (let i = 0; i < 30; i++) {
      const code = s.neuerCode();
      const n = (await post(s.basis, '/v1/vorschlag', { code })).json.name;
      assert.notEqual(n, a.name);
      assert.notEqual(n, 'sonne-tal-42');
    }
  } finally { await s.stop(); }
});

test('Admin-Log ist nur anhängbar', async () => {
  const s = await starte();
  try {
    await registriere(s);
    const n = s.db.adminLogLesen().length;
    assert.ok(n >= 1);
    assert.throws(() => s.db.raw.prepare('UPDATE adminlog SET aktion = ?').run('x'), /nur anhaengbar/);
    assert.throws(() => s.db.raw.prepare('DELETE FROM adminlog').run(), /nur anhaengbar/);
    assert.equal(s.db.adminLogLesen().length, n);
  } finally { await s.stop(); }
});

test('Kein Admin-HTTP-Endpunkt', async () => {
  const s = await starte();
  try {
    for (const p of ['/admin', '/v1/admin', '/v1/iptal', '/v1/kod-neu']) {
      const r = await post(s.basis, p, {});
      assert.equal(r.status, 404, p);
    }
  } finally { await s.stop(); }
});

test('Signierte POST ohne Body funktioniert (Hash über leeren Buffer, nicht über {})', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    // /v1/ip ohne Body → 400 (modus fehlt), aber NICHT 401: Signatur wurde akzeptiert
    const x = await merkezFetch('/v1/ip', { kimlik: r.kimlik, baseUrl: s.basis });
    assert.equal(x.status, 400);
    assert.equal(x.json.fehler, 'modus');
  } finally { await s.stop(); }
});

test('/v1/ip lan: ip muss ein String sein', async () => {
  const s = await starte();
  try {
    const r = await registriere(s);
    for (const ip of [['192.168.1.5'], 5, null, { toString: 1 }]) {
      assert.equal((await signiert(s, r.kimlik, '/v1/ip', { modus: 'lan', ip })).status, 400);
    }
  } finally { await s.stop(); }
});

test('Globale Register-Sperre: nach 20 abgelehnten Anfragen 503, auch 413 zählt', async () => {
  const s = await starte({ config: { limitRegister: 1000 } });
  try {
    for (let i = 0; i < 10; i++) await post(s.basis, '/v1/register', 'x'.repeat(9000)); // 413
    for (let i = 0; i < 11; i++) await post(s.basis, '/v1/register', '{}'); // 400
    const code = s.neuerCode();
    assert.equal((await post(s.basis, '/v1/register', { code })).status, 503);
    assert.equal(s.fehlerLog.filter((l) => l.includes('[ALARM]')).length, 1);
  } finally { await s.stop(); }
});

test('--neuer-schluessel: scheitert die Registrierung, bleibt die alte Identität vollständig erhalten', async () => {
  const s = await starte();
  try {
    const a = await registriere(s);
    const rebind = s.neuerCode('rebind', a.name, 3);
    s.cloudflare.fehler = true;
    await assert.rejects(kayitAusfuehren({ code: formatSetupCode(rebind, FORMAT_KUTU), auto: true, neuerSchluessel: true, kimlikDir: a.kimlikDir, acmednsDir: a.acmednsDir, baseUrl: s.basis }), /dienst/);
    s.cloudflare.fehler = false;
    const noch = ladeKimlik({ dir: a.kimlikDir });
    assert.equal(noch.boxId, a.kimlik.boxId);
    assert.equal(noch.ad, a.name);
    assert.equal((await signiert(s, noch, '/v1/ip', { modus: 'lan', ip: '192.168.1.10' })).status, 200);
    // zweiter Versuch: das .neu-Paar wird wiederverwendet und nach Erfolg übernommen
    const erg = await kayitAusfuehren({ code: formatSetupCode(rebind, FORMAT_KUTU), auto: true, neuerSchluessel: true, kimlikDir: a.kimlikDir, acmednsDir: a.acmednsDir, baseUrl: s.basis });
    const neu = ladeKimlik({ dir: a.kimlikDir });
    assert.equal(neu.boxId, erg.boxId);
    assert.notEqual(neu.boxId, a.kimlik.boxId);
    assert.equal(neu.ad, a.name);
  } finally { await s.stop(); }
});
