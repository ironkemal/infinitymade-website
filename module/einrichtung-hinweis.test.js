import { test } from 'node:test';
import assert from 'node:assert/strict';
import { einrichtungHinweisText } from './einrichtung-hinweis.js';

test('404 (Router nicht eingehängt = fertig) → nichts tun', () => {
  assert.equal(einrichtungHinweisText(404, null), null);
});

test('abgeschlossen → nichts tun', () => {
  assert.equal(einrichtungHinweisText(200, { abgeschlossen: true, verfuegbar: false }), null);
});

test('offen, noch kein Konto → Weiterleitung auf setup.html (Beta-Test 22.10.2026)', () => {
  const h = einrichtungHinweisText(200, { abgeschlossen: false, verfuegbar: true, abgelaufen: false });
  assert.deepEqual(h, { weiterleiten: true });
});

test('abgelaufener Jeton ohne Konto → ebenfalls Weiterleitung (setup.html zeigt „abgelaufen")', () => {
  const h = einrichtungHinweisText(200, { abgeschlossen: false, verfuegbar: true, abgelaufen: true });
  assert.deepEqual(h, { weiterleiten: true });
});

test('offen, Konto schon angelegt → Hinweis "Anmelden geht" mit vollem Linux-Pfad', () => {
  const h = einrichtungHinweisText(200, { abgeschlossen: false, verfuegbar: false });
  assert.match(h.text, /Anmelden geht/);
  assert.match(h.linux, /\/opt\/praxura\/onprem\/install\.sh --neuer-jeton/);
});

test('Serverfehler → nichts tun', () => {
  assert.equal(einrichtungHinweisText(500, null), null);
});
