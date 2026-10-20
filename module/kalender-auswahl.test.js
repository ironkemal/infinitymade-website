import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markiere, panelOffen, verdrahteAuswahl, AUSWAHL_KLASSE } from './kalender-auswahl.js';

function block(id) {
  const klassen = new Set();
  return {
    _termin: id == null ? undefined : { id },
    classList: {
      toggle: (k, an) => (an ? klassen.add(k) : klassen.delete(k)),
      contains: (k) => klassen.has(k)
    }
  };
}

test('markiere: nur die Blöcke des Termins tragen die Klasse', () => {
  const a = block(1), b = block(2), c = block(1);
  assert.equal(markiere([a, b, c], 1), 2);
  assert.ok(a.classList.contains(AUSWAHL_KLASSE));
  assert.ok(!b.classList.contains(AUSWAHL_KLASSE));
  assert.ok(c.classList.contains(AUSWAHL_KLASSE));
});

test('markiere: Wechsel nimmt die alte Markierung weg', () => {
  const a = block(1), b = block(2);
  markiere([a, b], 1);
  markiere([a, b], 2);
  assert.ok(!a.classList.contains(AUSWAHL_KLASSE));
  assert.ok(b.classList.contains(AUSWAHL_KLASSE));
});

test('markiere: null leert alles, Block ohne Termin bleibt unmarkiert', () => {
  const a = block(1), leer = block(null);
  markiere([a, leer], 1);
  assert.equal(markiere([a, leer], null), 0);
  assert.ok(!a.classList.contains(AUSWAHL_KLASSE));
  assert.ok(!leer.classList.contains(AUSWAHL_KLASSE));
});

test('panelOffen: gleiche Regel wie isBkActionOpen()', () => {
  assert.equal(panelOffen(null), false);
  assert.equal(panelOffen({ style: { display: 'none' }, hidden: false }), false);
  assert.equal(panelOffen({ style: { display: 'flex' }, hidden: true }), false);
  assert.equal(panelOffen({ style: { display: 'flex' }, hidden: false }), true);
});

test('verdrahteAuswahl: ohne DOM kein Fehler', () => {
  assert.doesNotThrow(() => verdrahteAuswahl({ selektor: '.x', behaelterIds: [] }));
});
