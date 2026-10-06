// module/setup-fragment.test.js — Tests fuer jetonAusHash. Lauf: node --test module/setup-fragment.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jetonAusHash } from './setup-fragment.js';

test('leere oder ungueltige Hash-Eingaben liefern null', () => {
  assert.equal(jetonAusHash(''), null);
  assert.equal(jetonAusHash('#'), null);
  assert.equal(jetonAusHash(null), null);
  assert.equal(jetonAusHash(undefined), null);
  assert.equal(jetonAusHash('#   '), null);
});

test('zu kurze Hashes liefern null', () => {
  assert.equal(jetonAusHash('#abc'), null);
  assert.equal(jetonAusHash('#' + 'a'.repeat(15)), null);
});

test('gueltiger 48-Hex-Jeton (install.sh openssl rand -hex 24) wird extrahiert', () => {
  const hex48 = '0123456789abcdef0123456789abcdef0123456789abcdef';
  assert.equal(jetonAusHash('#' + hex48), hex48);
});

test('ungueltiges URL-Encoding wirft keine Exception und liefert null', () => {
  assert.doesNotThrow(() => {
    assert.equal(jetonAusHash('#%ZZ'), null);
  });
});

test('fuehrende und nachfolgende Leerzeichen werden getrimmt', () => {
  const hex48 = '0123456789abcdef0123456789abcdef0123456789abcdef';
  assert.equal(jetonAusHash('#  ' + hex48 + '  '), hex48);
  assert.equal(jetonAusHash('#%20' + hex48 + '%20'), hex48);
});

test('Nicht-Hex-Zeichen liefern null', () => {
  assert.equal(jetonAusHash('#' + 'g'.repeat(48)), null);
  assert.equal(jetonAusHash('#0123456789abcdef0123456789abcdef!'), null);
  assert.equal(jetonAusHash('#0123456789abcdef 0123456789abcdef'), null);
});

test('Gross- und Kleinbuchstaben im Hex-String sind zulaessig', () => {
  const mixedHex = '0123456789ABCDEF0123456789abcdef0123456789ABCDEF';
  assert.equal(jetonAusHash('#' + mixedHex), mixedHex);
});

test('Grenzwerte der Laenge: 16 bis 128 Hex-Zeichen', () => {
  const hex16 = '0123456789abcdef';
  assert.equal(jetonAusHash('#' + hex16), hex16);

  const hex128 = 'a'.repeat(128);
  assert.equal(jetonAusHash('#' + hex128), hex128);

  const hex129 = 'a'.repeat(129);
  assert.equal(jetonAusHash('#' + hex129), null);
});

test('Hash ohne fuehrendes Raute-Zeichen wird ebenfalls verarbeitet', () => {
  const hex48 = '0123456789abcdef0123456789abcdef0123456789abcdef';
  assert.equal(jetonAusHash(hex48), hex48);
});
