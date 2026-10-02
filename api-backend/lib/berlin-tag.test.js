import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berlinHeute, istStichtag, jahresendePlus } from './berlin-tag.js';

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

test('jahresendePlus: addiert Jahre auf das Berliner Jahr und liefert YYYY-12-31', () => {
  const d = new Date('2026-10-02T10:00:00Z');
  assert.equal(jahresendePlus(10, d), '2036-12-31');
  assert.equal(jahresendePlus(8, d), '2034-12-31');
  assert.equal(jahresendePlus(6, d), '2032-12-31');
  assert.equal(jahresendePlus(0, d), '2026-12-31');
  // Silvester kurz vor Mitternacht Berliner Zeit
  assert.equal(jahresendePlus(10, new Date('2026-12-31T22:00:00Z')), '2036-12-31');
  // 23:30 UTC an Silvester ist bereits Neujahr Berliner Zeit
  assert.equal(jahresendePlus(10, new Date('2026-12-31T23:30:00Z')), '2037-12-31');
});

