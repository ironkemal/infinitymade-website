import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gelernteDauer, dauerQuelle, uebernehmeDauerQuelle, setzeDauerQuelleZurueck,
} from './termin-dauer.js';

// ── Hilfsattrappe ────────────────────────────────────────────────────────
// Ein generisches Kettenobjekt: jede Methode (select/eq/is/in/not/order/limit)
// gibt sich selbst zurueck, `await` loest ueber `then()` auf — genau wie der
// echte Supabase-Query-Builder.
function chainable(data) {
  const obj = {};
  ['select', 'eq', 'is', 'in', 'not', 'order', 'limit'].forEach(m => { obj[m] = () => obj; });
  obj.then = (resolve) => resolve({ data });
  return obj;
}

function fakeSupabase({ bookings = [], leistungen = [] } = {}) {
  return {
    from(tabelle) {
      if (tabelle === 'bookings') return chainable(bookings);
      if (tabelle === 'booking_leistungen') return chainable(leistungen);
      throw new Error('unbekannte Tabelle in der Attrappe: ' + tabelle);
    },
  };
}

function buchung(id, minuten) {
  const start = new Date('2026-09-01T08:00:00.000Z');
  const ende = new Date(start.getTime() + minuten * 60000);
  return { id, start_time: start.toISOString(), end_time: ende.toISOString() };
}

// ── gelernteDauer ────────────────────────────────────────────────────────

test('ohne supabase/ownerId/serviceId gibt es nichts zu lernen', async () => {
  assert.equal(await gelernteDauer({}), null);
  assert.equal(await gelernteDauer({ supabase: fakeSupabase(), ownerId: 'o1' }), null);
});

test('unter drei manuellen Eintraegen wird noch nicht gelernt — ein Ausreisser darf nicht zum Vorschlag fuer alle werden', async () => {
  const supabase = fakeSupabase({ bookings: [buchung('b1', 45), buchung('b2', 45)] });
  const r = await gelernteDauer({ supabase, ownerId: 'o1', serviceId: 's1' });
  assert.equal(r, null);
});

test('ab drei manuellen Eintraegen liefert der Median die Schaetzung', async () => {
  const supabase = fakeSupabase({
    bookings: [buchung('b1', 30), buchung('b2', 45), buchung('b3', 40)],
  });
  const r = await gelernteDauer({ supabase, ownerId: 'o1', serviceId: 's1' });
  assert.deepEqual(r, { minuten: 40, anzahl: 3 });
});

test('Kombi-Termine (mehr als eine Zeile in booking_leistungen) fliessen nicht ein', async () => {
  const supabase = fakeSupabase({
    bookings: [buchung('b1', 30), buchung('b2', 45), buchung('b3', 40), buchung('b4', 35)],
    // b2 hat zwei Leistungszeilen -> Kombi-Termin, faellt raus, nur 3 bleiben
    leistungen: [{ booking_id: 'b2' }, { booking_id: 'b2' }],
  });
  const r = await gelernteDauer({ supabase, ownerId: 'o1', serviceId: 's1' });
  assert.deepEqual(r, { minuten: 35, anzahl: 3 });
});

test('ein Datenfehler (ueber 10 Stunden) wird verworfen, nicht als Termin gezaehlt', async () => {
  const supabase = fakeSupabase({
    bookings: [buchung('b1', 30), buchung('b2', 45), buchung('b3', 700)],
  });
  const r = await gelernteDauer({ supabase, ownerId: 'o1', serviceId: 's1' });
  assert.equal(r, null); // nur noch zwei brauchbare Werte — unter der Mindeststichprobe
});

// ── dauer_quelle: Zustand zwischen den Terminmasken ─────────────────────

test('nach dem Zuruecksetzen ist die Quelle "vorschlag" — noch nichts bewusst entschieden', () => {
  setzeDauerQuelleZurueck();
  assert.equal(dauerQuelle(), 'vorschlag');
});

test('eine gespeicherte "manuell"-Markierung wird beim Bearbeiten uebernommen', () => {
  uebernehmeDauerQuelle('manuell');
  assert.equal(dauerQuelle(), 'manuell');
});

test('alles andere als "manuell" (auch NULL/unbekannt) zaehlt als noch nicht entschieden', () => {
  uebernehmeDauerQuelle('vorschlag');
  assert.equal(dauerQuelle(), 'vorschlag');
  uebernehmeDauerQuelle(null);
  assert.equal(dauerQuelle(), 'vorschlag');
  uebernehmeDauerQuelle(undefined);
  assert.equal(dauerQuelle(), 'vorschlag');
});
