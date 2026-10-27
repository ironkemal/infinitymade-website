import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import express from 'express';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { createFinanzlader } from './finanzadapter.js';

const tenantId = '00000000-0000-4000-8000-000000000001';
const employeeId = '00000000-0000-4000-8000-000000000002';
const jetzt = new Date('2026-10-27T10:00:00Z');

test('Factory: lazy, nur vorhandene Funktionen; kein Preload/Cache; Tenant und Uhr injiziert', async () => {
  const calls = [];
  const supabase = { from() { throw new Error('Kein versteckter Read'); } };
  let clockCalls = 0;
  const lader = createFinanzlader({ supabase, jetzt: () => { clockCalls++; return jetzt; },
    lader: { geld: async options => { calls.push(options); return { monat: options.jetzt.toISOString() }; }, mahnungen: null, beliebig: () => 0 } });
  assert.deepEqual(Object.keys(lader), ['geld']);
  assert.equal(calls.length, 0);
  assert.equal(clockCalls, 0);
  for (let i = 0; i < 2; i++) await lader.geld({ tenantId, supabase: 'fremd', jetzt: 'fremd', owner_id: 'fremd' });
  assert.equal(calls.length, 2);
  assert.equal(clockCalls, 2);
  for (const call of calls) {
    assert.deepEqual(Object.keys(call).sort(), ['jetzt', 'supabase', 'tenantId']);
    assert.equal(call.tenantId, tenantId);
    assert.equal(call.supabase, supabase);
    assert.equal(call.jetzt.getTime(), jetzt.getTime());
  }
  await assert.rejects(lader.geld({ tenantId: 'invalid' }));
  assert.equal(calls.length, 2);
});

test('Factory liefert echten Geldlader; fehlende B04-Blöcke bleiben abwesend', async () => {
  let reads = 0;
  const supabase = { from() {
    reads++;
    const q = { select() { return q; }, eq() { return q; }, gte() { return q; }, lt() { return q; }, order() { return q; }, async limit() { return { data: [], error: null }; } };
    return q;
  } };
  const lader = createFinanzlader({ supabase, jetzt });
  assert.equal(reads, 0);
  assert.deepEqual(Object.keys(lader), ['geld']);
  const r = await lader.geld({ tenantId });
  assert.equal(r.monat, '2026-10');
  assert.equal(r.kassiert.patient.gesamtCent, 0);
  assert.equal(r.offen.privat.gesamtCent, null);
  assert.ok(reads > 0);
});

// Actual B04 router source, only auth import replaced by required test injection.
// Avoids importing auth's environment-owned SDK client. No env access or network.
const source = fs.readFileSync(new URL('../../routes/startseite.js', import.meta.url), 'utf8')
  .replace("import { Router } from 'express';", '')
  .replace("import { requireAuth } from '../ai/auth.js';", '')
  .replace('export function createStartseiteRouter', 'function createStartseiteRouter');
const createStartseiteRouter = vm.runInNewContext(`${source}\ncreateStartseiteRouter`, {
  Router: express.Router, URLSearchParams, requireAuth() { throw new Error('Auth muss injiziert sein'); },
});

function request(router, query = '') {
  const app = express();
  app.use('/api', router);
  const socket = new Duplex({ read() {}, write(_chunk, _encoding, done) { done(); } });
  const req = new IncomingMessage(socket);
  req.method = 'GET';
  req.url = `/api/startseite/zusammenfassung${query}`;
  const res = new ServerResponse(req);
  return new Promise((resolve, reject) => {
    res.end = chunk => { try { resolve({ status: res.statusCode, body: JSON.parse(String(chunk)) }); } catch (error) { reject(error); } return res; };
    app.handle(req, res, error => reject(error || new Error('Route nicht erreicht')));
  });
}

test('B04 Router → Factory: Employee 0 Reads; Owner-Teilfehler 200; alle Fehler 503; keine Tenant-Overrides', async () => {
  const calls = [];
  const lader = createFinanzlader({ jetzt, supabase: {}, lader: {
    geld: async options => { calls.push(options); return { scope: 'mandant', monat: '2026-10' }; },
    abrechnung: async () => { throw new Error('RAW synthetic private failure'); },
  } });
  const router = role => createStartseiteRouter({ lader, auth(req, _res, next) {
    req.auth = { role, tenantId, userId: role === 'owner' ? tenantId : employeeId }; next();
  } });
  assert.deepEqual(await request(router('employee')), { status: 200, body: { bloecke: {} } });
  assert.equal((await request(router('employee'), '?bloecke=geld')).status, 403);
  assert.equal(calls.length, 0);
  const r = await request(router('owner'));
  assert.equal(r.status, 200);
  assert.equal(r.body.bloecke.geld.status, 'ok');
  assert.equal(r.body.bloecke.mahnungen.code, 'BLOCK_NICHT_VERFUEGBAR');
  assert.equal(r.body.bloecke.abrechnung.code, 'BLOCK_NICHT_VERFUEGBAR');
  assert.equal(calls[0].tenantId, tenantId);
  assert.equal((await request(router('owner'), '?tenantId=fremd')).status, 400);
  assert.equal(calls.length, 1);
  const all = await request(router('owner'), '?bloecke=mahnungen,abrechnung');
  assert.equal(all.status, 503);
  assert.doesNotMatch(JSON.stringify(all), /RAW|private/);
});
