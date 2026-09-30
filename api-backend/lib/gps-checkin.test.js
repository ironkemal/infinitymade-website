import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gpsCheckinErgebnisRein as f } from './gps-checkin.js';

const distanz = (a, b, c, d) => Math.hypot(a - c, b - d) * 111000; // grob, reicht für den Test
const basis = { pruefen: true, lat: 50.8, lng: 7.2, praxisLat: 50.8, praxisLng: 7.2, radiusM: 150, distanz };

test('Schalter aus → null, auch mit Standort', () => {
  assert.equal(f({ ...basis, pruefen: false }), null);
});
test('kein Standort → null (kein 400 mehr)', () => {
  assert.equal(f({ ...basis, lat: undefined, lng: undefined }), null);
  assert.equal(f({ ...basis, lat: '', lng: null }), null);
});
test('keine Praxiskoordinate → null, nicht false', () => {
  assert.equal(f({ ...basis, praxisLat: null, praxisLng: null }), null);
});
test('im Umkreis → true, außerhalb → false', () => {
  assert.equal(f(basis), true);
  assert.equal(f({ ...basis, lat: 50.81 }), false);
});
test('Unsinnswerte → null', () => {
  assert.equal(f({ ...basis, lat: 'abc' }), null);
  assert.equal(f({ ...basis, lat: 95 }), null);
});
