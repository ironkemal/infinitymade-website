import { test } from 'node:test';
import assert from 'node:assert/strict';

import { podologiePositionFuerText } from './podologie-heilmittel-position.js';

test('podologiePositionFuerText: Einzelleistungen Hornhautabtragung und Nagelbearbeitung liefern 78010', () => {
  assert.equal(podologiePositionFuerText('Hornhautabtragung'), '78010');
  assert.equal(podologiePositionFuerText('  hornhautabtragung  '), '78010');
  assert.equal(podologiePositionFuerText('Hornhautabtragung (einzeln)'), '78010');
  assert.equal(podologiePositionFuerText('Hornhautabtragung einzeln'), '78010');
  assert.equal(podologiePositionFuerText('Nagelbearbeitung'), '78010');
  assert.equal(podologiePositionFuerText('nagelbearbeitung (einzeln)'), '78010');
  assert.equal(podologiePositionFuerText('Nagelbearbeitung einzeln'), '78010');
});

test('podologiePositionFuerText: Ausdrückliche kleine Behandlung liefert 78010', () => {
  assert.equal(podologiePositionFuerText('Podologische Behandlung (klein)'), '78010');
  assert.equal(podologiePositionFuerText('podologische behandlung klein'), '78010');
  assert.equal(podologiePositionFuerText('pod. Beh. kl.'), '78010');
  assert.equal(podologiePositionFuerText('Pod. Beh. kl'), '78010');
  assert.equal(podologiePositionFuerText('Podologische Behandlung (klein) bis 20 Min.'), '78010');
});

test('podologiePositionFuerText: Ausdrückliche große Behandlung liefert 78020', () => {
  assert.equal(podologiePositionFuerText('Podologische Behandlung (groß)'), '78020');
  assert.equal(podologiePositionFuerText('Podologische Behandlung (gross)'), '78020');
  assert.equal(podologiePositionFuerText('podologische behandlung groß'), '78020');
  assert.equal(podologiePositionFuerText('pod. Beh. gr.'), '78020');
  assert.equal(podologiePositionFuerText('Podologische Komplexbehandlung (groß)'), '78020');
  assert.equal(podologiePositionFuerText('Podologische Komplexbehandlung groß'), '78020');
  assert.equal(podologiePositionFuerText('Podologische Behandlung (groß) über 20 Min.'), '78020');
});

test('podologiePositionFuerText: Generische Komplexbehandlung ohne Zeitangabe liefert null', () => {
  assert.equal(podologiePositionFuerText('Podologische Komplexbehandlung'), null);
  assert.equal(podologiePositionFuerText('podologische komplexbehandlung'), null);
  assert.equal(podologiePositionFuerText('Hornhautabtragung und Nagelbearbeitung'), null);
});

test('podologiePositionFuerText: Unbekannte Texte, Nagelspangen und leere Eingaben liefern null', () => {
  assert.equal(podologiePositionFuerText('Nagelspange'), null);
  assert.equal(podologiePositionFuerText('Ross-Fraser-Spange'), null);
  assert.equal(podologiePositionFuerText('Krankengymnastik'), null);
  assert.equal(podologiePositionFuerText('unbekannt'), null);
  assert.equal(podologiePositionFuerText(''), null);
  assert.equal(podologiePositionFuerText('   '), null);
  assert.equal(podologiePositionFuerText(null), null);
  assert.equal(podologiePositionFuerText(undefined), null);
});
