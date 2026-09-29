// Reform S3.6 — nicht endständiger ICD: nur Hinweis, nie Sperre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nichtEndstaendigHinweis } from '../katalog-suche.js';

test('terminal false -> Hinweistext', () => {
  assert.match(nichtEndstaendigHinweis({ kind: 'icd', code: 'E11', terminal: false }), /nicht endständig/);
});
test('terminal true / null / undefined -> kein Hinweis', () => {
  assert.equal(nichtEndstaendigHinweis({ kind: 'icd', terminal: true }), '');
  assert.equal(nichtEndstaendigHinweis({ kind: 'icd', terminal: null }), '');
  assert.equal(nichtEndstaendigHinweis({ kind: 'icd' }), '');
  assert.equal(nichtEndstaendigHinweis(null), '');
});
test('Diagnosegruppe -> kein Hinweis', () => {
  assert.equal(nichtEndstaendigHinweis({ kind: 'dg', terminal: false }), '');
});
