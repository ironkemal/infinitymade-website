// § 302 — Form des erzeugten Datenstroms (gkv-302 Audit 19.09.2026).
//   node --test api-backend/billing/dta/datenstrom-form.test.js
//
// Der Audit hat die Ausgabe unseres Builders gegen eine echte, von der Kasse
// angenommene DTA-Datei des Beta-Kunden und gegen Anlage 1/3 TP5 V21 gelegt.
// Drei Funde haetten die Datei in Pruefstufe 2 oder 3 abgewiesen — und zwar
// die GANZE Datei, nicht die einzelne Zeile.
//
// Die Golden-Dateien in `__golden__/` decken davon ab, was im Ein-Kassen-Fall
// sichtbar ist (Zaehlerpolsterung, Summenstatus, fehlendes UNA). Sie koennen
// aber nichts pruefen, was in den Fixtures nicht vorkommt: kein Komma in
// einem Freitext, keine zweite Diagnose, kein Podologie-Mapper. Genau das
// steht hier — sonst waeren diese vier Korrekturen ungeschuetzt.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildDtaFile } from './builder.js';
import { podoFixture } from './fixtures.js';
import { buildUNT, buildUNZ } from './envelope.js';
import { buildSLGA_GES } from './segments.js';
import { escapeEdifact, freitext, buildSegment, fmtAmount } from './encoding.js';
import { pruefeDatenstrom, segmenteTrennen } from './preflight.js';
import { summenstatusFuer } from '../codes/anlage3_v22.js';
import { therapiefrequenzFuer } from './zhe-kennzeichen.js';

const segmente = (inhalt) => segmenteTrennen(inhalt);
const finde    = (inhalt, tag) => segmente(inhalt).filter(s => s.startsWith(tag + '+'));

// --- 1. Zaehler sind n6 mit fuehrenden Nullen (Kap. 5.4) ------------------

test('UNT/UNZ zaehlen 6-stellig mit fuehrenden Nullen', () => {
  assert.equal(buildUNT({ segmentCount: 15, nachrichtenreferenz: 2 }), "UNT+000015+00002'");
  assert.equal(buildUNZ({ messageCount: 4, datennummer: 7 }),          "UNZ+000004+00007'");
});

test('der gebaute Datenstrom traegt die gepolsterten Zaehler', () => {
  const r = buildDtaFile(structuredClone(podoFixture));
  for (const unt of finde(r.content, 'UNT')) {
    assert.match(unt.split('+')[1], /^\d{6}$/, 'UNT-Zähler nicht 6-stellig: ' + unt);
  }
  assert.match(finde(r.content, 'UNZ')[0].split('+')[1], /^\d{6}$/);
});

// --- 2. Summenstatus (Anlage 3 TP5 V21, § 8.1.6) --------------------------

test('Versichertenstatus wird auf den Summenstatus abgebildet, nicht gepolstert', () => {
  assert.equal(summenstatusFuer('10000'), '11');
  assert.equal(summenstatusFuer('30000'), '31');
  assert.equal(summenstatusFuer('50000'), '51');
  assert.equal(summenstatusFuer('90000'), '99');   // 9 hat keine eigene Summenzeile
  assert.equal(summenstatusFuer(''),      '99');
  assert.equal(summenstatusFuer(null),    '99');
});

test('GES-Zeile traegt 11/31/51, nie 01/03/05', () => {
  const basis = structuredClone(podoFixture);
  basis.prescriptions[0].patient.versichertenstatus = '30000';
  const r = buildDtaFile(basis);
  const status = finde(r.content, 'GES').map(s => s.split('+')[1]);
  assert.deepEqual(status, ['00', '31']);
});

test('buildSLGA_GES weist einen Status zurueck, den es nicht gibt', () => {
  assert.throws(
    () => buildSLGA_GES([{ status: '01', rechnungsbetrag: 1, brutto: 1 }]),
    /Summenstatus "01" ungültig/,
  );
});

