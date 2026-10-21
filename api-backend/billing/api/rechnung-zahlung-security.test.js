import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

const realFetch = globalThis.fetch;
const calls = [];
let state;
const owner = 'owner-1';
const employee = 'employee-1';
const business = 'business-1';
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Exercise the actual router and Supabase SDK. Only SDK HTTP transport is synthetic.
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  assert.equal(url.hostname, 'payment-security.invalid', 'SDK requests must stay synthetic');
  const headers = new Headers(options.headers);
  const authorization = headers.get('authorization');
  const body = options.body ? JSON.parse(options.body) : null;
  calls.push({ path: url.pathname, query: url.searchParams, authorization, body });
  if (url.pathname === '/auth/v1/user') return reply({ id: state.role === 'owner' ? owner : employee });
  if (url.pathname.endsWith('/profiles')) {
    const id = url.searchParams.get('id')?.slice(3);
    if (id === owner) return reply({ id: owner, role: state.ownerRole || 'owner', is_active: true, buchungskonten: null });
    return reply({ id: employee, role: 'employee', owner_id: state.orphan ? null : owner,
      is_active: Object.hasOwn(state, 'active') ? state.active : true });
  }
  if (url.pathname.endsWith('/invoices')) {
    if (state.foreignInvoice && url.searchParams.get('owner_id') === `eq.${owner}`) return reply(null);
    return reply({ id: 'invoice-1', owner_id: state.foreignInvoice ? 'foreign-owner' : owner, business_id: state.nullBusiness ? null : business, total_patient: 100, status: 'offen' });
  }
  if (url.pathname.endsWith('/businesses')) return reply(state.foreignBusiness ? null : { id: business, owner_id: owner });
  if (url.pathname.endsWith('/rpc/get_my_permissions')) {
    if (state.permissionError) return reply({ message: 'Unavailable', code: 'XX000' }, 500);
    return reply(Object.hasOwn(state, 'permissions') ? state.permissions : [{ module: 'abrechnung', has_access: false }]);
  }
  if (url.pathname.endsWith('/rechnung_zahlungen')) return reply([]);
  if (url.pathname.endsWith('/rpc/rechnung_zahlung_buchen')) return reply({ ok: true, id: 'payment-1' });
  throw new Error(`Unexpected SDK request: ${url}`);
};
process.env.SUPABASE_URL = 'https://payment-security.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key';
const { default: router } = await import('./rechnung-zahlung.routes.js');
let server;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use(router);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { globalThis.fetch = realFetch; await new Promise(resolve => server.close(resolve)); });
async function request(method, overrides = {}, body = {}) {
  state = { role: 'employee', ...overrides };
  calls.length = 0;
  return realFetch(`${base}/rechnungen/invoice-1/${method === 'GET' ? 'zahlungen' : 'zahlung'}?business_id=attacker-business`, {
    method, headers: { Authorization: `Bearer ${state.token || 'synthetic-user-token'}`, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify({ eingegangener_betrag: 50, gegenkonto_code: '1200', ...body }) } : {}),
  });
}
function assertDeniedSideEffects() {
  assert.equal(calls.some(c => /rechnung_zahlungen|rechnung_zahlung_buchen/.test(c.path)), false);
  assert.equal(calls.some(c => c.path.endsWith('/profiles') && c.query.get('select')?.includes('buchungskonten')), false);
}
for (const method of ['GET', 'POST']) {
  for (const [label, overrides] of [
    ['denied group or explicit false override', {}],
    ['missing rights', { permissions: [] }],
    ['null rights', { permissions: null }],
    ['malformed rights', { permissions: { abrechnung: true } }],
    ['truthy nonboolean right', { permissions: [{ module: 'abrechnung', has_access: 'true' }] }],
    ['unrelated module grant', { permissions: [{ module: 'calendar', has_access: true }] }],
    // The existing DB RPC returns the effective false after applying a personal
    // deny override to a group grant. The route must honor that result verbatim.
    ['effective override deny', { permissions: [{ module: 'calendar', has_access: true }, { module: 'abrechnung', has_access: false }] }],
    ['permission lookup error', { permissionError: true }],
    ['foreign business', { foreignBusiness: true, permissions: [{ module: 'abrechnung', has_access: true }] }],
    ['null business', { nullBusiness: true }],
    ['inactive employee', { active: false }],
    ['unknown employee activity', { active: null }],
    ['orphan employee', { orphan: true }],
    ['invalid tenant owner', { ownerRole: 'employee' }],
  ]) test(`${method}: rejects ${label} before ledger/accounts/payment`, async () => {
    const res = await request(method, overrides);
    assert.equal(res.status, 403);
    assertDeniedSideEffects();
  });
  test(`${method}: foreign invoice is hidden`, async () => {
    const res = await request(method, { foreignInvoice: true });
    assert.equal(res.status, 404);
    assertDeniedSideEffects();
  });
  for (const role of ['owner', 'employee']) test(`${method}: allows ${role} with authoritative permission scope`, async () => {
    const res = await request(method, { role, permissions: [{ module: 'abrechnung', has_access: true }] }, { business_id: 'attacker-business' });
    assert.equal(res.status, method === 'GET' ? 200 : 201, await res.text());
    const permission = calls.find(c => c.path.endsWith('/rpc/get_my_permissions'));
    if (role === 'employee') {
      assert.equal(permission.authorization, 'Bearer synthetic-user-token');
      assert.equal(permission.body.p_business_id, business);
    } else assert.equal(permission, undefined);
    const invoiceIndex = calls.findIndex(c => c.path.endsWith('/invoices'));
    assert.ok(invoiceIndex >= 0);
    assert.equal(calls[invoiceIndex].query.get('owner_id'), `eq.${owner}`);
    assert.ok(calls[invoiceIndex].query.get('select').includes('business_id'));
    for (const path of ['/rechnung_zahlungen', '/rpc/rechnung_zahlung_buchen']) {
      const index = calls.findIndex(c => c.path.endsWith(path));
      if (index >= 0) {
        assert.ok(index > invoiceIndex);
        if (role === 'employee') assert.ok(index > calls.indexOf(permission));
      }
    }
    const accountsIndex = calls.findIndex(c => c.path.endsWith('/profiles') && c.query.get('select')?.includes('buchungskonten'));
    assert.ok(accountsIndex > invoiceIndex);
    if (role === 'employee') assert.ok(accountsIndex > calls.indexOf(permission));
    if (method === 'POST') {
      const payment = calls.find(c => c.path.endsWith('/rpc/rechnung_zahlung_buchen'));
      assert.equal(payment.body.p_owner_id, owner);
      assert.equal(payment.body.p_invoice_id, 'invoice-1');
      assert.equal(payment.body.p_restbetrag_modus, 'offen_lassen');
      assert.equal(payment.body.p_ausbuchungskonto_code, null);
    }
  });
}
for (const role of ['owner', 'employee']) test(`POST: ${role} can book payment plus writeoff`, async () => {
  const res = await request('POST', { role, permissions: [{ module: 'abrechnung', has_access: true }] }, { restbetrag_modus: 'ausbuchen' });
  assert.equal(res.status, 201);
  const rpc = calls.find(c => c.path.endsWith('/rpc/rechnung_zahlung_buchen'));
  assert.equal(rpc.body.p_restbetrag_modus, 'ausbuchen');
  assert.equal(rpc.body.p_ausbuchungskonto_code, '8700');
  assert.equal(rpc.body.p_created_by, role === 'owner' ? owner : employee);
});
test('Permission lookup uses each request JWT without retaining prior caller context', async () => {
  for (const token of ['synthetic-user-token-one', 'synthetic-user-token-two']) {
    const res = await request('GET', { token, permissions: [{ module: 'abrechnung', has_access: true }] });
    assert.equal(res.status, 200);
    const permission = calls.find(c => c.path.endsWith('/rpc/get_my_permissions'));
    assert.equal(permission.authorization, `Bearer ${token}`);
    assert.deepEqual(permission.body, { p_business_id: business });
  }
});
test('Owner legacy invoice without business remains readable', async () => {
  assert.equal((await request('GET', { role: 'owner', nullBusiness: true })).status, 200);
});
test('Owner legacy invoice without business remains payable', async () => {
  assert.equal((await request('POST', { role: 'owner', nullBusiness: true })).status, 201);
  assert.equal(calls.some(c => c.path.endsWith('/rpc/get_my_permissions')), false);
});
for (const role of ['owner', 'employee']) {
  for (const [label, body] of [
    ['zero amount', { eingegangener_betrag: 0 }],
    ['unknown account', { gegenkonto_code: 'missing' }],
    ['unknown writeoff account', { restbetrag_modus: 'ausbuchen', ausbuchungskonto_code: 'missing' }],
    ['invalid remainder mode', { restbetrag_modus: 'discard' }],
    ['invalid date', { zahlungsdatum: '18.10.2026' }],
  ]) test(`POST: ${role} still rejects ${label} without payment writes`, async () => {
    const res = await request('POST', { role, permissions: [{ module: 'abrechnung', has_access: true }] }, body);
    assert.equal(res.status, 400);
    assert.equal(calls.some(c => c.path.endsWith('/rpc/rechnung_zahlung_buchen')), false);
  });
}
