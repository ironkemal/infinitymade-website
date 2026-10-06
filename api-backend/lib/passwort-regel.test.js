import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_INHABER, MIN_MITARBEITER, minPasswortLaenge, pruefePasswort } from './passwort-regel.js';

test('Konstanten: Inhaber 12, Mitarbeiter 8', () => {
  assert.equal(MIN_INHABER, 12);
  assert.equal(MIN_MITARBEITER, 8);
});

test('minPasswortLaenge: employee -> 8, owner -> 12, unbekannt/undefined -> 12', () => {
  assert.equal(minPasswortLaenge('employee'), 8);
  assert.equal(minPasswortLaenge('owner'), 12);
  assert.equal(minPasswortLaenge(undefined), 12);
  assert.equal(minPasswortLaenge(null), 12);
  assert.equal(minPasswortLaenge('admin'), 12);
  assert.equal(minPasswortLaenge(''), 12);
});

test('pruefePasswort: owner 11 -> Fehler, owner 12 -> null', () => {
  assert.equal(pruefePasswort('owner', '12345678901'), 'Das Passwort muss mindestens 12 Zeichen lang sein.');
  assert.equal(pruefePasswort('owner', '123456789012'), null);
});

test('pruefePasswort: employee 7 -> Fehler, employee 8 -> null', () => {
  assert.equal(pruefePasswort('employee', '1234567'), 'Das Passwort muss mindestens 8 Zeichen lang sein.');
  assert.equal(pruefePasswort('employee', '12345678'), null);
});

test('pruefePasswort: unbekannt / undefined -> strengere Regel (12 Zeichen)', () => {
  assert.equal(pruefePasswort(undefined, '12345678901'), 'Das Passwort muss mindestens 12 Zeichen lang sein.');
  assert.equal(pruefePasswort(undefined, '123456789012'), null);
  assert.equal(pruefePasswort('x', '12345678901'), 'Das Passwort muss mindestens 12 Zeichen lang sein.');
  assert.equal(pruefePasswort('x', '123456789012'), null);
});

test('pruefePasswort: Nicht-String -> Fehler', () => {
  assert.equal(pruefePasswort('owner', null), 'Das Passwort muss mindestens 12 Zeichen lang sein.');
  assert.equal(pruefePasswort('employee', null), 'Das Passwort muss mindestens 8 Zeichen lang sein.');
  assert.equal(pruefePasswort('employee', undefined), 'Das Passwort muss mindestens 8 Zeichen lang sein.');
  assert.equal(pruefePasswort('employee', 12345678), 'Das Passwort muss mindestens 8 Zeichen lang sein.');
  assert.equal(pruefePasswort('employee', {}), 'Das Passwort muss mindestens 8 Zeichen lang sein.');
});
