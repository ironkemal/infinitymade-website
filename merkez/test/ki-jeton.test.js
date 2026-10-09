import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  ENTRA_MIN_RESTLAUF_SEK,
  MAX_TTL_SEK,
  kiConfigAusEnv,
  erstelleKiEntra,
  monatsSchluessel,
  naechsterMonatsanfangBerlin,
  tokenFingerabdruck,
} from '../ki-jeton.js';

const GUELTIGE_ENV = {
  KI_ENTRA_TENANT_ID: '12345678-1234-1234-1234-123456789abc',
  KI_ENTRA_CLIENT_ID: '87654321-4321-4321-4321-cba987654321',
  KI_ENTRA_CLIENT_SECRET: 'super-secret-entra-key',
  KI_ENDPOINT: 'https://meine-ki-ressource.openai.azure.com',
  KI_DEPLOYMENT: 'gpt-4o-mini',
  KI_REGION: 'swedencentral',
  KI_API_VERSION: '2024-10-21',
  KI_MONATS_LIMIT: '1000',
};

test('Konstanten: Restlaufzeit 45 min und TTL 1 h', () => {
  assert.equal(ENTRA_MIN_RESTLAUF_SEK, 2700);
  assert.equal(MAX_TTL_SEK, 3600);
});

test('kiConfigAusEnv: gültige Umgebungsvariablen', () => {
  const cfg = kiConfigAusEnv(GUELTIGE_ENV);
  assert.equal(cfg.gueltig, true);
  assert.equal(cfg.grund, null);
  assert.equal(cfg.tenantId, '12345678-1234-1234-1234-123456789abc');
  assert.equal(cfg.clientId, '87654321-4321-4321-4321-cba987654321');
  assert.equal(cfg.clientSecret, 'super-secret-entra-key');
  assert.equal(cfg.endpoint, 'https://meine-ki-ressource.openai.azure.com/');
  assert.equal(cfg.deployment, 'gpt-4o-mini');
  assert.equal(cfg.region, 'swedencentral');
  assert.equal(cfg.apiVersion, '2024-10-21');
  assert.equal(cfg.monatsLimit, 1000);

  // clientSecret ist nicht-enumerable (nie in JSON.stringify / Object.keys)
  const json = JSON.stringify(cfg);
  assert.ok(!json.includes('super-secret-entra-key'));
  assert.ok(!json.includes('clientSecret'));
  assert.ok(!Object.keys(cfg).includes('clientSecret'));
});

test('kiConfigAusEnv: Standardwerte für API-Version und Monatslimit', () => {
  const env = { ...GUELTIGE_ENV };
  delete env.KI_API_VERSION;
  delete env.KI_MONATS_LIMIT;
  const cfg = kiConfigAusEnv(env);
  assert.equal(cfg.gueltig, true);
  assert.equal(cfg.apiVersion, '2024-10-21');
  assert.equal(cfg.monatsLimit, 600);
});

test('kiConfigAusEnv: leere Umgebung und fehlende Pflichtfelder', () => {
  assert.equal(kiConfigAusEnv({}).grund, 'fehlt:KI_ENTRA_TENANT_ID');
  assert.equal(kiConfigAusEnv().grund, 'fehlt:KI_ENTRA_TENANT_ID');

  const felder = [
    'KI_ENTRA_TENANT_ID',
    'KI_ENTRA_CLIENT_ID',
    'KI_ENTRA_CLIENT_SECRET',
    'KI_ENDPOINT',
    'KI_DEPLOYMENT',
    'KI_REGION',
  ];

  for (const feld of felder) {
    const env = { ...GUELTIGE_ENV };
    delete env[feld];
    const cfg = kiConfigAusEnv(env);
    assert.equal(cfg.gueltig, false);
    assert.equal(cfg.grund, `fehlt:${feld}`);
  }
});

