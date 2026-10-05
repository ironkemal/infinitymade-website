// Testhilfen: Fake-Cloudflare und Fake-acme-dns (kein Netz), App auf freiem Port.
import crypto from 'node:crypto';
import { oeffneDb } from '../db.js';
import { erstelleApp } from '../server.js';
import { generateSetupCode, hashCode, FORMAT_KUTU } from '../../api-backend/routes/mitarbeiter-zugang-code.js';

export function fakeCloudflare() {
  const rec = new Map(); // "TYP|name" → Inhalt
  const f = {
    rec, fehler: false,
    async setzeA(fqdn, ip, ttl) { if (f.fehler) throw new Error('cf down'); rec.set('A|' + fqdn, { ip, ttl }); },
    async setzeCname(fqdn, ziel, ttl) { if (f.fehler) throw new Error('cf down'); rec.set('CNAME|' + fqdn, { ziel, ttl }); },
    async setzeCaa(fqdn, uri) { if (f.fehler) throw new Error('cf down'); rec.set('CAA|' + fqdn, { uri }); },
    async loesche(typ, fqdn) { rec.delete(typ + '|' + fqdn); },
  };
  return f;
}

export function fakeAcmeDns() {
  const a = {
    anzahl: 0,
    async registrieren() {
      a.anzahl++;
      const sub = crypto.randomUUID();
      return { username: 'u' + a.anzahl, password: 'p' + a.anzahl, subdomain: sub, fulldomain: `${sub}.auth.acme.example.org` };
    },
  };
  return a;
}

export async function starte({ jetzt, config = {} } = {}) {
  const db = oeffneDb(':memory:');
  const cloudflare = fakeCloudflare();
  const acmedns = fakeAcmeDns();
  const uhr = { ms: jetzt ?? Date.now() };
  const fehlerLog = [];
  const app = erstelleApp({
    db, cloudflare, acmedns,
    config: { boxDomain: 'box.example.org', acmeDnsUrl: 'https://acme.example.org', trustProxy: 1, ...config },
    jetzt: () => uhr.ms,
    log: { error: (...a) => fehlerLog.push(a.join(' ')) },
  });
  const server = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  const basis = `http://127.0.0.1:${server.address().port}`;
  const neuerCode = (art = 'kurulum', boxName = null, tage = 14) => {
    const code = generateSetupCode(10, FORMAT_KUTU);
    const t = Math.floor(uhr.ms / 1000);
    db.codeAnlegen({ codeHash: hashCode(code, FORMAT_KUTU), art, boxName, gueltigBis: t + tage * 86400, jetzt: t });
    return code;
  };
  return {
    db, cloudflare, acmedns, uhr, basis, server, fehlerLog, neuerCode,
    stop: () => new Promise((ok) => { server.closeAllConnections?.(); server.close(ok); }),
  };
}

export async function post(basis, pfad, body, headers = {}) {
  const r = await fetch(basis + pfad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
