import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeHeilmittelItems, normalizeBereich } from './heilmittel-items-pruefen.js';

test('normalizeBereich normalisiert Fachbereichsvarianten', () => {
  assert.equal(normalizeBereich('physio'), 'physio');
  assert.equal(normalizeBereich('Physiotherapie'), 'physio');
  assert.equal(normalizeBereich('physiotherapy'), 'physio');
  assert.equal(normalizeBereich('ergo'), 'ergo');
  assert.equal(normalizeBereich('Ergotherapie'), 'ergo');
  assert.equal(normalizeBereich('ergotherapy'), 'ergo');
  assert.equal(normalizeBereich('podo'), 'podo');
  assert.equal(normalizeBereich('Podologie'), 'podo');
  assert.equal(normalizeBereich('logo'), 'logo');
  assert.equal(normalizeBereich('Logopädie'), 'logo');
});

test('null oder undefined ist gültig', () => {
  assert.deepEqual(pruefeHeilmittelItems(null), { ok: true, items: null, summeEinheiten: null });
  assert.deepEqual(pruefeHeilmittelItems(undefined), { ok: true, items: null, summeEinheiten: null });
  assert.deepEqual(pruefeHeilmittelItems([]), { ok: true, items: null, summeEinheiten: null });
});

test('Kein Array liefert 422 Fehler', () => {
  const r = pruefeHeilmittelItems('nicht-array');
  assert.equal(r.ok, false);
  assert.equal(r.status, 422);
  assert.match(r.error, /Array oder null/);
});

test('Altes Podologie-Format (Strings oder Objekte ohne einheiten) bleibt unverändert', () => {
  const strings = ['78010', '78030'];
  const r1 = pruefeHeilmittelItems(strings, { therapie_bereich: 'podo' });
  assert.equal(r1.ok, true);
  assert.deepEqual(r1.items, strings);
  assert.equal(r1.summeEinheiten, null);

  const objOhneEinh = [{ code: '78010' }, { code: '78030' }];
  const r2 = pruefeHeilmittelItems(objOhneEinh, { therapie_bereich: 'podologie' });
  assert.equal(r2.ok, true);
  assert.deepEqual(r2.items, objOhneEinh);
});

test('Gültige Einzelelement-Liste mit Einheiten', () => {
  const items = [{ code: 'X0501', einheiten: 6, doppelbehandlung: false, bezeichnung: 'KG' }];
  const r = pruefeHeilmittelItems(items, { therapie_bereich: 'physio' });
  assert.equal(r.ok, true);
  assert.equal(r.summeEinheiten, 6);
  assert.deepEqual(r.items, [{ code: 'X0501', einheiten: 6, doppelbehandlung: false, bezeichnung: 'KG' }]);
});

test('Gültige Mehrfachelemente in Physio und Ergo berechnen summeEinheiten', () => {
  const itemsPhysio = [
    { code: 'X0501', einheiten: 6, doppelbehandlung: false },
    { code: 'X1201', einheiten: 6, doppelbehandlung: true, bezeichnung: 'MT' },
  ];
  const r1 = pruefeHeilmittelItems(itemsPhysio, { therapie_bereich: 'physiotherapy' });
  assert.equal(r1.ok, true);
  assert.equal(r1.summeEinheiten, 12);
  assert.equal(r1.items.length, 2);

  const itemsErgo = [
    { code: 'X2101', einheiten: 10, doppelbehandlung: false },
    { code: 'X2102', einheiten: 10, doppelbehandlung: false },
    { code: 'X2103', einheiten: 10, doppelbehandlung: false },
  ];
  const r2 = pruefeHeilmittelItems(itemsErgo, { therapie_bereich: 'ergotherapy' });
  assert.equal(r2.ok, true);
  assert.equal(r2.summeEinheiten, 30);
  assert.equal(r2.items.length, 3);
});

