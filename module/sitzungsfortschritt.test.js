import { test } from 'node:test';
import assert from 'node:assert/strict';
import { istFertigBehandelt } from './sitzungsfortschritt.js';

// Der Fehler, wegen dem es diese Datei gibt (Ops-Karte 12.08.2026):
// nie verplante Platzhalter-Sitzungen hielten das Rezept ewig von 'bereit' fern.
// Sie tauchen hier gar nicht mehr auf — `offen` zählt nur Sitzungen MIT Termin.
test('erbrachte Einheiten schlagen offene Platzhalter', () => {
  assert.equal(istFertigBehandelt({ offen: 0, erbracht: 6, einheiten: 6 }), true);
});

test('mehr erbracht als verordnet gilt ebenfalls als fertig', () => {
  assert.equal(istFertigBehandelt({ offen: 0, erbracht: 7, einheiten: 6 }), true);
});

// Die Gegenprobe: ohne diese Hälfte der Regel wäre ein Rezept über 6 Einheiten
// schon nach dem ersten abgehakten Termin abrechnungsbereit.
test('abgebrochene Serie wird NICHT automatisch bereit', () => {
  assert.equal(istFertigBehandelt({ offen: 0, erbracht: 5, einheiten: 6 }), false);
  assert.equal(istFertigBehandelt({ offen: 0, erbracht: 1, einheiten: 6 }), false);
});

test('ein offener Termin blockiert immer', () => {
  assert.equal(istFertigBehandelt({ offen: 1, erbracht: 6, einheiten: 6 }), false);
});

test('ohne verordnete Einheitenzahl reicht: nichts mehr offen', () => {
  assert.equal(istFertigBehandelt({ offen: 0, erbracht: 3, einheiten: null }), true);
  assert.equal(istFertigBehandelt({ offen: 2, erbracht: 3, einheiten: null }), false);
});
