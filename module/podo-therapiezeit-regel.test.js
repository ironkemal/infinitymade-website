import test from 'node:test';
import assert from 'node:assert/strict';
import { therapiezeitWert, positionAusTherapiezeit, therapiezeitPflicht, therapiezeitFehler, therapiezeitFuerSpeichern } from './podo-therapiezeit-regel.js';

test('positionAusTherapiezeit: Grenze strikt über 20', () => {
  assert.equal(positionAusTherapiezeit(20), '78010');
  assert.equal(positionAusTherapiezeit(21), '78020');
  assert.equal(positionAusTherapiezeit('45'), '78020');
  assert.equal(positionAusTherapiezeit(1), '78010');
  assert.equal(positionAusTherapiezeit(600), '78020');
});

test('therapiezeitWert: nur ganze Minuten 1..600', () => {
  for (const x of ['', null, undefined, 0, -5, 601, 12.5, '1,5', 'abc', ' ']) assert.equal(therapiezeitWert(x), null, String(x));
  assert.equal(therapiezeitWert(' 30 '), 30);
  assert.equal(positionAusTherapiezeit(''), '');
});

test('therapiezeitPflicht: nur c) mit Behandlungsposition', () => {
  assert.equal(therapiezeitPflicht('c', ['78010']), true);
  assert.equal(therapiezeitPflicht('c', ['78020', '78030']), true);
  assert.equal(therapiezeitPflicht('c', ['78030']), false);   // reiner Befundtag
  assert.equal(therapiezeitPflicht('a', ['78010']), false);
  assert.equal(therapiezeitPflicht('', ['78010']), false);
});

test('therapiezeitFehler: fehlend, falsche Position, beide, korrekt', () => {
  assert.match(therapiezeitFehler({ massnahme: 'c', checks: ['78010'], minuten: '' }), /Therapiezeit/);
  assert.match(therapiezeitFehler({ massnahme: 'c', checks: ['78010'], minuten: 30 }), /78020 abzurechnen/);
  assert.match(therapiezeitFehler({ massnahme: 'c', checks: ['78020'], minuten: 15 }), /78010 abzurechnen/);
  assert.match(therapiezeitFehler({ massnahme: 'c', checks: ['78010', '78020'], minuten: 30 }), /78010 abwählen/);
  assert.equal(therapiezeitFehler({ massnahme: 'c', checks: ['78010', '78030'], minuten: 20 }), '');
  assert.equal(therapiezeitFehler({ massnahme: 'c', checks: ['78020'], minuten: 21 }), '');
  assert.equal(therapiezeitFehler({ massnahme: 'b', checks: ['78010'], minuten: '' }), '');
  assert.equal(therapiezeitFehler({ massnahme: 'c', checks: ['78030'], minuten: '' }), '');
});

test('therapiezeitFuerSpeichern: nur bei c)', () => {
  assert.equal(therapiezeitFuerSpeichern('c', '25'), 25);
  assert.equal(therapiezeitFuerSpeichern('c', ''), null);
  assert.equal(therapiezeitFuerSpeichern('a', 25), null);
});
