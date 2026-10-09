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

export function fakeEntra(uhr) {
  let customExp = null;
  return {
    anzahl: 0,
    fehler: false,
    token: 'fake-entra-token-abcdefghij', // secret-scan: ignore (Fake-Testwert)
    get entraExp() {
      return customExp !== null ? customExp : Math.floor(uhr.ms / 1000) + 3600;
    },
    set entraExp(val) {
      customExp = val;
    },
    async holeToken() {
      this.anzahl++;
      if (this.fehler) throw Object.assign(new Error('Entra HTTP 500'), { code: 'KI_ENTRA' });
      return { token: this.token, entraExp: this.entraExp };
    },
  };
}

export function kiBereit(s, boxName) {
  s.db.einstellungSetzen('ki_global', 'an');
  if (boxName) {
    s.db.boxKiSetzen(boxName, 'aktiv');
  }
}

export async function starte({ jetzt, config = {}, ki, kiEntra } = {}) {
  const db = oeffneDb(':memory:');
  const cloudflare = fakeCloudflare();
  const acmedns = fakeAcmeDns();
  const uhr = { ms: jetzt ?? Date.now() };
  const fehlerLog = [];

  const standardKi = {
    gueltig: true,
    grund: null,
    endpoint: 'https://ki-test.example.openai.azure.com/',
    deployment: 'gpt-test',
    region: 'swedencentral',
    apiVersion: '2024-10-21',
    monatsLimit: 600,
  };
  const wirksameKi = ki !== undefined ? ki : (config.ki !== undefined ? config.ki : standardKi);
  const wirksamesKiEntra = kiEntra !== undefined ? kiEntra : fakeEntra(uhr);

  const app = erstelleApp({
    db, cloudflare, acmedns,
    config: {
      boxDomain: 'box.example.org',
      acmeDnsUrl: 'https://acme.example.org',
      trustProxy: 1,
      ...config,
      ki: wirksameKi,
    },
    kiEntra: wirksamesKiEntra,
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
    kiEntra: wirksamesKiEntra,
    kiConfig: wirksameKi,
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
