// node api-backend/billing/zuzahlung/bezahlt.test.js
import { istZuzahlungBezahlt, saldoJeRezept } from './bezahlt.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('istZuzahlungBezahlt');

test('voller Beleg → bezahlt', () => {
  assert.equal(istZuzahlungBezahlt({ zuzahlungEur: 13.50, kassiertAm: '2026-08-01', saldo: 13.50 }), true);
});

test('kein Beleg, kein Vermerk → offen', () => {
  assert.equal(istZuzahlungBezahlt({ zuzahlungEur: 13.50, kassiertAm: null, saldo: 0 }), false);
});

test('Altbestand: Vermerk ohne Beleg → bezahlt (sonst Mahnung trotz Zahlung)', () => {
  assert.equal(istZuzahlungBezahlt({ zuzahlungEur: 13.50, kassiertAm: '2026-05-14', saldo: 0 }), true);
});

test('storniert: Beleg und Gegenbuchung heben sich auf, Vermerk zurückgesetzt → offen', () => {
  assert.equal(istZuzahlungBezahlt({ zuzahlungEur: 13.50, kassiertAm: null, saldo: 0 }), false);
});

test('Teilzahlung → weiter offen', () => {
  assert.equal(istZuzahlungBezahlt({ zuzahlungEur: 13.50, kassiertAm: null, saldo: 5.00 }), false);
});

test('Teilzahlung schlaegt den Altbestands-Vermerk NICHT', () => {
  // Sonst wuerde eine angefangene Zahlung als vollstaendig gelten.
  assert.equal(istZuzahlungBezahlt({ zuzahlungEur: 13.50, kassiertAm: '2026-05-14', saldo: 5.00 }), false);
});

test('Storno ohne Originalbeleg (negativer Saldo) → offen', () => {
  assert.equal(istZuzahlungBezahlt({ zuzahlungEur: 13.50, kassiertAm: null, saldo: -13.50 }), false);
});

test('Ueberzahlung → bezahlt', () => {
  assert.equal(istZuzahlungBezahlt({ zuzahlungEur: 10.00, kassiertAm: null, saldo: 12.00 }), true);
});

test('Rundungsrest von einem halben Cent gilt als bezahlt', () => {
  assert.equal(istZuzahlungBezahlt({ zuzahlungEur: 13.50, kassiertAm: null, saldo: 13.4999 }), true);
});

console.log('\nsaldoJeRezept');

test('summiert je Rezept und rechnet Stornos gegen', () => {
  const m = saldoJeRezept([
    { prescription_id: 'a', amount_eur: 13.50 },
    { prescription_id: 'b', amount_eur: 10.00 },
    { prescription_id: 'b', amount_eur: -10.00 },
    { prescription_id: null, amount_eur: 25.00 },
  ]);
  assert.equal(m.get('a'), 13.50);
  assert.equal(m.get('b'), 0);
  assert.equal(m.has(null), false, 'Belege ohne Rezeptbezug gehoeren nicht in die Zuordnung');
});

test('leere Eingabe → leere Zuordnung', () => {
  assert.equal(saldoJeRezept(null).size, 0);
  assert.equal(saldoJeRezept([]).size, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
