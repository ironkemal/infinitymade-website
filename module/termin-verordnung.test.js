import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frequenzMindestabstand, pruefeFrequenz } from './termin-verordnung.js';

// Der Fall aus der Besprechung (Nausad, 12.08.2026): Verordnung sagt „alle vier
// Wochen", das System liess die zweite Sitzung am Folgetag zu.
test('„alle 4 Wochen" verlangt ~4 Wochen Abstand', () => {
  assert.equal(frequenzMindestabstand('alle 4 Wochen').tage, 22);
  assert.equal(frequenzMindestabstand('alle vier Wochen').tage, 22);
});

test('wöchentliche Frequenzen', () => {
  assert.equal(frequenzMindestabstand('1x wöchentlich').tage, 6);
  assert.equal(frequenzMindestabstand('2x wöchentlich').tage, 2);
  assert.equal(frequenzMindestabstand('3x pro Woche').tage, 1);
});

// Bei einer Spanne gilt der höhere Wert — die Warnung soll nur den klar
// unplausiblen Fall treffen, nicht jeden zweiten Termin.
test('Spanne „1-2x wöchentlich" rechnet mit 2x', () => {
  assert.equal(frequenzMindestabstand('1-2x wöchentlich').tage, 2);
});

test('14-tägig', () => {
  assert.equal(frequenzMindestabstand('14-tägig').tage, 11);
});

// Kein verwertbarer Text heisst ausdrücklich „nicht prüfen". Eine Warnung ohne
// Grundlage wird weggeklickt und macht damit alle anderen Warnungen wertlos.
test('unbekannter oder leerer Text prüft nicht', () => {
  assert.equal(frequenzMindestabstand(''), null);
  assert.equal(frequenzMindestabstand(null), null);
  assert.equal(frequenzMindestabstand('nach Bedarf'), null);
  assert.equal(frequenzMindestabstand('täglich'), null);
});

// ── pruefeFrequenz mit einem Supabase-Doppel ───────────────────────────────

function supabaseDoppel(sessions, error = null) {
  const kette = {
    select: () => kette,
    eq: () => kette,
    not: () => Promise.resolve({ data: sessions, error }),
  };
  return { from: () => kette };
}

const rx = { id: 'rx-1', frequenz: 'alle 4 Wochen' };

test('Folgetag bei „alle 4 Wochen" wird beanstandet', async () => {
  const supabase = supabaseDoppel([
    { id: 's1', session_number: 1, booking_id: 'b1', bookings: { start_time: '2026-08-10T09:00:00Z', status: 'confirmed' } },
  ]);
  const r = await pruefeFrequenz({ supabase, rx, neuesDatum: new Date('2026-08-11T09:00:00Z') });
  assert.equal(r.ok, false);
  assert.match(r.meldung, /alle 4 Wochen/);
  assert.match(r.meldung, /trotzdem angelegt/);
});

test('vier Wochen später ist in Ordnung', async () => {
  const supabase = supabaseDoppel([
    { id: 's1', session_number: 1, booking_id: 'b1', bookings: { start_time: '2026-08-10T09:00:00Z', status: 'confirmed' } },
  ]);
  const r = await pruefeFrequenz({ supabase, rx, neuesDatum: new Date('2026-09-07T09:00:00Z') });
  assert.equal(r.ok, true);
});

// Ein Termin kann auch VOR einen bestehenden gelegt werden — der Abstand zählt
// in beide Richtungen.
test('zu früh VOR einem bestehenden Termin wird ebenfalls beanstandet', async () => {
  const supabase = supabaseDoppel([
    { id: 's1', session_number: 2, booking_id: 'b1', bookings: { start_time: '2026-08-20T09:00:00Z', status: 'confirmed' } },
  ]);
  const r = await pruefeFrequenz({ supabase, rx, neuesDatum: new Date('2026-08-19T09:00:00Z') });
  assert.equal(r.ok, false);
});

test('abgesagte Termine zählen nicht', async () => {
  const supabase = supabaseDoppel([
    { id: 's1', session_number: 1, booking_id: 'b1', bookings: { start_time: '2026-08-10T09:00:00Z', status: 'cancelled' } },
  ]);
  const r = await pruefeFrequenz({ supabase, rx, neuesDatum: new Date('2026-08-11T09:00:00Z') });
  assert.equal(r.ok, true);
});

// Der Termin, den man gerade bearbeitet, darf sich nicht selbst beanstanden.
test('der eigene Termin wird übersprungen', async () => {
  const supabase = supabaseDoppel([
    { id: 's1', session_number: 1, booking_id: 'b1', bookings: { start_time: '2026-08-10T09:00:00Z', status: 'confirmed' } },
  ]);
  const r = await pruefeFrequenz({
    supabase, rx, neuesDatum: new Date('2026-08-11T09:00:00Z'), ausserBookingId: 'b1',
  });
  assert.equal(r.ok, true);
});

// Lieber gar nicht warnen als auf falscher Grundlage warnen.
test('Lesefehler führt nicht zu einer Warnung', async () => {
  const supabase = supabaseDoppel(null, { message: 'boom' });
  const r = await pruefeFrequenz({ supabase, rx, neuesDatum: new Date('2026-08-11T09:00:00Z') });
  assert.equal(r.ok, true);
});

test('Verordnung ohne Frequenz wird nicht geprüft', async () => {
  const supabase = supabaseDoppel([]);
  const r = await pruefeFrequenz({ supabase, rx: { id: 'rx-2' }, neuesDatum: new Date() });
  assert.equal(r.ok, true);
});
