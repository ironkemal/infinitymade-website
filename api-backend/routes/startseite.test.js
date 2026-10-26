import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';

const origin = 'https://synthetic.invalid';
const ownerId = '00000000-0000-4000-8000-000000000001';
const employeeId = '00000000-0000-4000-8000-000000000002';
const foreignId = '00000000-0000-4000-8000-000000000003';
const names = ['geld', 'mahnungen', 'abrechnung'];
const unavailable = { status: 'fehler', code: 'BLOCK_NICHT_VERFUEGBAR' };

// Ausschließlich synthetische Werte; kein dotenv, Server oder echter Netz-Fallback.
process.env.SUPABASE_URL = origin;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-role-key';

function sdkFixture({
  userId = ownerId,
  profile = { id: userId, role: 'owner', owner_id: null, is_active: true, plan_status: 'active' },
  authStatus = 200,
  profileStatus = 200,
} = {}) {
  const calls = [];
  const violations = [];
  const reject = (reason) => {
    violations.push(reason);
    throw new Error(reason);
  };
  const fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = init?.method || (input instanceof Request ? input.method : 'GET');
    if (url.origin !== origin || url.username || url.password || method !== 'GET') {
      return reject('Fetch außerhalb des synthetischen GET-Vertrags blockiert');
    }
    const reply = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    });
    if (url.pathname === '/auth/v1/user') {
      calls.push('auth');
      return reply(authStatus === 200 ? { id: userId } : { message: 'Synthetic rejected token', code: 'bad_jwt' }, authStatus);
    }
    if (url.pathname === '/rest/v1/profiles') {
      calls.push('profile');
      assert.equal(url.searchParams.get('select'), 'id,role,owner_id,is_active,plan_status');
      assert.equal(url.searchParams.get('id'), `eq.${userId}`);
      return reply(profileStatus === 200 ? profile : { message: 'Synthetic profile failure', code: '42501' }, profileStatus);
    }
    return reject('Fachabfrage oder unbekannter SDK-Endpoint blockiert');
  };
  return { calls, violations, fetch };
}

// Echte Express-Router-/Query-/Auth-Kette mit Node-HTTP-Objekten im Speicher.
// Kein listen(), kein Port, kein HTTP-Fetch; end() fängt die serialisierte Antwort ab.
function request(router, { query = '', token = 'synthetic-token', parser = 'extended' } = {}) {
  const app = express();
  app.set('query parser', parser);
  app.use('/api', router);
  const socket = new Duplex({ read() {}, write(_chunk, _encoding, done) { done(); } });
  const req = new IncomingMessage(socket);
  req.method = 'GET';
  req.url = `/api/startseite/zusammenfassung${query}`;
  req.headers = token === null ? {} : { authorization: `Bearer ${token}` };
  const res = new ServerResponse(req);
  return new Promise((resolve, reject) => {
    res.end = (chunk) => {
      try {
        resolve({ status: res.statusCode, body: JSON.parse(String(chunk)), headers: res.getHeaders() });
      } catch (error) { reject(error); }
      return res;
    };
    app.handle(req, res, (error) => reject(error || new Error('Route nicht erreicht')));
  });
}

function countingLoaders(overrides = {}) {
  const calls = [];
  const lader = Object.fromEntries(names.map(name => [name, async (...args) => {
    calls.push({ name, args });
    return Object.hasOwn(overrides, name) ? overrides[name](...args) : { quelle: name };
  }]));
  return { lader, calls };
}

