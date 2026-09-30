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

// canli-test P3 30.09.2026 — gespeicherter Kode beim Wiederöffnen
import { gespeicherterKodeHinweis } from '../katalog-suche.js';
const sbMit = (rows, error = null) => ({ rpc: async () => ({ data: rows, error }) });

test('gespeicherter nicht endständiger Kode -> derselbe Hinweis wie bei der Auswahl', async () => {
  const sb = sbMit([{ kind: 'icd', code: 'E11.7-', terminal: false }, { kind: 'icd', code: 'E11.70', terminal: true }]);
  assert.match(await gespeicherterKodeHinweis(sb, 'E11.7 – Diabetes'), /nicht endständig/);
  assert.match(await gespeicherterKodeHinweis(sb, 'E11.7'), /nicht endständig/);
});
test('gespeicherter endständiger/unbekannter Kode, leeres Feld, Suchfehler -> kein Hinweis', async () => {
  const sb = sbMit([{ kind: 'icd', code: 'E11.70', terminal: true }]);
  assert.equal(await gespeicherterKodeHinweis(sb, 'E11.70'), '');
  assert.equal(await gespeicherterKodeHinweis(sb, 'X99.9'), '');
  assert.equal(await gespeicherterKodeHinweis(sb, ''), '');
  assert.equal(await gespeicherterKodeHinweis(sbMit(null, { message: 'x' }), 'E11.7'), '');
});

// canli-test P3 30.09.2026 (2) — der Kode mit Strich ging roh an die RPC, die 0 Zeilen lieferte.
test('gespeichertes „E11.7-": die RPC bekommt den Kode OHNE Strich und der Hinweis erscheint', async () => {
  const gefragt = [];
  const sb = { rpc: async (_n, p) => {
    gefragt.push(p.p_q);
    // wie die echte RPC: mit nachgestelltem Strich keine Treffer
    return { data: /-$/.test(p.p_q) ? [] : [{ kind: 'icd', code: 'E11.7-', terminal: false }], error: null };
  } };
  assert.match(await gespeicherterKodeHinweis(sb, 'E11.7-'), /nicht endständig/);
  assert.match(await gespeicherterKodeHinweis(sb, 'E11.7- – Diabetes'), /nicht endständig/);
  assert.deepEqual(gefragt, ['E11.7', 'E11.7']);
});
