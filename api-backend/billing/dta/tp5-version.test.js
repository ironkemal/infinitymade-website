import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TP5_V22_AB,
  TP5_V21_BIS,
  tp5VersionFuerDatum,
  tp5VersionZulaessig,
} from './tp5-version.js';
import { buildDtaFile } from './builder.js';
import { pruefeDatenstrom } from './preflight.js';
import { podoFixture } from './fixtures.js';

test('tp5VersionFuerDatum: vor 01.02.2027 immer V21, ab 01.02.2027 automatisch V22', () => {
  assert.equal(TP5_V22_AB, '2027-02-01');
  assert.equal(TP5_V21_BIS, '2027-04-30');
  assert.equal(tp5VersionFuerDatum('2026-11-24'), '21');
  assert.equal(tp5VersionFuerDatum('2027-01-31'), '21');
  assert.equal(tp5VersionFuerDatum('2027-02-01'), '22');
  assert.equal(tp5VersionFuerDatum('2027-05-01'), '22');
  assert.equal(tp5VersionFuerDatum('20270201'), '22');
  assert.equal(tp5VersionFuerDatum(null), '21');
});

test('tp5VersionZulaessig: sperrt vorzeitiges V22, erlaubt Übergangsfrist und sperrt veraltetes V21', () => {
  // Vor 01.02.2027: nur V21 erlaubt
  assert.equal(tp5VersionZulaessig('21', '2027-01-31'), true);
  assert.equal(tp5VersionZulaessig('22', '2027-01-31'), false);

  // Übergangsfrist 01.02.2027 – 30.04.2027: beide erlaubt
  assert.equal(tp5VersionZulaessig('21', '2027-02-01'), true);
  assert.equal(tp5VersionZulaessig('22', '2027-02-01'), true);
  assert.equal(tp5VersionZulaessig('21', '2027-04-30'), true);
  assert.equal(tp5VersionZulaessig('22', '2027-04-30'), true);

  // Ab 01.05.2027: nur V22 erlaubt
  assert.equal(tp5VersionZulaessig('21', '2027-05-01'), false);
  assert.equal(tp5VersionZulaessig('22', '2027-05-01'), true);

  // Unbekannte Versionen immer unzulässig
  assert.equal(tp5VersionZulaessig('20', '2026-11-24'), false);
  assert.equal(tp5VersionZulaessig('99', '2027-03-01'), false);
});

test('buildDtaFile + pruefeDatenstrom: erzeugt V21 bis 31.01.2027 und V22 ab 01.02.2027, sperrt Stichtagsfehler', () => {
  const inputV21 = structuredClone(podoFixture);
  inputV21.rechnung.datum = '2027-01-31';
  const dta21 = buildDtaFile(inputV21);
  assert.match(dta21.content, /UNH\+00001\+SLGA:21:0:0'/);
  assert.match(dta21.content, /UNH\+00002\+SLLA:21:0:0'/);
  assert.doesNotMatch(dta21.content, /:22:0:0'/);
  assert.equal(pruefeDatenstrom(dta21.content).nachrichten, 2);

  // Mutiert man eine 2027-01-31-Datei manuell auf V22 -> Output-Validator muss sie ablehnen!
  assert.throws(
    () => pruefeDatenstrom(dta21.content.replaceAll(':21:0:0', ':22:0:0')),
    { code: 'DTA_SELBSTPRUEFUNG' }
  );

  // Ab 01.02.2027 -> automatisch V22, besteht pruefeDatenstrom!
  const inputV22 = structuredClone(podoFixture);
  inputV22.rechnung.datum = '2027-02-01';
  const dta22 = buildDtaFile(inputV22);
  assert.match(dta22.content, /UNH\+00001\+SLGA:22:0:0'/);
  assert.match(dta22.content, /UNH\+00002\+SLLA:22:0:0'/);
  assert.doesNotMatch(dta22.content, /:21:0:0'/);
  assert.equal(pruefeDatenstrom(dta22.content).nachrichten, 2);

  // Gemischte Versionen in einer Datei -> abgelehnt!
  assert.throws(
    () => pruefeDatenstrom(dta22.content.replace('SLLA:22:0:0', 'SLLA:21:0:0')),
    { code: 'DTA_SELBSTPRUEFUNG' }
  );

  // Veraltete V21-Datei ab 01.05.2027 -> abgelehnt!
  const inputMai = structuredClone(podoFixture);
  inputMai.rechnung.datum = '2027-05-01';
  const dtaMai = buildDtaFile(inputMai);
  assert.match(dtaMai.content, /SLGA:22:0:0'/);
  assert.throws(
    () => pruefeDatenstrom(dtaMai.content.replaceAll(':22:0:0', ':21:0:0')),
    { code: 'DTA_SELBSTPRUEFUNG' }
  );
});
