import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  waehleSeite, verdrahteSitzungsUmschalter, zeigeSitzungsSeiten, _setzeSeiteZurueck,
} from './sitzungen-ansicht.js';

/** Minimales DOM: nur was `zeigeSitzungsSeiten`/`verdrahteSitzungsUmschalter` anfassen. */
function baueDom() {
  const knopf = (ziel) => ({
    dataset: { ziel }, textContent: '', setAttribute() {}, classList: { toggle() {} },
  });
  const knoepfe = { unvergeben: knopf('unvergeben'), vergeben: knopf('vergeben') };
  let klickHandler = null;
  const leiste = {
    dataset: {},
    querySelector: (sel) => (sel.includes('"unvergeben"') ? knoepfe.unvergeben : knoepfe.vergeben),
    addEventListener: (typ, fn) => { klickHandler = fn; },
  };
  const kartei = {
    bkRxSitzungTabs: leiste,
    bkRxUnvergebeneBox: { hidden: false },
    bkRxVergebeneBox: { hidden: true },
  };
  globalThis.document = { getElementById: (id) => kartei[id] || null };
  return {
    knoepfe,
    klick: (ziel) => klickHandler({ target: { closest: () => knoepfe[ziel] } }),
  };
}

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

// ── Regression: Bug vom 19.09.2026 ──────────────────────────────────────────
//
// Vorher nahm `verdrahteSitzungsUmschalter(standLesen)` eine Closure entgegen
// und band den Klick-Listener nur beim ERSTEN Aufruf (Guard: `umschalterWired`).
// Jeder weitere Patient/Termin lieferte zwar eine neue Closure mit seinen
// eigenen Zahlen, aber der längst gebundene Listener hielt für den Rest der
// Sitzung an der Closure vom allerersten Aufruf fest — ein Klick auf „Termine"
// zeigte darum immer die Zahlen des ersten je geöffneten Patienten, nicht die
// des gerade offenen. Da `dashboard.js` (Physio/Ergo/Logo) und
// `module/podo-einheiten.js` (Podologie) denselben Umschalter auf demselben
// Panel verdrahten, konnte das sogar die Zahlen der falschen Fachrichtung sein.
test('ein Klick nach dem Patientenwechsel zeigt die Zahlen des NEUEN Patienten, nicht die des ersten', () => {
  _setzeSeiteZurueck();
  const dom = baueDom();

  // Patient A (z. B. Podologie): 6 offen, 12 vergeben.
  verdrahteSitzungsUmschalter();
  zeigeSitzungsSeiten({ offen: 6, vergeben: 12 });

  // Patient B (z. B. Physio): 3 offen, 0 vergeben. Der Listener bleibt derselbe
  // (nur einmal je Sitzung verdrahtet) — genau das ist der Fall, den der Bug traf.
  verdrahteSitzungsUmschalter();
  zeigeSitzungsSeiten({ offen: 3, vergeben: 0 });

  dom.klick('vergeben');

  assert.equal(dom.knoepfe.vergeben.textContent, 'Termine (0)',
    'nach dem Klick muss Patient Bs Zahl (0) stehen, nicht Patient As (12)');
  assert.equal(dom.knoepfe.unvergeben.textContent, 'Unvergebene (3)',
    'die andere Kachel muss ebenfalls Patient Bs Zahl zeigen');
});
