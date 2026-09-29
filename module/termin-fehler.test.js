import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fehlerAnzeige } from './termin-fehler.js';

test('Text wird sichtbar', () => {
  assert.deepEqual(fehlerAnzeige('Zeitraum belegt'), { sichtbar: true, text: 'Zeitraum belegt' });
});

test('leer, null, undefined, nur Leerzeichen -> versteckt', () => {
  for (const v of ['', null, undefined, '   ']) assert.equal(fehlerAnzeige(v).sichtbar, false);
});

test('Text wird getrimmt', () => {
  assert.equal(fehlerAnzeige('  x  ').text, 'x');
});
