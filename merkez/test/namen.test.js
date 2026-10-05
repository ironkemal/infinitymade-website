import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WOERTER, SPERRLISTE, zufallsName, NAME_FORMAT } from '../namen.js';

test('Wortliste: ~300 Wörter, eindeutig, nur a–z, 3–8 Zeichen', () => {
  assert.ok(WOERTER.length >= 250, 'zu kurz: ' + WOERTER.length);
  assert.equal(new Set(WOERTER).size, WOERTER.length);
  for (const w of WOERTER) assert.match(w, /^[a-z]{3,8}$/, w);
});

test('Wortliste: keine Sperrlisten-Treffer', () => {
  for (const w of WOERTER) for (const s of SPERRLISTE) assert.ok(!w.includes(s), `${w} enthält ${s}`);
});

test('zufallsName: wort-wort-NN, 1–99, verschiedene Wörter', () => {
  for (let i = 0; i < 500; i++) {
    const n = zufallsName();
    assert.match(n, NAME_FORMAT);
    const [a, b, nr] = n.split('-');
    assert.notEqual(a, b);
    assert.ok(WOERTER.includes(a) && WOERTER.includes(b));
    assert.ok(Number(nr) >= 1 && Number(nr) <= 99);
  }
});

test('NAME_FORMAT lehnt Sonderfälle ab', () => {
  for (const s of ['Sonne-tal-42', 'sonne-tal-0', 'sonne-tal-100', 'sonne-tal', 'sonne_tal-4', 'sönne-tal-4', '-a-tal-4', 'sonne-tal-4.evil']) {
    assert.ok(!NAME_FORMAT.test(s), s);
  }
});

test('nameErlaubt: Sperrliste greift über die Wortgrenze, Sperrpaare in beiden Richtungen', async () => {
  const { nameErlaubt } = await import('../namen.js');
  assert.equal(nameErlaubt('sonne-tal-42'), true);
  assert.equal(nameErlaubt('blu-tal-3'), false);         // "blut" über die Grenze
  assert.equal(nameErlaubt('weiss-macht-1'), false);
  assert.equal(nameErlaubt('macht-weiss-1'), false);
  assert.equal(nameErlaubt('Sonne-tal-4'), false);       // Format
});
