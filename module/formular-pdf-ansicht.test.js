import test from 'node:test';
import assert from 'node:assert/strict';
import { berechneRenderScale, MAX_CANVAS_PIXEL } from './formular-pdf-ansicht.js';

test('berechneRenderScale: Standard-Skalierung ohne Pixelueberschreitung', () => {
  // 1:1 Skalierung bei DPR 1
  assert.equal(berechneRenderScale(600, 600, 1), 1);

  // Layout 800px auf 400px Basis bei DPR 2 -> 2 * 2 = 4
  const scale = berechneRenderScale(800, 400, 2);
  assert.equal(scale, 4);
});

test('berechneRenderScale: deckelt renderScale wenn Gesamtpixel maxPixel uebersteigen', () => {
  // Seite 1000 x 1400 Pixel (= 1.400.000 Basis-Pixel)
  // Bei DPR 5 waere renderScale = 5 -> Gesamtpixel = 1.400.000 * 25 = 35.000.000 > 12.000.000
  // Erwarteter Deckel: sqrt(12.000.000 / 1.400.000) = sqrt(8.571428) ≈ 2.9277
  const gedeckelt = berechneRenderScale(1000, 1000, 5, MAX_CANVAS_PIXEL, 1400);
  assert.ok(gedeckelt < 5, 'renderScale muss unter 5 gedrückt worden sein');

  // Pruefen, dass Gesamtpixel <= MAX_CANVAS_PIXEL
  const total = (1000 * gedeckelt) * (1400 * gedeckelt);
  assert.ok(total <= MAX_CANVAS_PIXEL + 100, `Gesamtpixel (${total}) darf ${MAX_CANVAS_PIXEL} nicht überschreiten`);
  assert.equal(Math.round(gedeckelt * 100) / 100, 2.93);
});

test('berechneRenderScale: ungueltige Werte liefern sicheren Rueckfall 1', () => {
  assert.equal(berechneRenderScale(0, 500, 1), 1);
  assert.equal(berechneRenderScale(500, 0, 1), 1);
  assert.equal(berechneRenderScale(-100, 500, 1), 1);
});
