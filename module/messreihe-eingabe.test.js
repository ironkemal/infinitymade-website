import test from 'node:test';
import assert from 'node:assert/strict';
import { messFehler } from './messreihe-eingabe.js';

test('Chrome1911 Messreihen prüfen Körperteil, Datum und typspezifische Grenzen', () => {
  for (const [typ, max] of [['VAS', 10], ['ROM', 360], ['kraft', 999], ['custom', 999]]) {
    const pruefe = (wert, teil = 'Knie') => messFehler(typ, teil, wert, '2026-11-19');
    for (const wert of ['0', String(max)]) assert.equal(pruefe(wert), null);
    for (const wert of ['', 'NaN', '-1', String(max + 1)]) assert.ok(pruefe(wert));
    assert.match(pruefe('3', ''), /Körperteil/);
  }
  assert.ok(messFehler('VAS', 'Knie', 5, ''));
});
