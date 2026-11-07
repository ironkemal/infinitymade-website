import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { reservierePhysioPublikation, quittierePhysioReadback, finalisierePhysioPublikation, reserviereUndLadeHoch } from './artefakt-registry.js';

test('Reserve preserves SQL timestamp/null input and distinguishes worker permission', async () => {
  for (const granted of [true, false]) {
    const expected = { state: 'preparing', abrechnungId: 'ab1', generation: 2, worker_granted: granted,
      input_sha256: 'a'.repeat(64), updated_at: '2026-11-07 12:00:00.123456+00' };
    const db = { async rpc(name, args) {
      assert.equal(name, 'abrechnung_idempotency_reserve');
      assert.deepEqual(args, { p_owner: 'o1', p_key: 'opaque', p_payload: { a: 1 }, p_expected_input: null });
      return { data: expected };
    } };
    assert.deepEqual(await reservierePhysioPublikation({ db, ownerId: 'o1', key: 'opaque', payload: { a: 1 } }), expected);
  }
});

test('Exact SQLSTATE/message allowlist; no DB details or payload leak', async () => {
  for (const [sqlstate, message, status, code] of [
    ['40001', 'PHYSIO_INPUT_CHANGED', 409, 'PHYSIO_INPUT_CHANGED'],
    ['22023', 'PHYSIO_MANIFEST_OR_PACKAGE_INVALID', 422, 'PHYSIO_MANIFEST_OR_PACKAGE_INVALID'],
    ['42501', 'PHYSIO_OWNER_UNAVAILABLE', 403, 'PHYSIO_OWNER_UNAVAILABLE'],
    ['23505', 'PHYSIO_SESSION_CLAIM_CONFLICT', 409, 'PHYSIO_SESSION_CLAIM_CONFLICT'],
    ['40001', 'PHYSIO_INPUT_CHANGED private', 500, 'PHYSIO_PUBLIKATION_FEHLER'],
    ['P0001', 'PHYSIO_INPUT_CHANGED', 500, 'PHYSIO_PUBLIKATION_FEHLER'],
    ['PGRST202', 'private', 503, 'PHYSIO_PUBLIKATION_NICHT_VERFUEGBAR'],
  ]) {
    const db = { rpc: async () => ({ error: { code: sqlstate, message, details: 'private', hint: 'private' } }) };
    await assert.rejects(reservierePhysioPublikation({ db }), e =>
      e.status === status && e.code === code && !e.message.includes('private') && e.details === undefined);
  }
});

test('Missing capability, transport loss and invalid response never succeed', async () => {
  for (const db of [{}, { rpc: async () => { throw new Error('private'); } },
    { rpc: async () => null }, { rpc: async () => ({ data: { state: 'preparing', abrechnungId: 'ab1', generation: 1 } }) }]) {
    await assert.rejects(reservierePhysioPublikation({ db }), e => e.status === 503 && !e.message.includes('private'));
  }
});

test('Readback false is not a successful receipt', async () => {
  await assert.rejects(quittierePhysioReadback({ db: { rpc: async () => ({ data: false }) } }), e => e.status === 503);
  assert.equal(await quittierePhysioReadback({ db: { rpc: async (name) => {
    assert.equal(name, 'physio_artefakt_readback'); return { data: true };
  } } }), true);
});

test('Supabase returned transport failures and malformed worker grants are unavailable', async () => {
  const responses = [
    { status: 0, error: { code: '', message: 'TypeError: fetch failed private' } },
    { data: { state: 'preparing', abrechnungId: '', generation: 1, worker_granted: true } },
    { data: { state: 'preparing', abrechnungId: 'ab1', generation: 1, worker_granted: true } },
    { data: { state: 'preparing', abrechnungId: 'ab1', generation: 1, worker_granted: true,
      input_sha256: 'a'.repeat(64), updated_at: '' } },
  ];
  for (const response of responses) {
    await assert.rejects(reservierePhysioPublikation({ db: { rpc: async () => response } }),
      e => e.status === 503 && !e.message.includes('private'));
  }
});

