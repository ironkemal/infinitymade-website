import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ergaenzendMitbuchen } from './ergaenzend-mitbuchen.js';

const rx = { ergaenzend_position: 'X1302', ergaenzend_einheiten: 6, therapie_bereich: 'physio' };

test('ohne ergänzendes Heilmittel nie', () => {
  assert.equal(ergaenzendMitbuchen({ rx: { ...rx, ergaenzend_position: null }, bereitsErbracht: 0 }), false);
});

test('bis zur verordneten Menge ja, darüber nein', () => {
  assert.equal(ergaenzendMitbuchen({ rx, bereitsErbracht: 5 }), true);
  assert.equal(ergaenzendMitbuchen({ rx, bereitsErbracht: 6 }), false);
});

test('ohne eigene Menge gilt die vorrangige', () => {
  assert.equal(ergaenzendMitbuchen({ rx: { ...rx, ergaenzend_einheiten: null, anzahl_einheiten: 2 }, bereitsErbracht: 2 }), false);
});

test('Podologie nie', () => {
  assert.equal(ergaenzendMitbuchen({ rx: { ...rx, therapie_bereich: 'podo' }, bereitsErbracht: 0 }), false);
});