test('kiConfigAusEnv: ungültige Felder', () => {
  // UUIDs
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_ENTRA_TENANT_ID: 'nicht-uuid' }).grund, 'ungueltig:KI_ENTRA_TENANT_ID');
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_ENTRA_CLIENT_ID: '12345' }).grund, 'ungueltig:KI_ENTRA_CLIENT_ID');

  // Endpoints: kein https, Pfad, Port != 443, Query, Hash, Userinfo
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_ENDPOINT: 'http://test.example.com/' }).grund, 'ungueltig:KI_ENDPOINT');
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_ENDPOINT: 'https://test.example.com/pfad' }).grund, 'ungueltig:KI_ENDPOINT');
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_ENDPOINT: 'https://test.example.com:8443/' }).grund, 'ungueltig:KI_ENDPOINT');
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_ENDPOINT: 'https://user:pass@test.example.com/' }).grund, 'ungueltig:KI_ENDPOINT');
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_ENDPOINT: 'https://test.example.com/?query=1' }).grund, 'ungueltig:KI_ENDPOINT');
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_ENDPOINT: 'https://test.example.com/#hash' }).grund, 'ungueltig:KI_ENDPOINT');
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_ENDPOINT: 'keine-url' }).grund, 'ungueltig:KI_ENDPOINT');

  // Port 443 ist erlaubt und wird normalisiert
  const cfg443 = kiConfigAusEnv({ ...GUELTIGE_ENV, KI_ENDPOINT: 'https://test.example.com:443/' });
  assert.equal(cfg443.gueltig, true);
  assert.equal(cfg443.endpoint, 'https://test.example.com/');

  // Deployment
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_DEPLOYMENT: 'mit leerzeichen' }).grund, 'ungueltig:KI_DEPLOYMENT');
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_DEPLOYMENT: 'a'.repeat(65) }).grund, 'ungueltig:KI_DEPLOYMENT');

  // Region außerhalb EU
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_REGION: 'eastus' }).grund, 'ungueltig:KI_REGION');
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_REGION: 'westus2' }).grund, 'ungueltig:KI_REGION');

  // API-Version
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_API_VERSION: 'ungueltig' }).grund, 'ungueltig:KI_API_VERSION');
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_API_VERSION: '2024-10-21-invalid' }).grund, 'ungueltig:KI_API_VERSION');

  // Monatslimit
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_MONATS_LIMIT: '0' }).grund, 'ungueltig:KI_MONATS_LIMIT');
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_MONATS_LIMIT: '-1' }).grund, 'ungueltig:KI_MONATS_LIMIT');
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_MONATS_LIMIT: '1000001' }).grund, 'ungueltig:KI_MONATS_LIMIT');
  assert.equal(kiConfigAusEnv({ ...GUELTIGE_ENV, KI_MONATS_LIMIT: 'keine-zahl' }).grund, 'ungueltig:KI_MONATS_LIMIT');
});

test('erstelleKiEntra: Request-Form, URLSearchParams, AbortSignal und kein Secret im Log', async () => {
  const cfg = kiConfigAusEnv(GUELTIGE_ENV);
  const aufrufe = [];
  const logEintraege = [];
  const logSpy = {
    error: (...a) => logEintraege.push(a.join(' ')),
    warn: (...a) => logEintraege.push(a.join(' ')),
    info: (...a) => logEintraege.push(a.join(' ')),
  };

  const fakeFetch = async (url, opts) => {
    aufrufe.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'fake-jwt-token-mindestens-zehn-zeichen', expires_in: 3600 }), // secret-scan: ignore (Fake-Testwert)
    };
  };

  const entra = erstelleKiEntra({
    config: cfg,
    fetchImpl: fakeFetch,
    jetzt: () => 1_000_000_000,
    log: logSpy,
  });

  const res = await entra.holeToken();
  assert.equal(res.token, 'fake-jwt-token-mindestens-zehn-zeichen');
  assert.equal(res.entraExp, 1_000_000 + 3600);

  assert.equal(aufrufe.length, 1);
  const { url, opts } = aufrufe[0];
  assert.equal(url, `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`);
  assert.equal(opts.method, 'POST');
  assert.equal(opts.headers['Content-Type'], 'application/x-www-form-urlencoded');

  const params = new URLSearchParams(opts.body);
  assert.equal(params.get('grant_type'), 'client_credentials');
  assert.equal(params.get('client_id'), cfg.clientId);
  assert.equal(params.get('client_secret'), cfg.clientSecret);
  assert.equal(params.get('scope'), 'https://cognitiveservices.azure.com/.default');
  assert.ok(opts.signal, 'Signal vorhanden');

  // Weder Secret noch Token im Log
  assert.ok(!JSON.stringify(logEintraege).includes(cfg.clientSecret));
  assert.ok(!JSON.stringify(logEintraege).includes('fake-jwt-token'));
});

