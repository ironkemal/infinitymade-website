import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialen } from './kopf-profil.js';

test('initialen: Vor- und Nachname, Mittelnamen übersprungen', () => {
  assert.equal(initialen('Ines Inhaberin'), 'II');
  assert.equal(initialen('Anna Maria Beispiel'), 'AB');
  assert.equal(initialen('özlem'), 'Ö');
});

test('initialen: E-Mail, leer, nur Zeichen', () => {
  assert.equal(initialen('max.muster@example.invalid'), 'MM');
  assert.equal(initialen(''), '');
  assert.equal(initialen(undefined), '');
  assert.equal(initialen('— 123'), '');
});
