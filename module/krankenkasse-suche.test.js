// krankenkasse-suche.js — Tests der Reihenfolge.  Lauf:  node --test module/
//
// Getestet wird `sucheKassen` — die einzige Stelle, die entscheidet, was oben
// steht. Genau daran hing die Beschwerde: alphabetisch war die richtige Kasse
// nie in Sichtweite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sucheKassen } from './krankenkasse-suche.js';

const kassen = [
  { name: 'actimonda krankenkasse', kurz: null,     ik: '1',  anzahl: 0 },
  { name: 'AOK Bayern',             kurz: 'AOK BY', ik: '2',  anzahl: 41 },
  { name: 'BARMER',                 kurz: null,     ik: '3',  anzahl: 12 },
  { name: 'HEK',                    kurz: null,     ik: '4',  anzahl: 3 },
  { name: 'Techniker Krankenkasse', kurz: 'TK',     ik: '5',  anzahl: 7 },
  { name: 'Zeus BKK',               kurz: null,     ik: '6',  anzahl: 0 },
];

test('Kassen der eigenen Praxis stehen oben, nach Häufigkeit', () => {
  const r = sucheKassen(kassen, '');
  assert.deepEqual(r.slice(0, 4).map(k => k.name),
    ['AOK Bayern', 'BARMER', 'Techniker Krankenkasse', 'HEK']);
});

test('ungenutzte Kassen folgen alphabetisch', () => {
  const r = sucheKassen(kassen, '');
  assert.deepEqual(r.slice(4).map(k => k.name), ['actimonda krankenkasse', 'Zeus BKK']);
});

test('Suche findet über die Abkürzung', () => {
  assert.deepEqual(sucheKassen(kassen, 'TK').map(k => k.name), ['Techniker Krankenkasse']);
});

test('Suche ist unabhängig von Gross-/Kleinschreibung und Zeichensetzung', () => {
  // Der Bindestrich wird wie ein Leerzeichen behandelt — wer „aok-bayern"
  // tippt, meint dieselbe Kasse. (Diese Erwartung stand hier zuerst falsch
  // herum im Test; die Normalisierung war von Anfang an die richtige.)
  assert.deepEqual(sucheKassen(kassen, 'aok-bayern').map(k => k.name), ['AOK Bayern']);
  assert.deepEqual(sucheKassen(kassen, 'aok bayern').map(k => k.name), ['AOK Bayern']);
  assert.deepEqual(sucheKassen(kassen, 'BARMER').map(k => k.name), ['BARMER']);
  assert.deepEqual(sucheKassen(kassen, 'barmer').map(k => k.name), ['BARMER']);
});

test('ohne eigene Patienten bleibt es alphabetisch — nichts zu bevorzugen', () => {
  const frisch = kassen.map(k => ({ ...k, anzahl: 0 }));
  assert.deepEqual(sucheKassen(frisch, '').map(k => k.name), [
    'actimonda krankenkasse', 'AOK Bayern', 'BARMER', 'HEK',
    'Techniker Krankenkasse', 'Zeus BKK',
  ]);
});

test('Trefferzahl wird begrenzt', () => {
  const viele = Array.from({ length: 200 }, (_, i) => ({ name: `BKK ${i}`, kurz: null, ik: null, anzahl: 0 }));
  assert.equal(sucheKassen(viele, '', 30).length, 30);
});
