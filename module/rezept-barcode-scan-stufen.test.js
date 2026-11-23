// Box-Test 22.11.2026 (Pflichtpunkt 4): Renderstufen für PDF-Seiten und Verkleinerung großer Fotos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pdfStufen, bildMass } from './rezept-barcode-scan.js';

test('A4-Seite: erst Faktor 3 (schnell), dann die größte erlaubte Stufe (≈ 350 dpi)', () => {
  const [schnell, gross] = pdfStufen(595.28, 841.89);
  assert.equal(schnell, 3);
  assert.ok(gross > 4.5 && gross < 5, `große Stufe ${gross}`);
  assert.ok(595.28 * gross * 841.89 * gross <= 12_000_000 + 1, 'bleibt unter MAX_PIXELS');
});

test('große Seite: nur eine Stufe, wenn mehr nicht erlaubt ist', () => {
  assert.equal(pdfStufen(3000, 3000).length, 1);
  assert.ok(pdfStufen(3000, 3000)[0] < 3);
});

test('Foto über 12 MP wird proportional verkleinert, kleine Bilder bleiben', () => {
  const { breite, hoehe } = bildMass(8064, 6048); // 48-MP-Handyfoto
  assert.ok(breite * hoehe <= 12_000_000);
  assert.ok(Math.abs(breite / hoehe - 8064 / 6048) < 0.01);
  assert.deepEqual(bildMass(663, 165), { breite: 663, hoehe: 165 });
});
