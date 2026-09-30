import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berlinHeute, istStichtag } from './berlin-tag.js';

test('berlinHeute: kurz nach Mitternacht Berliner Zeit ist UTC noch am Vortag (Sommerzeit)', () => {
  // 30.09.2026 22:30 UTC = 01.10.2026 00:30 MESZ
  assert.equal(berlinHeute(new Date('2026-09-30T22:30:00Z')), '2026-10-01');
  assert.equal(berlinHeute(new Date('2026-09-30T21:59:59Z')), '2026-09-30');
});

test('berlinHeute: Winterzeit — 23:30 UTC ist schon der nächste Berliner Tag', () => {
  assert.equal(berlinHeute(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
});

test('istStichtag: nur echte Kalendertage im Format YYYY-MM-DD', () => {
  assert.equal(istStichtag('2026-10-01'), true);
  assert.equal(istStichtag('2026-02-30'), false);
  assert.equal(istStichtag('2026-13-01'), false);
  assert.equal(istStichtag('20261001'), false);
  assert.equal(istStichtag(null), false);
  assert.equal(istStichtag(undefined), false);
});
