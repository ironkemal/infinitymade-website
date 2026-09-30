import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  icdOhneStrich,
  icdAbfrageKodes,
  icdTerminalMap,
} from './icd-code.js';

test('icdOhneStrich: entfernt nachgestellte Bindestriche und trimmt', () => {
  assert.equal(icdOhneStrich('E11.7-'), 'E11.7');
  assert.equal(icdOhneStrich('E11.7--'), 'E11.7');
  assert.equal(icdOhneStrich('  E11.7-  '), 'E11.7');
  assert.equal(icdOhneStrich('M54.5'), 'M54.5');
  assert.equal(icdOhneStrich('M54.5G'), 'M54.5G');
  assert.equal(icdOhneStrich('M54.5G-'), 'M54.5G');

  // Groß-/Kleinschreibung bleibt erhalten
  assert.equal(icdOhneStrich('e11.7-'), 'e11.7');

  // Bindestrich in der Mitte bleibt stehen
  assert.equal(icdOhneStrich('A-B'), 'A-B');

  // Leere / ungültige Eingaben
  assert.equal(icdOhneStrich(''), '');
  assert.equal(icdOhneStrich(null), '');
  assert.equal(icdOhneStrich(undefined), '');
  assert.equal(icdOhneStrich('-'), '');
  assert.equal(icdOhneStrich('---'), '');
});

test('icdAbfrageKodes: generiert bindestrichfreie und gestrichelte Form', () => {
  assert.deepEqual(icdAbfrageKodes(['E11.7']), ['E11.7', 'E11.7-']);
  assert.deepEqual(icdAbfrageKodes(['E11.7-']), ['E11.7', 'E11.7-']);
  assert.deepEqual(icdAbfrageKodes(['E11.7', 'E11.7-']), ['E11.7', 'E11.7-']);

  const mehrere = icdAbfrageKodes(['E11.7-', 'M54.5']);
  assert.deepEqual(mehrere, ['E11.7', 'M54.5', 'E11.7-', 'M54.5-']);

  // Leere / ungültige Eingaben
  assert.deepEqual(icdAbfrageKodes([]), []);
  assert.deepEqual(icdAbfrageKodes(null), []);
  assert.deepEqual(icdAbfrageKodes(['', null, undefined]), []);
});

test('icdTerminalMap: mappt DB-Zeilen bindestrichfrei, nicht endständig gewinnt', () => {
  // Gestrichelte Zeile aus dem Katalog
  assert.deepEqual(
    icdTerminalMap([{ code: 'E11.7-', terminal: false }]),
    { 'E11.7': false }
  );

  // Endständiger Kode ohne Strich
  assert.deepEqual(
    icdTerminalMap([{ code: 'M54.5', terminal: true }]),
    { 'M54.5': true }
  );

  // Beide Varianten vorhanden: terminal === false gewinnt (Reihenfolge 1)
  assert.deepEqual(
    icdTerminalMap([
      { code: 'E11.7', terminal: true },
      { code: 'E11.7-', terminal: false },
    ]),
    { 'E11.7': false }
  );

  // Beide Varianten vorhanden: terminal === false gewinnt (Reihenfolge 2)
  assert.deepEqual(
    icdTerminalMap([
      { code: 'E11.7-', terminal: false },
      { code: 'E11.7', terminal: true },
    ]),
    { 'E11.7': false }
  );

  // Beide Varianten mit terminal === true
  assert.deepEqual(
    icdTerminalMap([
      { code: 'M54.5', terminal: true },
      { code: 'M54.5-', terminal: true },
    ]),
    { 'M54.5': true }
  );

  // Leere / ungültige Eingaben
  assert.deepEqual(icdTerminalMap([]), {});
  assert.deepEqual(icdTerminalMap(null), {});
  assert.deepEqual(icdTerminalMap([{ code: null, terminal: true }]), {});
});

import { icdOhneStrich as _o, icdAbfrageKodes as _a, icdTerminalMap as _m } from './icd-code.js';
import _test from 'node:test';
import _assert from 'node:assert/strict';
_test('dreistellige Kategorie: E11.- -> E11, Abfrage fragt auch E11.-; terminal null bleibt null', () => {
  _assert.equal(_o('E11.-'), 'E11');
  _assert.ok(_a(['E11']).includes('E11.-'));
  _assert.ok(_a(['E11.7']).includes('E11.7-') && !_a(['E11.7']).includes('E11.7.-'));
  _assert.equal(_m([{ code: 'E11.-', terminal: false }]).E11, false);
  _assert.equal(_m([{ code: 'X99', terminal: null }]).X99, null);
});
