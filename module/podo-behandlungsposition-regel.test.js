import { test } from 'node:test';
import assert from 'node:assert/strict';
import { behandlungspositionVorschlag } from './podo-behandlungsposition-regel.js';

test('Maßnahme a) Hornhautabtragung -> immer 78010', () => {
  assert.equal(behandlungspositionVorschlag('a'), '78010');
  // auch wenn das Rezept (falsch) 78020 traegt — a)/b) sind nie 78020.
  assert.equal(behandlungspositionVorschlag('a', '78020'), '78010');
});

test('Maßnahme b) Nagelbearbeitung -> immer 78010', () => {
  assert.equal(behandlungspositionVorschlag('b'), '78010');
  assert.equal(behandlungspositionVorschlag('b', '78020'), '78010');
});

test('Maßnahme c) Komplexbehandlung -> Vorschlag 78010, nicht 78020', () => {
  // 78020 ist bei c) zulaessig, aber die >20-Minuten-Entscheidung faellt je
  // Sitzung — das Rezept allein rechtfertigt keine Vorbelegung auf 78020.
  assert.equal(behandlungspositionVorschlag('c'), '78010');
  assert.equal(behandlungspositionVorschlag('c', '78020'), '78010');
});

test('unbekannte Maßnahme (Altbestand) -> rohe Rezeptposition, wenn 78010/78020', () => {
  assert.equal(behandlungspositionVorschlag('', '78010'), '78010');
  assert.equal(behandlungspositionVorschlag('', '78020'), '78020');
});

test('unbekannte Maßnahme + unbekannte/andere Position -> keine Vorbelegung', () => {
  assert.equal(behandlungspositionVorschlag('', ''), '');
  assert.equal(behandlungspositionVorschlag('', '78610'), '');
  assert.equal(behandlungspositionVorschlag(undefined, undefined), '');
});
