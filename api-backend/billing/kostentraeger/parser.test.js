// Standalone smoke test for kostentraeger parser + mock dataset.
//   node api-backend/billing/kostentraeger/parser.test.js

import {
  KOSTENTRAEGER_MOCK,
  routeToDatenannahmestelle,
  parseKostentraegerDatei,
  toUpsertRows,
} from './parser.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('kostentraeger.mock');

test('mock has >= 10 KK', () => {
  assert.ok(KOSTENTRAEGER_MOCK.length >= 10);
});

test('every mock entry has IK + name + das_ik', () => {
  for (const k of KOSTENTRAEGER_MOCK) {
    assert.match(k.ik, /^\d{9}$/, `bad IK: ${k.ik}`);
    assert.ok(k.name);
    assert.match(k.das_ik, /^\d{9}$/, `bad DAS-IK: ${k.das_ik}`);
  }
});

test('routeToDatenannahmestelle TK → vdek', () => {
  const r = routeToDatenannahmestelle('101575519');
  assert.equal(r.ok, true);
  assert.equal(r.das_ik, '108036123');
});

test('routeToDatenannahmestelle BAHN-BKK → Davaso (2026 switch)', () => {
  const r = routeToDatenannahmestelle('101317994');
  assert.equal(r.das_ik, '661430035');
  assert.match(r.das_kontakt, /davaso/i);
});

test('routeToDatenannahmestelle unknown IK returns error', () => {
  const r = routeToDatenannahmestelle('999999999');
  assert.equal(r.ok, false);
});

console.log('kostentraeger.parser');

test('parses minimal IDK/VDT/VKG/NAM round-trip', () => {
  const sample =
    "UNA:+,? '" +
    "IDK+107436001+01+AOK Rheinland/Hamburg'" +
    "VDT+20260101+99991231'" +
    "VKG+30+660500345+B'" +
    "IDK+101575519+01+Techniker Krankenkasse'" +
    "VDT+20260101'" +
    "VKG+30+108036123+B'";
  const records = parseKostentraegerDatei(sample);
  assert.equal(records.length, 2);
  assert.equal(records[0].ik, '107436001');
  assert.equal(records[0].name, 'AOK Rheinland/Hamburg');
  assert.equal(records[0].valid_from, '20260101');
  assert.equal(records[0].datenannahmestellen[0].das_ik, '660500345');
  assert.equal(records[1].ik, '101575519');
});

test('toUpsertRows shape matches kostentraeger DB schema', () => {
  const rows = toUpsertRows();
  assert.ok(rows.length === KOSTENTRAEGER_MOCK.length);
  const tk = rows.find(r => r.name === 'Techniker Krankenkasse (TK)');
  assert.deepEqual(Object.keys(tk).sort(),
    ['active','das_ik','ik','name','payer_type','region','valid_from','valid_to'].sort());
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
