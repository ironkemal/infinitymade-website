import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flyoutLage } from './leiste-flyout.js';

const leiste = { right: 72 };

test('flyoutLage: rechts neben der Leiste, oben bündig mit dem Gruppenkopf', () => {
  assert.deepEqual(flyoutLage({ top: 120 }, leiste, 200, 900), { left: 80, top: 120 });
});

test('flyoutLage: am unteren Fensterrand nach oben geklappt, nie über den oberen Rand', () => {
  assert.deepEqual(flyoutLage({ top: 800 }, leiste, 200, 900), { left: 80, top: 692 });
  assert.deepEqual(flyoutLage({ top: 300 }, leiste, 1200, 900), { left: 80, top: 8 });
  assert.deepEqual(flyoutLage({ top: -20 }, leiste, 100, 900), { left: 80, top: 8 });
});
