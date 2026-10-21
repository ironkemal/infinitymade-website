import { test } from 'node:test';
import assert from 'node:assert/strict';
import { letzterKmStand, startKmFehler } from './fahrt-km.js';

const sb = (werte) => ({
  from: (t) => {
    const q = { select: () => q, eq: () => q, not: () => q, order: () => q, limit: async () => ({ data: werte[t] != null ? [{ end_km: werte[t] }] : [] }) };
    return q;
  },
});

test('höchster End-KM aus Terminfahrten und freien Fahrten', async () => {
  assert.equal(await letzterKmStand(sb({ bookings: 12000, fahrten: 12450 }), 'v1'), 12450);
  assert.equal(await letzterKmStand(sb({ bookings: 9000 }), 'v1'), 9000);
  assert.equal(await letzterKmStand(sb({}), 'v1'), null);
  assert.equal(await letzterKmStand(sb({ bookings: 1 }), ''), null);
});

test('Start-KM unter dem letzten Stand ist ein Fehler, gleich oder höher nicht', () => {
  assert.match(startKmFehler(11999, 12000), /unter dem letzten Kilometerstand/);
  assert.equal(startKmFehler(12000, 12000), '');
  assert.equal(startKmFehler(12500, 12000), '');
  assert.equal(startKmFehler(5, null), '');
});