// --- 3. Komma: Steuerzeichen im Freitext, Dezimalzeichen in Zahlen --------
//        (Kap. 5.1 (11) — der gefaehrliche Teil ist die Abgrenzung)

test('Freitext entwertet das Komma, normale Werte nicht', () => {
  assert.equal(escapeEdifact('Hallux, links'),                    'Hallux, links');
  assert.equal(escapeEdifact('Hallux, links', { komma: true }),   'Hallux?, links');
  // Der eigentliche Grund fuer die Trennung: Betraege duerfen NICHT entwertet
  // werden, sonst wird aus 51,92 € ein "51?,92".
  assert.equal(fmtAmount(51.92), '51,92');
  assert.equal(buildSegment('X', [fmtAmount(51.92)]), "X+51,92'");
  assert.equal(buildSegment('X', [freitext('a,b')]),  "X+a?,b'");
});

test('leerer Freitext bleibt ein leeres Feld (keine Objekt-Ausgabe)', () => {
  assert.equal(buildSegment('X', ['a', freitext(''), 'c']), "X+a++c'");
  assert.equal(buildSegment('X', ['a', freitext(null)]),    "X+a'");
});

test('Diagnosetext mit Komma kommt entwertet in der Datei an, Betraege nicht', () => {
  const basis = structuredClone(podoFixture);
  basis.prescriptions[0].verordnung.diagnosetext = 'Ulkus, plantar rechts';
  const r = buildDtaFile(basis);
  assert.ok(r.content.includes('Ulkus?, plantar rechts'), finde(r.content, 'DIA').join(' | '));
  // Gegenprobe in derselben Datei: der Einzelbetrag bleibt unentwertet.
  assert.ok(r.content.includes('+28,90+'), 'Betrag wurde faelschlich entwertet');
  assert.ok(!r.content.includes('?,90'),   'Betrag wurde faelschlich entwertet');
});

// --- 4. DIA: ein Segment je Diagnose (Kap. 5.5.3.3 S. 72) -----------------

test('zwei ICD-Kodes ergeben zwei DIA-Segmente, nicht ein Feld mit Komma', () => {
  const basis = structuredClone(podoFixture);
  basis.prescriptions[0].verordnung.icd10Liste = ['E11.40', 'I70.24'];
  basis.prescriptions[0].verordnung.diagnosetext = 'Diabetisches Fußsyndrom';
  const r = buildDtaFile(basis);
  const dia = finde(r.content, 'DIA');
  assert.equal(dia.length, 2, dia.join(' | '));
  assert.equal(dia[0], 'DIA+E11.40+Diabetisches Fußsyndrom');
  // Der Freitext gehoert zur Hauptdiagnose und wird nicht wiederholt.
  assert.equal(dia[1], 'DIA+I70.24');
  assert.ok(!r.content.includes('E11.40,I70.24'), 'ICD-Kodes stehen noch zusammengeklebt in einem Feld');
});

test('ein einzelner icd10-String bleibt genau ein DIA (Rueckwaertskompatibilitaet)', () => {
  const r = buildDtaFile(structuredClone(podoFixture));
  assert.deepEqual(finde(r.content, 'DIA'), ['DIA+E11.40']);
});

test('ein zusammengeklebter Altbestand wird wieder aufgetrennt', () => {
  const basis = structuredClone(podoFixture);
  basis.prescriptions[0].verordnung.icd10 = 'E11.40,I70.24';
  const r = buildDtaFile(basis);
  assert.deepEqual(finde(r.content, 'DIA'), ['DIA+E11.40', 'DIA+I70.24']);
});

