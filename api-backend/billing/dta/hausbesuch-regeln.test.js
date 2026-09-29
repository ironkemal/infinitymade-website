import test from 'node:test';
import assert from 'node:assert/strict';
import { hausbesuchRegeln } from './hausbesuch-regeln.js';

const tag = (positionen) => [{ datum: '2026-09-10', positionen }];

test('Hausbesuch Ja + 79933 ist frei', () => {
  assert.deepEqual(hausbesuchRegeln({ hausbesuch: true, tage: tag(['78010', '79933']) }), []);
});
test('Nein/null/undefined + 79933 blockiert', () => {
  for (const hb of [false, null, undefined]) {
    const g = hausbesuchRegeln({ hausbesuch: hb, tage: tag(['78010', '79933']) });
    assert.equal(g.length, 1);
    assert.match(g[0], /am 10.09.2026 nicht abrechenbar/);
  }
});
test('79934 blockiert bei Nein', () => {
  assert.equal(hausbesuchRegeln({ hausbesuch: false, tage: tag(['79934']) }).length, 1);
});
test('ohne Hausbesuch-Kode nie gesperrt', () => {
  assert.deepEqual(hausbesuchRegeln({ hausbesuch: false, tage: tag(['78010']) }), []);
  assert.deepEqual(hausbesuchRegeln({}), []);
});
