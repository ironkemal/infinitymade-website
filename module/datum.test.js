import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alsISODatum } from './datum.js';

/**
 * Diese Tests sind bewusst zeitzonen-UNABHÄNGIG formuliert, obwohl sie einen
 * zeitzonen-abhängigen Fehler bewachen.
 *
 * Der Trick: `new Date(2026, 7, 19)` ist in JEDER Zeitzone der 19. August,
 * lokal gelesen. Ein Formatierer, der über `toISOString()` geht, trifft das
 * nur in UTC und westlich davon — in Berlin (+1/+2) fällt er immer auf den
 * Vortag. Die Zusicherung „lokale Felder rein, dieselben Felder raus" ist
 * damit überall gültig und schlägt trotzdem genau dann fehl, wenn jemand die
 * UTC-Fassung zurückbringt.
 */

const faelle = [
  ['Sommer, gemeldeter Fall',     2026, 7, 19, '2026-08-19'],
  ['Monatserster',                2026, 7,  1, '2026-08-01'],
  ['Winter (UTC+1 in Berlin)',    2026, 0, 19, '2026-01-19'],
  ['Jahreswechsel',               2026, 0,  1, '2026-01-01'],
  ['Silvester',                   2026, 11, 31, '2026-12-31'],
  ['DST-Umstellung Frühjahr',     2026, 2, 29, '2026-03-29'],
  ['DST-Umstellung Herbst',       2026, 9, 25, '2026-10-25'],
  ['sechste Zeile im März',       2026, 2, 31, '2026-03-31'],
];

test('lokale Mitternacht behält ihren Tag — der Fehler vom 31.08.2026', () => {
  for (const [name, y, m, d, erwartet] of faelle) {
    assert.equal(alsISODatum(new Date(y, m, d)), erwartet, name);
  }
});

test('die Uhrzeit ändert den Tag nicht — auch nicht um 23:00', () => {
  for (const stunde of [0, 1, 9, 13, 21, 23]) {
    assert.equal(
      alsISODatum(new Date(2026, 7, 19, stunde, 30)),
      '2026-08-19',
      `${stunde}:30 Uhr`,
    );
  }
});

test('jeder Tag eines Monats kommt genau einmal und in der richtigen Reihenfolge', () => {
  // Fängt einen Formatierer, der nur an einzelnen Stichtagen richtig liegt.
  const gesehen = [];
  for (let tag = 1; tag <= 31; tag++) gesehen.push(alsISODatum(new Date(2026, 7, tag)));
  assert.equal(gesehen.length, 31);
  assert.equal(new Set(gesehen).size, 31, 'kein Tag doppelt');
  assert.equal(gesehen[0], '2026-08-01');
  assert.equal(gesehen[30], '2026-08-31');
});

test('nimmt auch Zeichenketten aus der Datenbank entgegen', () => {
  // `fussbefund.js` reicht `row.erstellt_am` direkt durch — ein Timestamptz.
  assert.equal(alsISODatum('2026-08-19T09:30:00'), '2026-08-19');
  assert.equal(alsISODatum('2026-08-19'), alsISODatum(new Date('2026-08-19')));
});

test('ungültige Eingabe wird zu Leerstring, nicht zu "NaN-NaN-NaN"', () => {
  assert.equal(alsISODatum(null), '');
  assert.equal(alsISODatum(undefined), '');
  assert.equal(alsISODatum(''), '');
  assert.equal(alsISODatum('kein Datum'), '');
  assert.equal(alsISODatum(new Date('kaputt')), '');
});
