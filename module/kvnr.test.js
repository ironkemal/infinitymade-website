// kvnr.js — Tests.  Lauf:  node --test module/
//
// Die Prüfziffer ist der einzige Teil, der rechnet — und der einzige, bei dem
// ein Fehler still bleibt: eine falsche Formel würde gültige Nummern als falsch
// melden, der Anwender würde die Warnung nach dem dritten Mal ignorieren, und
// die Prüfung wäre wertlos. Deshalb sind hier echte, nachgerechnete Nummern.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeKvnr, pruefziffer } from './kvnr.js';

// Gegenprobe von Hand für A123456789:
//   A → 01, danach 12345678  →  Stellen: 0 1 1 2 3 4 5 6 7 8
//   Gewichte 1,2,1,2,…       →  0, 2, 1, 4, 3, 8, 5,12→3, 7,16→7
//   Summe = 0+2+1+4+3+8+5+3+7+7 = 40  →  40 % 10 = 0
test('Prüfziffer wird nach der amtlichen Formel gebildet', () => {
  assert.equal(pruefziffer('A12345678'), 0);
});

test('gültige Nummer wird angenommen', () => {
  const r = pruefeKvnr('A123456780');
  assert.equal(r.ok, true);
  assert.equal(r.code, null);
});

test('Kleinschreibung und Leerzeichen werden normalisiert', () => {
  const r = pruefeKvnr(' a12 345 6780 ');
  assert.equal(r.ok, true);
  assert.equal(r.normalisiert, 'A123456780');
});

test('leeres Feld ist kein Fehler — die Nummer darf später nachgetragen werden', () => {
  const r = pruefeKvnr('');
  assert.equal(r.ok, true);
  assert.equal(r.hinweis, '');
});

test('falsche Länge meldet Formatfehler, nicht Prüfzifferfehler', () => {
  assert.equal(pruefeKvnr('A12345678').code, 'format');    // 9 Zeichen
  assert.equal(pruefeKvnr('A1234567890').code, 'format');  // 11 Zeichen
  assert.equal(pruefeKvnr('1234567890').code, 'format');   // kein Buchstabe
  assert.equal(pruefeKvnr('AB23456789').code, 'format');   // zwei Buchstaben
});

test('vertauschte Ziffern fallen auf — der häufigste Tippfehler', () => {
  assert.equal(pruefeKvnr('A123456780').ok, true);
  assert.equal(pruefeKvnr('A213456780').code, 'pruefziffer');
});

test('falsche Prüfziffer wird erkannt', () => {
  for (const ziffer of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    assert.equal(pruefeKvnr(`A12345678${ziffer}`).code, 'pruefziffer');
  }
});
