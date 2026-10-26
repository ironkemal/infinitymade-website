import { test } from 'node:test';
import assert from 'node:assert/strict';
import { naechsterIndex } from './kopf-menue.js';

test('naechsterIndex: rundum, Start ohne Fokus oben bzw. unten, leer = -1', () => {
  assert.equal(naechsterIndex(0, 1, 3), 1);
  assert.equal(naechsterIndex(2, 1, 3), 0);
  assert.equal(naechsterIndex(0, -1, 3), 2);
  assert.equal(naechsterIndex(-1, 1, 3), 0);
  assert.equal(naechsterIndex(-1, -1, 3), 2);
  assert.equal(naechsterIndex(0, 1, 0), -1);
});
