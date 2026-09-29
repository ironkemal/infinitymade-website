import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidLanr, lanrPruefzifferWarnung, LANR_PRUEFZIFFER_HINWEIS } from './lanr-pruefung.js';
import { isValidLanr as backendIsValidLanr } from '../api-backend/billing/dta/preflight.js';

// Pruefziffer: Stellen 1-6 mit 4,9,4,9,4,9; 123456 -> 4+18+12+36+20+54=144 -> 6
const BEISPIELE = ['123456601', '123456701', '999999999', '000000000', '12345', '', null, undefined, 'abcdefghi', '1234566012', '271234401', '271234501'];

test('Beispiele: identisch mit dem Backend', () => {
  for (const b of BEISPIELE) assert.equal(isValidLanr(b), backendIsValidLanr(b), String(b));
});
test('gueltig / ungueltig / Ersatzwert', () => {
  assert.equal(isValidLanr('123456601'), true);
  assert.equal(isValidLanr('123456701'), false);
  assert.equal(isValidLanr('999999999'), true);
});
test('Warnung nur bei 9 Ziffern mit falscher Pruefziffer', () => {
  assert.equal(lanrPruefzifferWarnung('123456701'), LANR_PRUEFZIFFER_HINWEIS);
  assert.equal(lanrPruefzifferWarnung('123456601'), '');
  assert.equal(lanrPruefzifferWarnung('999999999'), '');
  assert.equal(lanrPruefzifferWarnung('12345'), '');
  assert.equal(lanrPruefzifferWarnung(''), '');
});
