import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDtaDecimal, hasKvnrChecksum } from './strict-fields.js';
import { preflight } from './preflight.js';

// Independently published §290 Anlage1 examples, Stand 02.01.2023.
test('KVNR checks published examples and rejects changed check digit', () => {
  for (const value of ['A000500015', 'C000500021']) assert.equal(hasKvnrChecksum(value), true);
  for (const value of ['A000500016', 'C000500022', 'A123456789', 'a000500015', null])
    assert.equal(hasKvnrChecksum(value), false);
});

test('decimal fields reject invalid syntax, precision, sign and overflow', () => {
  for (const value of [0, 9999.99, '1.20']) assert.equal(isDtaDecimal(value, 4), true);
  for (const value of [-1, 10000, 1.001, Infinity, NaN, '', ' ', '1e2', true, null, [], '1,20'])
    assert.equal(isDtaDecimal(value, 4), false, String(value));
  assert.equal(isDtaDecimal('1,20', 4, { comma: true }), true);
  assert.equal(isDtaDecimal(0, 4, { positive: true }), false);
  assert.equal(isDtaDecimal(9999999999.99, 10), true);
  assert.equal(isDtaDecimal(10000000000, 10), false);
});

const base = {
  absender: { ik: '801234561', name: 'Testpraxis' }, empfaenger: { ik: '108310400' },
  rechnung: { sammelRechnungsnummer: 'TEST-1', datum: '2026-05-23', datennummer: 1 },
  vkz: '01', prescriptions: [{
    patient: { kvnr: 'A000500015', versichertenstatus: '10000', nachname: 'Test', vorname: 'Erika', geburtsdatum: '1972-04-13', belegnummer: '1-1' },
    doctor: { lanr: '999999999', bsnr: '999999999' },
    verordnung: { ausstellungsdatum: '2026-05-02', icd10: 'M54.5', diagnosegruppe: 'WS2', verordnungsart: '03', leitsymptomatik: '1010', therapiefrequenz: '3', zuzahlungskennzeichen: '3', kostentraegerIk: '108310400', krankenkasseIk: '108310400' },
    tarif: { abrechnungscode: '22', tarifkennzeichen: '00501' },
    sessions: [{ positionsnummer: '10210', datumLeistung: '2026-05-05', anzahl: 1, einzelbetrag: 22.50, zuzahlungProPos: 2.25 }],
  }],
};

test('strict input baseline is accepted', () => assert.equal(preflight(base).ok, true));

for (const [name, mutate, field] of [
  ['counter fraction', x => { x.rechnung.datennummer = 1.5; }, 'rechnung.datennummer'],
  ['counter text', x => { x.rechnung.datennummer = 'abc'; }, 'rechnung.datennummer'],
  ['missing invoice date', x => { delete x.rechnung.datum; }, 'rechnung.datum'],
  ['impossible invoice date', x => { x.rechnung.datum = '2026-02-30'; }, 'rechnung.datum'],
  ['locale invoice date', x => { x.rechnung.datum = 'May 5 2026'; }, 'rechnung.datum'],
  ['rollover timestamp', x => { x.rechnung.datum = '2026-05-23T24:00:00Z'; }, 'rechnung.datum'],
  ['bad KVNR', x => { x.prescriptions[0].patient.kvnr = 'A000500016'; }, '.patient.kvnr'],
  ['bad card IK', x => { x.prescriptions[0].verordnung.krankenkasseIk = '108310401'; }, '.verordnung.krankenkasseIk'],
  ['missing payer IK', x => { delete x.prescriptions[0].verordnung.kostentraegerIk; }, '.verordnung.kostentraegerIk'],
  ['negative quantity', x => { x.prescriptions[0].sessions[0].anzahl = -1; }, '.anzahl'],
  ['zero quantity', x => { x.prescriptions[0].sessions[0].anzahl = 0; }, '.anzahl'],
  ['oversized price', x => { x.prescriptions[0].sessions[0].einzelbetrag = 1e12; }, '.einzelbetrag'],
  ['copay above price', x => { x.prescriptions[0].sessions[0].zuzahlungProPos = 999; }, '.zuzahlungProPos'],
  ['negative copay', x => { x.prescriptions[0].sessions[0].zuzahlungProPos = -1; }, '.zuzahlungProPos'],
  ['impossible service date', x => { x.prescriptions[0].sessions[0].datumLeistung = '2026-02-30'; }, '.datumLeistung'],
]) test(name, () => {
  const input = structuredClone(base); mutate(input);
  const result = preflight(input);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.where.endsWith(field)), JSON.stringify(result.errors));
});
