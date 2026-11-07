import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeDatenstrom } from './preflight.js';
import { buildDtaFile } from './builder.js';
import { podoFixture } from './fixtures.js';

// Handwritten byte string and cent totals, independent of production builder.
// Artificial identities/prices: syntax fixture, not contractual entitlement.
const VALID = "UNB+UNOC:3+801234561+108310400+20260523:1200+00001+B+SL123456S05+0'"
  + "UNH+00001+SLGA:21:0:0'FKT+01++801234561+108310400+108310400+801234561'REC+R1:0+20260523+1'GES+00+80,00+100,00+20,00'GES+11+80,00+100,00+20,00'NAM+Testpraxis'UNT+000007+00001'"
  + "UNH+00002+SLLA:21:0:0'FKT+01++801234561+108310400+108310400'REC+R1:0+20260523+1'INV+A000500015+10000++1-1'NAD+Test+Person+19700101'EHE+22:00501+10210+2,00+50,00+20260522+5,00'ZHE+999999999+999999999+20260501+3+WS+03+++++++1010++0+1+3'DIA+M54.5'BES+100,00+20,00+10,00+10,00'UNT+000010+00002'UNZ+000002+00001'";

test('independent syntactic fixture has 2 messages and 19 real segments', () => {
  assert.deepEqual(pruefeDatenstrom(VALID), { segmente: 19, nachrichten: 2 });
});

for (const [name, mutate] of [
  ['message version', s => s.replace('SLLA:21:0:0', 'SLLA:99:0:0')],
  ['unknown segment', s => s.replace('NAD+Test', 'BOG+Test')],
  ['UNZ reference', s => s.replace("UNZ+000002+00001'", "UNZ+000002+99999'")],
  ['noninteger reference', s => s.replace('+00001+B+', '+001.5+B+')],
  ['missing invoice date', s => s.replace('REC+R1:0+20260523+1', 'REC+R1:0++1')],
  ['invalid calendar performance date', s => s.replace('+20260522+5,00', '+20260230+5,00')],
  ['negative quantity', s => s.replace('+2,00+50,00', '+-2,00+50,00')],
  ['oversized amount', s => s.replace('+50,00+', '+10000000000,00+')],
  ['BES gross mismatch', s => s.replace('BES+100,00', 'BES+99,00')],
  ['GES status mismatch', s => s.replace('GES+11+80,00', 'GES+11+79,00')],
  ['copay parts mismatch', s => s.replace('BES+100,00+20,00', 'BES+100,00+21,00')],
  ['Unicode loss', s => s.replace('NAD+Test', 'NAD+Test😀')],
  ['control byte', s => s.replace('NAD+Test', 'NAD+Test\n')],
  ['missing final terminator', s => s.slice(0, -1)],
  ['data after UNZ', s => s + "NAM+oops'"],
  ['empty insured identity', s => s.replace('INV+A000500015', 'INV+')],
  ['unknown insured status', s => s.replace('+10000++1-1', '+20000++1-1')],
  ['arbitrary ZHE fields', s => s.replace('ZHE+999999999+999999999+20260501+3+WS+03+++++++1010++0+1+3', 'ZHE+abc+def+20260501+9+WHATEVER+99+++++++ABCD++9+9+9')],
  ['invalid ZHE copay key', s => s.replace('+20260501+3+WS+', '+20260501+9+WS+')],
  ['invalid ZHE area', s => s.replace('1010++0+1+3', '1010++0+9+3')],
  ['invalid ZHE symptom key', s => s.replace('1010++0+1+3', 'ABCD++0+1+3')],
  ['invalid ZHE doctor id', s => s.replace('ZHE+999999999+', 'ZHE+abc+')],
  ['invalid ZHE BVG/SER key', s => s.replace('+WS+03+++++++1010', '+WS+03+++9++++1010')],
  ['inflated GES summary and status together', s => s.replaceAll('+80,00+100,00+20,00', '+999,00+999,00+999,00')],
  ['wrong SLLA payer reference', s => s.replace("FKT+01++801234561+108310400+108310400'", "FKT+01++801234561+109999999+108310400'")],
  ['wrong SLLA invoice reference', s => s.replace("REC+R1:0+20260523+1'INV", "REC+R2:0+20260523+1'INV")],
]) test(`mutation rejects ${name}`, () => assert.throws(() => pruefeDatenstrom(mutate(VALID)), { code: 'DTA_SELBSTPRUEFUNG' }));

test('independent VKZ03 GES reconciles against GZF, not original service gross', () => {
  const claim = VALID.replaceAll('FKT+01', 'FKT+03')
    .replaceAll('+80,00+100,00+20,00', '+20,00+0,00+20,00')
    .replace("NAD+Test", "URI+801234561+ORIG1:0+20260501+1-1'NAD+Test")
    .replace('BES+100,00+20,00+10,00+10,00', 'GZF+20,00+10,00+10,00')
    .replace('UNT+000010+00002', 'UNT+000011+00002');
  assert.equal(pruefeDatenstrom(claim).nachrichten, 2);
  assert.throws(() => pruefeDatenstrom(claim.replaceAll('+20,00+0,00+20,00', '+999,00+0,00+999,00')), /SLGA-GES stimmt nicht/);
});

test('cannot bypass mandatory output grammar with obsolete minimal file', () => {
  assert.throws(() => pruefeDatenstrom("UNB'UNH+00001+SLLA:99:0:0'BOG+invalid'UNT+000003+00001'UNZ+000001+WRONG'"));
});

test('builder cannot diverge UNB application reference from order filename', () => {
  const input = structuredClone(podoFixture);
  input.rechnung.anwendungsreferenz = 'SL000000S01';
  assert.throws(() => buildDtaFile(input), /Anwendungsreferenz/);
});

test('escaped apostrophe counts once as text, not as segment', () => {
  const input = structuredClone(podoFixture);
  input.prescriptions[0].patient.nachname = "O'Neil";
  const dta = buildDtaFile(input);
  assert.ok(dta.content.includes("O?'Neil"));
  assert.equal(dta.segmentCount, 19);
});

test('builder cannot silently truncate non-Latin-1 name into bytes', () => {
  const input = structuredClone(podoFixture);
  input.prescriptions[0].patient.nachname = 'Test😀';
  assert.throws(() => buildDtaFile(input), /ISO-8859-1/);
});

test('missing per-position copay is emitted using same fallback as totals', () => {
  const input = structuredClone(podoFixture);
  delete input.prescriptions[0].sessions[0].zuzahlungProPos;
  const dta = buildDtaFile(input);
  assert.ok(dta.content.includes('EHE+71:00501+78010+1,00+28,90+20260828+2,89'));
  assert.equal(dta.totals.fallTotals[0].prozZuzahlung, 2.89);
});
