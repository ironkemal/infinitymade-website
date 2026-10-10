import { test } from 'node:test';
import assert from 'node:assert/strict';

import { paymentMethodFuerZahlart } from './rechnung-zahlung.js';

// Regressionstest (Ops-Meldung, 10.09.2026): 'paypal' wurde in prescriptions/
// belegliste ergänzt, aber ZAHLART_ZU_PAYMENT_METHOD hier vergessen — eine
// per PayPal bezahlte Rechnung verlor ihren payment_method lautlos (undefined
// -> || null in markiereRechnungBezahlt()). invoices.payment_method hat
// keinen eigenen 'paypal'-Wert (CHECK-Constraint), fällt deshalb auf
// 'sonstiges' zurück statt auf null.

test('bekannte Zahlarten werden 1:1 oder auf das passende Pendant abgebildet', () => {
  assert.equal(paymentMethodFuerZahlart('bar'), 'bar');
  assert.equal(paymentMethodFuerZahlart('ec'), 'karte');
  assert.equal(paymentMethodFuerZahlart('ueberweisung'), 'ueberweisung');
  assert.equal(paymentMethodFuerZahlart('sonstiges'), 'sonstiges');
});

test('paypal faellt auf sonstiges, nicht auf null', () => {
  assert.equal(paymentMethodFuerZahlart('paypal'), 'sonstiges');
});

test('unbekannte/fehlende Zahlart -> null, nicht undefined', () => {
  assert.equal(paymentMethodFuerZahlart('bitcoin'), null);
  assert.equal(paymentMethodFuerZahlart(undefined), null);
  assert.equal(paymentMethodFuerZahlart(null), null);
});

test('markiereRechnungBezahlt: meldet UPDATE-Fehler statt ihn zu verschlucken (onprem §7AI iii)', async () => {
  const { markiereRechnungBezahlt } = await import('./rechnung-zahlung.js');
  const sb = (antwort) => ({ from: () => ({ update: () => ({ eq: async () => antwort }) }) });
  assert.equal(await markiereRechnungBezahlt(sb({ error: null }), 'inv-1', 'bar'), true);
  assert.equal(await markiereRechnungBezahlt(sb({ error: { message: 'festgeschrieben' } }), 'inv-1', 'bar'), false);
  const wirft = { from: () => ({ update: () => ({ eq: async () => { throw new Error('netz'); } }) }) };
  assert.equal(await markiereRechnungBezahlt(wirft, 'inv-1', 'bar'), false);
});
