import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attachLeadKartenIk } from './lead-karten-ik.js';

function umgebung() {
  const hoerer = [];
  const kasse = { id: 'lead-krankenkasse', dataset: {}, addEventListener: (t, f) => hoerer.push([t, f]) };
  const ik = { id: 'lead-krankenkasseIk', value: 'x' };
  globalThis.document = { getElementById: id => (id === 'lead-krankenkasseIk' ? ik : null) };
  const tippen = () => hoerer.filter(([t]) => t === 'input').forEach(([, f]) => f());
  return { kasse, ik, hoerer, tippen };
}

test('lädt den gespeicherten Wert, leer wenn keiner da', () => {
  const { kasse, ik } = umgebung();
  attachLeadKartenIk(kasse, '108310400');
  assert.equal(ik.value, '108310400');
  attachLeadKartenIk(kasse, null);
  assert.equal(ik.value, '');
});

test('Kasse von Hand geändert → Karten-IK leer; Listener nur einmal', () => {
  const { kasse, ik, hoerer, tippen } = umgebung();
  attachLeadKartenIk(kasse, '108310400');
  attachLeadKartenIk(kasse, '108310400');
  assert.equal(hoerer.length, 1);
  tippen();
  assert.equal(ik.value, '');
});

test('ohne Geschwisterfeld passiert nichts', () => {
  const { kasse } = umgebung();
  globalThis.document = { getElementById: () => null };
  assert.doesNotThrow(() => attachLeadKartenIk(kasse, '108310400'));
});
