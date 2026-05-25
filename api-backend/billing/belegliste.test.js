// Tests for GoBD Belegliste Helper.
//   node api-backend/billing/belegliste.test.js

import { validateBelegEntry, generateCsvString } from './belegliste/helper.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('GoBD Belegliste validation checks');

test('validateBelegEntry: allows positive barverkauf', () => {
  const res = validateBelegEntry('barverkauf', 25.50);
  assert.equal(res.isValid, true);
});

test('validateBelegEntry: allows positive zuzahlung', () => {
  const res = validateBelegEntry('zuzahlung', 13.50);
  assert.equal(res.isValid, true);
});

test('validateBelegEntry: allows negative storno', () => {
  const res = validateBelegEntry('storno', -25.50);
  assert.equal(res.isValid, true);
});

test('validateBelegEntry: rejects negative barverkauf', () => {
  const res = validateBelegEntry('barverkauf', -10.00);
  assert.equal(res.isValid, false);
  assert.ok(res.error.includes('positiven Betrag'));
});

test('validateBelegEntry: rejects positive storno', () => {
  const res = validateBelegEntry('storno', 15.00);
  assert.equal(res.isValid, false);
  assert.ok(res.error.includes('negativen Betrag'));
});

test('validateBelegEntry: rejects zero amount', () => {
  const res = validateBelegEntry('barverkauf', 0);
  assert.equal(res.isValid, false);
});

test('validateBelegEntry: rejects unknown type', () => {
  const res = validateBelegEntry('illegal_type', 10.00);
  assert.equal(res.isValid, false);
  assert.ok(res.error.includes('Ungültiger oder fehlender Typ'));
});

test('validateBelegEntry: rejects non-numeric amount', () => {
  const res = validateBelegEntry('barverkauf', 'not-a-number');
  assert.equal(res.isValid, false);
});

console.log('\nGoBD Belegliste CSV formatting checks');

test('generateCsvString: outputs valid GoBD headers and formats German commas', () => {
  const mockRows = [
    { beleg_nr: 1, created_at: '2026-05-25T14:05:00Z', type: 'zuzahlung', amount_eur: 13.50, reference_text: 'Co-pay rx_1' },
    { beleg_nr: 2, created_at: '2026-05-25T14:15:00Z', type: 'barverkauf', amount_eur: 25.00, reference_text: 'Massage "Premium"' }
  ];
  
  const csv = generateCsvString(mockRows);
  
  // Verify delimiter directive is present and starts directly (without UTF-8 BOM)
  assert.equal(csv.startsWith('sep=;\r\n'), true, 'CSV must start directly with delimiter declaration (sep=;)');
  
  // Verify Headers and CRLF line endings
  assert.ok(csv.includes('Beleg-Nr;Datum;Uhrzeit;Typ;Betrag EUR;Referenztext\r\n'), 'CSV headers mismatch or missing CRLF');
  
  // Verify Sequential Padding
  assert.ok(csv.includes('"000001"'), 'Beleg-Nr should be padded to 6 digits');
  assert.ok(csv.includes('"000002"'), 'Beleg-Nr should be padded to 6 digits');
  
  // Verify Date formats
  assert.ok(csv.includes('25.05.2026'), 'Date should follow German format');
  
  // Verify German decimal representation (comma instead of dot)
  assert.ok(csv.includes('"13,50"'), 'Decimal separator should be a comma');
  assert.ok(csv.includes('"25,00"'), 'Decimal separator should be a comma');
  
  // Verify quote escaping in Reference Texts
  assert.ok(csv.includes('Massage ""Premium""'), 'Quotes must be escaped as double-quotes');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
