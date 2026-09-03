import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waehleSeite } from './sitzungen-ansicht.js';

// Die Voreinstellung ist „Unvergebene": das ist die Liste, aus der man zieht.
test('ohne Wunsch beginnt der Umschalter bei den unvergebenen Einheiten', () => {
  assert.equal(waehleSeite({ wunsch: undefined, offen: 4, vergeben: 2 }), 'unvergeben');
});

test('eine getroffene Wahl bleibt bestehen, solange sie etwas zeigt', () => {
  assert.equal(waehleSeite({ wunsch: 'vergeben', offen: 4, vergeben: 2 }), 'vergeben');
  assert.equal(waehleSeite({ wunsch: 'unvergeben', offen: 4, vergeben: 2 }), 'unvergeben');
});

// Ist alles vergeben, wäre „Unvergebene" eine leere Seite mit einem Haken —
// der Umschalter zeigt dann gleich die Termine.
test('ist nichts mehr offen, öffnet der Umschalter die Termine', () => {
  assert.equal(waehleSeite({ wunsch: 'unvergeben', offen: 0, vergeben: 6 }), 'vergeben');
});

test('ist noch kein Termin vergeben, bleibt es bei den unvergebenen', () => {
  assert.equal(waehleSeite({ wunsch: 'vergeben', offen: 6, vergeben: 0 }), 'unvergeben');
});

// Beide leer: lieber bei der Voreinstellung bleiben, als den Nutzer wortlos
// auf eine andere — ebenfalls leere — Seite zu schieben.
test('sind beide Seiten leer, wird nicht umgeschaltet', () => {
  assert.equal(waehleSeite({ wunsch: 'unvergeben', offen: 0, vergeben: 0 }), 'unvergeben');
  assert.equal(waehleSeite({ wunsch: 'vergeben', offen: 0, vergeben: 0 }), 'vergeben');
});

test('ein unbekannter Wunsch fällt auf die Voreinstellung zurück', () => {
  assert.equal(waehleSeite({ wunsch: 'quatsch', offen: 3, vergeben: 1 }), 'unvergeben');
});

test('fehlende Zahlen werden wie null behandelt und stürzen nicht ab', () => {
  assert.equal(waehleSeite({ wunsch: 'unvergeben' }), 'unvergeben');
});