test('erstelleKiEntra: Cache 45 min und Erneuerung nach Zeitvorspulen', async () => {
  const cfg = kiConfigAusEnv(GUELTIGE_ENV);
  let fetchAnzahl = 0;
  let simulatedNowMs = 1_000_000_000;

  const fakeFetch = async () => {
    fetchAnzahl++;
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: `token-${fetchAnzahl}-1234567890`, expires_in: 3600 }),
    };
  };

  const entra = erstelleKiEntra({
    config: cfg,
    fetchImpl: fakeFetch,
    jetzt: () => simulatedNowMs,
  });

  // 1. Aufruf: holt per Fetch
  const t1 = await entra.holeToken();
  assert.equal(fetchAnzahl, 1);
  assert.equal(t1.token, 'token-1-1234567890');

  // 2. Aufruf nach 10 Minuten (Restlaufzeit = 50 min >= 45 min): RAM-Cache aktiv
  simulatedNowMs += 600 * 1000;
  const t2 = await entra.holeToken();
  assert.equal(fetchAnzahl, 1);
  assert.equal(t2.token, 'token-1-1234567890');

  // 3. Aufruf nach weiteren 6 Minuten (Restlaufzeit = 44 min < 45 min): 2. Fetch
  simulatedNowMs += 360 * 1000;
  const t3 = await entra.holeToken();
  assert.equal(fetchAnzahl, 2);
  assert.equal(t3.token, 'token-2-1234567890');
});

test('erstelleKiEntra: Singleflight bündelt parallele Aufrufe', async () => {
  const cfg = kiConfigAusEnv(GUELTIGE_ENV);
  let fetchAnzahl = 0;

  const fakeFetch = async () => {
    fetchAnzahl++;
    await new Promise((ok) => setTimeout(ok, 20));
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token-singleflight-12345678', expires_in: 3600 }), // secret-scan: ignore (Fake-Testwert)
    };
  };

  const entra = erstelleKiEntra({
    config: cfg,
    fetchImpl: fakeFetch,
    jetzt: () => 1_000_000_000,
  });

  const [r1, r2, r3] = await Promise.all([
    entra.holeToken(),
    entra.holeToken(),
    entra.holeToken(),
  ]);

  assert.equal(fetchAnzahl, 1);
  assert.equal(r1.token, 'token-singleflight-12345678');
  assert.equal(r2.token, 'token-singleflight-12345678');
  assert.equal(r3.token, 'token-singleflight-12345678');
});

test('erstelleKiEntra: Fehlerpfade (HTTP, ungültige Antwort, Netz) ohne Secret/Token im Fehler', async () => {
  const cfg = kiConfigAusEnv(GUELTIGE_ENV);

  // 1. HTTP 500
  const entra500 = erstelleKiEntra({
    config: cfg,
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ error: 'internal' }) }),
  });
  await assert.rejects(
    entra500.holeToken(),
    (err) => {
      assert.equal(err.code, 'KI_ENTRA');
      assert.equal(err.message, 'Entra HTTP 500');
      assert.ok(!err.message.includes(cfg.clientSecret));
      return true;
    }
  );

  // 2. HTTP 401
  const entra401 = erstelleKiEntra({
    config: cfg,
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) }),
  });
  await assert.rejects(
    entra401.holeToken(),
    (err) => {
      assert.equal(err.code, 'KI_ENTRA');
      assert.equal(err.message, 'Entra HTTP 401');
      return true;
    }
  );

  // 3. Antwort kein JSON
  const entraBadJson = erstelleKiEntra({
    config: cfg,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('not json'); } }),
  });
  await assert.rejects(
    entraBadJson.holeToken(),
    (err) => {
      assert.equal(err.code, 'KI_ENTRA');
      assert.equal(err.message, 'Entra Antwort ungueltig');
      return true;
    }
  );

  // 4. Token ungültig (zu kurz)
  const entraShortToken = erstelleKiEntra({
    config: cfg,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'short', expires_in: 3600 }) }),
  });
  await assert.rejects(entraShortToken.holeToken(), /Entra Antwort ungueltig/);

  // 5. Token mit Steuerzeichen
  const entraControlChars = erstelleKiEntra({
    config: cfg,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'validlength\r\n', expires_in: 3600 }) }),
  });
  await assert.rejects(entraControlChars.holeToken(), /Entra Antwort ungueltig/);

  // 6. expires_in ungültig
  const entraBadExp = erstelleKiEntra({
    config: cfg,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ access_token: '1234567890abcdef', expires_in: 0 }) }),
  });
  await assert.rejects(entraBadExp.holeToken(), /Entra Antwort ungueltig/);

  // 7. Netzwerkfehler
  const entraNetz = erstelleKiEntra({
    config: cfg,
    fetchImpl: async () => { throw new Error('connection refused'); },
  });
  await assert.rejects(
    entraNetz.holeToken(),
    (err) => {
      assert.equal(err.code, 'KI_ENTRA');
      assert.equal(err.message, 'Entra nicht erreichbar');
      return true;
    }
  );
});

