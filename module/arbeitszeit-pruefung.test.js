import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeArbeitszeit } from './arbeitszeit-pruefung.js';

const WH_MO_08_16 = [{ start_time: '08:00:00', end_time: '16:00:00' }];

test('innerhalb der Arbeitszeit: keine Warnung', () => {
  const startDate = new Date('2026-09-28T10:00:00'); // Montag, lokal
  assert.equal(pruefeArbeitszeit({ wh: WH_MO_08_16, startDate }), null);
});

// Ops #307: Beta-1 erfasst abends (Live-Fund 01:41:17) — muss warnen, nicht blockieren.
test('außerhalb der Arbeitszeit: Warnung mit Bereich, kein Blockieren', () => {
  const startDate = new Date('2026-09-28T01:41:17');
  const r = pruefeArbeitszeit({ wh: WH_MO_08_16, startDate });
  assert.ok(r);
  assert.match(r.meldung, /außerhalb der Arbeitszeit/);
  assert.match(r.meldung, /08:00–16:00/);
  assert.match(r.notiz, /Außerhalb der Arbeitszeit gespeichert/);
  assert.match(r.notiz, /08:00–16:00/);
});

test('kein Arbeitstag (leere working_hours): Warnung statt Blockieren', () => {
  const startDate = new Date('2026-09-27T10:00:00'); // Sonntag, keine Zeilen
  const r = pruefeArbeitszeit({ wh: [], startDate });
  assert.ok(r);
  assert.match(r.meldung, /kein Arbeitstag/);
  assert.match(r.notiz, /kein Arbeitstag/);
});

test('kein Arbeitstag: wh ist null (z.B. Query ohne Treffer)', () => {
  const startDate = new Date('2026-09-27T10:00:00');
  const r = pruefeArbeitszeit({ wh: null, startDate });
  assert.ok(r);
  assert.match(r.meldung, /kein Arbeitstag/);
});

test('mehrere Zeiträume am Tag (Vormittag/Nachmittag): Treffer in einem reicht', () => {
  const wh = [
    { start_time: '08:00:00', end_time: '12:00:00' },
    { start_time: '14:00:00', end_time: '18:00:00' },
  ];
  assert.equal(pruefeArbeitszeit({ wh, startDate: new Date('2026-09-28T15:00:00') }), null);
  const r = pruefeArbeitszeit({ wh, startDate: new Date('2026-09-28T13:00:00') });
  assert.ok(r);
  assert.match(r.meldung, /08:00–12:00, 14:00–18:00/);
});

test('genau auf Startzeit: innerhalb (inklusive Start, exklusive Ende)', () => {
  assert.equal(pruefeArbeitszeit({ wh: WH_MO_08_16, startDate: new Date('2026-09-28T08:00:00') }), null);
  const r = pruefeArbeitszeit({ wh: WH_MO_08_16, startDate: new Date('2026-09-28T16:00:00') });
  assert.ok(r);
});
