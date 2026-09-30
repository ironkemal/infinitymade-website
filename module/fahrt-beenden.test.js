import test from 'node:test';
import assert from 'node:assert/strict';
import { zeigeFahrtBeenden, fahrtBeendenHinweisHtml, fahrtEndOeffnen, fahrtEndAktuell, fahrtEndAbschluss, leadIdFuerFahrt } from './fahrt-beenden.js';

test('Knopf nur mit Buchung und offener Fahrt', () => {
  assert.equal(zeigeFahrtBeenden({ bookingId: 'b1', fahrt_status: 'fahrt_return_pending' }), true);
  assert.equal(zeigeFahrtBeenden({ bookingId: 'b1', fahrt_status: 'fahrt_completed' }), false);
  assert.equal(zeigeFahrtBeenden({ bookingId: 'b1', fahrt_status: 'fahrt_arrived' }), false);
  assert.equal(zeigeFahrtBeenden({ bookingId: null, fahrt_status: 'fahrt_return_pending' }), false);
  assert.equal(zeigeFahrtBeenden(), false);
});

test('Hinweis enthält Knopf, keinen Backtick-Ärger, keine feste Farbe', () => {
  const h = fahrtBeendenHinweisHtml();
  assert.match(h, /id="podFahrtBeendenBtn"/);
  assert.match(h, /Fahrt beenden/);
  assert.doesNotMatch(h, /#fff|#f3f4f6|onclick/i);
});

test('ohne Kontext: Cache, Abschluss springt ins Fahrtenbuch (altes Verhalten)', () => {
  const cache = { id: 'c' };
  assert.equal(fahrtEndOeffnen(undefined, cache), cache);
  assert.equal(fahrtEndOeffnen({ type: 'click' }, cache), cache);
  assert.equal(fahrtEndAktuell(cache), cache);
  const calls = [];
  fahrtEndAbschluss({ closeBkActionPanel: () => calls.push('close'), showToast: () => calls.push('toast'), switchPanel: (p) => calls.push('panel:' + p) });
  assert.deepEqual(calls, ['close', 'toast', 'panel:fahrtenbuch']);
});

test('mit Kontext: eigene Buchung, bleibt in der Tagesbehandlung, onFertig einmal', () => {
  const cache = { id: 'c' }, booking = { id: 'b' };
  let fertig = 0;
  assert.equal(fahrtEndOeffnen({ booking, onFertig: () => fertig++ }, cache), booking);
  assert.equal(fahrtEndAktuell(cache), booking);
  const calls = [];
  fahrtEndAbschluss({ closeBkActionPanel: () => calls.push('close'), showToast: () => calls.push('toast'), switchPanel: () => calls.push('panel') });
  assert.deepEqual(calls, ['toast']);
  assert.equal(fertig, 1);
  assert.equal(fahrtEndAktuell(cache), cache); // Kontext verbraucht
});

test('erneutes Öffnen ohne Kontext löscht einen alten Kontext', () => {
  fahrtEndOeffnen({ booking: { id: 'x' } }, null);
  const cache = { id: 'c' };
  assert.equal(fahrtEndOeffnen(undefined, cache), cache);
  assert.equal(fahrtEndAktuell(cache), cache);
});

test('leadIdFuerFahrt: booking.lead_id zuerst, ohne Abfrage', async () => {
  const sb = { from() { throw new Error('darf nicht abfragen'); } };
  assert.equal(await leadIdFuerFahrt(sb, { lead_id: 'L1', customer_phone: '123' }), 'L1');
});

test('leadIdFuerFahrt: Telefon-Rückfall, ohne Treffer/Nummer/Fehler null', async () => {
  const mk = (res, boom) => ({ from() { const q = { select: () => q, eq: () => q, maybeSingle: async () => { if (boom) throw new Error('x'); return res; } }; return q; } });
  assert.equal(await leadIdFuerFahrt(mk({ data: { id: 'L2' } }), { owner_id: 'o', customer_phone: '123' }), 'L2');
  assert.equal(await leadIdFuerFahrt(mk({ data: null }), { owner_id: 'o', customer_phone: '123' }), null);
  assert.equal(await leadIdFuerFahrt(mk({ data: { id: 'L2' } }), { owner_id: 'o' }), null);
  assert.equal(await leadIdFuerFahrt(mk(null, true), { owner_id: 'o', customer_phone: '123' }), null);
  assert.equal(await leadIdFuerFahrt(null, null), null);
});
