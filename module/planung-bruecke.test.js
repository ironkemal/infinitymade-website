import test from 'node:test';
import assert from 'node:assert/strict';
import { termineDesStandorts } from './planung-bruecke.js';

const termine = [{ id: 'a', business_id: 'A' }, { id: 'b', business_id: 'B' }, { id: 'c', business_id: null }];

test('Standortfilter lässt eigene Termine und Altzeilen ohne Standort durch', () => {
  assert.deepEqual(termineDesStandorts(termine, 'A').map(t => t.id), ['a', 'c']);
});

test('Ohne Standort bleibt alles sichtbar', () => {
  assert.equal(termineDesStandorts(termine, null).length, 3);
});
