import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berechneRasterScrollTop } from './tageszentrale-raster.js';

test('F-04 berechneRasterScrollTop: scrollt zum ersten Termin (Do 19.11. 17:00 -> 16:30 sichtbar)', () => {
  // 17:00 Berlin (CET = +01:00) -> 30 Min Vorlauf = 16:30 -> (990 - 480) / 30 * 48 = 816 px
  const top = berechneRasterScrollTop({
    bookings: [
      { start_time: '2026-11-19T16:00:00Z', status: 'completed' }, // 17:00 CET
    ],
    dayStart: 8,
    slotPx: 48,
    isToday: false,
  });
  assert.equal(top, 816);
});

test('F-04 berechneRasterScrollTop: frueher Termin um 08:00 oder abgesagter Termin + Heute', () => {
  // 08:00 Termin -> clamp auf 0
  assert.equal(berechneRasterScrollTop({
    bookings: [{ start_time: '2026-11-19T07:00:00Z', status: 'confirmed' }],
    dayStart: 8,
    slotPx: 48,
  }), 0);

  // Heute ohne Termine um 14:42 CET -> 14:00 (14:30 - 30 Min) -> (840 - 480) / 30 * 48 = 576 px
  assert.equal(berechneRasterScrollTop({
    bookings: [{ start_time: '2026-11-21T16:00:00Z', status: 'cancelled' }],
    dayStart: 8,
    slotPx: 48,
    isToday: true,
    jetzt: new Date('2026-11-21T13:42:00Z'), // 14:42 CET
  }), 576);

  // Zukunftstag ohne Termine -> oben (08:00 = 0 px)
  assert.equal(berechneRasterScrollTop({
    bookings: [],
    dayStart: 8,
    slotPx: 48,
    isToday: false,
  }), 0);
});
