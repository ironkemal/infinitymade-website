import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Testbox 22.11.2026 (iPhone, „Bewegung reduzieren" an, Alt-Design): dashboard.css setzt bei
// prefers-reduced-motion `* { transform: none !important }`. Damit lag die Handy-Leiste dauerhaft
// über dem Inhalt. Gegenmittel ist die eigene Eigenschaft `translate`, wie im Neu-Design (R-01).
// Gemessen mit Playwright 393 px: vorher zu=sichtbar, nachher zu=weg / offen=sichtbar.
const css = readFileSync(new URL('../dashboard.css', import.meta.url), 'utf8');

test('Alt-Design: Handy-Leiste bleibt auch bei „Bewegung reduzieren" verschiebbar', () => {
  const block = css.match(/@media \(max-width: 1024px\) and \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/);
  assert.ok(block, 'eigener Block für schmal + Bewegung reduzieren');
  assert.match(block[1], /\.sidebar \{ translate: -100% 0; visibility: hidden; \}/);
  assert.match(block[1], /\.sidebar\.open \{ translate: 0 0; visibility: visible; \}/);
});

test('Der globale Reduzieren-Block hebt transform weiterhin auf (Grund für translate)', () => {
  assert.match(css, /prefers-reduced-motion: reduce\)[\s\S]{0,600}transform: none !important;/);
});
