import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panelId } from './shell-neu.js';
import { istNeu } from './neu-start.js';

test('panelId lässt nur saubere IDs durch', () => {
  assert.equal(panelId('overview'), 'overview');
  assert.equal(panelId('podologie-billing'), 'podologie-billing');
  assert.equal(panelId('x"><script>'), null);
  assert.equal(panelId(undefined), null);
});

test('neu-start tut ohne DOM bzw. im alten Design nichts', () => {
  assert.equal(istNeu(), false);
});