test('Real Supabase client maps a locally rejected fetch to transport 503', async () => {
  let attempts = 0;
  const db = createClient('https://synthetic.invalid', 'synthetic-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async () => { attempts++; throw new TypeError('synthetic private transport failure'); } },
  });
  await assert.rejects(reservierePhysioPublikation({ db }),
    e => e.status === 503 && e.code === 'PHYSIO_PUBLIKATION_NICHT_VERFUEGBAR'
      && !e.message.includes('private'));
  assert.ok(attempts > 0);
});

test('Finalization binds full precision CAS and result to original invoice', async () => {
  const timestamp = '2026-11-07 12:00:00.123456+00';
  const db = { async rpc(name, args) {
    assert.equal(name, 'abrechnung_physio_finalize');
    assert.equal(args.p_expected_updated_at, timestamp);
    assert.equal(args.p_generation, 3);
    assert.deepEqual(args.p_manifest, [{ id: 'artifact' }]);
    return { data: { ok: true, state: 'published', abrechnungId: 'ab1' } };
  } };
  const args = { db, abrechnungId: 'ab1', generation: 3, expectedUpdatedAt: timestamp, manifest: [{ id: 'artifact' }] };
  assert.equal((await finalisierePhysioPublikation(args)).abrechnungId, 'ab1');
  await assert.rejects(finalisierePhysioPublikation({ ...args, abrechnungId: 'other' }), e => e.status === 503);
});


test('Physio upload receipts follow byte and format checks; failures never publish or delete', async () => {
  for (const failure of [null, 'hash', 'format', 'receipt']) {
    const calls = [];
    const original = Buffer.from('synthetic payload');
    const db = {
      rpc: async (name, args) => {
        calls.push(name);
        if (name === 'artefakt_reserve') return { data: 'artifact1' };
        if (name === 'physio_artefakt_readback') {
          assert.equal(args.p_generation, 2);
          assert.equal(args.p_bytes, original.length);
          assert.equal(args.p_package_sha256, 'b'.repeat(64));
          assert.equal(calls.at(-2), 'format');
          return { data: failure !== 'receipt' };
        }
        assert.equal(name, 'artefakt_upload_done');
        return { data: true };
      },
      storage: { from: () => ({
        upload: async (path, bytes, options) => {
          calls.push('upload'); assert.equal(options.upsert, false);
          assert.deepEqual(bytes, original); return { data: { path } };
        },
        download: async () => {
          calls.push('download');
          return { data: new Blob([failure === 'hash' ? 'corrupted' : original]) };
        },
        remove: async () => { throw new Error('must never delete'); },
      }) },
    };
    const operation = reserviereUndLadeHoch({ db, ownerId: 'o1', abrechnungId: 'ab1',
      pfad: 'o1/ab1/physio-v1/2/synthetic.dta', kind: 'unsigned', role: 'dta',
      bytes: original, contentType: 'application/octet-stream',
      physio: { generation: 2, packageSha256: 'b'.repeat(64) },
      pruefeReadback: () => {
        calls.push('format');
        if (failure === 'format') throw Object.assign(new Error('invalid syntax'), { status: 422 });
      },
    });
    if (failure) await assert.rejects(operation);
    else assert.equal((await operation).registryId, 'artifact1');
    assert.equal(calls.includes('physio_artefakt_readback'), !['hash', 'format'].includes(failure));
    assert.ok(!calls.includes('artefakt_publish'));
    assert.ok(!calls.includes('abrechnung_physio_finalize'));
  }
});

test('Invalid Physio upload contract fails before registry or storage side effects', async () => {
  for (const extra of [
    { physio: { generation: 0, packageSha256: 'b'.repeat(64) }, pruefeReadback: () => {} },
    { physio: { generation: 2, packageSha256: 'bad' }, pruefeReadback: () => {} },
    { physio: { generation: 2, packageSha256: 'b'.repeat(64) } },
  ]) {
    let calls = 0;
    await assert.rejects(reserviereUndLadeHoch({ db: { rpc: async () => { calls++; } },
      kind: 'unsigned', role: 'dta', bytes: Buffer.from('synthetic'), ...extra }), e => e.status === 422);
    assert.equal(calls, 0);
  }
});
