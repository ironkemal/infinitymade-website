import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schubladenZustand } from './schublade-neu.js';

test('schubladenZustand: breit = nichts sperren, kein aria-expanded', () => {
  assert.deepEqual(schubladenZustand(false, true), { leisteInert: false, inhaltInert: false, expanded: null });
  assert.deepEqual(schubladenZustand(false, false), { leisteInert: false, inhaltInert: false, expanded: null });
});

test('schubladenZustand: schmal offen sperrt Inhalt, geschlossen die Leiste', () => {
  assert.deepEqual(schubladenZustand(true, true), { leisteInert: false, inhaltInert: true, expanded: 'true' });
  assert.deepEqual(schubladenZustand(true, false), { leisteInert: true, inhaltInert: false, expanded: 'false' });
});
