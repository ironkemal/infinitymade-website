// Box-Test 22.11.2026, Befund 2: „Ein Test soll fehlschlagen, wenn Konsolenfehler auftauchen.“
// Jede Probe im npm-Skript „probe“ muss console.error UND pageerror werten (direkt oder über konsole.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { konsoleBeobachten, konsoleAuswerten } from './browser-probe/konsole.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const proben = pkg.scripts.probe.match(/tools\/browser-probe\/[\w-]+\.mjs/g) || [];

test('jede Probe wertet Konsolenfehler und Seitenfehler', () => {
  assert.ok(proben.length >= 20, 'Probenliste gelesen');
  for (const p of proben) {
    const src = readFileSync(new URL('../' + p, import.meta.url), 'utf8');
    const helfer = /konsoleBeobachten\(/.test(src);
    const konsole = helfer || /on\(\s*['"]console['"][\s\S]{0,160}type\(\)\s*===\s*['"]error['"]/.test(src);
    const seite = helfer || /on\(\s*['"]pageerror['"]/.test(src);
    assert.ok(konsole && seite, `${p}: console.error (${konsole}) und pageerror (${seite}) müssen gewertet werden`);
  }
});

function seite() {
  /** @type {Record<string, Function>} */ const h = {};
  return { on: (/** @type {string} */ ev, /** @type {Function} */ fn) => { h[ev] = fn; }, h };
}

test('konsole.mjs: Fehler zählen, erlaubte Meldung nur mit Grund', () => {
  assert.throws(() => konsoleBeobachten(/** @type {any} */ (seite()), { erlaubt: [{ muster: /x/, grund: '' }] }), /Grund/);
  const s = seite();
  const b = konsoleBeobachten(/** @type {any} */ (s), { erlaubt: [{ muster: /gewollt/, grund: 'Szenario simuliert Ladefehler absichtlich' }] });
  s.h.console({ type: () => 'error', text: () => 'gewollt: Ladefehler' });
  s.h.console({ type: () => 'warning', text: () => 'egal' });
  s.h.console({ type: () => 'error', text: () => 'TypeError: x is undefined' });
  s.h.pageerror(new Error('boom'));
  assert.deepEqual(b.erlaubtGesehen, ['gewollt: Ladefehler']);
  assert.deepEqual(b.fehler, ['TypeError: x is undefined', 'pageerror: boom']);
  const vorher = process.exitCode;
  assert.equal(konsoleAuswerten({ fehler: [] }, 't'), true);
  assert.equal(konsoleAuswerten(b, 't'), false);
  assert.equal(process.exitCode, 1);
  process.exitCode = vorher;
});
