import { test } from 'node:test';
import assert from 'node:assert/strict';

import { monatsKacheln, SPRUNG_VERZOEGERUNG_MS } from './kalender-monat.js';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('immer volle Wochen', () => {
  for (let m = 0; m < 12; m++) {
    const k = monatsKacheln(2026, m);
    assert.equal(k.length % 7, 0, `Monat ${m + 1}`);
  }
});

test('erste Kachel ist ein Montag, letzte ein Sonntag', () => {
  for (let m = 0; m < 12; m++) {
    const k = monatsKacheln(2026, m);
    assert.equal(k[0].date.getDay(), 1, `Monat ${m + 1} beginnt nicht am Montag`);
    assert.equal(k[k.length - 1].date.getDay(), 0, `Monat ${m + 1} endet nicht am Sonntag`);
  }
});

test('August 2026 beginnt an einem Samstag — die Woche davor wird aufgefuellt', () => {
  const k = monatsKacheln(2026, 7);
  assert.equal(iso(k[0].date), '2026-07-27');
  assert.equal(k[0].otherMonth, true);
  assert.equal(iso(k[5].date), '2026-08-01');
  assert.equal(k[5].otherMonth, false);
});

test('ein Monat, der an einem Sonntag beginnt, rutscht nicht eine Woche vor', () => {
  // getDay() liefert fuer Sonntag 0. Ohne Umrechnung auf Montag = 0 stuende
  // der Erste ganz links statt ganz rechts in der ersten Zeile.
  const k = monatsKacheln(2026, 2); // 01.03.2026 ist ein Sonntag
  const ersterDesMonats = k.find(z => !z.otherMonth);
  assert.equal(iso(ersterDesMonats.date), '2026-03-01');
  assert.equal(k.indexOf(ersterDesMonats), 6, 'der Erste gehoert in die letzte Spalte');
});

test('alle Tage des Monats kommen genau einmal vor', () => {
  const k = monatsKacheln(2026, 1); // Februar
  const eigene = k.filter(z => !z.otherMonth).map(z => iso(z.date));
  assert.equal(eigene.length, 28);
  assert.equal(new Set(eigene).size, 28);
  assert.equal(eigene[0], '2026-02-01');
  assert.equal(eigene[27], '2026-02-28');
});

test('Schaltjahr wird nicht abgeschnitten', () => {
  const eigene = monatsKacheln(2028, 1).filter(z => !z.otherMonth);
  assert.equal(eigene.length, 29);
});

test('lueckenlose Kette ohne Sprung ueber den Monatswechsel', () => {
  const k = monatsKacheln(2026, 11); // Dezember, Jahreswechsel
  for (let i = 1; i < k.length; i++) {
    const diff = (k[i].date - k[i - 1].date) / 86400000;
    assert.ok(Math.abs(diff - 1) < 0.01, `Sprung bei ${iso(k[i].date)}`);
  }
});

test('die Sprungverzoegerung bleibt unter einer halben Sekunde', () => {
  // Darueber fuehlt sich der Einfachklick kaputt an.
  assert.ok(SPRUNG_VERZOEGERUNG_MS > 0 && SPRUNG_VERZOEGERUNG_MS <= 400);
});
