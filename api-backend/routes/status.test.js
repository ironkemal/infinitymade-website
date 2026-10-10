// O-40 + guvenlik S-60 — /api/status: SaaS 404, Box 401/403/200, Limit, 30-s-Speicher.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
// ai/auth.js baut beim Laden einen Supabase-Client — ohne URL wirft supabase-js.
process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-dummy';
const { createStatusRouter } = await import('./status.js');

// Ersatz für requireAuth: Rolle aus dem Header, kein Header = 401.
const fakeAuth = (req, res, next) => {
  const rolle = req.headers['x-rolle'];
  if (!rolle) return res.status(401).json({ error: 'Missing bearer token' });
  req.auth = rolle === 'owner'
    ? { userId: 'o1', tenantId: 'o1', role: 'owner' }
    : { userId: 'e1', tenantId: 'o1', role: 'employee' };
  next();
};

function zaehlendePruefungen() {
  const z = { storage: 0 };
  const pruefungen = () => ({
    postgres: async () => ({ buchMax: '0078' }),
    rest: async () => {},
    auth: async () => {},
    storage: async () => { z.storage++; },
    disk: async () => ({ status: 'unbekannt' }),
    dataKey: async () => ({ rundlauf: true, vergleich: 'unbekannt' }),
    version: { version: '0.5.2' },
    schema: { imageMax: '0078' },
  });
  return { z, pruefungen };
}

async function mitServer(router, fn) {
  const app = express();
  app.use('/api', router);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try { await fn(base); } finally { server.close(); }
}

test('SaaS: 404 auch mit gültiger Inhaber-Anmeldung', async () => {
  delete process.env.SUPABASE_PUBLIC_URL;
  const { pruefungen } = zaehlendePruefungen();
  await mitServer(createStatusRouter({ pruefungen, auth: fakeAuth }), async (base) => {
    const r = await fetch(`${base}/status`, { headers: { 'x-rolle': 'owner' } });
    assert.equal(r.status, 404);
  });
});

test('Box: ohne Anmeldung 401, Mitarbeiter 403, Inhaber 200; 30 s ein Durchlauf; 11. Aufruf 429', async () => {
  process.env.SUPABASE_PUBLIC_URL = 'https://praxis.example';
  try {
    const { z, pruefungen } = zaehlendePruefungen();
    await mitServer(createStatusRouter({ pruefungen, auth: fakeAuth }), async (base) => {
      assert.equal((await fetch(`${base}/status`)).status, 401);
      assert.equal((await fetch(`${base}/status`, { headers: { 'x-rolle': 'employee' } })).status, 403);
      const r = await fetch(`${base}/status`, { headers: { 'x-rolle': 'owner' } });
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('cache-control'), 'no-store');
      const j = await r.json();
      assert.equal(j.gesamt, 'ok');
      assert.equal(j.felder.db.status, 'ok');
      // 3 Aufrufe bisher; 7 weitere Inhaber-Aufrufe → 10 im Fenster, alle aus dem Speicher.
      for (let i = 0; i < 7; i++) {
        assert.equal((await fetch(`${base}/status`, { headers: { 'x-rolle': 'owner' } })).status, 200);
      }
      assert.equal(z.storage, 1);
      assert.equal((await fetch(`${base}/status`, { headers: { 'x-rolle': 'owner' } })).status, 429);
    });
  } finally { delete process.env.SUPABASE_PUBLIC_URL; }
});

test('nach Ablauf des Speichers neuer Durchlauf', async () => {
  process.env.SUPABASE_PUBLIC_URL = 'https://praxis.example';
  try {
    const { z, pruefungen } = zaehlendePruefungen();
    await mitServer(createStatusRouter({ pruefungen, auth: fakeAuth, cacheMs: 0 }), async (base) => {
      await fetch(`${base}/status`, { headers: { 'x-rolle': 'owner' } });
      await new Promise((r) => setTimeout(r, 5));
      await fetch(`${base}/status`, { headers: { 'x-rolle': 'owner' } });
      assert.equal(z.storage, 2);
    });
  } finally { delete process.env.SUPABASE_PUBLIC_URL; }
});

test('pruefungen() wirft synchron → 500, kein Hänger', async () => {
  process.env.SUPABASE_PUBLIC_URL = 'https://praxis.example';
  const orig = console.error; console.error = () => {};
  try {
    const pruefungen = () => { throw new Error('kaputt'); };
    await mitServer(createStatusRouter({ pruefungen, auth: fakeAuth }), async (base) => {
      const r = await fetch(`${base}/status`, { headers: { 'x-rolle': 'owner' } });
      assert.equal(r.status, 500);
      assert.ok(!(await r.text()).includes('kaputt'));
    });
  } finally { console.error = orig; delete process.env.SUPABASE_PUBLIC_URL; }
});
