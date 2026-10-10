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

test('markiereZuBelegBezahlt: ohne supabase oder rxId -> true (no-op)', async () => {
  const { markiereZuBelegBezahlt } = await import('./rechnung-zahlung.js');
  assert.equal(await markiereZuBelegBezahlt(null, 'rx-1', 'bar'), true);
  assert.equal(await markiereZuBelegBezahlt({}, '', 'bar'), true);
});

test('markiereZuBelegBezahlt: kein ZU-Beleg vorhanden -> true', async () => {
  const { markiereZuBelegBezahlt } = await import('./rechnung-zahlung.js');
  const fakeSb = {
    from(table) {
      assert.equal(table, 'invoices');
      return {
        select() { return this; },
        eq() { return this; },
        is() { return this; },
        neq() { return this; },
        async maybeSingle() {
          return { data: null, error: null };
        },
      };
    },
  };
  assert.equal(await markiereZuBelegBezahlt(fakeSb, 'rx-none', 'bar'), true);
});

test('markiereZuBelegBezahlt: bereits bezahlt -> true ohne Update', async () => {
  const { markiereZuBelegBezahlt } = await import('./rechnung-zahlung.js');
  let updateCalled = false;
  const fakeSb = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        is() { return this; },
        neq() { return this; },
        async maybeSingle() {
          return { data: { id: 'zu-1', status: 'paid', payment_status: 'paid' }, error: null };
        },
        update() {
          updateCalled = true;
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  };
  assert.equal(await markiereZuBelegBezahlt(fakeSb, 'rx-paid', 'bar'), true);
  assert.equal(updateCalled, false);
});

test('markiereZuBelegBezahlt: offener ZU-Beleg -> setzt paid und mapped Zahlart', async () => {
  const { markiereZuBelegBezahlt } = await import('./rechnung-zahlung.js');
  let updatePayload = null;
  let updatedId = null;
  const fakeSb = {
    from() {
      return {
        select() { return this; },
        eq(col, val) {
          if (col === 'id') updatedId = val;
          return this;
        },
        is() { return this; },
        neq() { return this; },
        async maybeSingle() {
          return { data: { id: 'zu-42', status: 'sent', payment_status: 'pending' }, error: null };
        },
        update(payload) {
          updatePayload = payload;
          return this;
        },
      };
    },
  };
  const res = await markiereZuBelegBezahlt(fakeSb, 'rx-42', 'ec');
  assert.equal(res, true);
  assert.equal(updatedId, 'zu-42');
  assert.equal(updatePayload.status, 'paid');
  assert.equal(updatePayload.payment_status, 'paid');
  assert.equal(updatePayload.payment_method, 'karte');
  assert.ok(typeof updatePayload.paid_at === 'string');
});

test('markiereZuBelegBezahlt: DB-Fehler meldet false', async () => {
  const { markiereZuBelegBezahlt } = await import('./rechnung-zahlung.js');
  const fakeSbSelectErr = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        is() { return this; },
        neq() { return this; },
        async maybeSingle() {
          return { data: null, error: { message: 'DB down' } };
        },
      };
    },
  };
  assert.equal(await markiereZuBelegBezahlt(fakeSbSelectErr, 'rx-err', 'bar'), false);

  const fakeSbUpdateErr = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        is() { return this; },
        neq() { return this; },
        async maybeSingle() {
          return { data: { id: 'zu-1', status: 'sent', payment_status: 'pending' }, error: null };
        },
        update() {
          return { eq: async () => ({ error: { message: 'update failed' } }) };
        },
      };
    },
  };
  assert.equal(await markiereZuBelegBezahlt(fakeSbUpdateErr, 'rx-err2', 'bar'), false);
});

test('Parität: ZAHLART_ZU_PAYMENT_METHOD in api-backend/billing/zuzahlung/zu-beleg.js ist ein Spiegel (10.10.2026)', async () => {
  const front = await import('./rechnung-zahlung.js');
  const back = await import('../api-backend/billing/zuzahlung/zu-beleg.js');
  assert.deepEqual(back.ZAHLART_ZU_PAYMENT_METHOD, front.ZAHLART_ZU_PAYMENT_METHOD);
});
