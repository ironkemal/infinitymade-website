// Smoke test for Anlage 1 V21 EDIFACT builder.
//   node api-backend/billing/dta/smoke.test.js

import { buildDtaFile } from './builder.js';
import { escapeEdifact, fmtAmount, fmtDate, UNA_HEADER, buildSegment } from './encoding.js';
import { buildDtaFilename } from './filename.js';
import { buildUNB, buildUNH, buildUNT, buildUNZ } from './envelope.js';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); fail++; }
}

console.log('encoding');
test('escapes reserved chars', () => assert.equal(escapeEdifact("O'Brien+Co"), "O?'Brien?+Co"));
test('release-char self-escape', () => assert.equal(escapeEdifact('a?b'), 'a??b'));
test('amount with comma', () => assert.equal(fmtAmount(12.5), '12,50'));
test('date YYYYMMDD', () => assert.equal(fmtDate('2026-05-18'), '20260518'));
test('UNA is 9 chars', () => assert.equal(UNA_HEADER.length, 9));
test('buildSegment trims trailing empties', () =>
  assert.equal(buildSegment('X', ['a', 'b', '', '']), "X+a+b'"));
test('buildSegment keeps middle empty', () =>
  assert.equal(buildSegment('X', ['a', '', 'c']), "X+a++c'"));

console.log('envelope');
test('UNB carries UNOC:3 + B + testindikator', () => {
  const unb = buildUNB({
    absenderIk:   '123456789',
    empfaengerIk: '987654321',
    erstellungsdatum: '2026-05-18T08:30:00Z',
    datennummer: 7,
    leistungsbereich: 'B',
    anwendungsreferenz: 'EHK5678900000007',
    testIndikator: '2',
  });
  assert.ok(unb.startsWith('UNB+UNOC:3+123456789+987654321+20260518:0830+00007+B+EHK5678900000007+2'), unb);
});
test('UNH SLLA:21:0:0', () => {
  assert.equal(buildUNH({ nachrichtenreferenz: 2, nachrichtenart: 'SLLA' }),
               "UNH+00002+SLLA:21:0:0'");
});
test('UNT echoes count + ref', () => {
  assert.equal(buildUNT({ segmentCount: 15, nachrichtenreferenz: 2 }), "UNT+15+00002'");
});
test('UNZ', () => {
  assert.equal(buildUNZ({ messageCount: 4, datennummer: 7 }), "UNZ+4+00007'");
});

console.log('filename');
test('echt EHK', () => assert.equal(
  buildDtaFilename({ absenderIk: '123456789', laufendeNummer: 23 }), 'EHK5678900000023'));
test('test EHM', () => assert.equal(
  buildDtaFilename({ absenderIk: '123456789', laufendeNummer: 1, kind: 'test' }), 'EHM5678900000001'));

console.log('builder — V21 Heilmittel');
const result = buildDtaFile({
  preflight: false,  // smoke test uses synthetic IKs; preflight is covered in preflight.test.js
  absender:   { ik: '123456789', name: 'Physiopraxis Müller' },
  empfaenger: { ik: '987654321', name: 'AOK DAS' },
  rechnung: {
    sammelRechnungsnummer: 'R2026-W20-001',
    einzelRechnungsnummer: '0',
    datum: '2026-05-18',
    datennummer: 23,
    rechnungsart: '1',
  },
  kind: 'echt',
  vkz: '01',
  prescriptions: [{
    patient: {
      kvnr: 'A123456789',
      versichertenstatus: '10000',
      nachname: 'Müller',
      vorname: 'Hans',
      geburtsdatum: '1972-04-13',
      strasse: 'Königsallee 1',
      plz: '40213',
      ort: 'Düsseldorf',
      belegnummer: '0000001',
    },
    doctor: { lanr: '999999900', bsnr: '180000700' },
    verordnung: {
      ausstellungsdatum: '2026-05-02',
      icd10: 'M54.5',
      diagnosegruppe: 'WS2',
      verordnungsart: '03',
      leitsymptomatik: '1010',
      dringend: false,
      hausbesuch: false,
      heilmittelBereich: '1',
      therapiefrequenz: '3',
      zuzahlungskennzeichen: '0',
      kostentraegerIk: '101000000',
      krankenkasseIk:  '101000000',
    },
    tarif: { abrechnungscode: '22', tarifkennzeichen: '01001' },
    sessions: ['2026-05-05','2026-05-07','2026-05-12','2026-05-14','2026-05-19','2026-05-21']
      .map(d => ({
        positionsnummer: '10210',
        datumLeistung: d,
        anzahl: 1,
        einzelbetrag: 22.50,
        zuzahlungProPos: 2.25,
      })),
  }],
});

