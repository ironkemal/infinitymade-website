import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildDtaFile } from './builder.js';
import { podoFixture } from './fixtures.js';
import { segmenteTrennen } from './preflight.js';

const segmente = (inhalt) => segmenteTrennen(inhalt);
const finde    = (inhalt, tag) => segmente(inhalt).filter(s => s.startsWith(tag + '+'));

test('builder: eine Verordnung mit icd10Liste ["M17.1R", "E11.40†"] erzeugt DIA-Werte M17.1 und E11.40', () => {
  const basis = structuredClone(podoFixture);
  basis.prescriptions[0].verordnung.icd10Liste = ['M17.1R', 'E11.40†'];
  basis.prescriptions[0].verordnung.diagnosetext = '';
  const r = buildDtaFile(basis);
  const dia = finde(r.content, 'DIA');
  assert.equal(dia.length, 2);
  assert.equal(dia[0], 'DIA+M17.1');
  assert.equal(dia[1], 'DIA+E11.40');
  assert.ok(!r.content.includes('M17.1R'), 'Zusatz R darf nicht im DTA-Datenstrom vorkommen');
  assert.ok(!r.content.includes('E11.40†'), 'Sonderzeichen † darf nicht im DTA-Datenstrom vorkommen');
});

test('builder #338: vkz 02 ohne urspruenglich wirft 422 Fehler mit Verweis auf Anlage 1 § 7.2', () => {
  const basis = structuredClone(podoFixture);
  basis.vkz = '02';
  delete basis.prescriptions[0].urspruenglich;

  assert.throws(
    () => buildDtaFile(basis),
    (err) => {
      assert.equal(err.status, 422);
      assert.match(err.message, /Korrekturverfahren \(VKZ 02\)/);
      assert.match(err.message, /Anlage 1 TP5 V21 § 7\.2/);
      return true;
    }
  );
});

test('builder #338: vkz 04 ohne urspruenglich wirft 422 Fehler mit Verweis auf Anlage 1 § 7.2', () => {
  const basis = structuredClone(podoFixture);
  basis.vkz = '04';
  delete basis.prescriptions[0].urspruenglich;

  assert.throws(
    () => buildDtaFile(basis),
    (err) => {
      assert.equal(err.status, 422);
      assert.match(err.message, /Korrekturverfahren \(VKZ 04\)/);
      assert.match(err.message, /Anlage 1 TP5 V21 § 7\.2/);
      return true;
    }
  );
});

test('builder #338: vkz 02 mit urspruenglich erzeugt URI-Segment', () => {
  const basis = structuredClone(podoFixture);
  basis.vkz = '02';
  basis.prescriptions[0].urspruenglich = {
    ikLeistungserbringer:  '109999999',
    sammelRechnungsnummer: 'TEST-A1',
    einzelRechnungsnummer: '1',
    rechnungsdatum:        '2026-09-01',
    belegnummer:           '12345678',
  };

  const r = buildDtaFile(basis);
  const uri = finde(r.content, 'URI');
  assert.equal(uri.length, 1);
  assert.match(uri[0], /^URI\+109999999\+TEST-A1:1\+20260901\+12345678/);
});

test('builder #338: vkz 01 ohne urspruenglich bleibt fehlerfrei und ohne URI-Segment', () => {
  const basis = structuredClone(podoFixture);
  basis.vkz = '01';
  delete basis.prescriptions[0].urspruenglich;

  const r = buildDtaFile(basis);
  const uri = finde(r.content, 'URI');
  assert.equal(uri.length, 0);
});

