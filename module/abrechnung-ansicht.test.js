/**
 * Tests für module/abrechnung-ansicht.js.
 *
 * Nur die DOM-freie Logik: `normalisiereAnsicht()` und die Zustandsgetter.
 * `zeigeAbrechnungAnsicht()`/`wireAbrechnungAnsicht()` fassen den DOM an
 * (`node --test` hat keinen) und werden erst in Phase 1 mit echtem Markup
 * per `npm run probe` geprüft — derselbe Schnitt wie bei
 * `sitzungen-ansicht.test.js` (dort testet nur `waehleSeite()`).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AB_ANSICHTEN,
  normalisiereAnsicht,
  aktuelleAbrechnungAnsicht,
  _setzeAbrechnungAnsichtZurueck,
} from './abrechnung-ansicht.js';

test('kennt genau die drei Ansichten des Plans', () => {
  assert.deepEqual(AB_ANSICHTEN, ['einstieg', 'neu', 'bisherige']);
});

test('gültige Ansichten bleiben unverändert', () => {
  for (const a of AB_ANSICHTEN) assert.equal(normalisiereAnsicht(a), a);
});

test('unbekannte oder fehlende Ziele fallen auf den Einstieg zurück', () => {
  assert.equal(normalisiereAnsicht('quatsch'), 'einstieg');
  assert.equal(normalisiereAnsicht(''), 'einstieg');
  assert.equal(normalisiereAnsicht(undefined), 'einstieg');
  assert.equal(normalisiereAnsicht(null), 'einstieg');
});

test('der Zustand beginnt beim Einstieg und lässt sich für Tests zurücksetzen', () => {
  assert.equal(aktuelleAbrechnungAnsicht(), 'einstieg');
  _setzeAbrechnungAnsichtZurueck();
  assert.equal(aktuelleAbrechnungAnsicht(), 'einstieg');
});
