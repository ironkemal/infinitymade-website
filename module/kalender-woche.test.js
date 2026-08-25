import { test } from 'node:test';
import assert from 'node:assert/strict';

import { montagDerWoche, wochenTage, pixelFuerMinute } from './kalender-woche.js';
import { mitDeckkraft } from './kalender-farben.js';
import { WV_SLOT_PX } from './kalender-raster.js';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('Montag einer Woche — Wochenmitte', () => {
  // 22.08.2026 ist ein Samstag.
  assert.equal(iso(montagDerWoche('2026-08-22')), '2026-08-17');
});

test('Montag bleibt Montag', () => {
  assert.equal(iso(montagDerWoche('2026-08-17')), '2026-08-17');
});

test('Sonntag gehoert zur Woche davor, nicht zur naechsten', () => {
  // getDay() liefert für Sonntag 0 — ohne Sonderfall landete man 6 Tage
  // in der Zukunft statt am Montag davor.
  assert.equal(iso(montagDerWoche('2026-08-23')), '2026-08-17');
});

test('Zeitumstellung verschiebt die Woche nicht', () => {
  // 29.03.2026 ist der Sonntag der Sommerzeitumstellung. Um Mitternacht
  // gerechnet kann der Tag lokal auf den Vortag rutschen — deshalb rechnet
  // montagDerWoche() mittags.
  assert.equal(iso(montagDerWoche('2026-03-29')), '2026-03-23');
  assert.equal(iso(montagDerWoche('2026-03-30')), '2026-03-30');
});

test('wochenTage liefert sieben Tage, Montag zuerst', () => {
  const tage = wochenTage('2026-08-22');
  assert.equal(tage.length, 7);
  assert.equal(iso(tage[0]), '2026-08-17');
  assert.equal(iso(tage[6]), '2026-08-23');
  assert.equal(tage[0].getDay(), 1); // Montag
  assert.equal(tage[6].getDay(), 0); // Sonntag
});

test('wochenTage ueberspringt keinen Tag ueber den Monatswechsel', () => {
  const tage = wochenTage('2026-08-31');
  assert.deepEqual(tage.map(iso), [
    '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03',
    '2026-09-04', '2026-09-05', '2026-09-06',
  ]);
});

test('pixelFuerMinute rechnet mit der Wochenhoehe, nicht mit der Tageshoehe', () => {
  assert.equal(pixelFuerMinute(8 * 60), 0);          // Rasteranfang
  assert.equal(pixelFuerMinute(8 * 60 + 30), WV_SLOT_PX);
  assert.equal(pixelFuerMinute(9 * 60), WV_SLOT_PX * 2);
  // Das war der Fehler vor dem 22.08.2026: die Zeitleiste rechnete mit 56 px
  // je halber Stunde, der Inhalt mit 28 — 09:00 lag doppelt so tief.
  assert.equal(pixelFuerMinute(9 * 60), 56);
});

test('pixelFuerMinute trifft auch zwischen den Rasterlinien', () => {
  // 09:20 liegt zwei Drittel im dritten Feld.
  assert.equal(Math.round(pixelFuerMinute(9 * 60 + 20)), Math.round(WV_SLOT_PX * 2 + WV_SLOT_PX * (20 / 30)));
});

test('mitDeckkraft: Hexfarbe bekommt das Alpha-Suffix', () => {
  assert.equal(mitDeckkraft('#22c55e'), '#22c55e22');
  assert.equal(mitDeckkraft('#22c55e', '25'), '#22c55e25');
});

test('mitDeckkraft: CSS-Variable wird nicht verstuemmelt', () => {
  // '#var(--primary)22' waere kein Farbwert — der Block haette keine Flaeche.
  // Das passiert, sobald ein Termin zu niemandem aus teamMembers gehoert.
  assert.equal(mitDeckkraft('var(--primary)'), 'color-mix(in srgb, var(--primary) 13%, transparent)');
});

test('mitDeckkraft: Kurzform und Grossbuchstaben', () => {
  assert.equal(mitDeckkraft('#ABCDEF'), '#ABCDEF22');
  // Dreistellige Kurzform ist kein sicherer Fall — dort ergaebe '#abc' + '22'
  // die Farbe '#abc22', also etwas voellig anderes.
  assert.equal(mitDeckkraft('#abc'), 'color-mix(in srgb, #abc 13%, transparent)');
});