test('erstelleKiEntra: keine Cache-Vergiftung nach Fehlschlag', async () => {
  const cfg = kiConfigAusEnv(GUELTIGE_ENV);
  let scheitern = true;

  const fakeFetch = async () => {
    if (scheitern) {
      throw new Error('netzwerk down');
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'wieder-erfolgreich-123456', expires_in: 3600 }), // secret-scan: ignore (Fake-Testwert)
    };
  };

  const entra = erstelleKiEntra({
    config: cfg,
    fetchImpl: fakeFetch,
    jetzt: () => 1_000_000_000,
  });

  await assert.rejects(entra.holeToken(), /Entra nicht erreichbar/);

  // Nach Fehler gelingt der nächste Aufruf sofort
  scheitern = false;
  const res = await entra.holeToken();
  assert.equal(res.token, 'wieder-erfolgreich-123456');
});

test('monatsSchluessel: Europe/Berlin Monatsschlüssel', () => {
  assert.equal(monatsSchluessel(Date.parse('2026-10-15T12:00:00Z')), '2026-10');
  // Zwischen 22:00Z und 23:00Z am Monatsende im Sommer
  assert.equal(monatsSchluessel(Date.parse('2026-09-30T21:30:00Z')), '2026-09');
  assert.equal(monatsSchluessel(Date.parse('2026-09-30T22:30:00Z')), '2026-10');
});

test('naechsterMonatsanfangBerlin: DST-sichere Monatswechsel laut Vertrag', () => {
  // 1. Pflichttest: 2026-10-15 → 2026-10-31T23:00:00Z (Zeitumstellung 25.10. liegt dazwischen, 01.11. ist CET)
  const res1 = naechsterMonatsanfangBerlin(Date.parse('2026-10-15T12:00:00Z'));
  assert.equal(res1, Math.floor(Date.parse('2026-10-31T23:00:00Z') / 1000));

  // 2. Pflichttest: 2026-12-31 23:30 Berlin (=22:30Z) → 2026-12-31T23:00:00Z (01.01. ist CET)
  const res2 = naechsterMonatsanfangBerlin(Date.parse('2026-12-31T22:30:00Z'));
  assert.equal(res2, Math.floor(Date.parse('2026-12-31T23:00:00Z') / 1000));

  // 3. Pflichttest: Sommer 2026-06-10 → 2026-06-30T22:00:00Z (01.07. ist CEST)
  const res3 = naechsterMonatsanfangBerlin(Date.parse('2026-06-10T12:00:00Z'));
  assert.equal(res3, Math.floor(Date.parse('2026-06-30T22:00:00Z') / 1000));

  // 4. Pflichttest Grenzfall: 2026-10-31T22:30:00Z (= 23:30 CET → noch Oktober in Berlin) → 2026-10-31T23:00:00Z
  const res4 = naechsterMonatsanfangBerlin(Date.parse('2026-10-31T22:30:00Z'));
  assert.equal(res4, Math.floor(Date.parse('2026-10-31T23:00:00Z') / 1000));

  // 5. Pflichttest Grenzfall: 2026-09-30T21:30:00Z (= 23:30 CEST → noch September in Berlin) → 2026-09-30T22:00:00Z
  const res5 = naechsterMonatsanfangBerlin(Date.parse('2026-09-30T21:30:00Z'));
  assert.equal(res5, Math.floor(Date.parse('2026-09-30T22:00:00Z') / 1000));
});

test('tokenFingerabdruck: sha256-hex', () => {
  const token = 'test-token-string-12345';
  const expected = createHash('sha256').update(token).digest('hex');
  assert.equal(tokenFingerabdruck(token), expected);
});
