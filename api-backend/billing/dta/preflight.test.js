// Tests for §302 SGB V Preflight Validator.
//   node api-backend/billing/dta/preflight.test.js

import {
  preflight,
  isValidIkChecksum,
  isValidKvnr,
  isValidVersichertenstatus,
  isValidLanr,
  isValidIcd10,
  isValidDiagnosegruppe,
  isValidTarifkennzeichen,
  ikKlassifikation,
} from './preflight.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('atomic checks');
test('IK checksum: AOK Bayern 108310400 valid',  () => assert.equal(isValidIkChecksum('108310400'), true));
test('IK checksum: 101234561 valid',             () => assert.equal(isValidIkChecksum('101234561'), true));
test('IK checksum: 123456789 invalid (synthetic)', () => assert.equal(isValidIkChecksum('123456789'), false));
test('IK checksum: too short',                    () => assert.equal(isValidIkChecksum('12345'), false));
test('IK Klassifikation Kostenträger',  () => assert.equal(ikKlassifikation('108310400'), 'kostentraeger'));
test('IK Klassifikation Leistungserbringer', () => assert.equal(ikKlassifikation('801234561'), 'leistungserbringer'));

test('KVNR valid format',     () => assert.equal(isValidKvnr('A123456789'), true));
test('KVNR rejects lowercase', () => assert.equal(isValidKvnr('a123456789'), false));
test('KVNR rejects no letter', () => assert.equal(isValidKvnr('1123456789'), false));

test('Versichertenstatus 10000 valid',  () => assert.equal(isValidVersichertenstatus('10000'), true));
test('Versichertenstatus 30000 valid',  () => assert.equal(isValidVersichertenstatus('30000'), true));
test('Versichertenstatus 20000 invalid', () => assert.equal(isValidVersichertenstatus('20000'), false));

test('LANR dummy 999999900 allowed',   () => assert.equal(isValidLanr('999999900'), true));
test('LANR too short rejected',        () => assert.equal(isValidLanr('12345'), false));

test('ICD-10 M54.5 valid',             () => assert.equal(isValidIcd10('M54.5'), true));
test('ICD-10 with modifier valid',     () => assert.equal(isValidIcd10('M54.5G'), true));
test('ICD-10 bare letter invalid',     () => assert.equal(isValidIcd10('M'), false));

test('Diagnosegruppe WS2 valid',       () => assert.equal(isValidDiagnosegruppe('WS2'), true));
test('Diagnosegruppe EX2a valid',      () => assert.equal(isValidDiagnosegruppe('EX2a'), true));
test('Diagnosegruppe X invalid',       () => assert.equal(isValidDiagnosegruppe('X'), false));

test('Tarifkennzeichen 02001 valid',   () => assert.equal(isValidTarifkennzeichen('02001'), true));
test('Tarifkennzeichen 99001 invalid', () => assert.equal(isValidTarifkennzeichen('99001'), false));
test('Tarifkennzeichen wrong len',     () => assert.equal(isValidTarifkennzeichen('0200'), false));

// ---------------------------------------------------------------------------

console.log('preflight — happy path');

const validInput = {
  absender:   { ik: '801234561', name: 'Physiopraxis Test' },
  empfaenger: { ik: '108310400', name: 'AOK Bayern' },
  rechnung: { sammelRechnungsnummer: 'R2026-W21-001', datum: '2026-05-23', datennummer: 1, rechnungsart: '1' },
  vkz: '01',
  prescriptions: [{
    patient: { kvnr: 'A123456789', versichertenstatus: '10000', nachname: 'Müller', vorname: 'Hans',
               geburtsdatum: '1972-04-13', plz: '40213', belegnummer: '0000001' },
    doctor: { lanr: '999999900', bsnr: '999999999' },
    verordnung: { ausstellungsdatum: '2026-05-02', icd10: 'M54.5', diagnosegruppe: 'WS2',
                  verordnungsart: '03', leitsymptomatik: '1010', therapiefrequenz: '3',
                  zuzahlungskennzeichen: '0', kostentraegerIk: '108310400' },
    tarif: { abrechnungscode: '22', tarifkennzeichen: '02001' },
    sessions: ['2026-05-05','2026-05-07','2026-05-12','2026-05-14','2026-05-19','2026-05-21']
      .map(d => ({ positionsnummer: '10210', datumLeistung: d, anzahl: 1, einzelbetrag: 22.50, zuzahlungProPos: 2.25 })),
  }],
};

test('valid prescription passes preflight', () => {
  const r = preflight(validInput);
  if (!r.ok) console.log('       got errors:', r.errors);
  assert.equal(r.ok, true);
  assert.equal(r.errors.length, 0);
});

