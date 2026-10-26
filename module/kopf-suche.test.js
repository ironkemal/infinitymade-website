import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schraegstrichFokussiert } from './kopf-suche.js';

const taste = (o = {}) => ({ key: '/', ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false, isComposing: false, ...o });

test('„/“ fokussiert die Suche außerhalb von Eingabefeldern', () => {
  assert.equal(schraegstrichFokussiert(taste(), { tagName: 'BUTTON' }), true);
  assert.equal(schraegstrichFokussiert(taste(), null), true);
});

test('„/“ bleibt Zeichen beim Tippen, mit Zusatztaste oder bei anderer Taste', () => {
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) assert.equal(schraegstrichFokussiert(taste(), { tagName: tag }), false, tag);
  assert.equal(schraegstrichFokussiert(taste(), { tagName: 'DIV', isContentEditable: true }), false);
  assert.equal(schraegstrichFokussiert(taste({ metaKey: true }), null), false);
  assert.equal(schraegstrichFokussiert(taste({ key: 'a' }), null), false);
  assert.equal(schraegstrichFokussiert(taste({ defaultPrevented: true }), null), false);
  assert.equal(schraegstrichFokussiert(undefined, null), false);
});
