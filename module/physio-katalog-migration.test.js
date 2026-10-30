import { test } from 'node:test';
import assert from 'node:assert/strict';
import { physioAltlastPatches, migrierePhysioAltlast, zertifikatPatches, zertifikateMitDeckung, ZERTIFIKAT_PFLICHT, PHYSIO_KATALOG_ERGAENZUNG } from './physio-katalog-migration.js';
import { PHYSIO_POSITIONS } from '../api-backend/billing/codes/physio_positions.js';

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
  const erlaubt = new Set(['MT', 'MLD', 'KGG', 'ZNS-BOBATH', 'ZNS-VOJTA', 'ZNS-PNF', 'ZNS-K-BOBATH', 'ZNS-K-VOJTA']);
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

test('KG-ZNS hängt an der Methode', () => {
  assert.equal(ZERTIFIKAT_PFLICHT.X0710, 'ZNS-BOBATH');
  assert.equal(ZERTIFIKAT_PFLICHT.X0711, 'ZNS-VOJTA');
  assert.equal(ZERTIFIKAT_PFLICHT.X0712, 'ZNS-PNF');
  assert.equal(ZERTIFIKAT_PFLICHT.X0709, 'ZNS-K-VOJTA');
  assert.equal(ZERTIFIKAT_PFLICHT.X0702, undefined);
});

test('Kinder-Zertifikat deckt Erwachsene derselben Methode, nie umgekehrt', () => {
  assert.deepEqual(zertifikateMitDeckung(['ZNS-K-BOBATH']), ['ZNS-K-BOBATH', 'ZNS-BOBATH']);
  assert.deepEqual(zertifikateMitDeckung(['ZNS-BOBATH']), ['ZNS-BOBATH']);
  assert.deepEqual(zertifikateMitDeckung(['ZNS-K-VOJTA', 'MT']), ['ZNS-K-VOJTA', 'MT', 'ZNS-VOJTA']);
  assert.ok(!zertifikateMitDeckung(['ZNS-K-BOBATH']).includes('ZNS-VOJTA'));
});

test('K11: Ergänzung trägt die Preise der Abrechnungsdatei', () => {
  const quelle = new Map(PHYSIO_POSITIONS.map(p => [p.x, p]));
  for (const e of PHYSIO_KATALOG_ERGAENZUNG) {
    assert.ok(quelle.has(e.code), `${e.code} fehlt in physio_positions.js`);
    assert.equal(e.price, quelle.get(e.code).preis, e.code);
    assert.equal(e.price_min, e.price); assert.equal(e.price_max, e.price);
    assert.equal(e.locked, true);
  }
});

test('K11: keine Dublette, Gruppen bleiben draußen', () => {
  const codes = PHYSIO_KATALOG_ERGAENZUNG.map(e => e.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const g of ['X0401', 'X0601']) assert.ok(!codes.includes(g));
  // X0204/X0205 sind MLD-Zertifikatspositionen → die Saat setzt required_certificate
  assert.equal(ZERTIFIKAT_PFLICHT.X0205, 'MLD');
  assert.equal(ZERTIFIKAT_PFLICHT.X0204, 'MLD');
});
