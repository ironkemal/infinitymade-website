/**
 * Tests für module/kalender-team.js.
 *
 * `teamReihenfolge()` entscheidet, wie viele Spalten die Tagesansicht bekommt
 * und wer links steht. Zwei Fehlerbilder soll sie unmöglich machen: derselbe
 * Behandler zweimal (am 27.08.2026 in einer Ein-Personen-Praxis gemeldet) und
 * der eigene Zugang irgendwo mittendrin.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teamReihenfolge } from './kalender-team.js';

const ids = (arr) => arr.map(m => m.id).join(',');

test('doppelte Profilzeilen ergeben nur eine Spalte', () => {
  const roh = [{ id: 'a' }, { id: 'b' }, { id: 'a' }];
  assert.equal(ids(teamReihenfolge(roh, null)), 'a,b');
});

test('eigener Zugang steht ganz vorn, der Rest behält seine Reihenfolge', () => {
  const roh = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(ids(teamReihenfolge(roh, 'c')), 'c,a,b');
});

test('steht der eigene Zugang schon vorn, ändert sich nichts', () => {
  const roh = [{ id: 'a' }, { id: 'b' }];
  assert.equal(ids(teamReihenfolge(roh, 'a')), 'a,b');
});

test('unbekannte oder fehlende selfId lässt die Reihenfolge unberührt', () => {
  const roh = [{ id: 'a' }, { id: 'b' }];
  assert.equal(ids(teamReihenfolge(roh, 'x')), 'a,b');
  assert.equal(ids(teamReihenfolge(roh, null)), 'a,b');
});

test('leere, fehlende und id-lose Einträge fallen raus', () => {
  assert.deepEqual(teamReihenfolge(null, 'a'), []);
  assert.deepEqual(teamReihenfolge(undefined, 'a'), []);
  assert.equal(ids(teamReihenfolge([{ id: 'a' }, null, {}, { id: '' }], 'a')), 'a');
});

test('die Eingabeliste wird nicht verändert', () => {
  const roh = [{ id: 'a' }, { id: 'b' }];
  teamReihenfolge(roh, 'b');
  assert.equal(ids(roh), 'a,b');
});
