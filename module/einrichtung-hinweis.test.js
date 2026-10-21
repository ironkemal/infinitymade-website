import { test } from 'node:test';
import assert from 'node:assert/strict';
import { einrichtungHinweisText } from './einrichtung-hinweis.js';

test('404 (Router nicht eingehängt = fertig) → kein Hinweis', () => {
  assert.equal(einrichtungHinweisText(404, null), null);
});

test('abgeschlossen → kein Hinweis', () => {
  assert.equal(einrichtungHinweisText(200, { abgeschlossen: true, verfuegbar: false }), null);
});

test('offen, noch kein Konto → Hinweis "noch kein Konto"', () => {
  const h = einrichtungHinweisText(200, { abgeschlossen: false, verfuegbar: true, abgelaufen: false });
  assert.match(h.text, /noch kein Konto/);
  assert.match(h.text, /Praxura-Einrichtung/);
});

test('offen, Konto schon angelegt → Hinweis "Anmelden geht"', () => {
  const h = einrichtungHinweisText(200, { abgeschlossen: false, verfuegbar: false });
  assert.match(h.text, /Anmelden geht/);
});

test('abgelaufener Jeton zeigt denselben Ausweg (install.ps1 erneuert ihn)', () => {
  const h = einrichtungHinweisText(200, { abgeschlossen: false, verfuegbar: true, abgelaufen: true });
  assert.ok(h);
});

test('Serverfehler → kein Hinweis', () => {
  assert.equal(einrichtungHinweisText(500, null), null);
});
