// TERMIN_SELECT ist die Feldliste, mit der ein Termin zum Bearbeiten
// nachgeladen wird. Was hier fehlt, ist beim Oeffnen der Maske `undefined` —
// und wird beim Speichern als NULL zurueckgeschrieben. Genau so verlor
// `rezeptart` (Selbstzahler-Markierung) jede Bearbeitung.
//
// Der Test haelt die Felder fest, an denen ein stiller Datenverlust haengt.
// Er prueft die Liste, nicht die Abfrage: eine echte Abfrage braeuchte
// Anmeldung und Datenbank, der Fehler sass aber in der Liste selbst.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TERMIN_SELECT, RX_FELDER, RX_JOIN } from './termin-laden.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Die Feldnamen der obersten Ebene — verschachtelte Beziehungen ausgeklammert. */
function oberflaeche(select) {
  return select.replace(/\w+\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '').split(',')
    .map(s => s.trim()).filter(Boolean);
}

test('rezeptart wird mitgeladen — sonst geht die Selbstzahler-Markierung verloren', () => {
  assert.ok(oberflaeche(TERMIN_SELECT).includes('rezeptart'));
});

test('payment_method wird mitgeladen — openBookingModal stellt es wieder her', () => {
  assert.ok(oberflaeche(TERMIN_SELECT).includes('payment_method'));
});

test('die Felder, die der Speicherpfad ueberschreibt, sind alle dabei', () => {
  // Jedes Feld aus dem payload in dashboard.js, das aus der Maske kommt und
  // beim Bearbeiten aus `b` vorbelegt wird. Fehlt eins, wird es genullt.
  const felder = oberflaeche(TERMIN_SELECT);
  for (const f of ['start_time', 'end_time', 'customer_name', 'customer_phone',
                   'notes', 'hausbesuch', 'lead_id', 'user_id', 'service_id',
                   'status', 'rezeptart', 'payment_method']) {
    assert.ok(felder.includes(f), `${f} fehlt in TERMIN_SELECT`);
  }
});

test('die Sitzungsbeziehung bleibt erhalten', () => {
  assert.match(TERMIN_SELECT, /prescription_sessions\(/);
});

test('no_show_session_links wird mitgeladen — sonst verschwindet die Rezeptinfo beim erneuten Oeffnen eines Ausfall-Termins', () => {
  assert.ok(oberflaeche(TERMIN_SELECT).includes('no_show_session_links'));
});

test('verordnung_id wird mitgeladen — sonst findet die Podologie-Verordnung im Termin-Aktionen-Panel keinen Anschluss', () => {
  assert.ok(oberflaeche(TERMIN_SELECT).includes('verordnung_id'));
});

// Die Verordnungsspalten am Termin standen an fuenf Stellen von Hand; `rezeptart`
// fehlte in allen (canli-test P1, 10.10.2026). Seitdem gibt es RX_FELDER/RX_JOIN.
test('RX_FELDER traegt die Spalten, an denen Geldzeile und Rezeptinfo haengen', () => {
  const felder = RX_FELDER.replace(/\w+\([^()]*\)/g, '').split(',').filter(Boolean);
  for (const f of ['rezeptart', 'gueltig_bis', 'zuzahlung_befreit', 'patient_id', 'arzt_id']) {
    assert.ok(felder.includes(f), `${f} fehlt in RX_FELDER`);
  }
  assert.ok(TERMIN_SELECT.includes(RX_JOIN));
});

test('RX_FELDER nennt nur Spalten, die es in prescriptions gibt', () => {
  const schema = readFileSync(fileURLToPath(new URL('../db/SCHEMA.sql', import.meta.url)), 'utf8');
  const start = schema.indexOf('CREATE TABLE public.prescriptions (');
  assert.ok(start >= 0, 'prescriptions nicht im Schema-Auszug gefunden');
  const block = schema.slice(start, schema.indexOf(');', start));
  const felder = RX_FELDER.replace(/\w+\([^()]*\)/g, '').split(',').filter(Boolean);
  for (const f of felder) assert.match(block, new RegExp(`\\n\\s+"?${f}"? `), `${f} steht nicht im Schema`);
});

test('der Termin-Join zur Verordnung wird nirgends mehr von Hand geschrieben', () => {
  const wurzel = fileURLToPath(new URL('..', import.meta.url));
  const dateien = ['dashboard.js', ...readdirSync(wurzel + 'module')
    .filter(n => n.endsWith('.js') && !n.endsWith('.test.js') && n !== 'termin-laden.js')
    .map(n => 'module/' + n)];
  for (const d of dateien) {
    const text = readFileSync(wurzel + d, 'utf8');
    assert.ok(!text.includes('prescription_sessions(id,session_number,prescriptions('), `${d}: Join von Hand — RX_JOIN benutzen`);
  }
});
