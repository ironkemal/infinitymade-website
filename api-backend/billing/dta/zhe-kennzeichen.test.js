// Verordnungsbesonderheiten (ZHE Feld 7) — Anlage 3 TP5 V21 §8.1.11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verordnungsbesonderheitFuer } from './zhe-kennzeichen.js';
import { buildDtaFile } from './builder.js';
import { physioFixture } from './fixtures.js';

test('Entlassmanagement true → "4", alles andere leer', () => {
  assert.equal(verordnungsbesonderheitFuer({ entlassmanagement: true }), '4');
  assert.equal(verordnungsbesonderheitFuer({ entlassmanagement: false }), '');
  assert.equal(verordnungsbesonderheitFuer({ entlassmanagement: null }), '');
  assert.equal(verordnungsbesonderheitFuer({}), '');
  assert.equal(verordnungsbesonderheitFuer(null), '');
  // Nur echtes boolean true — kein String aus einem Formular.
  assert.equal(verordnungsbesonderheitFuer(/** @type {any} */ ({ entlassmanagement: 'true' })), '');
});

test('Builder schreibt "4" in ZHE Feld 7', () => {
  const rx = physioFixture.prescriptions[0];
  const input = { ...physioFixture, prescriptions: [{ ...rx, verordnung: { ...rx.verordnung, verordnungsbesonderheiten: '4' } }] };
  const { content } = buildDtaFile(/** @type {any} */ (input));
  const zhe = content.split("'").find(s => s.startsWith('ZHE+'));
  assert.ok(zhe, 'ZHE-Segment fehlt');
  assert.equal(zhe.split('+')[7], '4', zhe);
});

test('Physio-Mapper reicht das Kennzeichen an den Builder weiter', () => {
  const src = readFileSync(new URL('../api/abrechnung.routes.js', import.meta.url), 'utf8');
  assert.match(src, /verordnungsbesonderheiten:\s*verordnungsbesonderheitFuer\(rx\)/);
  // Die Spalte muss auch gelesen werden, sonst ist rx.entlassmanagement immer undefined.
  assert.match(src, /entlassmanagement, entlassungsdatum/);
});
