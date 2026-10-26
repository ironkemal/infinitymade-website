import { test } from 'node:test';
import assert from 'node:assert/strict';
import { neuEintraege } from './kopf-neu.js';

const alles = { kalender: true, patienten: true, verordnungen: true, scan: true, oeffneTermin: () => {}, oeffneVerordnung: () => {}, leadKnopf: {} };

test('neuEintraege: alles freigeschaltet → vier Einträge in fester Reihenfolge', () => {
  assert.deepEqual(neuEintraege(alles), ['termin', 'patient', 'verordnung', 'scannen']);
});

test('neuEintraege: nur, was Leiste und Öffner hergeben', () => {
  assert.deepEqual(neuEintraege({ ...alles, verordnungen: false, scan: false }), ['termin', 'patient']);
  assert.deepEqual(neuEintraege({ ...alles, oeffneTermin: null }), ['patient', 'verordnung', 'scannen']);
  assert.deepEqual(neuEintraege({ ...alles, patienten: true, leadKnopf: null }), ['termin', 'verordnung', 'scannen']);
  assert.deepEqual(neuEintraege({}), []);
});
