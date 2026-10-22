// Billing auth contract: actual router + installed Supabase SDK, synthetic HTTP only.
// Reproduce: node --test api-backend/billing/api/billing-auth-contract.test.js
// Intent: upstream outages deny access with 503; rejected credentials retain 401.
// This proves local classification only, not the cause of any live 401.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';

process.env.SUPABASE_URL = 'http://billing-auth.synthetic.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key';
const originalFetch = globalThis.fetch;
let mode = 'valid', authCalls = [], businessCalls = [], unexpected = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.origin !== process.env.SUPABASE_URL) {
    unexpected.push(url.origin);
    throw new Error('Unexpected HTTP denied');
  }
  if (url.pathname === '/auth/v1/user') {
    const headers = new Headers(options.headers);
    authCalls.push({ authorization: headers.get('authorization'), apikey: headers.get('apikey') });
    if (mode === 'network') throw new TypeError('synthetic private network detail');
    if (mode === 'non-json-500') return new Response('synthetic upstream HTML', { status: 500 });
    if (mode === 'malformed-json-500') return new Response('{broken', { status: 500, headers: { 'Content-Type': 'application/json' } });
    if (mode === 'rejected' || mode === 'expired') return json({ message: 'synthetic private rejection', code: mode === 'expired' ? 'jwt_expired' : 'bad_jwt' }, 401);
    if (typeof mode === 'number') return json({ message: 'synthetic private upstream detail' }, mode);
    return json({ id: 'synthetic-owner', aud: 'authenticated' });
  }
  businessCalls.push(url.pathname);
  throw new Error('Unexpected business HTTP denied');
};
const { default: router, handleEmpfaengerPruefung } = await import('./abrechnung.routes.js');
const app = express();
app.use(router);
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
after(async () => {
  globalThis.fetch = originalFetch;
  await new Promise(resolve => server.close(resolve));
});

const failureModes = [['rejected', 401], ['expired', 401], ['null-user', 401], [408, 503], [429, 503], ['non-json-500', 503], ['malformed-json-500', 503], [500, 503], [502, 503], [503, 503], [504, 503], ['network', 503]];
for (const path of ['/positions', '/positions/podologie?date=2026-10-22', '/abrechnung/synthetic-id/zeilen']) {
  for (const [scenario, expected] of [['missing', 401], ...failureModes.filter(([mode]) => mode !== 'null-user')]) {
    test(`${path}: ${scenario} -> ${expected}, no business reads`, async () => {
      mode = scenario; authCalls = []; businessCalls = []; unexpected = [];
      const response = await originalFetch(origin + path, {
        headers: scenario === 'missing' ? {} : { Authorization: 'Bearer synthetic-user-token' },
      });
      const body = await response.json();
      assert.deepEqual(businessCalls, []);
      assert.deepEqual(unexpected, []);
      assert.deepEqual(authCalls, scenario === 'missing' ? [] : [{ authorization: 'Bearer synthetic-user-token', apikey: 'synthetic-service-key' }]);
      assert.equal(response.status, expected);
      assert.deepEqual(body, scenario === 'missing' ? { error: 'Missing bearer token' } : expected === 401
        ? { error: 'Invalid token' }
        : { error: 'Authentifizierungsdienst vorübergehend nicht verfügbar. Bitte später erneut versuchen.', code: 'AUTH_UNAVAILABLE' });
    });
  }
}
for (const path of ['/positions', '/positions/podologie?date=2026-10-22']) {
  test(`${path}: valid token -> 200 positions, exact SDK headers`, async () => {
    mode = 'valid'; authCalls = []; businessCalls = []; unexpected = [];
    const response = await originalFetch(origin + path, { headers: { Authorization: 'Bearer synthetic-user-token' } });
    assert.equal(response.status, 200);
    assert.ok((await response.json()).positions.length > 0);
    assert.deepEqual(authCalls, [{ authorization: 'Bearer synthetic-user-token', apikey: 'synthetic-service-key' }]);
    assert.deepEqual(businessCalls, []);
    assert.deepEqual(unexpected, []);
  });
}
for (const [path, rejectedText, missingText] of [
  ['/prescription/synthetic-id/zuzahlungsrechnung', 'Ungültiges Token', 'Nicht autorisiert'],
  ['/prescription/synthetic-id/rechnung?type=rzg_quittung', 'Ungültiges Token', 'Nicht autorisiert'],
  ['/belegliste/export', 'Nicht autorisiert: Ungültiger Token', 'Nicht autorisiert: Fehlender Token'],
]) {
  for (const [scenario, expected] of [['missing', 401], ...failureModes.filter(([mode]) => mode !== 'null-user')]) {
    test(`legacy ${path}: ${scenario} -> ${expected}, preserves text contract and denies before reads`, async () => {
      mode = scenario; authCalls = []; businessCalls = []; unexpected = [];
      const response = await originalFetch(origin + path, {
        headers: scenario === 'missing' ? {} : { Authorization: 'Bearer synthetic-user-token' },
      });
      assert.equal(response.status, expected);
      assert.equal(await response.text(), scenario === 'missing' ? missingText : expected === 401 ? rejectedText
        : 'Authentifizierungsdienst vorübergehend nicht verfügbar. Bitte später erneut versuchen.');
      assert.deepEqual(businessCalls, []);
      assert.deepEqual(unexpected, []);
      assert.deepEqual(authCalls, scenario === 'missing' ? [] : [{ authorization: 'Bearer synthetic-user-token', apikey: 'synthetic-service-key' }]);
    });
  }
}
for (const [scenario, expected] of failureModes.filter(([mode]) => !['non-json-500', 'malformed-json-500'].includes(mode))) {
  test(`injected handleEmpfaengerPruefung: ${scenario} denies before DB`, async () => {
    let reads = 0;
    const error = scenario === 'null-user' ? null : scenario === 'network'
      ? new TypeError('synthetic private detail')
      : { status: typeof scenario === 'number' ? scenario : 401, message: 'synthetic private detail' };
    const res = { status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
    await handleEmpfaengerPruefung({ headers: { authorization: 'Bearer synthetic-injected' } }, res, {
      auth: { async getUser(token) { assert.equal(token, 'synthetic-injected'); return { data: { user: null }, error }; } },
      db: { from() { reads++; throw new Error('No DB allowed'); } },
    });
    assert.equal(reads, 0);
    assert.equal(res.statusCode, expected);
    assert.ok(!JSON.stringify(res.body).includes('private'));
  });
}
