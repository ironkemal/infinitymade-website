// Tests fuer die Software-Hersteller-IK-Sperre (compliance/LEGAL_DECISIONS.md, 2026-09-21).
//   node api-backend/billing/dta/software-hersteller-ik.test.js

import {
  SOFTWARE_HERSTELLER_IK,
  istVerbotenerAbsender,
  assertNichtSoftwareHerstellerIkAlsAbsender,
} from './software-hersteller-ik.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('software-hersteller-ik');

test('Konstante trägt die erteilte IK (21.10.2026)', () => {
  assert.equal(SOFTWARE_HERSTELLER_IK, '590537440');
});

test('Echtdatei mit der erteilten IK als Absender wird abgewiesen, Testdatei nicht', () => {
  assert.throws(() => assertNichtSoftwareHerstellerIkAlsAbsender({ kind: 'echt', absenderIk: '590537440' }));
  assert.doesNotThrow(() => assertNichtSoftwareHerstellerIkAlsAbsender({ kind: 'test', absenderIk: '590537440' }));
  assert.doesNotThrow(() => assertNichtSoftwareHerstellerIkAlsAbsender({ kind: 'erprobung', absenderIk: '590537440' }));
});

test('No-Op solange softwareHerstellerIk nicht gesetzt (Standardverhalten)', () => {
  assert.equal(
    istVerbotenerAbsender({ kind: 'echt', absenderIk: '801234565' }),
    false
  );
  assert.doesNotThrow(() =>
    assertNichtSoftwareHerstellerIkAlsAbsender({ kind: 'echt', absenderIk: '801234565' })
  );
});

test('kind !== "echt" ist nie verboten, auch wenn IK übereinstimmt', () => {
  assert.equal(
    istVerbotenerAbsender({ kind: 'test', absenderIk: '801234565', softwareHerstellerIk: '801234565' }),
    false
  );
  assert.equal(
    istVerbotenerAbsender({ kind: 'erprobung', absenderIk: '801234565', softwareHerstellerIk: '801234565' }),
    false
  );
});

test('kind==="echt" + übereinstimmende IK ist verboten, sobald die IK konfiguriert ist', () => {
  assert.equal(
    istVerbotenerAbsender({ kind: 'echt', absenderIk: '801234565', softwareHerstellerIk: '801234565' }),
    true
  );
  assert.throws(
    () => assertNichtSoftwareHerstellerIkAlsAbsender({
      kind: 'echt', absenderIk: '801234565', softwareHerstellerIk: '801234565',
    }),
    /Software-Hersteller-IK/
  );
});

test('assertNichtSoftwareHerstellerIkAlsAbsender wirft NICHT ohne explizite softwareHerstellerIk (heutiger Produktionszustand)', () => {
  assert.doesNotThrow(() =>
    assertNichtSoftwareHerstellerIkAlsAbsender({ kind: 'echt', absenderIk: '801234565' })
  );
});

test('kind==="echt" + andere IK ist erlaubt', () => {
  assert.equal(
    istVerbotenerAbsender({ kind: 'echt', absenderIk: '999999999', softwareHerstellerIk: '801234565' }),
    false
  );
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
