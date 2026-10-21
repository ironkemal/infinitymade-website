import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportAenderungsprotokollCsv } from './fahrtenbuch-export.js';

const first = '12345678-1111-4111-8111-111111111111';
const second = '12345678-2222-4222-8222-222222222222';
const full = 'P-' + first.replaceAll('-', '').toUpperCase();
const ziel = ref => `Patientenbesuch (s. Verzeichnis Nr. ${ref})`;
const snapshot = (booking_id, ref) => ({ booking_id, zielort: ziel(ref), zweck: 'Patientenbesuch', fahrt_started_at: '2026-10-14T08:00:00Z' });
const audit = (id, alt, neu = null) => ({ id, fahrt_id: 'deleted', op: neu ? 'UPDATE' : 'DELETE', alt, neu, geaendert_am: `2026-10-14T10:0${id}:00Z` });

async function run(t, changes, rows = [], error = null) {
  const blobs = [];
  const downloads = [];
  const original = { window: globalThis.window, document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL, timeout: globalThis.setTimeout };
  t.after(() => {
    for (const key of ['window', 'document']) {
      if (original[key] === undefined) delete globalThis[key]; else globalThis[key] = original[key];
    }
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
    globalThis.setTimeout = original.timeout;
  });
  globalThis.window = {};
  globalThis.document = { body: { appendChild() {} }, createElement() { return { click() { downloads.push(this.download); }, remove() {} }; } };
  URL.createObjectURL = blob => { blobs.push(blob); return 'blob:synthetic'; };
  URL.revokeObjectURL = () => {};
  globalThis.setTimeout = fn => { fn(); return 0; };
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, async range() { return { data: changes, error }; } };
  const operation = exportAenderungsprotokollCsv({ supabase: { from(table) { assert.equal(table, 'fahrten_aenderungen'); return query; } }, ownerId: 'owner', rows, toast() {} });
  return { operation, blobs, downloads };
}

test('Actual export resolves deleted-only full reference from stored audit snapshot', async t => {
  const result = await run(t, [audit(1, snapshot(first, full))]);
  await result.operation;
  assert.equal(result.downloads.length, 1);
  assert.match(await result.blobs[0].text(), new RegExp('"' + full + '"'));
});

test('Actual export prefers current row over historical snapshot', async t => {
  const result = await run(t, [audit(1, snapshot(first, 'P-12345678'))], [{ id: 'deleted', ...snapshot(first, full) }]);
  await result.operation;
  assert.match(await result.blobs[0].text(), new RegExp(';"' + full + '";'));
});

test('Actual export uses newest available snapshot for absent current row', async t => {
  const result = await run(t, [audit(1, snapshot(first, 'P-12345678'), snapshot(first, full)), audit(2, snapshot(first, full))]);
  await result.operation;
  assert.match(await result.blobs[0].text(), new RegExp(';"' + full + '";'));
});

test('Actual export blocks deleted/live legacy collision before download', async t => {
  const result = await run(t, [audit(1, snapshot(first, 'P-12345678'))], [{ id: 'live', ...snapshot(second, 'P-12345678') }]);
  await assert.rejects(result.operation, /Export gesperrt.*P-12345678/);
  assert.equal(result.downloads.length, 0);
  assert.equal(result.blobs.length, 0);
});

test('Actual export retains current row with removed booking instead of restoring stale reference', async t => {
  const result = await run(t, [audit(1, snapshot(first, full))], [{ id: 'deleted', booking_id: null }]);
  await result.operation;
  assert.doesNotMatch(await result.blobs[0].text(), new RegExp(';"' + full + '";'));
});

test('Audit read error prevents download', async t => {
  const result = await run(t, [], [], new Error('synthetic read failure'));
  await assert.rejects(result.operation, /synthetic read failure/);
  assert.equal(result.downloads.length, 0);
});
