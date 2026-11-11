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

test('builder & preflight: KZ 5 (zuzahlungsfrei -> pflichtig) mit freiem Ersttag erzeugt 0,00 EUR Pauschale in BES und keine Falsch-Warnung S:01009', () => {
  const basis = structuredClone(podoFixture);
  const rx = basis.prescriptions[0];
  rx.verordnung.zuzahlungskennzeichen = '5';
  rx.verordnung.pauschaleFrei = true; // 1. Behandlungstag war befreit -> keine 10-EUR-Pauschale
  rx.sessions = [
    { positionsnummer: '78010', datumLeistung: '2026-08-20', anzahl: 1, einzelbetrag: 28.90, zuzahlungProPos: 0, position_frei: true },
    { positionsnummer: '78010', datumLeistung: '2026-08-28', anzahl: 1, einzelbetrag: 28.90, zuzahlungProPos: 2.89 },
  ];

  const r = buildDtaFile(basis);
  assert.equal(r.totals.brutto, 57.80);
  assert.equal(r.totals.fallTotals[0].prozZuzahlung, 2.89);
  assert.equal(r.totals.fallTotals[0].pauschZuzahlung, 0.00);
  assert.equal(r.totals.gesZuzahlung, 2.89);
  assert.equal(r.totals.netto, 54.91);

  const ehe = finde(r.content, 'EHE');
  assert.equal(ehe.length, 2);
  assert.match(ehe[0], /\+20260820\+0,00$/);
  assert.match(ehe[1], /\+20260828\+2,89$/);

  const bes = finde(r.content, 'BES');
  assert.equal(bes[0], 'BES+57,80+2,89+2,89+0,00');

  const s01009 = (r.preflightWarnings || []).filter(w => w.code === 'S:01009');
  assert.equal(s01009.length, 0, 'Befreite Sitzung darf keine S:01009-Warnung auslösen');
});

test('builder: KZ 4 (pflichtig -> befreit) deckelt 10-EUR-Pauschale auf pflichtigBrutto statt Gesamtbrutto', () => {
  const basis = structuredClone(podoFixture);
  const rx = basis.prescriptions[0];
  rx.verordnung.zuzahlungskennzeichen = '4';
  rx.sessions = [
    // Tag 1 pflichtig: 6,00 EUR Brutto, 0,60 EUR Proz.-Zuzahlung -> Pauschale max. 5,40 EUR
    { positionsnummer: '78010', datumLeistung: '2026-08-20', anzahl: 1, einzelbetrag: 6.00, zuzahlungProPos: 0.60 },
    // Tag 2 befreit: 30,00 EUR Brutto, 0,00 EUR Zuzahlung
    { positionsnummer: '78010', datumLeistung: '2026-08-28', anzahl: 1, einzelbetrag: 30.00, zuzahlungProPos: 0, position_frei: true },
  ];

  const r = buildDtaFile(basis);
  assert.equal(r.totals.brutto, 36.00);
  assert.equal(r.totals.fallTotals[0].prozZuzahlung, 0.60);
  assert.equal(r.totals.fallTotals[0].pauschZuzahlung, 5.40);
  assert.equal(r.totals.gesZuzahlung, 6.00);
  assert.equal(r.totals.netto, 30.00);

  const bes = finde(r.content, 'BES');
  assert.equal(bes[0], 'BES+36,00+6,00+0,60+5,40');
});
