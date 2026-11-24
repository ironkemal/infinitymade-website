// tools/bekci-ajan/iz.test.js
// Ne: iz.mjs birim testleri.
// Niye: SPEC.md §3.0d ve görev tanımı uyarınca kararlı JSON serialization,
// anahtar sıralaması, 16 hane sha256 ve determinizmin doğrulanması.

import test from 'node:test';
import assert from 'node:assert/strict';
import { iz, kararlıStringify } from './iz.mjs';

test('1. iz: anahtar sırası farklı nesneler aynı izi üretir', () => {
  const o1 = { b: 2, a: 1 };
  const o2 = { a: 1, b: 2 };
  assert.equal(iz(o1), iz(o2));
  assert.equal(kararlıStringify(o1), '{"a":1,"b":2}');
  assert.equal(kararlıStringify(o2), '{"a":1,"b":2}');
});

test('2. iz: iç içe nesnelerde anahtar sırası farklı olsa bile aynı izi üretir', () => {
  const o1 = { z: { y: 2, x: 1 }, w: [{ b: 2, a: 1 }] };
  const o2 = { w: [{ a: 1, b: 2 }], z: { x: 1, y: 2 } };
  assert.equal(iz(o1), iz(o2));
});

test('3. iz: dizi eleman sırası değişirse iz değişir', () => {
  const arr1 = ['78010', '78020'];
  const arr2 = ['78020', '78010'];
  assert.notEqual(iz(arr1), iz(arr2));
});

test('4. iz: çıktı tam 16 hane küçük harf hex dizgisidir', () => {
  const res = iz({ test: 'deger', sayi: 42 });
  assert.equal(res.length, 16);
  assert.match(res, /^[0-9a-f]{16}$/);
});

test('5. iz: string girdiler doğrudan sha256 ilk 16 hanesini üretir', () => {
  const str = JSON.stringify(['q1', ['a.pdf'], []]);
  const arr = ['q1', ['a.pdf'], []];
  assert.equal(iz(str), iz(arr));
});

test('6. iz: ilkel değerler, null ve undefined güvenle işlenir', () => {
  assert.equal(typeof iz(null), 'string');
  assert.equal(typeof iz(123), 'string');
  assert.equal(typeof iz('metin'), 'string');
  assert.equal(typeof iz(true), 'string');
  assert.equal(typeof iz({ a: undefined, b: 1 }), 'string');
  assert.equal(iz({ a: undefined, b: 1 }), iz({ b: 1 }));
});
