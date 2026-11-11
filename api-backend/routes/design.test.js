// Redesign-Pilot: Entscheidung, Auth, Cache, Leckfreiheit (A02, A04, A08, A19, A20).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-dummy';
const { createDesignRouter, designNeuErlaubt } = await import('./design.js');

const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';
const fakeAuth = (req, res, next) => {
  const rolle = req.headers['x-rolle'];
  if (!rolle) return res.status(401).json({ error: 'Missing bearer token' });
  req.auth = { userId: 'u', tenantId: req.headers['x-tenant'] || T1, role: rolle };
  next();
};

test('rein: nur gelisteter Tenant, nur erlaubte Rolle, AUS gewinnt', () => {
  const env = { DESIGN_NEU_PILOT_TENANTS: ` ${T1.toUpperCase()} , ` };
  assert.equal(designNeuErlaubt({ tenantId: T1, role: 'owner' }, env), true);
  assert.equal(designNeuErlaubt({ tenantId: T2, role: 'owner' }, env), false);
  assert.equal(designNeuErlaubt({ tenantId: T1, role: 'employee' }, env), false);
  assert.equal(designNeuErlaubt({ tenantId: T1, role: 'employee' }, { ...env, DESIGN_NEU_PILOT_ROLLEN: 'owner,employee' }), true);
  assert.equal(designNeuErlaubt({ tenantId: T1, role: 'owner' }, { ...env, DESIGN_NEU_AUS: '1' }), false);
  assert.equal(designNeuErlaubt({ tenantId: T1, role: 'owner' }, {}), false);
  assert.equal(designNeuErlaubt({ tenantId: T1, role: 'admin' }, env), false);
  assert.equal(designNeuErlaubt(null, env), false);
});

async function mitServer(env, fn) {
  const app = express();
  app.use('/api', createDesignRouter({ auth: fakeAuth, env }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try { await fn(`http://127.0.0.1:${server.address().port}/api/design/entscheidung`); }
  finally { await new Promise((r) => server.close(r)); }
}

test('Route: 401 ohne Auth, private/no-store, nur {neu}, Client kann Mandant nicht vorgeben', async () => {
  await mitServer({ DESIGN_NEU_PILOT_TENANTS: T1 }, async (url) => {
    assert.equal((await fetch(url)).status, 401);
    const r = await fetch(url, { headers: { 'x-rolle': 'owner' } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'private, no-store');
    const body = await r.json();
    assert.deepEqual(body, { neu: true });
    assert.doesNotMatch(JSON.stringify(body) + [...r.headers.keys()].join(), new RegExp(T1));
    const fremd = await (await fetch(`${url}?tenantId=${T1}&role=owner`, { headers: { 'x-rolle': 'owner', 'x-tenant': T2 } })).json();
    assert.deepEqual(fremd, { neu: false });
  });
});