test('B04: Startseitenvertrag an Express-Router und bestehender SDK-Auth', { timeout: 10_000 }, async (t) => {
  let current;
  // SDK kann Fetch-Throws abfangen: Verletzungen daher nach JEDEM Aufruf prüfen.
  t.mock.method(globalThis, 'fetch', (...args) => {
    assert.ok(current, 'SDK-Fetch nur innerhalb einer synthetischen Fixture');
    return current.fetch(...args);
  });
  const { createStartseiteRouter } = await import('./startseite.js');

  async function invoke({ sdk = {}, lader, auth, ...options } = {}) {
    current = sdkFixture(sdk);
    const counted = countingLoaders();
    const result = await request(createStartseiteRouter({ lader: lader ?? counted.lader, auth }), options);
    assert.deepEqual(current.violations, [], 'Kein Netz-Fallback, keine Fachabfrage');
    assert.equal(result.headers['cache-control'], 'no-store');
    return { ...result, sdkCalls: current.calls, loaderCalls: counted.calls };
  }

  await t.test('ohne Token: 401, keinerlei SDK- oder Laderaufruf', async () => {
    const r = await invoke({ token: null });
    assert.equal(r.status, 401);
    assert.deepEqual(r.sdkCalls, []);
    assert.deepEqual(r.loaderCalls, []);
  });

  await t.test('Query-Token ist hier keine Anmeldung', async () => {
    const r = await invoke({ token: null, query: '?token=synthetic-token' });
    assert.equal(r.status, 401);
    assert.deepEqual(r.sdkCalls, []);
    assert.deepEqual(r.loaderCalls, []);
  });

  await t.test('abgewiesenes Token: generische 401, kein Profilzugriff', async () => {
    const r = await invoke({ sdk: { authStatus: 401 } });
    assert.equal(r.status, 401);
    assert.deepEqual(r.body, { error: 'Invalid token' });
    assert.deepEqual(r.sdkCalls, ['auth']);
    assert.deepEqual(r.loaderCalls, []);
  });

  for (const [name, sdk] of [
    ['fehlendes Profil', { profile: null }],
    ['Profilfehler', { profileStatus: 403 }],
    ['gelöschtes Profil', { profile: { id: ownerId, role: 'owner', plan_status: 'deleted' } }],
    ['inaktiver Mitarbeiter', { userId: employeeId, profile: { id: employeeId, role: 'employee', owner_id: ownerId, is_active: false } }],
  ]) {
    await t.test(`${name}: 403 ohne Fachzugriff oder Lader`, async () => {
      const r = await invoke({ sdk });
      assert.equal(r.status, 403);
      assert.deepEqual(r.sdkCalls, ['auth', 'profile']);
      assert.deepEqual(r.loaderCalls, []);
    });
  }

  const employee = { userId: employeeId, profile: { id: employeeId, role: 'employee', owner_id: ownerId, is_active: true } };
  await t.test('Mitarbeiter-Default: keine Finanzschlüssel und kein Laderaufruf', async () => {
    const r = await invoke({ sdk: employee });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { bloecke: {} });
    assert.deepEqual(r.loaderCalls, []);
    for (const name of names) assert.ok(!JSON.stringify(r.body).includes(name));
  });

  for (const owner_id of [null, employeeId]) {
    await t.test(`Mitarbeiter mit fehlender/falscher Owner-Zuordnung ${owner_id}: 403 vor Ladern`, async () => {
      const r = await invoke({ sdk: { userId: employeeId, profile: { ...employee.profile, owner_id } } });
      assert.equal(r.status, 403);
      assert.deepEqual(r.body, { code: 'NUR_INHABER' });
      assert.deepEqual(r.sdkCalls, ['auth', 'profile']);
      assert.deepEqual(r.loaderCalls, []);
    });
  }

  for (const name of [...names, names.join(',')]) {
    await t.test(`Mitarbeiter fordert ${name}: 403 NUR_INHABER vor Ladern`, async () => {
      const r = await invoke({ sdk: employee, query: `?bloecke=${name}` });
      assert.equal(r.status, 403);
      assert.deepEqual(r.body, { code: 'NUR_INHABER' });
      assert.deepEqual(r.loaderCalls, []);
    });
  }

  for (const role of [null, 'admin', 'Owner', 'unknown']) {
    await t.test(`unbekannte Rolle ${role}: 403 vor Ladern`, async () => {
      const r = await invoke({ sdk: { profile: { id: ownerId, role } } });
      assert.equal(r.status, 403);
      assert.deepEqual(r.body, { code: 'NUR_INHABER' });
      assert.deepEqual(r.loaderCalls, []);
    });
  }

  for (const authContext of [
    undefined,
    { role: 'owner' },
    { role: 'owner', userId: '', tenantId: '' },
    { role: 'owner', userId: ownerId, tenantId: foreignId },
    { role: 'employee', userId: employeeId, tenantId: '' },
    { role: 'employee', userId: employeeId, tenantId: employeeId },
  ]) {
    await t.test(`ungültiger Auth-Kontext ${JSON.stringify(authContext)}: gesperrt`, async () => {
      const r = await invoke({ auth(req, _res, next) { req.auth = authContext; next(); } });
      assert.equal(r.status, 403);
      assert.deepEqual(r.body, { code: 'NUR_INHABER' });
      assert.deepEqual(r.sdkCalls, []);
      assert.deepEqual(r.loaderCalls, []);
    });
  }

  for (const [code, queries] of [
    ['UNGUELTIGE_BLOECKE', [
      '?bloecke=', '?bloecke', '?bloecke=geld,', '?bloecke=,geld',
      '?bloecke=geld,,mahnungen', '?bloecke=geld,geld', '?bloecke=Geld',
      '?bloecke=geld,unbekannt', '?bloecke=%20geld',
      '?bloecke=geld&bloecke=mahnungen', '?bloecke=geld&bloecke=geld',
      '?bloecke[]=geld', '?bloecke[geld]=1',
    ]],
    ['UNGUELTIGE_PARAMETER', [
      '?bloecke=geld&unbekannt=1', '?tenantId=' + foreignId,
      '?owner_id=' + foreignId, '?standort_id=' + foreignId,
      '?bloecke=geld&tenantId=' + foreignId, '?__proto__[tenantId]=' + foreignId,
    ]],
  ]) {
    for (const query of queries) {
      await t.test(`ungültige Query ${query}: 400 ${code} ohne Lader`, async () => {
        const r = await invoke({ query });
        assert.equal(r.status, 400);
        assert.deepEqual(r.body, { code });
        assert.deepEqual(r.loaderCalls, []);
      });
    }
  }

  await t.test('Owner-Default: alle drei Blöcke, ausschließlich vertrauenswürdige tenantId', async () => {
    const r = await invoke({ sdk: { profile: { id: ownerId, role: 'owner', owner_id: foreignId } } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { bloecke: Object.fromEntries(names.map(name => [name, { status: 'ok', daten: { quelle: name } }])) });
    assert.deepEqual(r.loaderCalls, names.map(name => ({ name, args: [{ tenantId: ownerId }] })));
    assert.deepEqual(r.sdkCalls, ['auth', 'profile']);
  });

  await t.test('Owner mit is_active=false: laut bestehendem Authvertrag zulässig', async () => {
    const r = await invoke({ sdk: { profile: { id: ownerId, role: 'owner', is_active: false, plan_status: 'canceled' } } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.sdkCalls, ['auth', 'profile']);
    assert.deepEqual(r.loaderCalls, names.map(name => ({ name, args: [{ tenantId: ownerId }] })));
    assert.deepEqual(r.body, { bloecke: Object.fromEntries(names.map(name => [name, { status: 'ok', daten: { quelle: name } }])) });
  });

  await t.test('Auswahl: nur angeforderte Lader, auch mit einfachem Express-Queryparser', async () => {
    const r = await invoke({ query: '?bloecke=abrechnung,geld', parser: 'simple' });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body.bloecke).sort(), ['abrechnung', 'geld']);
    assert.deepEqual(r.loaderCalls.map(c => c.name).sort(), ['abrechnung', 'geld']);
    assert.deepEqual(r.loaderCalls, ['abrechnung', 'geld'].map(name => ({ name, args: [{ tenantId: ownerId }] })));
  });

  await t.test('Teil-Ausfall: 200, nur betroffener Block fehlerhaft, kein RawError', async () => {
    const fehlerDetails = 'synthetic-private-error-must-not-leak';
    const counted = countingLoaders({ geld: async () => { throw Object.assign(new Error(fehlerDetails), { code: fehlerDetails, status: 401 }); } });
    const r = await invoke({ lader: counted.lader });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.bloecke.geld, unavailable);
    assert.equal(r.body.bloecke.mahnungen.status, 'ok');
    assert.equal(r.body.bloecke.abrechnung.status, 'ok');
    assert.ok(!JSON.stringify(r.body).includes(fehlerDetails));
    assert.ok(!JSON.stringify(r.body).includes('stack'));
    assert.equal(counted.calls.length, 3);
  });

  await t.test('alle angeforderten Lader scheitern: 503 mit festen Blockfehlern', async () => {
    const counted = countingLoaders(Object.fromEntries(names.map(name => [name, async () => { throw new Error('synthetic failure'); }])));
    const r = await invoke({ lader: counted.lader });
    assert.equal(r.status, 503);
    assert.deepEqual(r.body, { bloecke: Object.fromEntries(names.map(name => [name, unavailable])) });
    assert.equal(counted.calls.length, 3);
  });

  await t.test('einziger angeforderter Block scheitert: 503, andere Lader unberührt', async () => {
    const counted = countingLoaders({ mahnungen() { throw new Error('synthetic synchronous failure'); } });
    const r = await invoke({ lader: counted.lader, query: '?bloecke=mahnungen' });
    assert.equal(r.status, 503);
    assert.deepEqual(r.body, { bloecke: { mahnungen: unavailable } });
    assert.deepEqual(counted.calls, [{ name: 'mahnungen', args: [{ tenantId: ownerId }] }]);
  });

  await t.test('fehlende Adapter: unavailable statt erfundener Nullwerte', async () => {
    const r = await invoke({ lader: {} });
    assert.equal(r.status, 503);
    assert.deepEqual(r.body, { bloecke: Object.fromEntries(names.map(name => [name, unavailable])) });
  });

  for (const data of [null, undefined, new Error('synthetic resolved error')]) {
    await t.test(`ungültige Laderantwort ${String(data)}: Blockfehler statt ok/0`, async () => {
      const r = await invoke({ lader: { geld: async () => data }, query: '?bloecke=geld' });
      assert.equal(r.status, 503);
      assert.deepEqual(r.body, { bloecke: { geld: unavailable } });
    });
  }

  await t.test('Serialisierungsfehler bleibt auf betroffenen Block beschränkt', async () => {
    const r = await invoke({ lader: { geld: async () => ({ ungueltig: 1n }), abrechnung: async () => ({ quelle: 'abrechnung' }) }, query: '?bloecke=geld,abrechnung' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.bloecke.geld, unavailable);
    assert.deepEqual(r.body.bloecke.abrechnung, { status: 'ok', daten: { quelle: 'abrechnung' } });
  });
});
