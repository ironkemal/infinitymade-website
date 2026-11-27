import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { oeffneDb } from '../db.js';
import { erstelleAdminBridge } from '../admin-bridge.js';
import { starte, fakeCloudflare } from './helper.js';
import {
  signiereAnfrage,
  boxIdAusPublicKey,
  publicKeyAlsBase64url,
} from '../../api-backend/merkez-istemci/signatur.js';
import { hashCode, istKutuCodeGueltig, FORMAT_KUTU } from '../../api-backend/routes/mitarbeiter-zugang-code.js';

function genAdminKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const boxId = boxIdAusPublicKey(publicKey);
  const pubBase64url = publicKeyAlsBase64url(publicKey);
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  return { publicKey, privateKey, boxId, pubBase64url, pubPem };
}

async function adminCall(baseUrl, path, { method = 'GET', body, kimlik, akteur = 'cockpit:founder@example.test', extraHeaders = {}, jetzt } = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const fullPath = akteur !== null ? `${path}${sep}akteur=${encodeURIComponent(akteur)}` : path;
  const url = `${baseUrl}${fullPath}`;
  const rawBody = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body));
  const headers = { ...extraHeaders };
  if (kimlik) {
    const sig = signiereAnfrage({ method, url, body: rawBody, kimlik, ...(jetzt !== undefined ? { jetzt } : {}) });
    Object.assign(headers, sig.headers);
  }
  if (akteur !== null) {
    headers['X-Praxura-Akteur'] = akteur;
  }
  if (rawBody !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    method,
    headers,
    ...(rawBody !== undefined ? { body: rawBody } : {}),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function seedBox(db, name = 'sonne-tal-42', boxId = 'a'.repeat(32), overrides = {}) {
  db.boxNeu({
    boxId,
    publicKey: 'pk-dummy',
    name,
    acmeUser: 'u1',
    acmeSubdomain: 'sub1',
    acmeFulldomain: 'sub1.auth.acme.example.org',
    jetzt: 1_795_000_000,
  });
  if (overrides.lanIp) {
    db.boxIp(boxId, overrides.lanIp, overrides.ipAm ?? 1_795_000_100);
  }
}

test('1. Fail-closed: ohne oder mit ungültigem MERKEZ_ADMIN_PUBKEY bleibt /internal/admin ungemountet (null / 404)', async () => {
  const db = oeffneDb(':memory:');
  const cf = fakeCloudflare();

  assert.equal(erstelleAdminBridge({ db, cf, env: {} }), null);
  assert.equal(erstelleAdminBridge({ db, cf, env: { MERKEZ_ADMIN_PUBKEY: '' } }), null);
  assert.equal(erstelleAdminBridge({ db, cf, env: { MERKEZ_ADMIN_PUBKEY: 'ungueltig!!!' } }), null);

  // RSA-Key (kein Ed25519) muss ebenfalls fail-closed null liefern
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rsaPem = rsa.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  assert.equal(erstelleAdminBridge({ db, cf, env: { MERKEZ_ADMIN_PUBKEY: rsaPem } }), null);

  // Im echten Server: ohne MERKEZ_ADMIN_PUBKEY liefert /internal/admin/status 404
  const s = await starte({ config: { env: {} } });
  try {
    const r = await fetch(`${s.basis}/internal/admin/status`);
    assert.equal(r.status, 404);
  } finally {
    await s.stop();
  }
});

test('2. 401 bei fehlender, falscher, manipulierter, abgelaufener oder wiederholter Signatur; 400 bei ungültigem Akteur', async () => {
  const keys = genAdminKeys();
  const wrongKeys = genAdminKeys();
  const s = await starte({
    jetzt: 1_800_000_000_000,
    config: {
      env: { MERKEZ_ADMIN_PUBKEY: keys.pubBase64url },
      limitAdmin: 100,
    },
  });
  try {
    // Keine Signatur
    assert.equal((await adminCall(s.basis, '/internal/admin/status')).status, 401);

    // Falscher Schlüssel (mit richtiger boxId im Header, aber fremdem Private-Key)
    const rWrongSig = await adminCall(s.basis, '/internal/admin/status', {
      kimlik: { boxId: keys.boxId, privateKey: wrongKeys.privateKey },
      jetzt: s.uhr.ms,
    });
    assert.equal(rWrongSig.status, 401);

    // Fremder Schlüssel komplett
    const rWrongKey = await adminCall(s.basis, '/internal/admin/status', {
      kimlik: { boxId: wrongKeys.boxId, privateKey: wrongKeys.privateKey },
      jetzt: s.uhr.ms,
    });
    assert.equal(rWrongKey.status, 401);

    // Abgelaufener Zeitstempel (> 300s)
    const rExpired = await adminCall(s.basis, '/internal/admin/status', {
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms - 400_000,
    });
    assert.equal(rExpired.status, 401);

    // Gültiger Aufruf + Replay mit exakt derselben Nonce
    const url = `${s.basis}/internal/admin/status?akteur=${encodeURIComponent('cockpit:f@example.test')}`;
    const sig = signiereAnfrage({
      method: 'GET',
      url,
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    });
    const resOk = await fetch(url, { headers: { ...sig.headers, 'X-Praxura-Akteur': 'cockpit:f@example.test' } });
    assert.equal(resOk.status, 200);

    const resReplay = await fetch(url, { headers: { ...sig.headers, 'X-Praxura-Akteur': 'cockpit:f@example.test' } });
    assert.equal(resReplay.status, 401);

    // Ungültiger Akteur -> 400 ungueltiger_akteur
    const rBadAkteur = await adminCall(s.basis, '/internal/admin/status', {
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      akteur: 'bad actor with spaces!',
      jetzt: s.uhr.ms,
    });
    assert.equal(rBadAkteur.status, 400);
    assert.equal(rBadAkteur.json.fehler, 'ungueltiger_akteur');

    const rNoAkteur = await adminCall(s.basis, '/internal/admin/status', {
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      akteur: null,
      jetzt: s.uhr.ms,
    });
    assert.equal(rNoAkteur.status, 400);
    assert.equal(rNoAkteur.json.fehler, 'ungueltiger_akteur');
  } finally {
    await s.stop();
  }
});

test('3. 403 bei IP-Allowlist-Verletzung und 200 bei erlaubter IP', async () => {
  const keys = genAdminKeys();
  const sBlocked = await starte({
    jetzt: 1_800_000_000_000,
    config: {
      env: {
        MERKEZ_ADMIN_PUBKEY: keys.pubPem,
        MERKEZ_ADMIN_ALLOWED_IPS: '10.99.0.5',
      },
    },
  });
  try {
    const r = await adminCall(sBlocked.basis, '/internal/admin/status', {
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: sBlocked.uhr.ms,
    });
    assert.equal(r.status, 403);
    assert.equal(r.json.fehler, 'ip_nicht_erlaubt');
  } finally {
    await sBlocked.stop();
  }

  const sAllowed = await starte({
    jetzt: 1_800_000_000_000,
    config: {
      env: {
        MERKEZ_ADMIN_PUBKEY: keys.pubPem,
        MERKEZ_ADMIN_ALLOWED_IPS: '10.99.0.5, 127.0.0.1',
      },
    },
  });
  try {
    const r = await adminCall(sAllowed.basis, '/internal/admin/status', {
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: sAllowed.uhr.ms,
    });
    assert.equal(r.status, 200);
  } finally {
    await sAllowed.stop();
  }
});

test('4. GET /status liefert kiGlobal, Boxen mit Monatsverbrauch, 7-Tage-Berichten inkl. EUR-Schätzung und Adminlog', async () => {
  const keys = genAdminKeys();
  // 2026-11-27T12:00:00Z = 1795780800s
  const nowMs = Date.parse('2026-11-27T12:00:00.000Z');
  const nowSek = Math.floor(nowMs / 1000);
  const s = await starte({
    jetzt: nowMs,
    config: {
      env: {
        MERKEZ_ADMIN_PUBKEY: keys.pubBase64url,
        KI_DEPLOYMENT: 'gpt-5-mini',
        KI_DEPLOYMENT_TRANSCRIBE: 'gpt-4o-transcribe',
      },
      ki: {
        gueltig: true,
        endpoint: 'https://ki-test.example.openai.azure.com/',
        deployment: 'gpt-5-mini',
        region: 'germanywestcentral',
        apiVersion: '2024-10-21',
        monatsLimit: 750,
      },
    },
  });
  try {
    const boxId = 'b'.repeat(32);
    seedBox(s.db, 'mond-see-12', boxId, { lanIp: '192.168.10.22', ipAm: nowSek - 120 });
    s.db.boxKiSetzen('mond-see-12', 'aktiv');
    s.db.boxKiLimitSetzen('mond-see-12', 1200);
    s.db.einstellungSetzen('ki_global', 'an');

    // 2 Jetons im aktuellen Berliner Monat (2026-11)
    s.db.kiAusgabeEintragen({ boxId, zeit: nowSek - 100, monat: '2026-11', exp: nowSek + 3500, entraExp: nowSek + 3500 });
    s.db.kiAusgabeEintragen({ boxId, zeit: nowSek - 50, monat: '2026-11', exp: nowSek + 3550, entraExp: nowSek + 3550 });

    // Aktueller Bericht (innerhalb 7 Tage): 1M input + 500k output (davon 100k reasoning) gpt-5-mini + 60s Audio gpt-4o-transcribe
    s.db.kiBerichtSpeichern({
      boxId,
      reportId: 'rep-2026-11-26',
      payloadHash: 'hash-1',
      windowStart: '2026-11-26T00:00:00.000Z',
      empfangen: nowSek - 3600,
      daten: {
        reportId: 'rep-2026-11-26',
        windowStart: '2026-11-26T00:00:00.000Z',
        windowEnd: '2026-11-27T00:00:00.000Z',
        taskTotals: {
          'b2c-draft': {
            calls: 4,
            prompt_tokens: 1_000_000,
            completion_tokens: 500_000,
            total_tokens: 1_500_000,
            reasoning_tokens: 100_000,
          },
          transkribieren: {
            calls: 2,
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            audio_seconds: 60,
          },
        },
      },
    });

    // Alter Bericht (> 7 Tage zurück) darf nicht in letzte_berichte gezählt werden
    s.db.kiBerichtSpeichern({
      boxId,
      reportId: 'rep-old',
      payloadHash: 'hash-old',
      windowStart: '2026-11-10T00:00:00.000Z',
      empfangen: nowSek - 16 * 86400,
      daten: {
        reportId: 'rep-old',
        windowStart: '2026-11-10T00:00:00.000Z',
        windowEnd: '2026-11-11T00:00:00.000Z',
        taskTotals: {
          'b2c-draft': { calls: 99, prompt_tokens: 999, completion_tokens: 999, total_tokens: 1998 },
        },
      },
    });

    s.db.adminLog('system', 'test-eintrag', 'mond-see-12', { info: 1 }, nowSek - 10);

    const r = await adminCall(s.basis, '/internal/admin/status', {
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.kiGlobal, 'an');
    assert.equal(r.json.monatsLimitStandard, 750);
    assert.equal(r.json.monat, '2026-11');
    assert.equal(r.json.boxes.length, 1);

    const box = r.json.boxes[0];
    assert.equal(box.name, 'mond-see-12');
    assert.equal(box.lan_ip, '192.168.10.22');
    assert.equal(box.ki_status, 'aktiv');
    assert.equal(box.ki_limit, 1200);
    assert.equal(box.ki_ausgaben_monat, 2);
    assert.equal(box.public_key, undefined);
    assert.equal(box.acme_user, undefined);

    assert.equal(box.letzte_berichte.report_count, 1);
    assert.equal(box.letzte_berichte.calls, 6);
    assert.equal(box.letzte_berichte.prompt_tokens, 1_000_000);
    assert.equal(box.letzte_berichte.completion_tokens, 500_000);
    assert.equal(box.letzte_berichte.reasoning_tokens, 100_000);
    assert.equal(box.letzte_berichte.audio_seconds, 60);
    // gpt-5-mini: 1M * 0.253 + 0.5M * 2.024 = 1.265; gpt-4o-transcribe: 1 min * 0.006072 = 0.006072 -> 1.271072
    assert.equal(box.letzte_berichte.cost_eur, 1.271072);

    assert.equal(r.json.adminlogRecent.length, 1);
    assert.equal(r.json.adminlogRecent[0].aktion, 'test-eintrag');
  } finally {
    await s.stop();
  }
});

test('5. POST /codes/new & POST /codes/rebind: gültiger Code, nur Hash in DB, Adminlog ohne Klartext', async () => {
  const keys = genAdminKeys();
  const s = await starte({
    jetzt: 1_800_000_000_000,
    config: { env: { MERKEZ_ADMIN_PUBKEY: keys.pubBase64url } },
  });
  try {
    const rNew = await adminCall(s.basis, '/internal/admin/codes/new', {
      method: 'POST',
      body: {},
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      akteur: 'cockpit:tech@example.test',
      jetzt: s.uhr.ms,
    });
    assert.equal(rNew.status, 201);
    assert.ok(istKutuCodeGueltig(rNew.json.code));
    assert.equal(rNew.json.gueltigBis, 1_800_000_000 + 14 * 86400);

    const rowNew = s.db.codeHolen(hashCode(rNew.json.code, FORMAT_KUTU));
    assert.equal(rowNew.art, 'kurulum');

    // Rebind für unbekannte Box -> 404
    const rMiss = await adminCall(s.basis, '/internal/admin/codes/rebind', {
      method: 'POST',
      body: { name: 'sonne-tal-42' },
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    });
    assert.equal(rMiss.status, 404);

    // Aktive Box anlegen -> Rebind 201 (72h)
    seedBox(s.db, 'sonne-tal-42');
    const rRebind = await adminCall(s.basis, '/internal/admin/codes/rebind', {
      method: 'POST',
      body: { name: 'sonne-tal-42' },
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      akteur: 'cockpit:tech@example.test',
      jetzt: s.uhr.ms,
    });
    assert.equal(rRebind.status, 201);
    assert.equal(rRebind.json.name, 'sonne-tal-42');
    assert.ok(istKutuCodeGueltig(rRebind.json.code));
    assert.equal(rRebind.json.gueltigBis, 1_800_000_000 + 3 * 86400);

    // Gesperrte Box -> 409
    s.db.boxIptal('sonne-tal-42', 1_800_000_000);
    const rInactive = await adminCall(s.basis, '/internal/admin/codes/rebind', {
      method: 'POST',
      body: { name: 'sonne-tal-42' },
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    });
    assert.equal(rInactive.status, 409);

    // Klartext-Codes dürfen weder in adminlog noch in codes stehen
    const logs = s.db.adminLogLesen();
    assert.deepEqual(logs.map((l) => l.aktion), ['kod-neu', 'kod-rebind']);
    assert.equal(logs[0].akteur, 'cockpit:tech@example.test');
    const logDump = JSON.stringify(logs);
    assert.ok(!logDump.includes(rNew.json.code));
    assert.ok(!logDump.includes(rNew.json.code.replace(/-/g, '')));
    assert.ok(!logDump.includes(rRebind.json.code));
  } finally {
    await s.stop();
  }
});

test('6. POST /boxes/:name/ki: Status und Limit aktualisieren, validieren und protokollieren', async () => {
  const keys = genAdminKeys();
  const s = await starte({
    jetzt: 1_800_000_000_000,
    config: { env: { MERKEZ_ADMIN_PUBKEY: keys.pubBase64url } },
  });
  try {
    seedBox(s.db, 'stern-berg-7');

    // Status aktiv + Limit 900
    const r1 = await adminCall(s.basis, '/internal/admin/boxes/stern-berg-7/ki', {
      method: 'POST',
      body: { status: 'aktiv', limit: 900 },
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      akteur: 'cockpit:founder@example.test',
      jetzt: s.uhr.ms,
    });
    assert.equal(r1.status, 200);
    assert.equal(r1.json.ok, true);
    assert.equal(r1.json.box.ki_status, 'aktiv');
    assert.equal(r1.json.box.ki_limit, 900);

    // Limit zurück auf 'standard' (null) und Status 'aus'
    const r2 = await adminCall(s.basis, '/internal/admin/boxes/stern-berg-7/ki', {
      method: 'POST',
      body: { status: 'aus', limit: 'standard' },
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    });
    assert.equal(r2.status, 200);
    assert.equal(r2.json.box.ki_status, 'aus');
    assert.equal(r2.json.box.ki_limit, null);

    // Ungültiges Limit / Status / unbekannte Box
    assert.equal((await adminCall(s.basis, '/internal/admin/boxes/stern-berg-7/ki', {
      method: 'POST',
      body: { limit: 0 },
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    })).status, 400);

    assert.equal((await adminCall(s.basis, '/internal/admin/boxes/stern-berg-7/ki', {
      method: 'POST',
      body: { limit: 1_000_001 },
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    })).status, 400);

    assert.equal((await adminCall(s.basis, '/internal/admin/boxes/stern-berg-7/ki', {
      method: 'POST',
      body: { status: 'kaputt' },
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    })).status, 400);

    assert.equal((await adminCall(s.basis, '/internal/admin/boxes/licht-tal-99/ki', {
      method: 'POST',
      body: { status: 'aktiv' },
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    })).status, 404);

    const aktionen = s.db.adminLogLesen().map((l) => l.aktion);
    assert.deepEqual(aktionen, ['ki-an', 'ki-limit', 'ki-aus', 'ki-limit']);
  } finally {
    await s.stop();
  }
});

test('7. POST /ki-global & POST /boxes/:name/iptal: confirmPhrase-Pflicht, CNAME-Löschung und Adminlog', async () => {
  const keys = genAdminKeys();
  const s = await starte({
    jetzt: 1_800_000_000_000,
    config: { env: { MERKEZ_ADMIN_PUBKEY: keys.pubBase64url } },
  });
  try {
    seedBox(s.db, 'wald-bach-15');
    s.cloudflare.rec.set('A|wald-bach-15.box.example.org', { ip: '192.168.1.50' });
    s.cloudflare.rec.set('CNAME|_acme-challenge.wald-bach-15.box.example.org', { ziel: 'sub1.auth.acme.example.org' });

    // /ki-global ohne passende confirmPhrase -> 400
    const rBadGlobal = await adminCall(s.basis, '/internal/admin/ki-global', {
      method: 'POST',
      body: { wert: 'an', confirmPhrase: 'FALSCH' },
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    });
    assert.equal(rBadGlobal.status, 400);
    assert.equal(rBadGlobal.json.fehler, 'bestaetigung_fehlt');
    assert.equal(s.db.einstellungLesen('ki_global'), null);

    // /ki-global mit exakter confirmPhrase -> 200
    const rGoodGlobal = await adminCall(s.basis, '/internal/admin/ki-global', {
      method: 'POST',
      body: { wert: 'an', confirmPhrase: 'KI-GLOBAL-AN' },
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    });
    assert.equal(rGoodGlobal.status, 200);
    assert.equal(rGoodGlobal.json.kiGlobal, 'an');
    assert.equal(s.db.einstellungLesen('ki_global'), 'an');

    // /boxes/:name/iptal ohne exakte confirmPhrase -> 400
    const rBadIptal = await adminCall(s.basis, '/internal/admin/boxes/wald-bach-15/iptal', {
      method: 'POST',
      body: { confirmPhrase: 'IPTAL-andere-box-1' },
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    });
    assert.equal(rBadIptal.status, 400);
    assert.equal(s.db.boxNachName('wald-bach-15').status, 'aktiv');

    // /boxes/:name/iptal mit exakter confirmPhrase -> 200 + CNAME weg + A-Record bleibt
    const rGoodIptal = await adminCall(s.basis, '/internal/admin/boxes/wald-bach-15/iptal', {
      method: 'POST',
      body: { confirmPhrase: 'IPTAL-wald-bach-15' },
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      akteur: 'cockpit:founder@example.test',
      jetzt: s.uhr.ms,
    });
    assert.equal(rGoodIptal.status, 200);
    assert.equal(rGoodIptal.json.status, 'iptal');
    assert.equal(s.db.boxNachName('wald-bach-15').status, 'iptal');
    assert.ok(s.cloudflare.rec.has('A|wald-bach-15.box.example.org'));
    assert.ok(!s.cloudflare.rec.has('CNAME|_acme-challenge.wald-bach-15.box.example.org'));

    const logs = s.db.adminLogLesen();
    assert.deepEqual(logs.map((l) => l.aktion), ['ki-global', 'iptal']);
  } finally {
    await s.stop();
  }
});

test('8. Akteur-Bindung: Query-Manipulation -> 401; Header-Mismatch -> 400 ohne Nonce-Verbrauch', async () => {
  const keys = genAdminKeys();
  const s = await starte({
    jetzt: 1_800_000_000_000,
    config: { env: { MERKEZ_ADMIN_PUBKEY: keys.pubBase64url }, limitAdmin: 100 },
  });
  try {
    const signedAkteur = 'cockpit:alice@example.test';
    const urlAlice = `${s.basis}/internal/admin/status?akteur=${encodeURIComponent(signedAkteur)}`;
    const sigAlice = signiereAnfrage({
      method: 'GET',
      url: urlAlice,
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    });

    // 1. Header-Mismatch -> 400 ungueltiger_akteur, Nonce darf NICHT verbrannt werden
    const rMismatch = await fetch(urlAlice, {
      headers: { ...sigAlice.headers, 'X-Praxura-Akteur': 'cockpit:bob@example.test' },
    });
    assert.equal(rMismatch.status, 400);
    assert.equal((await rMismatch.json()).fehler, 'ungueltiger_akteur');

    // Dieselbe Nonce mit passendem Header muss danach noch 200 liefern
    const rAfterMismatch = await fetch(urlAlice, {
      headers: { ...sigAlice.headers, 'X-Praxura-Akteur': signedAkteur },
    });
    assert.equal(rAfterMismatch.status, 200);

    // 2. Query-Akteur nach Signierung manipuliert (mit passendem Header) -> 401 Signaturfehler
    const sigAlice2 = signiereAnfrage({
      method: 'GET',
      url: urlAlice,
      kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
      jetzt: s.uhr.ms,
    });
    const urlTampered = `${s.basis}/internal/admin/status?akteur=${encodeURIComponent('cockpit:bob@example.test')}`;
    const rTampered = await fetch(urlTampered, {
      headers: { ...sigAlice2.headers, 'X-Praxura-Akteur': 'cockpit:bob@example.test' },
    });
    assert.equal(rTampered.status, 401);
  } finally {
    await s.stop();
  }
});

test('9. Fail-closed bei fehlerhaftem MERKEZ_ADMIN_ALLOWED_IPS und 401 bei hostErwartet-Mismatch', async () => {
  const keys = genAdminKeys();
  const db = oeffneDb(':memory:');
  const cf = fakeCloudflare();

  for (const badIps of [',', ' , , ', 'not-an-ip', '127.0.0.1, ???']) {
    const errors = [];
    const bridge = erstelleAdminBridge({
      db,
      cf,
      env: { MERKEZ_ADMIN_PUBKEY: keys.pubBase64url, MERKEZ_ADMIN_ALLOWED_IPS: badIps },
      log: { error: (...a) => errors.push(a.join(' ')) },
    });
    assert.equal(bridge, null, `MERKEZ_ADMIN_ALLOWED_IPS=${JSON.stringify(badIps)} muss null liefern`);
    assert.ok(errors.length > 0);
  }

  const s = await starte({
    jetzt: 1_800_000_000_000,
    config: {
      hostErwartet: 'merkez.example.org',
      env: { MERKEZ_ADMIN_PUBKEY: keys.pubBase64url },
    },
  });
  try {
    const u = new URL(s.basis);
    const sendRawHost = (hostHeader) => new Promise((resolve, reject) => {
      const path = `/internal/admin/status?akteur=${encodeURIComponent('cockpit:f@example.test')}`;
      const sig = signiereAnfrage({
        method: 'GET',
        url: `https://${hostHeader}${path}`,
        kimlik: { boxId: keys.boxId, privateKey: keys.privateKey },
        jetzt: s.uhr.ms,
      });
      const req = http.request({
        hostname: u.hostname,
        port: Number(u.port),
        path,
        method: 'GET',
        headers: {
          Host: hostHeader,
          ...sig.headers,
          'X-Praxura-Akteur': 'cockpit:f@example.test',
        },
      }, (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject);
      req.end();
    });

    assert.equal(await sendRawHost('evil.example.org'), 401);
    assert.equal(await sendRawHost('merkez.example.org'), 200);
  } finally {
    await s.stop();
    db.close();
  }
});
