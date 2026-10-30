import { test } from 'node:test';
import assert from 'node:assert/strict';
import { physioAltlastPatches, migrierePhysioAltlast, zertifikatPatches, ZERTIFIKAT_PFLICHT } from './physio-katalog-migration.js';

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

test('Zertifikatsposition ohne Pflichtzertifikat bekommt es nachgetragen', () => {
  const p = zertifikatPatches([
    { id: 'mt', gkv_position_nr: 'X1201' },
    { id: 'mld', gkv_position_nr: 'X0201', required_certificate: null },
    { id: 'kgg', gkv_position_nr: 'X0507' },
    { id: 'kg', gkv_position_nr: 'X0501' },
  ]);
  assert.deepEqual(p, [
    { id: 'mt', patch: { required_certificate: 'MT' } },
    { id: 'mld', patch: { required_certificate: 'MLD' } },
    { id: 'kgg', patch: { required_certificate: 'KGG' } },
  ]);
});

test('gesetztes Zertifikat bleibt unberührt', () => {
  assert.deepEqual(zertifikatPatches([{ id: 'a', gkv_position_nr: 'X1201', required_certificate: 'MT' }]), []);
});

test('nur Werte, die der DB-Constraint kennt', () => {
  const erlaubt = new Set(['MT', 'MLD', 'KGG']);
  for (const v of Object.values(ZERTIFIKAT_PFLICHT)) assert.ok(erlaubt.has(v), v);
});

test('migrierePhysioAltlast trägt das Zertifikat ein und hält den Cache synchron', async () => {
  const calls = [];
  const supabase = { from: () => ({ update: (patch) => ({ eq: async (_c, id) => { calls.push([id, patch]); return { error: null }; } }) }) };
  const services = [{ id: 'm', gkv_position_nr: 'X0202', title: 'MLD 60' }];
  await migrierePhysioAltlast({ supabase, services, katalog: [kmt] });
  assert.deepEqual(calls, [['m', { required_certificate: 'MLD' }]]);
  assert.equal(services[0].required_certificate, 'MLD');
});
