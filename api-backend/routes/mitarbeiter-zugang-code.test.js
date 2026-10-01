import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SETUP_CODE_ALPHABET,
  generateSetupCode,
  formatSetupCode,
  normalizeCode,
  hashCode,
  verifyCode,
  isCodeExpired,
  calculateExpiryDate,
} from './mitarbeiter-zugang-code.js';

test('SETUP_CODE_ALPHABET has 32 unambiguous characters', () => {
  assert.equal(SETUP_CODE_ALPHABET.length, 32);
  assert.equal(SETUP_CODE_ALPHABET.includes('0'), false);
  assert.equal(SETUP_CODE_ALPHABET.includes('1'), false);
  assert.equal(SETUP_CODE_ALPHABET.includes('O'), false);
  assert.equal(SETUP_CODE_ALPHABET.includes('I'), false);
});

test('generateSetupCode produces a 10-character code using ALPHABET only', () => {
  const code = generateSetupCode();
  assert.equal(code.length, 10);
  for (const ch of code) {
    assert.ok(SETUP_CODE_ALPHABET.includes(ch), `Character ${ch} must be in alphabet`);
  }
});

test('formatSetupCode formats 10-char raw string as XXXXX-XXXXX', () => {
  assert.equal(formatSetupCode('ABCDE23456'), 'ABCDE-23456');
  assert.equal(formatSetupCode('abcde-23456'), 'ABCDE-23456');
  assert.equal(formatSetupCode('  abcde 23456 '), 'ABCDE-23456');
});

test('normalizeCode removes whitespace, hyphens, and converts to uppercase', () => {
  assert.equal(normalizeCode(' abc-de-fgh-jk '), 'ABCDEFGHJK');
  assert.equal(normalizeCode(''), '');
  assert.equal(normalizeCode(null), '');
});

test('hashCode produces consistent 64-character SHA-256 hex string regardless of format', () => {
  const raw = 'ABCDE23456';
  const formatted = 'abcde-23456';
  const spaced = '  AbCdE 23456  ';

  const hash1 = hashCode(raw);
  const hash2 = hashCode(formatted);
  const hash3 = hashCode(spaced);

  assert.equal(hash1.length, 64);
  assert.equal(hash1, hash2);
  assert.equal(hash2, hash3);
});

test('verifyCode timing-safe comparison verifies matching codes and rejects mismatches', () => {
  const code = 'ABCDE23456';
  const hash = hashCode(code);

  assert.equal(verifyCode('ABCDE-23456', hash), true);
  assert.equal(verifyCode('abcde23456', hash), true);
  assert.equal(verifyCode('  abcde-23456  ', hash), true);

  assert.equal(verifyCode('ABCDE23457', hash), false);
  assert.equal(verifyCode('WRONG-CODE', hash), false);
  assert.equal(verifyCode('', hash), false);
  assert.equal(verifyCode(null, hash), false);
  assert.equal(verifyCode('ABCDE23456', 'invalid-hash'), false);
});

test('isCodeExpired correctly detects past and future dates', () => {
  const now = new Date('2026-10-01T12:00:00.000Z');

  const future = new Date('2026-10-08T12:00:00.000Z').toISOString();
  assert.equal(isCodeExpired(future, now), false);

  const past = new Date('2026-09-30T12:00:00.000Z').toISOString();
  assert.equal(isCodeExpired(past, now), true);

  const exactNow = now.toISOString();
  assert.equal(isCodeExpired(exactNow, now), true);

  assert.equal(isCodeExpired(null, now), true);
  assert.equal(isCodeExpired('invalid-date', now), true);
});

test('calculateExpiryDate defaults to now + 7 days', () => {
  const base = new Date('2026-10-01T12:00:00.000Z');
  const expiryIso = calculateExpiryDate(7, base);
  const expected = new Date('2026-10-08T12:00:00.000Z').toISOString();
  assert.equal(expiryIso, expected);
});
