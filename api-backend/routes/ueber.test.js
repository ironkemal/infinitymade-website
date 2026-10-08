// O-178 / K2b.16 + guvenlik S-54 — /api/ueber*: Version öffentlich, Rest nur Box + angemeldet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
// ai/auth.js baut beim Laden einen Supabase-Client — ohne URL wirft supabase-js.
process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-dummy';
const { default: ueberRouter } = await import('./ueber.js');

async function mitServer(fn) {
  const app = express();
  app.use('/api', ueberRouter);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try { await fn(base); } finally { server.close(); }
}

test('GET /api/ueber: öffentlich, nur Version', async () => {
  process.env.IMAGE_VERSION = '0.4.0+abc1234';
  await mitServer(async (base) => {
    const r = await fetch(`${base}/ueber`);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { version: '0.4.0+abc1234' });
  });
});

test('SaaS (kein SUPABASE_PUBLIC_URL): Verbindungen/Lizenzen 404 — auch mit Token', async () => {
  delete process.env.SUPABASE_PUBLIC_URL;
  await mitServer(async (base) => {
    for (const p of ['/ueber/verbindungen', '/ueber/lizenzen']) {
      const r = await fetch(base + p, { headers: { Authorization: 'Bearer irgendwas' } });
      assert.equal(r.status, 404, p);
    }
  });
});

test('Box ohne Anmeldung: 401, keine Liste', async () => {
  process.env.SUPABASE_PUBLIC_URL = 'https://praxis.example';
  try {
    await mitServer(async (base) => {
      for (const p of ['/ueber/verbindungen', '/ueber/lizenzen']) {
        const r = await fetch(base + p);
        assert.equal(r.status, 401, p);
      }
    });
  } finally { delete process.env.SUPABASE_PUBLIC_URL; }
});
