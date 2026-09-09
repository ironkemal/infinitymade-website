import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rechnungsModus, zeigeRechnungsModus, renderRezeptBadges, mountRechnungsansicht } from './rechnung-ansicht.js';

// Regressionstest für Bug 1 (Ops-Meldung, 09.09.2026): "Rechnung speichern
// schliesst den Editor nicht — es wirkt, als wäre nichts passiert." Die Regel
// muss in JEDEM Modus genau eine der drei Flächen zeigen.

test('rechnungsModus: "liste" zeigt nur die Liste + Neue-Rechnung-Knopf', () => {
  const h = rechnungsModus('liste');
  assert.equal(h.invListWrap, false);
  assert.equal(h.invEditor, true);
  assert.equal(h.invView, true);
  assert.equal(h.invNewBtn, false);
});

test('rechnungsModus: "editor" zeigt nur den Editor', () => {
  const h = rechnungsModus('editor');
  assert.equal(h.invListWrap, true);
  assert.equal(h.invEditor, false);
  assert.equal(h.invView, true);
  assert.equal(h.invNewBtn, true);
});

test('rechnungsModus: "ansicht" zeigt nur die Druckansicht, Neue-Rechnung-Knopf weg', () => {
  const h = rechnungsModus('ansicht');
  assert.equal(h.invListWrap, true);
  assert.equal(h.invEditor, true);
  assert.equal(h.invView, false);
  assert.equal(h.invNewBtn, true);
});

test('in jedem Modus ist genau eine der drei Flächen sichtbar (nicht null, nicht zwei)', () => {
  for (const modus of ['liste', 'editor', 'ansicht']) {
    const h = rechnungsModus(modus);
    const sichtbar = [!h.invListWrap, !h.invEditor, !h.invView].filter(Boolean).length;
    assert.equal(sichtbar, 1, `Modus "${modus}" zeigt ${sichtbar} Flächen statt 1`);
  }
});

test('zeigeRechnungsModus("ansicht") setzt .hidden an allen vier Elementen', () => {
  const gesetzt = {};
  global.document = {
    getElementById: (id) => ({
      set hidden(v) { gesetzt[id] = v; },
      get hidden() { return gesetzt[id]; },
    }),
  };
  zeigeRechnungsModus('ansicht');
  assert.deepEqual(gesetzt, { invListWrap: true, invEditor: true, invView: false, invNewBtn: true });
});

test('zeigeRechnungsModus uebersteht ein fehlendes Element (kein Wurf)', () => {
  global.document = { getElementById: () => null };
  assert.doesNotThrow(() => zeigeRechnungsModus('liste'));
});

test('renderRezeptBadges: kein verknuepftes Rezept -> Platzhalter-Badge', () => {
  mountRechnungsansicht({ escapeHtml: (s) => s });
  const html = renderRezeptBadges({ prescriptions: null });
  assert.match(html, /Kein verknüpftes Rezept/);
});

test('renderRezeptBadges: DMRZ exportiert -> "DMRZ ✓"-Badge', () => {
  mountRechnungsansicht({ escapeHtml: (s) => s });
  const html = renderRezeptBadges({ prescriptions: { rezept_typ: 'blanko', dmrz_exported_at: '2026-09-01T10:00:00Z' } });
  assert.match(html, /DMRZ ✓/);
});
