import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import express from 'express';
import { createCockpitRouter, requireCockpitRole } from './cockpit.js';
import { createCockpitMerkezRouter } from './cockpit-merkez.js';
import { oeffneDb } from '../../merkez/db.js';
import { erstelleApp } from '../../merkez/server.js';
import { fakeCloudflare, fakeAcmeDns } from '../../merkez/test/helper.js';
import { publicKeyAlsBase64url } from '../merkez-istemci/signatur.js';
import { istKutuCodeGueltig } from './mitarbeiter-zugang-code.js';

function genEd25519Pair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubBase64url = publicKeyAlsBase64url(publicKey);
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const privBase64url = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64url');
  return { publicKey, privateKey, pubBase64url, privPem, privBase64url };
}

function makeOpsSupabase() {
  const tokenUsers = {
    'tok-founder': { id: 'u-founder' },
    'tok-tech': { id: 'u-tech' },
    'tok-support': { id: 'u-support' },
    'tok-sales': { id: 'u-sales' },
  };
  const members = {
    'u-founder': { id: 'u-founder', email: 'founder@example.test', display_name: 'Founder', role: 'founder', is_active: true },
    'u-tech': { id: 'u-tech', email: 'tech@example.test', display_name: 'Tech', role: 'tech', is_active: true },
    'u-support': { id: 'u-support', email: 'support@example.test', display_name: 'Support', role: 'support', is_active: true },
    'u-sales': { id: 'u-sales', email: 'sales@example.test', display_name: 'Sales', role: 'sales', is_active: true },
  };
  return {
    auth: {
      async getUser(token) {
        const user = tokenUsers[token];
        if (!user) return { data: { user: null }, error: { message: 'invalid jwt' } };
        return { data: { user }, error: null };
      },
    },
    from(table) {
      assert.equal(table, 'ops_members');
      let filterId = null;
      const builder = {
        select() { return builder; },
        eq(col, val) {
          if (col === 'id') filterId = val;
          return builder;
        },
        async maybeSingle() {
          return { data: members[filterId] || null, error: null };
        },
      };
      return builder;
    },
  };
}

async function withExpressApp(mountPath, router, fn) {
  const app = express();
  app.use(mountPath, router);
  const server = http.createServer(app);
  await new Promise((ok) => server.listen(0, '127.0.0.1', () => ok()));
  const addr = /** @type {import('node:net').AddressInfo} */ (server.address());
  const base = `http://127.0.0.1:${addr.port}${mountPath}`;
  try {
    await fn(base);
  } finally {
    server.closeAllConnections?.();
    await new Promise((ok) => server.close(() => ok()));
  }
}

