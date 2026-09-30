// onprem O-140 (30.09.2026): Praxisstandort ohne Nominatim — Zustandstext.
import test from 'node:test';
import assert from 'node:assert/strict';
import { standortStatusText } from './praxis-standort.js';

test('standortStatusText: fehlend, leer, gesetzt', () => {
  assert.match(standortStatusText(null), /nicht eingerichtet/);
  assert.match(standortStatusText({ id: 'b', clinic_lat: null, clinic_lng: null }), /nicht eingerichtet/);
  assert.match(standortStatusText({ id: 'b', clinic_lat: 50.8, clinic_lng: 7.2 }), /gesetzt \(50\.80000, 7\.20000\).*150 m/);
});
