import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbg } from './debug-log.js';

test('dbg schweigt ohne Schalter und spricht mit praxura_debug=1 (Fund 10)', () => {
  const speicher = new Map();
  globalThis.localStorage = { getItem: (k) => speicher.get(k) ?? null };
  const alt = console.log; const zeilen = [];
  console.log = (...a) => zeilen.push(a);
  try {
    dbg('[init] start');
    assert.equal(zeilen.length, 0);
    speicher.set('praxura_debug', '1');
    dbg('[init] start');
    assert.deepEqual(zeilen, [['[init] start']]);
  } finally { console.log = alt; delete globalThis.localStorage; }
});
