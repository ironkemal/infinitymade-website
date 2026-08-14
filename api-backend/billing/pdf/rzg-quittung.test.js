// node api-backend/billing/pdf/rzg-quittung.test.js
//
// Die Quittung, die dem Patienten in die Hand gedrückt wird. Einzige Regel, die
// hier zählt: darauf steht sein Anteil und sonst kein Betrag.
import { renderRzgQuittung } from './rzg-quittung.template.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('RZG-Quittung template');

const opts = {
  praxis:   { name: 'Praxis Müller', strasse: 'Königsallee 1', plz_ort: '40213 Düsseldorf', ik: '123456789' },
  patient:  { vorname: 'Hans', nachname: 'Müller', kvnr: 'A123456789' },
  verordnung: { ausstellungsdatum: '2026-05-02', krankenkasse: 'AOK Rheinland/Hamburg' },
  rechnung: { nummer: 'RZG-ABCD1234', datum: '2026-05-18' },
  sessions: [
    { datum: '2026-05-05', position: '20501', bezeichnung: 'KG Einzel', zuzahlung: 2.96 },
    { datum: '2026-05-07', position: '20501', bezeichnung: 'KG Einzel', zuzahlung: 2.96 },
  ],
  totals: { brutto: 59.26, prozZuzahlung: 5.92, pauschZuzahlung: 10.00, gesZuzahlung: 15.92, netto: 43.34 },
};

const q = renderRzgQuittung(opts);

test('starts with doctype', () => assert.ok(q.startsWith('<!DOCTYPE html>')));
test('zeigt den erhaltenen Eigenanteil', () => assert.ok(q.includes('15,92')));
test('zeigt weder Behandlungsbetrag noch Kassenanteil', () => {
  assert.ok(!q.includes('59,26'), 'Gesamtbetrag der Behandlung darf nicht erscheinen');
  assert.ok(!q.includes('43,34'), 'Kassenanteil darf nicht erscheinen');
});

// Der frühere Rückfall `totals.gesZuzahlung ?? totals.gesamt ?? 0` druckte bei
// fehlendem Eigenanteil den vollen Behandlungsbetrag als "erhaltenen Betrag".
// Lieber gar keine Quittung als eine mit dem falschen Betrag.
test('bricht ab statt den Gesamtbetrag zu drucken', () => {
  assert.throws(
    () => renderRzgQuittung({ ...opts, totals: { gesamt: 59.26 } }),
    /gesZuzahlung/
  );
});
test('bricht auch bei leeren totals ab', () => {
  assert.throws(() => renderRzgQuittung({ ...opts, totals: {} }), /gesZuzahlung/);
});
test('0,00 € ist ein gültiger Betrag (zuzahlungsfrei)', () => {
  const frei = renderRzgQuittung({ ...opts, totals: { gesZuzahlung: 0 } });
  assert.ok(frei.includes('0,00'));
});
test('escapes XSS', () => {
  const evil = renderRzgQuittung({
    ...opts,
    praxis: { name: '<script>alert(1)</script>' },
  });
  assert.ok(!evil.includes('<script>alert(1)'));
  assert.ok(evil.includes('&lt;script&gt;'));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
