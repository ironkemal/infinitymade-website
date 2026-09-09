/**
 * Tests für module/geld.js.
 *
 * fmtEur muss mit der bisherigen "richtigen" Implementierung
 * (dashboard.js:18204, vor Phase 0) identisch formatieren — das ist der
 * Grund, warum diese Datei entsteht: die anderen vier Kopien im Code
 * sollen ersatzlos hierher zeigen können, ohne dass sich eine angezeigte
 * Zahl ändert. `formatEur()` (dashboard.js:14877), die abweichend OHNE
 * Tausenderpunkt formatiert, ist ausdrücklich NICHT das Vorbild.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtEur, parseEur } from './geld.js';

test('formatiert mit Tausenderpunkt und Komma-Dezimal', () => {
  assert.equal(fmtEur(1234.5), '1.234,50 €');
  assert.equal(fmtEur(1234567.89), '1.234.567,89 €');
  assert.equal(fmtEur(0.5), '0,50 €');
});

test('rundet auf zwei Nachkommastellen', () => {
  assert.equal(fmtEur(10), '10,00 €');
  assert.equal(fmtEur(10.005), '10,01 €');
});

test('nicht-numerische Eingaben werden 0 €, nicht NaN € oder leer', () => {
  assert.equal(fmtEur(null), '0,00 €');
  assert.equal(fmtEur(undefined), '0,00 €');
  assert.equal(fmtEur(NaN), '0,00 €');
  assert.equal(fmtEur('quatsch'), '0,00 €');
  assert.equal(fmtEur(''), '0,00 €');
});

test('negative Beträge (z. B. Korrekturzahlung) bleiben negativ', () => {
  assert.equal(fmtEur(-42.5), '-42,50 €');
});

test('parseEur liest das eigene fmtEur-Format zurück (ohne € und Leerzeichen)', () => {
  assert.equal(parseEur('1.234,50'), 1234.5);
  assert.equal(parseEur('1.234.567,89'), 1234567.89);
  assert.equal(parseEur('0,50'), 0.5);
  assert.equal(parseEur('10,00'), 10);
});

test('parseEur liest die komplette fmtEur-Ausgabe mit „ €" am Ende', () => {
  assert.equal(parseEur(fmtEur(1234.5)), 1234.5);
  assert.equal(parseEur('1.234,50 €'), 1234.5);
});

test('parseEur ohne Tausenderpunkt (deutsche Eingabe, kleiner Betrag)', () => {
  assert.equal(parseEur('1234,50'), 1234.5);
  assert.equal(parseEur('42,00'), 42);
});

test('parseEur mit englisch getipptem Punkt als Dezimaltrenner', () => {
  assert.equal(parseEur('1234.50'), 1234.5);
  assert.equal(parseEur('1234.5'), 1234.5);
});

test('parseEur: einzelner Punkt mit genau drei Nachkommastellen ist Tausendertrennzeichen', () => {
  // "1.234" — kein Cent-Betrag hat drei Nachkommastellen, das ist Deutsch für 1234.
  assert.equal(parseEur('1.234'), 1234);
});

test('parseEur: mehrere Punkte sind immer Tausendertrennzeichen', () => {
  assert.equal(parseEur('1.234.567'), 1234567);
});

test('parseEur: reine Ganzzahl', () => {
  assert.equal(parseEur('1234'), 1234);
  assert.equal(parseEur('0'), 0);
});

test('parseEur toleriert Leerzeichen und Euro-Zeichen', () => {
  assert.equal(parseEur('  1.234,50 € '), 1234.5);
  assert.equal(parseEur('1.234,50€'), 1234.5);
});

test('parseEur: negative Beträge', () => {
  assert.equal(parseEur('-42,50'), -42.5);
});

test('parseEur gibt null für Unlesbares, nicht 0 oder NaN', () => {
  assert.equal(parseEur('quatsch'), null);
  assert.equal(parseEur(''), null);
  assert.equal(parseEur('   '), null);
  assert.equal(parseEur(null), null);
  assert.equal(parseEur(undefined), null);
  assert.equal(parseEur('12,34,56'), null);
});

test('parseEur akzeptiert direkt eine Zahl', () => {
  assert.equal(parseEur(42.5), 42.5);
  assert.equal(parseEur(0), 0);
});
