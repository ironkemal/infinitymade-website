// Standalone smoke test for physio_positions module.
//   node api-backend/billing/codes/physio_positions.test.js

import {
  PHYSIO_POSITIONS, PHYSIO_POSITION_COUNT,
  resolvePositionsnummer, findPosition,
} from './physio_positions.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('physio_positions');

test('58 positions defined', () => assert.equal(PHYSIO_POSITION_COUNT, 58));

test('X→2 substitution for Physio (code 22)', () => {
  assert.equal(resolvePositionsnummer('X0501', '22'), '20501');
  assert.equal(resolvePositionsnummer('X0201', '22'), '20201');
});

test('X→1 for Masseur (code 21)', () => {
  assert.equal(resolvePositionsnummer('X0501', '21'), '10501');
});

test('X→6 for Krankenhaus (code 27)', () => {
  assert.equal(resolvePositionsnummer('X0501', '27'), '60501');
});

test('Hebammen positions (21901/21904) bypass substitution', () => {
  assert.equal(resolvePositionsnummer('21901', '22'), '21901');
  assert.equal(resolvePositionsnummer('21904', '22'), '21904');
});

test('already-resolved code passes through', () => {
  assert.equal(resolvePositionsnummer('20501', '22'), '20501');
});

test('unknown Abrechnungscode throws', () => {
  assert.throws(() => resolvePositionsnummer('X0501', '14'), /Unknown Heilmittel-Abrechnungscode/);
});

test('invalid format throws', () => {
  assert.throws(() => resolvePositionsnummer('foo', '22'), /Unrecognized Positionsnummer/);
});

test('findPosition by template', () => {
  const p = findPosition('X0501', '22');
  assert.equal(p.label, 'Allgemeine Krankengymnastik (KG) Einzel');
  assert.equal(p.preis, 29.63);
  assert.equal(p.positionsnummer, '20501');
});

test('findPosition by resolved code', () => {
  const p = findPosition('20702', '22');
  assert.equal(p.label, 'KG-Muko Einzel');
  assert.equal(p.preis, 88.94);
});

test('findPosition KG-ZNS-Kinder has no Zuzahlung', () => {
  const p = findPosition('X0708', '22');
  assert.equal(p.zuzahlung, null);
});

test('all positions have valid X-template or numeric', () => {
  for (const p of PHYSIO_POSITIONS) {
    assert.ok(/^X\d{4}$/.test(p.x) || /^\d{5}$/.test(p.x), `bad template: ${p.x}`);
    assert.ok(p.preis > 0, `${p.x} missing preis`);
  }
});

test('Hausbesuch flag set on X9922/X9950/X9951', () => {
  for (const code of ['X9922', 'X9950', 'X9951']) {
    const p = findPosition(code, '22');
    assert.equal(p.hausbesuch, true, `${code} should be hausbesuch=true`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