async function reqJson(base, path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

test('Fail-Closed 503 MERKEZ_BRIDGE_NOT_CONFIGURED bei fehlender oder ungültiger Bridge-Konfiguration', async () => {
  const ops = makeOpsSupabase();
  const requireRole = (roles) => requireCockpitRole(roles, { getOpsSupabase: () => ops });
  const keys = genEd25519Pair();
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rsaPrivPem = rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  const badConfigs = [
    {},
    { MERKEZ_ADMIN_URL: 'http://127.0.0.1:8788' }, // fehlender Key
    { MERKEZ_ADMIN_PRIVKEY: keys.privBase64url }, // fehlende URL
    { MERKEZ_ADMIN_URL: 'http://127.0.0.1:8788', MERKEZ_ADMIN_PRIVKEY: keys.privBase64url, NODE_ENV: 'production' }, // http in Prod verboten
    { MERKEZ_ADMIN_URL: 'http://10.0.0.5:8788', MERKEZ_ADMIN_PRIVKEY: keys.privBase64url, NODE_ENV: 'development' }, // non-localhost http verboten
    { MERKEZ_ADMIN_URL: 'https://example.org', MERKEZ_ADMIN_PRIVKEY: 'kaputt' },
    { MERKEZ_ADMIN_URL: 'https://example.org', MERKEZ_ADMIN_PRIVKEY: rsaPrivPem },
  ];

  for (const env of badConfigs) {
    const router = createCockpitMerkezRouter({ requireCockpitRole: requireRole, env });
    await withExpressApp('/api/cockpit/merkez', router, async (base) => {
      const r = await reqJson(base, '/status', { token: 'tok-founder' });
      assert.equal(r.status, 503);
      assert.equal(r.json.error, 'MERKEZ_BRIDGE_NOT_CONFIGURED');
    });
  }
});

test('Strenge RBAC: support & sales überall 403; tech kein Zugriff auf /ki-global & /iptal; unauth 401', async () => {
  const ops = makeOpsSupabase();
  const requireRole = (roles) => requireCockpitRole(roles, { getOpsSupabase: () => ops });
  const keys = genEd25519Pair();

  let upstreamCalls = 0;
  const fakeFetch = async () => {
    upstreamCalls++;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const router = createCockpitMerkezRouter({
    requireCockpitRole: requireRole,
    env: {
      NODE_ENV: 'test',
      MERKEZ_ADMIN_URL: 'http://127.0.0.1:8788',
      MERKEZ_ADMIN_PRIVKEY: keys.privBase64url,
    },
    fetchImpl: fakeFetch,
  });

  await withExpressApp('/api/cockpit/merkez', router, async (base) => {
    // Unauthentifiziert -> 401
    assert.equal((await reqJson(base, '/status')).status, 401);

    // Support & Sales -> 403 auf allen Endpunkten
    for (const tok of ['tok-support', 'tok-sales']) {
      assert.equal((await reqJson(base, '/status', { token: tok })).status, 403);
      assert.equal((await reqJson(base, '/codes/new', { method: 'POST', token: tok, body: {} })).status, 403);
      assert.equal((await reqJson(base, '/codes/rebind', { method: 'POST', token: tok, body: { name: 'sonne-tal-42' } })).status, 403);
      assert.equal((await reqJson(base, '/boxes/sonne-tal-42/ki', { method: 'POST', token: tok, body: { status: 'aktiv' } })).status, 403);
      assert.equal((await reqJson(base, '/ki-global', { method: 'POST', token: tok, body: { wert: 'an', confirmPhrase: 'KI-GLOBAL-AN' } })).status, 403);
      assert.equal((await reqJson(base, '/boxes/sonne-tal-42/iptal', { method: 'POST', token: tok, body: { confirmPhrase: 'IPTAL-sonne-tal-42' } })).status, 403);
    }

    // Tech: erlaubt auf status / codes/new / codes/rebind / boxes/:name/ki
    assert.equal((await reqJson(base, '/status', { token: 'tok-tech' })).status, 200);
    assert.equal((await reqJson(base, '/codes/new', { method: 'POST', token: 'tok-tech', body: {} })).status, 200);
    assert.equal((await reqJson(base, '/codes/rebind', { method: 'POST', token: 'tok-tech', body: { name: 'sonne-tal-42' } })).status, 200);
    assert.equal((await reqJson(base, '/boxes/sonne-tal-42/ki', { method: 'POST', token: 'tok-tech', body: { status: 'aktiv' } })).status, 200);

    // Tech: 403 auf /ki-global & /boxes/:name/iptal (founder-only!)
    assert.equal((await reqJson(base, '/ki-global', { method: 'POST', token: 'tok-tech', body: { wert: 'an', confirmPhrase: 'KI-GLOBAL-AN' } })).status, 403);
    assert.equal((await reqJson(base, '/boxes/sonne-tal-42/iptal', { method: 'POST', token: 'tok-tech', body: { confirmPhrase: 'IPTAL-sonne-tal-42' } })).status, 403);

    // Founder: erlaubt auf /ki-global & /boxes/:name/iptal
    assert.equal((await reqJson(base, '/ki-global', { method: 'POST', token: 'tok-founder', body: { wert: 'an', confirmPhrase: 'KI-GLOBAL-AN' } })).status, 200);
    assert.equal((await reqJson(base, '/boxes/sonne-tal-42/iptal', { method: 'POST', token: 'tok-founder', body: { confirmPhrase: 'IPTAL-sonne-tal-42' } })).status, 200);

    assert.equal(upstreamCalls, 6);
  });
});

test('Live Ed25519 Round-Trip: Cockpit-Router -> cockpit-merkez -> echter merkez/server.js (SQLite + Fake-CF)', async () => {
  const keys = genEd25519Pair();
  const db = oeffneDb(':memory:');
  const cf = fakeCloudflare();
  const acmedns = fakeAcmeDns();
  const nowMs = Date.now();
  const nowSek = Math.floor(nowMs / 1000);

  // Box + DNS-Eintrag anlegen
  db.boxNeu({
    boxId: 'c'.repeat(32),
    publicKey: 'pk-box-1',
    name: 'wolke-berg-8',
    acmeUser: 'u1',
    acmeSubdomain: 'sub1',
    acmeFulldomain: 'sub1.auth.acme.example.org',
    jetzt: nowSek - 86400,
  });
  db.boxIp('c'.repeat(32), '192.168.178.44', nowSek - 300);
  cf.rec.set('A|wolke-berg-8.box.example.org', { ip: '192.168.178.44', ttl: 3600 });
  cf.rec.set('CNAME|_acme-challenge.wolke-berg-8.box.example.org', { ziel: 'sub1.auth.acme.example.org', ttl: 600 });

  const merkezApp = erstelleApp({
    db,
    cloudflare: cf,
    acmedns,
    config: {
      boxDomain: 'box.example.org',
      acmeDnsUrl: 'https://acme.example.org',
      trustProxy: 1,
      env: { MERKEZ_ADMIN_PUBKEY: keys.pubBase64url },
    },
    jetzt: () => nowMs,
  });

  const merkezServer = await new Promise((ok) => {
    const s = merkezApp.listen(0, '127.0.0.1', () => ok(s));
  });
  const merkezAddr = /** @type {import('node:net').AddressInfo} */ (merkezServer.address());
  const merkezUrl = `http://127.0.0.1:${merkezAddr.port}`;

  const ops = makeOpsSupabase();
  const cockpitRouter = createCockpitRouter({
    supabase: null,
    opsSupabase: ops,
    merkezEnv: {
      NODE_ENV: 'test',
      MERKEZ_ADMIN_URL: merkezUrl,
      MERKEZ_ADMIN_PRIVKEY: keys.privPem, // PEM-Format hier testen
    },
  });

  try {
    await withExpressApp('/api/cockpit', cockpitRouter, async (base) => {
      // 1. Tech liest /merkez/status
      const rStatus = await reqJson(base, '/merkez/status', { token: 'tok-tech' });
      assert.equal(rStatus.status, 200);
      assert.equal(rStatus.json.kiGlobal, 'aus');
      assert.equal(rStatus.json.boxes.length, 1);
      assert.equal(rStatus.json.boxes[0].name, 'wolke-berg-8');
      assert.equal(rStatus.json.boxes[0].lan_ip, '192.168.178.44');

      // 2. Tech erstellt Einrichtungscode
      const rCode = await reqJson(base, '/merkez/codes/new', { method: 'POST', token: 'tok-tech', body: {} });
      assert.equal(rCode.status, 201);
      assert.ok(istKutuCodeGueltig(rCode.json.code));

      // 3. Tech erstellt Rebind-Code
      const rRebind = await reqJson(base, '/merkez/codes/rebind', {
        method: 'POST',
        token: 'tok-tech',
        body: { name: 'wolke-berg-8' },
      });
      assert.equal(rRebind.status, 201);
      assert.equal(rRebind.json.name, 'wolke-berg-8');
      assert.ok(istKutuCodeGueltig(rRebind.json.code));

      // 4. Tech schaltet KI für Box an & setzt Limit
      const rBoxKi = await reqJson(base, '/merkez/boxes/wolke-berg-8/ki', {
        method: 'POST',
        token: 'tok-tech',
        body: { status: 'aktiv', limit: 1500 },
      });
      assert.equal(rBoxKi.status, 200);
      assert.equal(rBoxKi.json.box.ki_status, 'aktiv');
      assert.equal(rBoxKi.json.box.ki_limit, 1500);

      // 5. Tech darf KI-Global NICHT schalten -> 403
      const rTechGlobal = await reqJson(base, '/merkez/ki-global', {
        method: 'POST',
        token: 'tok-tech',
        body: { wert: 'an', confirmPhrase: 'KI-GLOBAL-AN' },
      });
      assert.equal(rTechGlobal.status, 403);

      // 6. Founder schaltet KI-Global ein
      const rFounderGlobal = await reqJson(base, '/merkez/ki-global', {
        method: 'POST',
        token: 'tok-founder',
        body: { wert: 'an', confirmPhrase: 'KI-GLOBAL-AN' },
      });
      assert.equal(rFounderGlobal.status, 200);
      assert.equal(rFounderGlobal.json.kiGlobal, 'an');

      // 7. Founder sperrt Box (Iptal) mit Bestätigungsphrase
      const rIptal = await reqJson(base, '/merkez/boxes/wolke-berg-8/iptal', {
        method: 'POST',
        token: 'tok-founder',
        body: { confirmPhrase: 'IPTAL-wolke-berg-8' },
      });
      assert.equal(rIptal.status, 200);
      assert.equal(rIptal.json.status, 'iptal');
      assert.ok(cf.rec.has('A|wolke-berg-8.box.example.org'));
      assert.ok(!cf.rec.has('CNAME|_acme-challenge.wolke-berg-8.box.example.org'));

      // Adminlog prüfen: Cockpit-Akteure exakt protokolliert, keine Klartext-Codes
      const logs = db.adminLogLesen();
      assert.deepEqual(
        logs.map((l) => [l.akteur, l.aktion]),
        [
          ['cockpit:tech@example.test', 'kod-neu'],
          ['cockpit:tech@example.test', 'kod-rebind'],
          ['cockpit:tech@example.test', 'ki-an'],
          ['cockpit:tech@example.test', 'ki-limit'],
          ['cockpit:founder@example.test', 'ki-global'],
          ['cockpit:founder@example.test', 'iptal'],
        ]
      );
      const logStr = JSON.stringify(logs);
      assert.ok(!logStr.includes(rCode.json.code));
      assert.ok(!logStr.includes(rRebind.json.code));
    });
  } finally {
    merkezServer.closeAllConnections?.();
    await new Promise((ok) => merkezServer.close(() => ok()));
    db.close();
  }
});

test('Negativtests: ungültiger/Traversal-:name -> 400 INVALID_BOX_NAME; Upstream-Fehler -> 502/504', async () => {
  const ops = makeOpsSupabase();
  const requireRole = (roles) => requireCockpitRole(roles, { getOpsSupabase: () => ops });
  const keys = genEd25519Pair();

  let upstreamMode = 'invalid-json';
  const router = createCockpitMerkezRouter({
    requireCockpitRole: requireRole,
    env: {
      NODE_ENV: 'test',
      MERKEZ_ADMIN_URL: 'http://127.0.0.1:8788',
      MERKEZ_ADMIN_PRIVKEY: keys.privBase64url,
    },
    fetchImpl: async () => {
      if (upstreamMode === 'invalid-json') {
        return new Response('<html>bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } });
      }
      if (upstreamMode === 'timeout') {
        const err = new Error('timed out');
        err.name = 'TimeoutError';
        throw err;
      }
      throw new Error('ECONNREFUSED');
    },
  });

  await withExpressApp('/api/cockpit/merkez', router, async (base) => {
    for (const badName of ['..%2F..%2Fetc', 'BAD_NAME', 'a-b-0', 'sonne-tal']) {
      const rKi = await reqJson(base, `/boxes/${badName}/ki`, {
        method: 'POST',
        token: 'tok-tech',
        body: { status: 'aktiv' },
      });
      assert.equal(rKi.status, 400);
      assert.equal(rKi.json.error, 'INVALID_BOX_NAME');

      const rIptal = await reqJson(base, `/boxes/${badName}/iptal`, {
        method: 'POST',
        token: 'tok-founder',
        body: { confirmPhrase: `IPTAL-${badName}` },
      });
      assert.equal(rIptal.status, 400);
      assert.equal(rIptal.json.error, 'INVALID_BOX_NAME');
    }

    const rRebindBad = await reqJson(base, '/codes/rebind', {
      method: 'POST',
      token: 'tok-tech',
      body: { name: '../admin' },
    });
    assert.equal(rRebindBad.status, 400);
    assert.equal(rRebindBad.json.error, 'INVALID_BOX_NAME');

    upstreamMode = 'invalid-json';
    const rBadJson = await reqJson(base, '/status', { token: 'tok-tech' });
    assert.equal(rBadJson.status, 502);
    assert.equal(rBadJson.json.error, 'MERKEZ_UPSTREAM_INVALID');

    upstreamMode = 'network';
    const rUnreachable = await reqJson(base, '/status', { token: 'tok-tech' });
    assert.equal(rUnreachable.status, 502);
    assert.equal(rUnreachable.json.error, 'MERKEZ_UPSTREAM_UNREACHABLE');

    upstreamMode = 'timeout';
    const rTimeout = await reqJson(base, '/status', { token: 'tok-tech' });
    assert.equal(rTimeout.status, 504);
    assert.equal(rTimeout.json.error, 'MERKEZ_UPSTREAM_TIMEOUT');
  });
});
