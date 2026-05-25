// node api-backend/billing/zuzahlung/zuzahlungPrint.test.js
import { renderZuzahlungsrechnung } from '../pdf/zuzahlungsrechnung.template.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('Zuzahlungsrechnung print generation test');

test('correctly maps fields to A4 printout structure', () => {
  const opts = {
    praxis: { name: 'Therapiezentrum', strasse: 'Musterweg 1', plz_ort: '53721 Siegburg', telefon: '123' },
    patient: { vorname: 'Jane', nachname: 'Doe', strasse: 'Bahnstr. 4', plz: '53721', ort: 'Siegburg' },
    rechnung: { nummer: 'ZU-12345', datum: new Date(), faelligkeit: new Date() },
    sessions: [{ datum: new Date(), position: 'X0501', bezeichnung: 'KG', brutto: 35.00, zuzahlung: 3.50 }],
    totals: { brutto: 35.00, prozZuzahlung: 3.50, pauschZuzahlung: 10.00, gesZuzahlung: 13.50 }
  };
  const html = renderZuzahlungsrechnung(opts);
  assert.ok(html.includes('ZU-12345'), 'should contain invoice number');
  assert.ok(html.includes('Jane Doe'), 'should contain patient name');
  // German formatting check
  assert.ok(html.includes('13,50') && html.includes('€'), 'should contain total amount');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
