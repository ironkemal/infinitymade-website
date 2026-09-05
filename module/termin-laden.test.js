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
import { TERMIN_SELECT } from './termin-laden.js';

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