test('>3 vorrangige Heilmittel wird mit 422 abgewiesen', () => {
  const items = [
    { code: 'X0501', einheiten: 6 },
    { code: 'X1201', einheiten: 6 },
    { code: 'X0502', einheiten: 6 },
    { code: 'X0503', einheiten: 6 },
  ];
  const r = pruefeHeilmittelItems(items, { therapie_bereich: 'physio' });
  assert.equal(r.ok, false);
  assert.equal(r.status, 422);
  assert.match(r.error, /Maximal 3/);
});

test('Mehrfachzeilen in Podologie oder Logopädie werden mit 422 abgewiesen', () => {
  const items = [
    { code: '78010', einheiten: 6 },
    { code: '78020', einheiten: 6 },
  ];
  const r1 = pruefeHeilmittelItems(items, { therapie_bereich: 'podologie' });
  assert.equal(r1.ok, false);
  assert.equal(r1.status, 422);
  assert.match(r1.error, /Physiotherapie und Ergotherapie/);

  const r2 = pruefeHeilmittelItems(items, { therapie_bereich: 'logo' });
  assert.equal(r2.ok, false);
  assert.equal(r2.status, 422);
  assert.match(r2.error, /Physiotherapie und Ergotherapie/);
});

test('Doppelter Code wird mit 422 abgewiesen', () => {
  const items = [
    { code: 'X0501', einheiten: 6 },
    { code: 'X0501', einheiten: 6 },
  ];
  const r = pruefeHeilmittelItems(items, { therapie_bereich: 'physio' });
  assert.equal(r.ok, false);
  assert.equal(r.status, 422);
  assert.match(r.error, /nicht mehrfach verordnet werden/);
});

test('Ungültiger Code wird mit 422 abgewiesen', () => {
  const r1 = pruefeHeilmittelItems([{ code: 'ABC', einheiten: 6 }], { therapie_bereich: 'physio' });
  assert.equal(r1.ok, false);
  assert.equal(r1.status, 422);

  const r2 = pruefeHeilmittelItems([{ code: 'TOOLONG123', einheiten: 6 }], { therapie_bereich: 'physio' });
  assert.equal(r2.ok, false);
  assert.equal(r2.status, 422);
});

test('Ungültige Einheiten (0, >60, keine Ganzzahl) wird mit 422 abgewiesen', () => {
  assert.equal(pruefeHeilmittelItems([{ code: 'X0501', einheiten: 0 }], { therapie_bereich: 'physio' }).status, 422);
  assert.equal(pruefeHeilmittelItems([{ code: 'X0501', einheiten: 61 }], { therapie_bereich: 'physio' }).status, 422);
  assert.equal(pruefeHeilmittelItems([{ code: 'X0501', einheiten: 3.5 }], { therapie_bereich: 'physio' }).status, 422);
  assert.equal(pruefeHeilmittelItems([{ code: 'X0501', einheiten: -1 }], { therapie_bereich: 'physio' }).status, 422);
  assert.equal(pruefeHeilmittelItems([{ code: 'X0501', einheiten: 'ungültig' }], { therapie_bereich: 'physio' }).status, 422);
});

test('Ungültige Doppelbehandlung (nicht-bool) wird mit 422 abgewiesen', () => {
  const r = pruefeHeilmittelItems([{ code: 'X0501', einheiten: 6, doppelbehandlung: 'ja' }], { therapie_bereich: 'physio' });
  assert.equal(r.ok, false);
  assert.equal(r.status, 422);
  assert.match(r.error, /Boolean erwartet/);
});

test('Zu lange Bezeichnung (>80 Zeichen) wird mit 422 abgewiesen', () => {
  const r = pruefeHeilmittelItems([{ code: 'X0501', einheiten: 6, bezeichnung: 'A'.repeat(81) }], { therapie_bereich: 'physio' });
  assert.equal(r.ok, false);
  assert.equal(r.status, 422);
  assert.match(r.error, /maximal 80 Zeichen/);
});