test('totals computed', () => {
  const r = preflight(validInput);
  assert.equal(r.totals.brutto, 135.00);
  assert.equal(r.totals.zuzahlung, 23.50);
  assert.equal(r.totals.netto, 111.50);
});

// ---------------------------------------------------------------------------

console.log('preflight — failure modes');

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function hasErr(r, code) { return r.errors.some(e => e.code === code); }

test('catches missing absender IK', () => {
  const i = clone(validInput); delete i.absender.ik;
  const r = preflight(i);
  assert.equal(r.ok, false);
  assert.ok(hasErr(r, 'F:01001'));
});

test('catches bad IK checksum on absender', () => {
  const i = clone(validInput); i.absender.ik = '123456789';
  const r = preflight(i);
  assert.equal(r.ok, false);
  assert.ok(hasErr(r, 'F:01003'));
});

test('catches bad IK checksum on empfaenger', () => {
  const i = clone(validInput); i.empfaenger.ik = '987654321';
  const r = preflight(i);
  assert.ok(hasErr(r, 'F:02003'));
});

test('catches malformed KVNR', () => {
  const i = clone(validInput); i.prescriptions[0].patient.kvnr = '123456789';
  const r = preflight(i);
  assert.ok(hasErr(r, 'P:01001'));
});

test('catches missing belegnummer', () => {
  const i = clone(validInput); delete i.prescriptions[0].patient.belegnummer;
  const r = preflight(i);
  assert.ok(hasErr(r, 'P:01006'));
});

test('catches duplicate belegnummer in same Sammel', () => {
  const i = clone(validInput);
  i.prescriptions.push(clone(i.prescriptions[0]));  // same belegnummer 0000001
  const r = preflight(i);
  assert.ok(hasErr(r, 'P:01007'));
});

test('catches invalid ICD-10', () => {
  const i = clone(validInput); i.prescriptions[0].verordnung.icd10 = 'XYZ';
  const r = preflight(i);
  assert.ok(hasErr(r, 'V:01002'));
});

test('catches invalid Verordnungsart', () => {
  const i = clone(validInput); i.prescriptions[0].verordnung.verordnungsart = '99';
  const r = preflight(i);
  assert.ok(hasErr(r, 'V:01004'));
});

test('catches non-Heilmittel Abrechnungscode', () => {
  const i = clone(validInput); i.prescriptions[0].tarif.abrechnungscode = '14';
  const r = preflight(i);
  assert.ok(hasErr(r, 'T:01002'));
});

test('catches Leistung before Ausstellung', () => {
  const i = clone(validInput);
  i.prescriptions[0].sessions[0].datumLeistung = '2026-04-30';
  const r = preflight(i);
  assert.ok(hasErr(r, 'S:01004'));
});

test('catches Leistung in der Zukunft', () => {
  const i = clone(validInput);
  i.prescriptions[0].sessions[0].datumLeistung = '2099-01-01';
  const r = preflight(i);
  assert.ok(hasErr(r, 'S:01005'));
});

test('catches negative einzelbetrag', () => {
  const i = clone(validInput);
  i.prescriptions[0].sessions[0].einzelbetrag = -10;
  const r = preflight(i);
  assert.ok(hasErr(r, 'S:01007'));
});

test('warns on suspicious Zuzahlung-Summe', () => {
  const i = clone(validInput);
  i.prescriptions[0].sessions.forEach(s => { s.zuzahlungProPos = 5.00; });  // way over 10%
  const r = preflight(i);
  assert.ok(r.warnings.some(w => w.code === 'S:01009'));
});

test('catches empty prescriptions array', () => {
  const i = clone(validInput); i.prescriptions = [];
  const r = preflight(i);
  assert.ok(hasErr(r, 'F:05001'));
});

test('blocks validation if physician report is requested but status is not completed', () => {
  const i = clone(validInput);
  i.prescriptions[0].verordnung.berichtAngefordert = true;
  i.prescriptions[0].verordnung.berichtStatus = 'offen';
  const r = preflight(i);
  assert.equal(r.ok, false);
  assert.ok(hasErr(r, 'V:01009'));
});

test('allows validation if physician report is requested and status is completed', () => {
  const i = clone(validInput);
  i.prescriptions[0].verordnung.berichtAngefordert = true;
  i.prescriptions[0].verordnung.berichtStatus = 'erledigt';
  const r = preflight(i);
  assert.equal(r.ok, true);
});

test('allows validation if physician report is not requested', () => {
  const i = clone(validInput);
  i.prescriptions[0].verordnung.berichtAngefordert = false;
  i.prescriptions[0].verordnung.berichtStatus = 'offen';
  const r = preflight(i);
  assert.equal(r.ok, true);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
