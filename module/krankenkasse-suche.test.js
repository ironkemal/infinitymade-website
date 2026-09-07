// krankenkasse-suche.js — Tests der Reihenfolge.  Lauf:  node --test module/
//
// Getestet wird `sucheKassen` — die einzige Stelle, die entscheidet, was oben
// steht. Genau daran hing die Beschwerde: alphabetisch war die richtige Kasse
// nie in Sichtweite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sucheKassen } from './krankenkasse-suche.js';

const quelle = readFileSync(new URL('./krankenkasse-suche.js', import.meta.url), 'utf8');

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
  const viele = Array.from({ length: 400 }, (_, i) => ({ name: `BKK ${i}`, kurz: null, ik: null, anzahl: 0 }));
  assert.equal(sucheKassen(viele, '', 30).length, 30);
});

test('Vorgabe zeigt den ganzen Kassenbestand — 94 Zeilen, nicht 30', () => {
  // Regression: die Vorgabe war 30 und schnitt die alphabetische Liste mitten
  // im „B" ab. Der Anwender sah ein Fuenftel und hielt die Quelle fuer falsch.
  const bestand = Array.from({ length: 94 }, (_, i) => ({ name: `Kasse ${i}`, kurz: null, ik: null, anzahl: 0 }));
  assert.equal(sucheKassen(bestand, '').length, 94);
});

// ── Ops #264: Krankenkasse → IK automatisch, ohne dashboard.js zu vergrössern ──
//
// attachKrankenkasseSuche() ist DOM-getrieben (attachAutocomplete()) — kein
// node:test-DOM hier, deshalb ein Bauart-Test wie bei podologie-abrechnung.js:
// geprüft wird die Quelle, nicht das Verhalten im Browser (das übernimmt
// tools/browser-probe/ bzw. der echte Klickdurchgang).

test('IK-Geschwisterfeld wird per Namenskonvention gesucht (<id>Ik), kein neuer Dashboard-Aufruf nötig', () => {
  assert.match(quelle, /getElementById\(\s*inputEl\.id\s*\+\s*['"]Ik['"]\s*\)/,
    'dashboard.js darf nicht wachsen — die Verknüpfung muss hier im Modul über die ID-Konvention laufen.');
});

test('Autofill überschreibt nie einen vorhandenen Wert (OCR/Handkorrektur bleibt stehen)', () => {
  const treffer = quelle.match(/onSelect:\s*k\s*=>\s*\{[\s\S]{0,200}?\}/);
  assert.ok(treffer, 'onSelect-Handler nicht gefunden');
  assert.match(treffer[0], /!ikEl\.value/,
    'Ohne diese Bedingung würde jede Kassenauswahl eine bereits eingetragene IK stillschweigend ersetzen.');
});
