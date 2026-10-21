import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { wartelisteZeitfensterGueltig as valid } from './warteliste-zeitfenster.js';
import { wartelisteZeitfensterGueltig as frontend } from '../../module/warteliste-zeitfenster.js';

test('Warteliste time bounds: backend/frontend parity', () => {
  for (const [from, to, expected] of [
    ['18:00', '10:00', false], ['08:00', '08:00', false],
    ['08:00:01', '08:00:02', true], ['08:00', '09:00', true],
    [null, '09:00', true], ['08:00', null, true], [null, null, true],
    ['24:00', null, false], ['8:00', '09:00', false], [123, null, false],
  ]) {
    assert.equal(valid(from, to), expected);
    assert.equal(frontend(from, to), expected);
  }
});

test('actual POST rejects reversed bounds before insert; allows open bounds', async () => {
  const source = fs.readFileSync(new URL('../billing/api/warteliste.routes.js', import.meta.url), 'utf8');
  const start = source.indexOf("router.post('/',");
  const end = source.indexOf("router.patch('/:id'", start);
  let handler;
  const writes = [];
  const chain = { insert(payload) { writes.push(payload); return this; }, select() { return this; }, single() { return {data: writes.at(-1), error: null}; } };
  vm.runInNewContext(source.slice(start, end), {
    router: { post(_path, callback) { handler = callback; } },
    resolveAuth: async () => ({tenantId: 'QA-OWNER'}),
    supabase: {from: () => chain}, wartelisteZeitfensterGueltig: valid, console,
  });
  const res = () => ({code: 200, status(code) { this.code = code; return this; }, json(body) {this.body = body; return this;} });
  for (const [from, to] of [['18:00', '10:00'], ['08:00', '08:00'], ['24:00', null]]) {
    const response = res();
    await handler({body: {preferred_time_from: from, preferred_time_to: to}}, response);
    assert.equal(response.code, 400);
    assert.equal(writes.length, 0);
  }
  const response = res();
  await handler({body: {preferred_time_from: '08:00'}}, response);
  assert.equal(response.code, 201);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].owner_id, 'QA-OWNER');
  assert.equal(writes[0].preferred_time_to, null);
});