test('ohne ICD steht trotzdem ein DIA — das Segment ist Mussfeld', () => {
  const basis = structuredClone(podoFixture);
  basis.prescriptions[0].verordnung.icd10 = '';
  basis.prescriptions[0].verordnung.icd10Liste = [];
  basis.prescriptions[0].verordnung.diagnosetext = 'Nagelmykose';
  const r = buildDtaFile(basis);
  assert.deepEqual(finde(r.content, 'DIA'), ['DIA++Nagelmykose']);
});

// --- 5. Therapiefrequenz je Fachbereich (Kap. 5.5.3.3 S. 72) --------------

test('Podologie meldet immer Therapiefrequenz 0, andere Bereiche den echten Wert', () => {
  assert.equal(therapiefrequenzFuer('podologie', '3'), '0');
  assert.equal(therapiefrequenzFuer('podologie', ''),  '0');
  assert.equal(therapiefrequenzFuer('physiotherapy', '3'), '3');
  assert.equal(therapiefrequenzFuer('ergotherapie',  '2'), '2');
  assert.equal(therapiefrequenzFuer('logopaedie',    '1'), '1');
});

// --- 6. UNA (Kap. 5.4 kennt es nicht) -------------------------------------

test('der Datenstrom beginnt mit UNB, nicht mit UNA', () => {
  const r = buildDtaFile(structuredClone(podoFixture));
  assert.ok(!r.content.startsWith('UNA'));
  assert.ok(r.content.startsWith('UNB+UNOC:3+'));
});

// --- 7. Selbstpruefung der Ausgabe ----------------------------------------
//        Die beiden Formfehler oben konnten nur deshalb monatelang
//        ueberleben, weil niemand das Ergebnis gelesen hat.

test('segmenteTrennen achtet das Entwertungszeichen', () => {
  assert.deepEqual(segmenteTrennen("AAA+x?'y'BBB+z'"), ["AAA+x?'y", 'BBB+z']);
});

test('pruefeDatenstrom laesst eine korrekte Datei durch', () => {
  const r = buildDtaFile(structuredClone(podoFixture));
  const ergebnis = pruefeDatenstrom(r.content);
  assert.equal(ergebnis.nachrichten, r.messageCount);
});

test('pruefeDatenstrom meldet einen ungepolsterten UNT-Zaehler', () => {
  const kaputt = "UNB+UNOC:3'UNH+00001+SLGA:21:0:0'NAM+X'UNT+3+00001'UNZ+000001+00001'";
  assert.throws(() => pruefeDatenstrom(kaputt), /UNT-Segmentzähler "3" ist nicht 6-stellig/);
});

test('pruefeDatenstrom meldet einen falsch gezaehlten UNT', () => {
  const kaputt = "UNB+UNOC:3'UNH+00001+SLGA:21:0:0'NAM+X'UNT+000009+00001'UNZ+000001+00001'";
  assert.throws(() => pruefeDatenstrom(kaputt), /meldet 9 Segmente, gezählt wurden 3/);
});

test('pruefeDatenstrom meldet einen unbekannten GES-Status', () => {
  const kaputt = "UNB+UNOC:3'UNH+00001+SLGA:21:0:0'GES+01+1,00+1,00'UNT+000003+00001'UNZ+000001+00001'";
  assert.throws(() => pruefeDatenstrom(kaputt), /GES-Summenstatus "01"/);
});

test('pruefeDatenstrom meldet einen falschen UNZ-Nachrichtenzaehler', () => {
  const kaputt = "UNB+UNOC:3'UNH+00001+SLGA:21:0:0'NAM+X'UNT+000003+00001'UNZ+000004+00001'";
  assert.throws(() => pruefeDatenstrom(kaputt), /UNZ meldet 4 Nachrichten, gezählt wurden 1/);
});

test('pruefeDatenstrom meldet eine nie geschlossene Nachricht', () => {
  const kaputt = "UNB+UNOC:3'UNH+00001+SLGA:21:0:0'NAM+X'UNZ+000001+00001'";
  assert.throws(() => pruefeDatenstrom(kaputt), /nie mit UNT geschlossen/);
});
