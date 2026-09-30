/**
 * icd-dg-match.test.js — Tests fuer passendeUnterkodes (Aufgabe W1).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { passendeUnterkodes } from '../icd-dg-match.js';

const RULE_DF = {
  icd_accept: [{ re: '^E1[0-4]\\.7[45]$' }, { re: '^E1[0-4]\\.4[01]$' }, { re: '^G63\\.2\\*?$' }],
  icd_exclude: [],
  icd_auto_select: [{ re: '^E1[0-4]\\.7[45]$' }],
  icd_enforcement: 'warn',
};

const RULE_UI1 = {
  icd_accept: [{ re: '^L60\\.0$' }],
  icd_exclude: [],
  icd_enforcement: 'hard_before_dta',
};

const RULE_WITH_EXCLUDE = {
  icd_accept: [{ re: '^E11\\.7[0-9]$' }],
  icd_exclude: [{ re: '^E11\\.70$' }],
  icd_enforcement: 'warn',
};

test('passendeUnterkodes: 4-stellig E11.7 liefert E11.74 und E11.75 fuer DF', () => {
  const kinder = passendeUnterkodes('E11.7', RULE_DF);
  assert.deepEqual(kinder, ['E11.74', 'E11.75']);
});

test('passendeUnterkodes: 3-stellig E11 liefert 4- und 5-stellige passende Kinder', () => {
  const kinder = passendeUnterkodes('E11', RULE_DF);
  assert.deepEqual(kinder, ['E11.40', 'E11.41', 'E11.74', 'E11.75']);
});

test('passendeUnterkodes: 5-stelliger Kode hat keine Kinder', () => {
  assert.deepEqual(passendeUnterkodes('E11.74', RULE_DF), []);
  assert.deepEqual(passendeUnterkodes('E11.75', RULE_DF), []);
});

test('passendeUnterkodes: Kodes mit Sonderzeichen (†*!) am Ende haben keine Kinder', () => {
  assert.deepEqual(passendeUnterkodes('E11.7*', RULE_DF), []);
  assert.deepEqual(passendeUnterkodes('G63.2*', RULE_DF), []);
  assert.deepEqual(passendeUnterkodes('E11.7!', RULE_DF), []);
  assert.deepEqual(passendeUnterkodes('E11.7†', RULE_DF), []);
});

test('passendeUnterkodes: Bindestrich am Ende wird normalisiert', () => {
  assert.deepEqual(passendeUnterkodes('E11.7-', RULE_DF), ['E11.74', 'E11.75']);
  assert.deepEqual(passendeUnterkodes('E11.-', RULE_DF), ['E11.40', 'E11.41', 'E11.74', 'E11.75']);
});

test('passendeUnterkodes: 3-stelliger Kode fuer UI1 liefert L60.0', () => {
  assert.deepEqual(passendeUnterkodes('L60', RULE_UI1), ['L60.0']);
});

test('passendeUnterkodes: wenn keine Kinder passen -> leere Liste', () => {
  assert.deepEqual(passendeUnterkodes('L60.0', RULE_DF), []);
  assert.deepEqual(passendeUnterkodes('M54.5', RULE_DF), []);
  assert.deepEqual(passendeUnterkodes('M54', RULE_DF), []);
});

test('passendeUnterkodes: beachtet icd_exclude', () => {
  const kinder = passendeUnterkodes('E11.7', RULE_WITH_EXCLUDE);
  assert.ok(!kinder.includes('E11.70'), 'E11.70 ist ausgeschlossen');
  assert.ok(kinder.includes('E11.71'));
});

test('passendeUnterkodes: leere/ungueltige Eingaben liefern leere Liste', () => {
  assert.deepEqual(passendeUnterkodes('', RULE_DF), []);
  assert.deepEqual(passendeUnterkodes(null, RULE_DF), []);
  assert.deepEqual(passendeUnterkodes('E11.7', null), []);
  assert.deepEqual(passendeUnterkodes('E11.7', { icd_accept: [] }), []);
  assert.deepEqual(passendeUnterkodes('UNGÜLTIG', RULE_DF), []);
});
