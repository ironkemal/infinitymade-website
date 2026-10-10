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
  assert.deepEqual(await markiereRechnungBezahlt(sb({ error: null }), 'inv-1', 'bar'), { ok: true, meldung: null });
  // KHS §6 2 (vi): der Datenbanktext (Trigger 0080) kommt beim Aufrufer an
  assert.deepEqual(await markiereRechnungBezahlt(sb({ error: { message: 'Rechnung RE-1 kann nicht ausgestellt werden' } }), 'inv-1', 'bar'), { ok: false, meldung: 'Rechnung RE-1 kann nicht ausgestellt werden' });
  const wirft = { from: () => ({ update: () => ({ eq: async () => { throw new Error('netz'); } }) }) };
  assert.deepEqual(await markiereRechnungBezahlt(wirft, 'inv-1', 'bar'), { ok: false, meldung: 'netz' });
});

// KHS §6 2 (vi): Fake-Supabase für frageZahlungsstatus — invoices (Snapshot-Prüfung + Update) und prescriptions.
function zahlungsSb({ rechnung, rx = null, updateFehler = null }) {
  const updates = [];
  const sb = {
    from: (tab) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: tab === 'invoices' ? rechnung : rx, error: null }) }) }),
      update: (werte) => ({ eq: async () => { updates.push({ tab, werte }); return { error: tab === 'invoices' ? updateFehler : null }; } }),
    }),
  };
  return { sb, updates };
}

test('frageZahlungsstatus: Entwurf ohne Snapshot → kein Kassieren, Hinweis (vi)', async () => {
  const { frageZahlungsstatus } = await import('./rechnung-zahlung.js');
  const { sb, updates } = zahlungsSb({ rechnung: { status: 'draft', aussteller_snapshot: { v: 1 }, empfaenger_snapshot: null }, rx: { id: 'rx', zuzahlung_eur: 10 } });
  let kassiert = false; const toasts = [];
  await frageZahlungsstatus('inv-1', { supabase: sb, prescriptionId: 'rx', kassiere: async () => { kassiert = true; return true; }, toast: (m, t) => toasts.push({ m, t }) });
  assert.equal(kassiert, false);
  assert.equal(updates.length, 0);
  assert.equal(toasts[0].t, 'error');
  assert.match(toasts[0].m, /erneut speichern/);
});

test('frageZahlungsstatus: Altbeleg (sent) ohne Snapshot bleibt zahlbar; DB-Meldung wird angezeigt (vi)', async () => {
  const { frageZahlungsstatus } = await import('./rechnung-zahlung.js');
  const { sb } = zahlungsSb({ rechnung: { status: 'sent', aussteller_snapshot: null, empfaenger_snapshot: null }, rx: { id: 'rx', zuzahlung_kassiert_am: '2026-10-10', zuzahlung_zahlart: 'bar' }, updateFehler: { message: 'Trigger sagt nein' } });
  const toasts = [];
  await frageZahlungsstatus('inv-1', { supabase: sb, prescriptionId: 'rx', toast: (m, t) => toasts.push({ m, t }) });
  assert.deepEqual(toasts, [{ m: 'Trigger sagt nein', t: 'error' }]);
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

test('frageZahlungsstatus: Verordnung ohne Zuzahlungsfall → Signal für den Ledger-Dialog (canli-test 10.10.2026 P2)', async () => {
  const { frageZahlungsstatus } = await import('./rechnung-zahlung.js');
  const { sb, updates } = zahlungsSb({ rechnung: { status: 'draft', aussteller_snapshot: { v: 1 }, empfaenger_snapshot: { v: 1 } } });
  assert.equal(await frageZahlungsstatus('inv-1', { supabase: sb, prescriptionId: null }), 'ohne_zuzahlungsfall');
  assert.equal(updates.length, 0);
});
