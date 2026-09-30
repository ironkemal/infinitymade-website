// canli-test P1 30.09.2026 — was in prescriptions.icd10/icd10_2 geschrieben wird, trägt keinen Strich.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nurIcdKode } from './verordnung-maske.js';

test('nurIcdKode: Strich am Kodeende weg, Titel und Mehrfachkodes bleiben unberührt', () => {
  assert.equal(nurIcdKode('E11.7-'), 'E11.7');
  assert.equal(nurIcdKode('E11.7- – Diabetes mellitus'), 'E11.7');
  assert.equal(nurIcdKode('E11.74 – Diabetes mellitus, Typ 2'), 'E11.74');
  assert.equal(nurIcdKode('E11.7- L60.0'), 'E11.7 L60.0');
  assert.equal(nurIcdKode('E11.7-, L60.0-'), 'E11.7, L60.0');
  assert.equal(nurIcdKode(''), '');
  assert.equal(nurIcdKode(null), '');
});

test('nurIcdKode: dreistellige Kategorie „E11.-" -> „E11" (Punkt + Strich)', () => {
  assert.equal(nurIcdKode('E11.-'), 'E11');
  assert.equal(nurIcdKode('E11.- – Diabetes mellitus'), 'E11');
});
