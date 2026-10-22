// App für Mitarbeiter (onprem O-214) — /api/manifest: Box mit Praxisnamen, SaaS 404, nie 5xx.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { createManifestRouter, manifestFuer, GRUNDFASSUNG, cacheLeeren } from './manifest.js';

function fakeSupabase(ergebnis) {
  const kette = {
    select: () => kette, eq: () => kette, order: () => kette, limit: () => kette,
    maybeSingle: async () => { if (ergebnis instanceof Error) throw ergebnis; return ergebnis; },
  };
  return { from: () => kette };
}

async function mitServer(supabase, fn) {
  cacheLeeren();
  const app = express();
  app.use('/api', createManifestRouter({ supabase }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try { await fn(`http://127.0.0.1:${server.address().port}/api/manifest`); } finally { server.close(); }
}

test('manifestFuer: Name übernommen, short_name ≤ 12 Zeichen', () => {
  const m = manifestFuer('Podologie Müller Siegburg');
  assert.equal(m.name, 'Podologie Müller Siegburg');
  assert.ok(m.short_name.length <= 12, m.short_name);
  assert.equal(manifestFuer('Fuß Wohl').short_name, 'Fuß Wohl');
});

test('manifestFuer: leer → Grundfassung „Praxura"', () => {
  assert.equal(manifestFuer('   ').name, 'Praxura');
  assert.equal(manifestFuer(null).short_name, 'Praxura');
});

test('Grundfassung hat 192er und 512er PNG (Installierbarkeit Android)', () => {
  const groessen = GRUNDFASSUNG.icons.filter((i) => i.type === 'image/png').map((i) => i.sizes);
  assert.ok(groessen.includes('192x192') && groessen.includes('512x512'));
});

test('Box: Praxisname im Manifest, richtiger Content-Type', async () => {
  process.env.SUPABASE_PUBLIC_URL = 'https://box.example';
  await mitServer(fakeSupabase({ data: { business_name: 'Podologie Test' }, error: null }), async (url) => {
    const r = await fetch(url);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /application\/manifest\+json/);
    assert.equal((await r.json()).name, 'Podologie Test');
  });
});

test('Box: DB-Fehler → 200 mit Grundfassung, nie 5xx', async () => {
  process.env.SUPABASE_PUBLIC_URL = 'https://box.example';
  await mitServer(fakeSupabase(new Error('db weg')), async (url) => {
    const r = await fetch(url);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).name, 'Praxura');
  });
});

test('SaaS (kein SUPABASE_PUBLIC_URL): 404 — kein fremder Praxisname', async () => {
  delete process.env.SUPABASE_PUBLIC_URL;
  await mitServer(fakeSupabase({ data: { business_name: 'Fremde Praxis' }, error: null }), async (url) => {
    assert.equal((await fetch(url)).status, 404);
  });
});
