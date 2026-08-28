// Regression zur Fehlerklasse „Podologie Nord" (12.08.2026): eine Verordnung,
// die aus der Liste faellt, zeigt ihre Frist nicht mehr und verbrennt still.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standortZuschnitt, istPraxisweit } from './standort-zuschnitt.js';

const A = 'biz-a', B = 'biz-b';
const zeile = (id, lead_id, business_id) => ({ id, lead_id, leads: lead_id ? { business_id } : null });

const daten = [
  zeile('v1', 'p1', A),
  zeile('v2', 'p2', B),
  zeile('v3', 'p3', null),   // Patient ohne business_id (vor Standort-Anlage entstanden)
  zeile('v4', null, null),   // Privat/BG ohne Patientenakte
];

test('ohne aktiven Standort wird nichts gefiltert', () => {
  const r = standortZuschnitt(daten, null);
  assert.equal(r.zeilen.length, 4);
  assert.equal(r.zeigeHerkunft, false, 'Einzelpraxis braucht keine Marke');
});

test('gemeinsame Nutzung (undefined) filtert ebenfalls nicht', () => {
  assert.equal(standortZuschnitt(daten, undefined).zeilen.length, 4);
});

test('bei getrennten Standorten bleibt der fremde Standort draussen', () => {
  const ids = standortZuschnitt(daten, A).zeilen.map(v => v.id);
  assert.ok(!ids.includes('v2'), 'Verordnung des anderen Standorts darf nicht erscheinen');
});

test('Zeile ohne business_id verschwindet NIE — das war der Verlust vom 12.08.', () => {
  for (const standort of [A, B]) {
    const ids = standortZuschnitt(daten, standort).zeilen.map(v => v.id);
    assert.ok(ids.includes('v3'), `Patient ohne business_id fehlt in ${standort}`);
  }
});

test('Zeile ohne Patientenakte verschwindet NIE — Privat/BG haengt daran', () => {
  for (const standort of [A, B]) {
    const ids = standortZuschnitt(daten, standort).zeilen.map(v => v.id);
    assert.ok(ids.includes('v4'), `Verordnung ohne lead_id fehlt in ${standort}`);
  }
});

test('jede Zeile ist in mindestens einem Standort sichtbar', () => {
  const gesehen = new Set([...standortZuschnitt(daten, A).zeilen, ...standortZuschnitt(daten, B).zeilen].map(v => v.id));
  assert.deepEqual([...gesehen].sort(), ['v1', 'v2', 'v3', 'v4']);
});

test('Marke nur fuer Zeilen ohne Standortzuordnung', () => {
  assert.equal(istPraxisweit(zeile('x', 'p', A)), false);
  assert.equal(istPraxisweit(zeile('x', 'p', null)), true);
  assert.equal(istPraxisweit(zeile('x', null, null)), true);
});

test('leere und kaputte Eingaben werfen nicht', () => {
  assert.deepEqual(standortZuschnitt([], A).zeilen, []);
  assert.deepEqual(standortZuschnitt(null, A).zeilen, []);
  assert.equal(istPraxisweit(undefined), true, 'im Zweifel sichtbar, nicht verschwunden');
});
