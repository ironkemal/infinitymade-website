import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  baueHeuteIndex, terminZuLead, tagesgrenzen, uhrzeitBerlin,
} from './termin-heute.js?v=20260906';

const T = (h, m = 0) => `2026-09-06T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+02:00`;
const JETZT = new Date(T(15));

test('lead_id ist der stärkste Schlüssel', () => {
  const idx = baueHeuteIndex([{ lead_id: 'a', start_time: T(9), status: 'confirmed' }], JETZT);
  assert.equal(terminZuLead(idx, { id: 'a' }), T(9));
  assert.equal(terminZuLead(idx, { id: 'b' }), null);
});

test('ohne lead_id greift die Telefonnummer — Schreibweise egal', () => {
  const idx = baueHeuteIndex(
    [{ customer_phone_normalized: '+4917012345', start_time: T(10), status: 'confirmed' }], JETZT);
  assert.equal(terminZuLead(idx, { id: 'x', phone: '0170 / 123-45' }), null); // andere Ziffern
  assert.equal(terminZuLead(idx, { id: 'x', phone_normalized: '+4917012345' }), T(10));
});

test('Name trägt nur, solange er eindeutig ist', () => {
  const eindeutig = baueHeuteIndex(
    [{ customer_name: 'Klaus Fischer · 1972-07-23', lead_id: null, start_time: T(11), status: 'confirmed' }], JETZT);
  assert.equal(terminZuLead(eindeutig, { first_name: 'Klaus', last_name: 'Fischer', geburtsdatum: '1972-07-23' }), T(11));

  // Zwei Menschen, gleicher Name → lieber gar kein Vorschlag.
  const doppelt = baueHeuteIndex([
    { customer_name: 'Klaus Fischer', lead_id: 'a', start_time: T(11), status: 'confirmed' },
    { customer_name: 'Klaus Fischer', lead_id: 'b', start_time: T(12), status: 'confirmed' },
  ], JETZT);
  assert.equal(terminZuLead(doppelt, { first_name: 'Klaus', last_name: 'Fischer' }), null);
});

test('zwei Termine desselben Patienten verbrennen den Namen nicht', () => {
  const idx = baueHeuteIndex([
    { customer_name: 'Eva Klein', lead_id: 'a', start_time: T(9), status: 'confirmed' },
    { customer_name: 'Eva Klein', lead_id: 'a', start_time: T(16), status: 'confirmed' },
  ], JETZT);
  // 16:00 liegt näher an 15:00 als 09:00 — der aktuelle Termin gewinnt.
  assert.equal(terminZuLead(idx, { first_name: 'Eva', last_name: 'Klein' }), T(16));
});

test('abgesagte, no-show und fremde Status zählen nicht', () => {
  const idx = baueHeuteIndex([
    { lead_id: 'a', start_time: T(9),  status: 'cancelled' },
    { lead_id: 'b', start_time: T(10), status: 'no_show' },
    { lead_id: 'c', start_time: T(11), status: 'confirmed', no_show: true },
    { lead_id: 'd', start_time: T(12), status: 'completed' },
    { lead_id: 'e', start_time: T(13), status: 'pending' },
  ], JETZT);
  assert.equal(terminZuLead(idx, { id: 'a' }), null);
  assert.equal(terminZuLead(idx, { id: 'b' }), null);
  assert.equal(terminZuLead(idx, { id: 'c' }), null);
  assert.equal(terminZuLead(idx, { id: 'd' }), T(12), 'schon behandelt — Rezept wird danach erfasst');
  assert.equal(terminZuLead(idx, { id: 'e' }), T(13));
});

test('leerer Index schlägt niemanden vor', () => {
  const idx = baueHeuteIndex([], JETZT);
  assert.equal(terminZuLead(idx, { id: 'a', phone: '0170123', first_name: 'A' }), null);
  assert.equal(terminZuLead(idx, null), null);
});

test('Tagesgrenzen laufen über Berliner Zeit, nicht über UTC', () => {
  // 22:30 UTC am 06.09. ist in Berlin bereits der 07.09. — mit
  // toISOString().slice(0,10) wäre hier noch der 06. herausgekommen.
  const { tag } = tagesgrenzen(new Date('2026-09-06T22:30:00Z'));
  assert.equal(tag, '2026-09-07');
});

test('Uhrzeit wird in Berliner Zeit beschriftet', () => {
  assert.equal(uhrzeitBerlin('2026-09-06T12:00:00Z'), '14:00');
  assert.equal(uhrzeitBerlin('kaputt'), '');
});
