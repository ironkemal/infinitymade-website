import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serienDaten, serienAnzahl, serienKnopfText, anzahlHinweisText } from './serien-termine.js';

// 2026-09-16 ist ein Mittwoch (Wochentag 3).
test('wöchentlich, ein Wochentag — sieben Tage Abstand', () => {
  assert.deepEqual(
    serienDaten({ startDatum: '2026-09-16', anzahl: 3, intervalDays: 7, wochentage: [3] }),
    ['2026-09-16', '2026-09-23', '2026-09-30'],
  );
});

test('ohne Wochentagsangabe gilt der Wochentag des Starts', () => {
  assert.deepEqual(
    serienDaten({ startDatum: '2026-09-16', anzahl: 2, intervalDays: 7 }),
    ['2026-09-16', '2026-09-23'],
  );
});

test('zwei Wochentage je Woche — Mi und Fr', () => {
  assert.deepEqual(
    serienDaten({ startDatum: '2026-09-16', anzahl: 4, intervalDays: 7, wochentage: [3, 5] }),
    ['2026-09-16', '2026-09-18', '2026-09-23', '2026-09-25'],
  );
});

test('alle zwei Wochen', () => {
  assert.deepEqual(
    serienDaten({ startDatum: '2026-09-16', anzahl: 3, intervalDays: 14, wochentage: [3] }),
    ['2026-09-16', '2026-09-30', '2026-10-14'],
  );
});

// Die einzige bewusste Abweichung vom alten Verhalten: „täglich" heisst täglich.
test('täglich zählt Kalendertage, nicht Wochen', () => {
  assert.deepEqual(
    serienDaten({ startDatum: '2026-09-16', anzahl: 4, taeglich: true, wochentage: [3] }),
    ['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'],
  );
});

// Über die Sommerzeitgrenze (25.10.2026): der Wochentag darf nicht verrutschen.
test('Zeitumstellung verschiebt den Wochentag nicht', () => {
  const tage = serienDaten({ startDatum: '2026-10-21', anzahl: 3, intervalDays: 7, wochentage: [3] });
  assert.deepEqual(tage, ['2026-10-21', '2026-10-28', '2026-11-04']);
});

test('Jahreswechsel', () => {
  assert.deepEqual(
    serienDaten({ startDatum: '2026-12-30', anzahl: 2, intervalDays: 7, wochentage: [3] }),
    ['2026-12-30', '2027-01-06'],
  );
});

test('unbrauchbare Eingaben liefern nichts statt zu raten', () => {
  assert.deepEqual(serienDaten({ startDatum: '', anzahl: 5 }), []);
  assert.deepEqual(serienDaten({ startDatum: '2026-09-16', anzahl: 0 }), []);
  assert.deepEqual(serienDaten({ startDatum: '2026-09-16', anzahl: 'drei' }), []);
});

// Die Obergrenze ist die Versicherung gegen die eingefrorene Maske.
test('die Schleife endet auch bei 52 Terminen', () => {
  const tage = serienDaten({ startDatum: '2026-09-16', anzahl: 52, intervalDays: 7, wochentage: [3] });
  assert.equal(tage.length, 52);
});

/* ── Ops 08fa9e2c: nur die angehakten Einheiten verteilen ─────────────────── */

function liste(anzahlAngehakt, gesamt) {
  return {
    querySelectorAll(sel) {
      assert.equal(sel, '.rx-unv-cb:checked');
      return { length: anzahlAngehakt, _gesamt: gesamt };
    },
  };
}

test('nichts angehakt — alle offenen Einheiten, wie bisher', () => {
  assert.equal(serienAnzahl(liste(0, 9), 9), 9);
  assert.equal(serienAnzahl(null, 9), 9);
});

test('fünf von neun angehakt — nur die fünf', () => {
  assert.equal(serienAnzahl(liste(5, 9), 9), 5);
});

test('die Beschriftung nennt die Zahl, die gleich passiert', () => {
  assert.equal(serienKnopfText(9, false), '🗓 9 offene Einheiten als Serie verteilen');
  assert.equal(serienKnopfText(5, true), '🗓 5 ausgewählte Einheiten als Serie verteilen');
  assert.equal(serienKnopfText(1, true), '🗓 1 ausgewählte Einheit als Serie verteilen');
});

/* ── Ops 08fa9e2c: „Anzahl 3" darf auch einen einzigen Termin heissen ────── */

test('der Hinweis sagt, was mit dem Rest passiert', () => {
  assert.match(anzahlHinweisText(3, false), /übrigen 2 bleiben offen/);
  assert.match(anzahlHinweisText(3, true), /Alle 3 Termine/);
  assert.equal(anzahlHinweisText(1, false), '');
});
