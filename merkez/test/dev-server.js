#!/usr/bin/env node
// Lokaler Namensdienst zum manuellen Testen von kayit.js / merkez-istemci (K2b.5b / O-161).
// Startet mit In-Memory/Fake-Cloudflare + acme-dns und temporärer SQLite-Datenbank.
// Nur für Entwicklung gedacht (erfordert MERKEZ_DEV=1).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { erstelleApp } from '../server.js';
import { oeffneDb } from '../db.js';
import { fakeAcmeDns } from './helper.js';
import { generateSetupCode, formatSetupCode, hashCode, FORMAT_KUTU } from '../../api-backend/routes/mitarbeiter-zugang-code.js';

export function erstelleProtokollierendesCloudflare() {
  const eintraege = new Map();
  return {
    eintraege,
    async setzeA(fqdn, ip, ttl) {
      console.log(`[cloudflare-fake] A-Record gesetzt: ${fqdn} -> ${ip} (TTL: ${ttl})`);
      eintraege.set('A|' + fqdn, { ip, ttl });
    },
    async setzeCname(fqdn, ziel, ttl) {
      console.log(`[cloudflare-fake] CNAME-Record gesetzt: ${fqdn} -> ${ziel} (TTL: ${ttl})`);
      eintraege.set('CNAME|' + fqdn, { ziel, ttl });
    },
    async setzeCaa(fqdn, uri) {
      console.log(`[cloudflare-fake] CAA-Record gesetzt: ${fqdn} -> ${uri || 'letsencrypt.org; validationmethods=dns-01'}`);
      eintraege.set('CAA|' + fqdn, { uri });
    },
    async loesche(typ, fqdn) {
      console.log(`[cloudflare-fake] Record gelöscht: ${typ} ${fqdn}`);
      eintraege.delete(typ + '|' + fqdn);
    },
  };
}

export async function starteDevServer({ port = Number(process.env.PORT || 8788), boxDomain = process.env.BOX_DOMAIN || 'box.beispiel.test' } = {}) {
  if (process.env.MERKEZ_DEV !== '1') {
    console.error('Fehler: dev-server darf nur gestartet werden, wenn MERKEZ_DEV=1 gesetzt ist.');
    process.exit(1);
  }

  const dbPfad = path.join(os.tmpdir(), `merkez-dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sqlite`);
  const db = oeffneDb(dbPfad);
  const cloudflare = erstelleProtokollierendesCloudflare();
  const acmedns = fakeAcmeDns();

  // Einen gültigen Einrichtungscode beim Start anlegen (14 Tage gültig)
  const code = generateSetupCode(10, FORMAT_KUTU);
  const t = Math.floor(Date.now() / 1000);
  db.codeAnlegen({
    codeHash: hashCode(code, FORMAT_KUTU),
    art: 'kurulum',
    boxName: null,
    gueltigBis: t + 14 * 86400,
    jetzt: t,
  });
  const formatiert = formatSetupCode(code, FORMAT_KUTU);

  const app = erstelleApp({
    db,
    cloudflare,
    acmedns,
    config: {
      boxDomain,
      acmeDnsUrl: 'https://auth.acme-dns.' + boxDomain,
      trustProxy: 1,
      limitVorschlag: 1000,
      limitRegister: 1000,
      limitSigniert: 1000,
    },
    log: console,
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(port, '127.0.0.1', () => resolve(s));
  });

  console.log(`[merkez dev-server] Lauscht auf http://127.0.0.1:${port}`);
  console.log(`[merkez dev-server] Domain: *.${boxDomain}`);
  console.log(`[merkez dev-server] SQLite-Datenbank: ${dbPfad}`);
  console.log(`[merkez dev-server] Gültiger Einrichtungscode: ${formatiert}`);

  const cleanup = () => {
    try {
      db.close?.();
      for (const p of [dbPfad, dbPfad + '-wal', dbPfad + '-shm']) if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      // Ignorieren
    }
  };
  process.on('exit', cleanup);

  return { server, db, cloudflare, acmedns, code: formatiert, dbPfad };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  starteDevServer().catch((e) => {
    console.error('Fehler beim Start des Dev-Servers:', e.message);
    process.exit(1);
  });
}