test('envelope present', () => {
  assert.ok(result.content.startsWith(UNA_HEADER));
  assert.ok(result.content.includes('UNB+UNOC:3+123456789+987654321+'));
  assert.ok(result.content.endsWith("UNZ+2+00023'"));
});
test('SLGA + SLLA messages', () => {
  assert.ok(result.content.includes("UNH+00001+SLGA:21:0:0'"));
  assert.ok(result.content.includes("UNH+00002+SLLA:21:0:0'"));
  assert.equal(result.messageCount, 2);
});
test('SLGA FKT — 6 fields, IK-LE/KT/KK/Absender', () => {
  // FKT(SLGA): VKZ, Sammelrechnung(empty), IK-LE, IK-KT, IK-KK, IK-Absender
  assert.ok(result.content.includes("FKT+01++123456789+101000000+101000000+123456789'"), result.content);
});
test('SLGA REC — composite Sammel:Einzel + Rechnungsart', () => {
  assert.ok(result.content.includes("REC+R2026-W20-001:0+20260518+1'"), 'SLGA REC');
});
test('SLGA GES — Status 00 first', () => {
  assert.ok(/GES\+00\+/.test(result.content), 'GES 00 row missing');
});
test('SLGA NAM present', () => {
  assert.ok(result.content.includes("NAM+Physiopraxis Müller'"));
});
test('SLLA FKT — Freifeld empty, 6 fields', () => {
  assert.ok(result.content.includes("FKT+01++123456789+101000000+101000000'"));
});
test('SLLA INV — 4 fields, Belegnummer M', () => {
  // versNr, status, beleginfo(empty), belegnummer
  assert.ok(result.content.includes("INV+A123456789+10000++0000001'"));
});
test('SLLA NAD — 7 fields, no geschlecht', () => {
  assert.ok(result.content.includes("NAD+Müller+Hans+19720413+Königsallee 1+40213+Düsseldorf'"));
});
test('SLLA EHE — Leistungserbringergruppe + positionsnummer + anzahl + preis + datum', () => {
  assert.ok(result.content.includes("EHE+22:01001+10210+1,00+22,50+20260505+2,25'"), 'first EHE');
});
test('SLLA ZHE — 17 fields, Verordnungsart, Leitsymptomatik, Therapiefrequenz', () => {
  // BSNR, LANR, VerordnungsDatum, ZuzahlungsKZ, DiagnoseGruppe, VerordnungsartHeilmittel,
  // (empty Verordnungsbesonderh.) , (empty Unfall), (empty BVG), (empty Behandlungsbeginn),
  // (empty Therapiebericht), (empty Hausbesuch), Leitsymptomatik, (empty PatLeitsym),
  // Dringlich, HeilmittelBereich, Therapiefrequenz
  // 6 empty Kann-fields between Verordnungsart (03) and Leitsymptomatik (1010)
  assert.ok(result.content.includes(
    "ZHE+180000700+999999900+20260502+0+WS2+03+++++++1010++0+1+3'"
  ), result.content);
});
test('SLLA DIA — ICD-10', () => {
  assert.ok(result.content.includes("DIA+M54.5'"));
});
test('SLLA BES — 4 totals, no Belegnummer here', () => {
  // brutto, gesZuzahlung, prozZuzahlung, pauschZuzahlung
  // 6 × 22.50 = 135.00; prozZ = 6 × 2.25 = 13.50; pauschZ = 10.00; gesZ = 23.50
  assert.ok(result.content.includes("BES+135,00+23,50+13,50+10,00'"), 'BES totals');
});
test('totals object', () => {
  assert.equal(result.totals.brutto, 135.00);
  assert.equal(result.totals.gesZuzahlung, 23.50);
  assert.equal(result.totals.netto, 111.50);
});

test('validator rejects invalid VKZ', () => {
  assert.throws(() => buildDtaFile({
    absender: { ik: '123456789' },
    empfaenger: { ik: '987654321' },
    rechnung: { sammelRechnungsnummer: 'X', datum: '2026-05-18', datennummer: 1 },
    prescriptions: [{ patient:{kvnr:'A1',belegnummer:'1'}, verordnung:{verordnungsart:'03',zuzahlungskennzeichen:'3',kostentraegerIk:'1'}, tarif:{tarifkennzeichen:'01001'}, sessions:[] }],
    vkz: '99',
    preflight: false,
  }), /Invalid VKZ/);
});
test('validator rejects non-Heilmittel Abrechnungscode', () => {
  assert.throws(() => buildDtaFile({
    absender: { ik: '123456789' },
    empfaenger: { ik: '987654321' },
    rechnung: { sammelRechnungsnummer: 'X', datum: '2026-05-18', datennummer: 1 },
    prescriptions: [{
      patient:{kvnr:'A1',belegnummer:'1'},
      verordnung:{verordnungsart:'03',zuzahlungskennzeichen:'3',kostentraegerIk:'1'},
      tarif:{abrechnungscode:'14', tarifkennzeichen:'01001'},  // 14 = Hörgeräteakustiker (A)
      sessions:[],
    }],
    preflight: false,
  }), /not a Heilmittel code/);
});
test('throws when no prescriptions', () => {
  assert.throws(() => buildDtaFile({
    absender:   { ik: '123456789' },
    empfaenger: { ik: '987654321' },
    rechnung:   { sammelRechnungsnummer: 'X', datum: '2026-05-18', datennummer: 1 },
    prescriptions: [],
    preflight: false,
  }));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
