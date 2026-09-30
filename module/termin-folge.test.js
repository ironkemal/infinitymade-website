// Folgetermin (Konsey 30.09.2026): Datum aus der Frequenz, Leistungen ohne Eingangsbefundung.
import test from 'node:test';
import assert from 'node:assert/strict';
import { folgeterminStart, folgeLeistungen, STANDARD_ABSTAND_TAGE } from './termin-folge.js';

const lokal = (y, m, d, h = 9, min = 0) => new Date(y, m - 1, d, h, min);
const JETZT = lokal(2026, 9, 30, 8, 0);

test('Frequenz „alle 4-6 Wochen" → 28 Tage, gleiche Uhrzeit', () => {
  const r = folgeterminStart(lokal(2026, 10, 5, 9, 30), 'alle 4-6 Wochen', JETZT);
  assert.equal(r.start, '2026-11-02T09:30');
  assert.equal(r.abstandTage, 28);
  assert.equal(r.ausFrequenz, true);
});

test('„1x alle 4 Wochen" → 28 Tage; „2x pro Woche" → kuerzerer Abstand als eine Woche', () => {
  assert.equal(folgeterminStart(lokal(2026, 10, 5), '1x alle 4 Wochen', JETZT).abstandTage, 28);
  const zwei = folgeterminStart(lokal(2026, 10, 5), '2x pro Woche', JETZT);
  assert.ok(zwei.abstandTage >= 1 && zwei.abstandTage < 7, String(zwei.abstandTage));
});

test('ohne lesbare Frequenz: eine Woche, nicht aus der Frequenz', () => {
  for (const f of [null, '', 'nach Bedarf']) {
    const r = folgeterminStart(lokal(2026, 10, 5, 10, 0), f, JETZT);
    assert.equal(r.abstandTage, STANDARD_ABSTAND_TAGE);
    assert.equal(r.ausFrequenz, false);
    assert.equal(r.start, '2026-10-12T10:00');
  }
});

test('alter Ausgangstermin: Ergebnis liegt in der Zukunft (morgen, gleiche Uhrzeit)', () => {
  const r = folgeterminStart(lokal(2026, 8, 1, 14, 15), 'alle 4 Wochen', JETZT);
  assert.equal(r.start, '2026-10-01T14:15');
});

const dienste = [
  { id: 'behandlung', gkv_position_nr: '78010' },
  { id: 'erst', gkv_position_nr: '78040' },
  { id: 'befund', gkv_position_nr: '78030' },
];

test('Folgeleistungen: die Eingangsbefundung (einmalig) kommt nicht mit', () => {
  const r = folgeLeistungen([
    { service_id: 'behandlung', anzahl: 1 }, { service_id: 'erst', anzahl: 1 },
  ], 'behandlung', dienste);
  assert.deepEqual(r.serviceIds, ['behandlung']);
});

test('Folgeleistungen: Kombination bleibt erhalten, Menge der Hauptzeile', () => {
  const r = folgeLeistungen([
    { service_id: 'behandlung', anzahl: 2 }, { service_id: 'befund', anzahl: 1 },
  ], 'behandlung', dienste);
  assert.deepEqual(r.serviceIds, ['behandlung', 'befund']);
  assert.equal(r.menge, 2);
});

test('Folgeleistungen: ohne Zeilen gilt die Hauptleistung des Termins; ist die selbst 78040, nichts', () => {
  assert.deepEqual(folgeLeistungen([], 'behandlung', dienste).serviceIds, ['behandlung']);
  assert.deepEqual(folgeLeistungen(null, 'erst', dienste).serviceIds, []);
  assert.deepEqual(folgeLeistungen([{ service_id: 'erst', anzahl: 1 }], 'erst', dienste).serviceIds, []);
});
