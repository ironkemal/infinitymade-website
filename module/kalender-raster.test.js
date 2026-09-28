/**
 * Tests für module/kalender-raster.js — nur die DOM-freie Logik.
 *
 * `slotSpanHinweis()` deckt Ops #314 ab (Kemal: Dreifachklick/Drag im
 * Schnelltermin-Kalender verdreifachte scheinbar die Termindauer). Die
 * FullCalendar-Drag-Interaktion selbst lässt sich mit node --test nicht
 * nachstellen (kein DOM/Mouse-Events) — testbar ist die reine Funktion, die
 * aus der von FullCalendar gelieferten Start/End-Spanne den Hinweistext baut.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotSpanHinweis } from './kalender-raster.js';

test('genau ein Zeitraster (Einzelklick) löst keinen Hinweis aus', () => {
  assert.equal(slotSpanHinweis('2026-09-28T09:00:00', '2026-09-28T09:30:00', 30), null);
});

test('kürzer als ein Zeitraster löst ebenfalls keinen Hinweis aus', () => {
  assert.equal(slotSpanHinweis('2026-09-28T09:00:00', '2026-09-28T09:15:00', 30), null);
});

test('Drag über drei Zeitraster (Ops #314) meldet 90 Minuten / 3 Raster', () => {
  const msg = slotSpanHinweis('2026-09-28T09:00:00', '2026-09-28T10:30:00', 30);
  assert.match(msg, /90 Minuten/);
  assert.match(msg, /3 Zeitraster/);
});

test('Drag über zwei Zeitraster meldet 60 Minuten / 2 Raster', () => {
  const msg = slotSpanHinweis('2026-09-28T14:00:00', '2026-09-28T15:00:00', 30);
  assert.match(msg, /60 Minuten/);
  assert.match(msg, /2 Zeitraster/);
});

test('fehlende oder ungültige Eingaben liefern null statt zu werfen', () => {
  assert.equal(slotSpanHinweis(null, '2026-09-28T10:00:00', 30), null);
  assert.equal(slotSpanHinweis('2026-09-28T09:00:00', 'quatsch', 30), null);
  assert.equal(slotSpanHinweis('2026-09-28T09:00:00', '2026-09-28T10:00:00', 0), null);
});
