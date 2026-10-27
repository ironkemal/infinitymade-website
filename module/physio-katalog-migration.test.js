import { test } from 'node:test';
import assert from 'node:assert/strict';
import { physioAltlastPatches, migrierePhysioAltlast } from './physio-katalog-migration.js';

const kmt = { code: 'X0106', kuerzel: 'KMT', title: 'Klassische Massagetherapie (KMT)', duration: 20, price: 21.63 };

test('Saat-Karte „Massage Einzel" X0102 wird zu X0106 KMT', () => {
  const p = physioAltlastPatches([{ id: 'a', gkv_position_nr: 'X0102', title: 'Massage Einzel', duration_minutes: 25 }], kmt);
  assert.deepEqual(p, [{ id: 'a', patch: { gkv_position_nr: 'X0106', title: kmt.title, code: 'KMT', price: '21.63', duration_minutes: 20 } }]);
});

test('bewusst angelegte Unterwasserdruckstrahlmassage bleibt unberührt', () => {
  assert.deepEqual(physioAltlastPatches([{ id: 'a', gkv_position_nr: 'X0102', title: 'Unterwasserdruckstrahlmassage' }], kmt), []);
});

test('X0106 schon da → alte Karte verliert nur den GKV-Bezug', () => {
  const p = physioAltlastPatches([
    { id: 'a', gkv_position_nr: 'X0102', title: 'Massage Einzel' },
    { id: 'b', gkv_position_nr: 'X0106', title: 'KMT' },
  ], kmt);
  assert.deepEqual(p, [{ id: 'a', patch: { gkv_position_nr: null } }]);
});

test('ohne KMT im Katalog passiert nichts', () => {
  assert.deepEqual(physioAltlastPatches([{ id: 'a', gkv_position_nr: 'X0102', title: 'Massage Einzel' }], null), []);
});

test('migrierePhysioAltlast schreibt und hält den Cache synchron', async () => {
  const calls = [];
  const supabase = { from: () => ({ update: (patch) => ({ eq: async (_c, id) => { calls.push([id, patch]); return { error: null }; } }) }) };
  const services = [{ id: 'a', gkv_position_nr: 'X0102', title: 'Massage Einzel' }];
  await migrierePhysioAltlast({ supabase, services, katalog: [kmt] });
  assert.equal(calls.length, 1);
  assert.equal(services[0].gkv_position_nr, 'X0106');
});
