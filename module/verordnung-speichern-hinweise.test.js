import { test } from 'node:test';
import assert from 'node:assert/strict';
import { icdHinweiseZusammen, ARZT_KORREKTUR } from './verordnung-speichern-hinweise.js';

const GEN = 'ICD-Code ist nicht endständig. Bitte mit der Verordnung vergleichen — Korrektur nur durch den Arzt (neue Unterschrift + Datum).';
const BEF = 'E11.7 ist nicht endständig — für DF passen z. B. E11.72, E11.73';

test('nur Katalog-Hinweis (keine DG) -> einmal, auch bei zwei Feldern', () => {
  assert.deepEqual(icdHinweiseZusammen([GEN, GEN]), [GEN]);
  assert.deepEqual(icdHinweiseZusammen(['', '']), []);
});
test('Motor-Befund ersetzt den Katalog-Satz (nie zwei Sätze zur selben Sache)', () => {
  assert.deepEqual(icdHinweiseZusammen([GEN], [BEF]), [`${BEF} ${ARZT_KORREKTUR}`]);
});
test('Befund ohne Katalog-Treffer -> Befund', () => {
  assert.deepEqual(icdHinweiseZusammen([''], [BEF]), [`${BEF} ${ARZT_KORREKTUR}`]);
});
test('nichts -> leer', () => assert.deepEqual(icdHinweiseZusammen(), []));
