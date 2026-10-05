import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSetupCode, formatSetupCode, normalizeCode, hashCode, verifyCode,
  istKutuCodeGueltig, FORMAT_KUTU, KUTU_CODE_ALPHABET,
} from './mitarbeiter-zugang-code.js';

test('Kutu-Code: 16 Zeichen, Crockford-Alphabet, gültiges Prüfzeichen', () => {
  for (let i = 0; i < 200; i++) {
    const c = generateSetupCode(10, FORMAT_KUTU);
    assert.equal(c.length, 16);
    for (const z of c) assert.ok(KUTU_CODE_ALPHABET.includes(z));
    assert.ok(istKutuCodeGueltig(c));
  }
});

test('Kutu-Code: Alphabet ohne I, L, O, U', () => {
  for (const z of 'ILOU') assert.ok(!KUTU_CODE_ALPHABET.includes(z));
  assert.equal(KUTU_CODE_ALPHABET.length, 32);
});

test('Kutu-Code: Anzeigeformat XXXX-XXXX-XXXX-XXXX', () => {
  const c = generateSetupCode(10, FORMAT_KUTU);
  assert.match(formatSetupCode(c, FORMAT_KUTU), /^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
});

test('Kutu-Code: Eingabe tolerant (Kleinschreibung, Bindestriche optional, O→0, I/L→1)', () => {
  const c = generateSetupCode(10, FORMAT_KUTU);
  const schoen = formatSetupCode(c, FORMAT_KUTU);
  assert.equal(normalizeCode(schoen.toLowerCase(), FORMAT_KUTU), c);
  assert.equal(normalizeCode(' ' + c + ' ', FORMAT_KUTU), c);
  assert.equal(normalizeCode('O0Il-L1', FORMAT_KUTU), '001111');
  assert.equal(hashCode(schoen.toLowerCase(), FORMAT_KUTU), hashCode(c, FORMAT_KUTU));
  assert.ok(verifyCode(schoen, hashCode(c, FORMAT_KUTU), FORMAT_KUTU));
  assert.ok(!verifyCode(schoen, hashCode(generateSetupCode(10, FORMAT_KUTU), FORMAT_KUTU), FORMAT_KUTU));
});

test('Kutu-Code: Prüfzeichen fängt jeden Einzelzeichenfehler', () => {
  const c = generateSetupCode(10, FORMAT_KUTU);
  for (let pos = 0; pos < 16; pos++) {
    for (const z of KUTU_CODE_ALPHABET) {
      if (z === c[pos]) continue;
      const falsch = c.slice(0, pos) + z + c.slice(pos + 1);
      assert.ok(!istKutuCodeGueltig(falsch), `Position ${pos} → ${z} unentdeckt`);
    }
  }
});

test('Kutu-Code: falsche Länge / unzulässige Zeichen / Nicht-String', () => {
  assert.ok(!istKutuCodeGueltig(''));
  assert.ok(!istKutuCodeGueltig('ABCD-EFGH'));
  assert.ok(!istKutuCodeGueltig(null));
  assert.ok(!istKutuCodeGueltig('UUUU-UUUU-UUUU-UUUU'));
});

test('Standardformat (Mitarbeiter) bleibt unverändert', () => {
  const c = generateSetupCode();
  assert.equal(c.length, 10);
  assert.equal(formatSetupCode(c).length, 11);
  assert.equal(normalizeCode('ab-cd'), 'ABCD');
  assert.equal(normalizeCode('OIL'), 'OIL');
});
