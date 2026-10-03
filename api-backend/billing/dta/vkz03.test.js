// § 302 SGB V — VKZ 03 DTA Kernberechnungen, Preflight & Segmente (M1.1)
//
// Spezifikation: Anlage 1 TP5 V21 (Stand 15.01.2026, gültig ab 01.10.2025)
//   - Kap. 7.2 & 7.4.2: VKZ 03 (Zuzahlungsforderung gem. § 43c SGB V)
//   - Kap. 5.5.2: SLGA GES (Status 00 Gesamtsumme + je Status 11/31/...)
//   - Kap. 5.5.3.1: SLLA URI (Ursprüngliche Rechnungsinformation)
//   - Kap. 5.5.3.3: SLLA GZF (Gesamt-Zuzahlungs-Forderungs-Segment)
//
// Ausführen: node --test api-backend/billing/dta/vkz03.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildDtaFile, calcAbrechnungsfallTotals } from './builder.js';
import { preflight, segmenteTrennen } from './preflight.js';
import { physioFixture } from './fixtures.js';

const segmente = (inhalt) => segmenteTrennen(inhalt);
const findeSegmente = (inhalt, tag) => segmente(inhalt).filter(s => s.startsWith(tag + '+'));

function createVkz03Fixture(overrides = {}) {
  const base = {
    absender:   { ik: '801234561', name: 'Physiopraxis Test' },
    empfaenger: { ik: '108310400', name: 'AOK Bayern' },
    rechnung: {
      sammelRechnungsnummer: 'R2026-W21-001',
      einzelRechnungsnummer: '0',
      datum: '2026-05-23',
      datennummer: 1,
      rechnungsart: '1',
    },
    vkz: '03',
    kind: 'echt',
    transfernummer: 1,
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
      doctor: { lanr: '999999999', bsnr: '999999999' },
      verordnung: {
        ausstellungsdatum: '2026-05-02',
        icd10: 'M54.5',
        diagnosegruppe: 'WS2',
        verordnungsart: '03',
        leitsymptomatik: '1010',
        therapiefrequenz: '3',
        zuzahlungskennzeichen: '2', // KZ 2: Zahlungsunwillig trotz Mahnung
        kostentraegerIk: '108310400',
        krankenkasseIk:  '108310400',
      },
      tarif: { abrechnungscode: '22', tarifkennzeichen: '00501' },
      sessions: [
        { positionsnummer: '10210', datumLeistung: '2026-05-05', anzahl: 1, einzelbetrag: 50.00, zuzahlungProPos: 5.00 },
        { positionsnummer: '10210', datumLeistung: '2026-05-07', anzahl: 1, einzelbetrag: 50.00, zuzahlungProPos: 5.00 },
      ],
      urspruenglich: {
        ikLeistungserbringer:  '801234561',
        sammelRechnungsnummer: 'R2026-W20-001',
        einzelRechnungsnummer: '0',
        rechnungsdatum:        '2026-05-20',
        belegnummer:           '0000001',
      },
    }],
  };

  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// 1. GZF / GES Segmente & Ausschluss von BES bei VKZ 03
// ---------------------------------------------------------------------------
test('VKZ 03: erzeugt GZF und kein BES in der SLLA-Nachricht', () => {
  const f = createVkz03Fixture();
  const res = buildDtaFile(f);

  const gzf = findeSegmente(res.content, 'GZF');
  assert.equal(gzf.length, 1, 'GZF-Segment muss genau einmal vorhanden sein');

  const bes = findeSegmente(res.content, 'BES');
  assert.equal(bes.length, 0, 'BES-Segment darf bei VKZ 03 NICHT vorkommen (GZF ersetzt BES)');

  // 100 € Brutto -> 10 € Prozent + 10 € Pauschale = 20 € Forderung
  assert.equal(gzf[0], 'GZF+20,00+10,00+10,00');
});

test('VKZ 03: SLGA GES hat Rechnungsbetrag = Forderung, Brutto = 0,00, Zuzahlung = Forderung', () => {
  const f = createVkz03Fixture();
  const res = buildDtaFile(f);

  const ges = findeSegmente(res.content, 'GES');
  // 1x Status 00 (Gesamtsumme) + 1x Status 11 (Mitglied Versichertenstatus 10000)
  assert.equal(ges.length, 2);
  assert.equal(ges[0], 'GES+00+20,00+0,00+20,00');
  assert.equal(ges[1], 'GES+11+20,00+0,00+20,00');
});

// ---------------------------------------------------------------------------
// 2. Erlaubte Zuzahlungskennzeichen: 1, 2, 5
// ---------------------------------------------------------------------------
test('VKZ 03: Kennzeichen 2 (Zahlungsunwillig trotz schriftlicher Mahnung) zulässig', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].verordnung.zuzahlungskennzeichen = '2';
  const pf = preflight(f);
  assert.equal(pf.ok, true);
  assert.doesNotThrow(() => buildDtaFile(f));
});

test('VKZ 03: Kennzeichen 1 (Nachträgliche Befreiung) zulässig', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].verordnung.zuzahlungskennzeichen = '1';
  const pf = preflight(f);
  assert.equal(pf.ok, true);
  assert.doesNotThrow(() => buildDtaFile(f));
});

test('VKZ 03: Kennzeichen 5 (Jahreswechsel) zulässig', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].verordnung.zuzahlungskennzeichen = '5';
  const pf = preflight(f);
  assert.equal(pf.ok, true);
  assert.doesNotThrow(() => buildDtaFile(f));
});

// ---------------------------------------------------------------------------
// 3. Unzulässige Kennzeichen: 0 und 3 müssen fail-closed abgewiesen werden
// ---------------------------------------------------------------------------
test('VKZ 03: Kennzeichen 0 ist unzulässig und wird abgewiesen', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].verordnung.zuzahlungskennzeichen = '0';
  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'V:01005'));
  assert.throws(() => buildDtaFile(f), /unzulässig/);
});

test('VKZ 03: Kennzeichen 3 ist unzulässig und wird abgewiesen', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].verordnung.zuzahlungskennzeichen = '3';
  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'V:01005'));
  assert.throws(() => buildDtaFile(f), /unzulässig/);
});

test('VKZ 03: Kennzeichen 4 ist unzulässig und wird abgewiesen', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].verordnung.zuzahlungskennzeichen = '4';
  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'V:01005'));
  assert.throws(() => buildDtaFile(f), /unzulässig/);
});

// ---------------------------------------------------------------------------
// 4. Berechnung: Brutto 100 € -> Prozent 10 €, Pauschale 10 €, Summe 20 €
// ---------------------------------------------------------------------------
test('VKZ 03 Berechnung: 100 € Brutto -> 10 € % + 10 € Pauschale = 20 € Forderung', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].sessions = [
    { positionsnummer: '10210', datumLeistung: '2026-05-05', anzahl: 1, einzelbetrag: 100.00, zuzahlungProPos: 10.00 },
  ];
  const res = buildDtaFile(f);
  const gzf = findeSegmente(res.content, 'GZF');
  assert.equal(gzf[0], 'GZF+20,00+10,00+10,00');

  // EHE-Segment behält die ursprünglichen Leistungspreise
  const ehe = findeSegmente(res.content, 'EHE');
  assert.equal(ehe[0], 'EHE+22:00501+10210+1,00+100,00+20260505+10,00');

  // Datei- und Gruppensummen
  assert.equal(res.totals.brutto, 0.00);
  assert.equal(res.totals.gesZuzahlung, 20.00);
  assert.equal(res.totals.netto, 20.00);
  assert.equal(res.totals.serviceBrutto, 100.00);

  // Preflight-Totals stimmen exakt überein
  const pf = preflight(f);
  assert.equal(pf.ok, true);
  assert.equal(pf.totals.brutto, 0.00);
  assert.equal(pf.totals.zuzahlung, 20.00);
  assert.equal(pf.totals.netto, 20.00);
  assert.equal(pf.totals.serviceBrutto, 100.00);
});

// ---------------------------------------------------------------------------
// 5. Berechnung: Brutto 5 € -> Prozent 0,50 €, Pauschale 4,50 €, Summe 5,00 € (Cap)
// ---------------------------------------------------------------------------
test('VKZ 03 Berechnung: 5 € Brutto -> 0,50 € % + 4,50 € Pauschale = 5,00 € Forderung (Cap)', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].sessions = [
    { positionsnummer: '10210', datumLeistung: '2026-05-05', anzahl: 1, einzelbetrag: 5.00, zuzahlungProPos: 0.50 },
  ];
  const res = buildDtaFile(f);
  const gzf = findeSegmente(res.content, 'GZF');
  assert.equal(gzf[0], 'GZF+5,00+0,50+4,50');

  const ges = findeSegmente(res.content, 'GES');
  assert.equal(ges[0], 'GES+00+5,00+0,00+5,00');
  assert.equal(ges[1], 'GES+11+5,00+0,00+5,00');

  assert.equal(res.totals.brutto, 0.00);
  assert.equal(res.totals.gesZuzahlung, 5.00);
  assert.equal(res.totals.netto, 5.00);
  assert.equal(res.totals.serviceBrutto, 5.00);

  const pf = preflight(f);
  assert.equal(pf.ok, true);
  assert.equal(pf.totals.brutto, 0.00);
  assert.equal(pf.totals.zuzahlung, 5.00);
  assert.equal(pf.totals.netto, 5.00);
  assert.equal(pf.totals.serviceBrutto, 5.00);
});

// ---------------------------------------------------------------------------
// 6. Explizit zuzahlungsfreie Positionen (Mischung)
// ---------------------------------------------------------------------------
test('VKZ 03: Explizit freie Positionen werden mit 0 € Zuzahlung gerechnet und im EHE mit 0 übermittelt', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].sessions = [
    { positionsnummer: '10210', datumLeistung: '2026-05-05', anzahl: 1, einzelbetrag: 30.00, zuzahlungProPos: 3.00 },
    { positionsnummer: '21901', datumLeistung: '2026-05-05', anzahl: 1, einzelbetrag: 15.00, position_frei: true },
  ];
  const res = buildDtaFile(f);

  // EHE 1 (10210): zuzahlung = 3,00
  // EHE 2 (21901): zuzahlung = 0,00 (zuzahlungsfrei)
  const ehe = findeSegmente(res.content, 'EHE');
  assert.equal(ehe[0], 'EHE+22:00501+10210+1,00+30,00+20260505+3,00');
  assert.equal(ehe[1], 'EHE+22:00501+21901+1,00+15,00+20260505+0,00');

  // Service-Brutto = 45 €, Prozent = 3 €, Pauschale = min(10, 45 - 3) = 10 € -> Gesamt = 13 €
  const gzf = findeSegmente(res.content, 'GZF');
  assert.equal(gzf[0], 'GZF+13,00+3,00+10,00');

  const pf = preflight(f);
  assert.equal(pf.ok, true);
  assert.equal(pf.totals.zuzahlung, 13.00);
  assert.equal(pf.totals.netto, 13.00);
  assert.equal(pf.totals.serviceBrutto, 45.00);
});

// ---------------------------------------------------------------------------
// 7. Mehrere KartenIK / Versichertenstatus-Gruppen
// ---------------------------------------------------------------------------
test('VKZ 03: Mehrere Statusgruppen bilden korrekte GES 00, 11 und 31 Zeilen mit 0,00 Brutto', () => {
  const f = createVkz03Fixture();
  const p1 = f.prescriptions[0]; // Versichertenstatus 10000 -> Summenstatus 11, Forderung 20 €
  const p2 = structuredClone(p1); // Versichertenstatus 30000 -> Summenstatus 31
  p2.patient.kvnr = 'B987654321';
  p2.patient.versichertenstatus = '30000';
  p2.patient.belegnummer = '0000002';
  p2.urspruenglich.belegnummer = '0000002';
  p2.sessions = [
    { positionsnummer: '10210', datumLeistung: '2026-05-12', anzahl: 1, einzelbetrag: 50.00, zuzahlungProPos: 5.00 },
  ];
  // p2: ServiceBrutto 50 €, Prozent 5 €, Pauschale 10 € -> Forderung 15 €

  f.prescriptions = [p1, p2];

  const res = buildDtaFile(f);
  const ges = findeSegmente(res.content, 'GES');

  // GES Zeilen: 00 (Gesamtsumme 35 €), 11 (20 €), 31 (15 €)
  assert.equal(ges.length, 3);
  assert.equal(ges[0], 'GES+00+35,00+0,00+35,00');
  assert.equal(ges[1], 'GES+11+20,00+0,00+20,00');
  assert.equal(ges[2], 'GES+31+15,00+0,00+15,00');

  assert.equal(res.totals.brutto, 0.00);
  assert.equal(res.totals.gesZuzahlung, 35.00);
  assert.equal(res.totals.netto, 35.00);
  assert.equal(res.totals.serviceBrutto, 150.00);
});

// ---------------------------------------------------------------------------
// 8. Ursprüngliche Rechnungsinformation (URI) Pflicht und Validierung
// ---------------------------------------------------------------------------
test('VKZ 03: erzeugt valides URI-Segment in der SLLA-Nachricht', () => {
  const f = createVkz03Fixture();
  const res = buildDtaFile(f);

  const uri = findeSegmente(res.content, 'URI');
  assert.equal(uri.length, 1);
  assert.equal(uri[0], 'URI+801234561+R2026-W20-001:0+20260520+0000001');
});

test('VKZ 03: fehlt urspruenglich (URI), schlägt Preflight mit P:01006 und Builder mit 422 fehl', () => {
  const f = createVkz03Fixture();
  delete f.prescriptions[0].urspruenglich;

  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'P:01006'));

  assert.throws(() => buildDtaFile(f), /Ursprüngliche Rechnungsinformation/);
});

test('VKZ 03: ungültige Absender-IK im URI wird abgewiesen', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].urspruenglich.ikLeistungserbringer = '12345'; // zu kurz

  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'F:01002'));

  assert.throws(() => buildDtaFile(f), /9 Stellen erwartet/);
});

test('VKZ 03: ungültige Prüfziffer der Absender-IK im URI wird abgewiesen', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].urspruenglich.ikLeistungserbringer = '801234562'; // falsche Prüfziffer

  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'F:01003'));

  assert.throws(() => buildDtaFile(f), /Prüfziffer ungültig/);
});

test('VKZ 03: Sammelrechnungsnummer > 14 Zeichen im URI wird abgewiesen', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].urspruenglich.sammelRechnungsnummer = 'RECHNUNG-2026-001'; // 17 Zeichen

  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'F:03002'));

  assert.throws(() => buildDtaFile(f), /> 14 Zeichen/);
});

test('VKZ 03: unzulässige Zeichen in Sammelrechnungsnummer im URI werden abgewiesen', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].urspruenglich.sammelRechnungsnummer = 'R 2026/01'; // Leerzeichen

  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'F:03006'));

  assert.throws(() => buildDtaFile(f), /unzulässige Zeichen/);
});

test('VKZ 03: ungültiges Rechnungsdatum im URI wird abgewiesen', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].urspruenglich.rechnungsdatum = 'ungueltig';

  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'F:03005'));

  assert.throws(() => buildDtaFile(f), /Rechnungsdatum fehlt oder ungültig/);
});

test('VKZ 03: ungültige Belegnummer im URI wird abgewiesen', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].urspruenglich.belegnummer = 'BEL#123'; // ungültiges Sonderzeichen

  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'P:01009'));

  assert.throws(() => buildDtaFile(f), /Belegnummer "BEL#123" ungültig/);
});

// ---------------------------------------------------------------------------
// 9. Ablehnung ungültiger Zuzahlungswerte & Nullforderungen
// ---------------------------------------------------------------------------
test('VKZ 03: Fehlende explizite zuzahlungProPos wird abgewiesen (kein 10%-Fallback)', () => {
  const f = createVkz03Fixture();
  delete f.prescriptions[0].sessions[0].zuzahlungProPos;

  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'S:01007'));

  assert.throws(() => buildDtaFile(f), /Explizite Forderungs-Zuzahlung für Position/);
});

test('VKZ 03: Negative zuzahlungProPos wird abgewiesen', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].sessions[0].zuzahlungProPos = -2.50;

  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'S:01007'));

  assert.throws(() => buildDtaFile(f), /ungültig/);
});

test('VKZ 03: zuzahlungProPos > Einzelbetrag wird abgewiesen', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].sessions[0].zuzahlungProPos = 75.00; // Einzelbetrag ist 50.00

  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'S:01007'));

  assert.throws(() => buildDtaFile(f), /ungültig/);
});

test('VKZ 03: Nicht-endliche zuzahlungProPos wird abgewiesen', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].sessions[0].zuzahlungProPos = NaN;

  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'S:01007'));

  assert.throws(() => buildDtaFile(f), /ungültig/);
});

test('VKZ 03: Nullforderung (0,00 €) wird strikt abgewiesen', () => {
  const f = createVkz03Fixture();
  // Wenn alle Sessions 0 € Einzelbetrag und 0 € Zuzahlung hätten
  f.prescriptions[0].sessions = [
    { positionsnummer: '10210', datumLeistung: '2026-05-05', anzahl: 1, einzelbetrag: 0.00, zuzahlungProPos: 0.00 },
  ];

  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'S:01007'));

  assert.throws(() => buildDtaFile(f), /Nullforderungen sind unzulässig/);
});

// ---------------------------------------------------------------------------
// 10. Konsistenz & Unverändertes Verhalten für VKZ 01 und VKZ 04
// ---------------------------------------------------------------------------
test('VKZ 01: Standardfall erzeugt BES und kein GZF, Netto = Brutto - Zuzahlung', () => {
  const f = structuredClone(physioFixture);
  f.preflight = false;
  const res = buildDtaFile(f);

  const bes = findeSegmente(res.content, 'BES');
  assert.equal(bes.length, 1);
  const gzf = findeSegmente(res.content, 'GZF');
  assert.equal(gzf.length, 0);

  // 135 € Brutto, 23,50 € Zuzahlung, 111,50 € Netto
  assert.equal(res.totals.brutto, 135.00);
  assert.equal(res.totals.gesZuzahlung, 23.50);
  assert.equal(res.totals.netto, 111.50);
  assert.equal(res.totals.serviceBrutto, undefined);
});

test('VKZ 04: unterstützt pauschKorrektur und erzeugt BES', () => {
  const f = structuredClone(physioFixture);
  f.vkz = '04';
  f.prescriptions[0].pauschKorrektur = 5.00;
  f.prescriptions[0].urspruenglich = {
    ikLeistungserbringer:  '123456789',
    sammelRechnungsnummer: 'R2026-W19-001',
    einzelRechnungsnummer: '0',
    rechnungsdatum:        '2026-05-10',
    belegnummer:           '0000001',
  };
  f.preflight = false;
  const res = buildDtaFile(f);

  const bes = findeSegmente(res.content, 'BES');
  assert.equal(bes.length, 1);
  // BES trägt pauschKorrektur als 5. Feld
  assert.ok(bes[0].includes('+5,00'));
});

test('VKZ 01: position_frei=true und fehlende zuzahlungProPos emittiert im EHE leeres Feld und nutzt unveränderte Logik', () => {
  const f = structuredClone(physioFixture);
  f.preflight = false;
  f.prescriptions[0].sessions[0].position_frei = true;
  delete f.prescriptions[0].sessions[0].zuzahlungProPos;

  const res = buildDtaFile(f);
  const ehe = findeSegmente(res.content, 'EHE');
  assert.ok(!ehe[0].includes('+0,00'), 'EHE darf für abwesende Zuzahlung bei non-03 nicht 0,00 ausgeben');
});

// ---------------------------------------------------------------------------
// 11. Strenge Finanz-Validierung VKZ 03 (Regressionstests)
// ---------------------------------------------------------------------------

test('VKZ 03: Boolesche Zuzahlung (true/false) wird strikt abgewiesen', () => {
  for (const b of [true, false]) {
    const f = createVkz03Fixture();
    f.prescriptions[0].sessions[0].zuzahlungProPos = b;

    const pf = preflight(f);
    assert.equal(pf.ok, false, `preflight should reject boolean ${b}`);
    assert.ok(pf.errors.some(e => e.code === 'S:01007'));
    assert.throws(() => buildDtaFile(f), /ungültig|boolescher Wert/);
  }
});

test('VKZ 03: Leere oder Leerzeichen-Zeichenkette als Zuzahlung wird strikt abgewiesen', () => {
  for (const empty of ['', '   ']) {
    const f = createVkz03Fixture();
    f.prescriptions[0].sessions[0].zuzahlungProPos = empty;

    const pf = preflight(f);
    assert.equal(pf.ok, false, `preflight should reject empty string "${empty}"`);
    assert.ok(pf.errors.some(e => e.code === 'S:01007'));
    assert.throws(() => buildDtaFile(f), /ungültig|nicht leer/);
  }
});

test('VKZ 03: Nicht-endliche Zuzahlung (Infinity/-Infinity) wird strikt abgewiesen', () => {
  for (const inf of [Infinity, -Infinity]) {
    const f = createVkz03Fixture();
    f.prescriptions[0].sessions[0].zuzahlungProPos = inf;

    const pf = preflight(f);
    assert.equal(pf.ok, false);
    assert.ok(pf.errors.some(e => e.code === 'S:01007'));
    assert.throws(() => buildDtaFile(f), /ungültig/);
  }
});

test('VKZ 03: position_frei=true mit ungültiger Zuzahlung (true/"") wird strikt abgewiesen (kein implicit invalid->0)', () => {
  for (const invalid of [true, '', '   ']) {
    const f = createVkz03Fixture();
    f.prescriptions[0].sessions[0].position_frei = true;
    f.prescriptions[0].sessions[0].zuzahlungProPos = invalid;

    const pf = preflight(f);
    assert.equal(pf.ok, false);
    assert.ok(pf.errors.some(e => e.code === 'S:01007'));
    assert.throws(() => buildDtaFile(f), /ungültig|boolescher Wert|nicht leer/);
  }
});

test('VKZ 03: Anzahl 0 oder negativ wird strikt abgewiesen', () => {
  for (const badQty of [0, -1, -0.5, '0', '-2']) {
    const f = createVkz03Fixture();
    f.prescriptions[0].sessions[0].anzahl = badQty;

    const pf = preflight(f);
    assert.equal(pf.ok, false, `preflight should reject qty ${badQty}`);
    assert.ok(pf.errors.some(e => e.code === 'S:01007' && e.where.includes('anzahl')));
    assert.throws(() => buildDtaFile(f), /Anzahl.*ungültig/);
  }
});

test('VKZ 03: Boolesche oder leere Anzahl wird strikt abgewiesen', () => {
  for (const badQty of [true, false, '', '   ']) {
    const f = createVkz03Fixture();
    f.prescriptions[0].sessions[0].anzahl = badQty;

    const pf = preflight(f);
    assert.equal(pf.ok, false, `preflight should reject qty ${badQty}`);
    assert.ok(pf.errors.some(e => e.code === 'S:01007' && e.where.includes('anzahl')));
    assert.throws(() => buildDtaFile(f), /Anzahl.*ungültig/);
  }
});

test('VKZ 03: Nicht-endliche Anzahl (Infinity/NaN) wird strikt abgewiesen', () => {
  for (const badQty of [Infinity, NaN, 'abc']) {
    const f = createVkz03Fixture();
    f.prescriptions[0].sessions[0].anzahl = badQty;

    const pf = preflight(f);
    assert.equal(pf.ok, false);
    assert.ok(pf.errors.some(e => e.code === 'S:01007' && e.where.includes('anzahl')));
    assert.throws(() => buildDtaFile(f), /Anzahl.*ungültig/);
  }
});

test('VKZ 03: Gültige String- und Zahlenmengen/-zuzahlungen erzeugen synchrone EHE, GZF und GES Segmente', () => {
  const f = createVkz03Fixture();
  // String-Zuzahlung mit Komma ("5,00") und String-Anzahl ("2")
  f.prescriptions[0].sessions = [
    { positionsnummer: '10210', datumLeistung: '2026-05-05', anzahl: '2', einzelbetrag: '50,00', zuzahlungProPos: '5,00' },
  ];

  const res = buildDtaFile(f);

  // EHE: Anzahl 2,00, Preis 50,00, Zuzahlung 5,00
  const ehe = findeSegmente(res.content, 'EHE');
  assert.equal(ehe[0], 'EHE+22:00501+10210+2,00+50,00+20260505+5,00');

  // GZF: 2 * 5,00 = 10,00 % + 10,00 Pauschale = 20,00 Gesamt
  const gzf = findeSegmente(res.content, 'GZF');
  assert.equal(gzf[0], 'GZF+20,00+10,00+10,00');

  // GES: Gesamtsumme 20,00
  const ges = findeSegmente(res.content, 'GES');
  assert.equal(ges[0], 'GES+00+20,00+0,00+20,00');
  assert.equal(ges[1], 'GES+11+20,00+0,00+20,00');

  // Preflight stimmt synchron überein
  const pf = preflight(f);
  assert.equal(pf.ok, true);
  assert.equal(pf.totals.brutto, 0.00);
  assert.equal(pf.totals.zuzahlung, 20.00);
  assert.equal(pf.totals.netto, 20.00);
  assert.equal(pf.totals.serviceBrutto, 100.00);
});

test('VKZ 03: Gebrochene Mengen (z.B. 1.5 oder "1,5") werden unterstützt und exakt berechnet', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].sessions = [
    { positionsnummer: '10210', datumLeistung: '2026-05-05', anzahl: 1.5, einzelbetrag: 20.00, zuzahlungProPos: 2.00 },
  ];

  const res = buildDtaFile(f);

  const ehe = findeSegmente(res.content, 'EHE');
  assert.equal(ehe[0], 'EHE+22:00501+10210+1,50+20,00+20260505+2,00');

  // Service-Brutto = 20 * 1.5 = 30.00, Prozent = 2 * 1.5 = 3.00, Pauschale = 10.00 -> 13.00
  const gzf = findeSegmente(res.content, 'GZF');
  assert.equal(gzf[0], 'GZF+13,00+3,00+10,00');

  const ges = findeSegmente(res.content, 'GES');
  assert.equal(ges[0], 'GES+00+13,00+0,00+13,00');

  const pf = preflight(f);
  assert.equal(pf.ok, true);
  assert.equal(pf.totals.zuzahlung, 13.00);
  assert.equal(pf.totals.netto, 13.00);
  assert.equal(pf.totals.serviceBrutto, 30.00);
});

test('VKZ 03: Echtes Fehlen der Anzahl (undefined/null) nutzt Standardwert 1', () => {
  for (const absent of [undefined, null]) {
    const f = createVkz03Fixture();
    f.prescriptions[0].sessions = [
      { positionsnummer: '10210', datumLeistung: '2026-05-05', anzahl: absent, einzelbetrag: 50.00, zuzahlungProPos: 5.00 },
    ];

    const res = buildDtaFile(f);
    const ehe = findeSegmente(res.content, 'EHE');
    assert.equal(ehe[0], 'EHE+22:00501+10210+1,00+50,00+20260505+5,00');

    const pf = preflight(f);
    assert.equal(pf.ok, true);
    assert.equal(pf.totals.zuzahlung, 15.00);
    assert.equal(pf.totals.serviceBrutto, 50.00);
  }
});

test('VKZ 03: Widerspruch position_frei=true und zuzahlungProPos > 0 wird strikt abgewiesen', () => {
  const f = createVkz03Fixture();
  f.prescriptions[0].sessions[0].position_frei = true;
  f.prescriptions[0].sessions[0].zuzahlungProPos = 5.00;

  const pf = preflight(f);
  assert.equal(pf.ok, false);
  assert.ok(pf.errors.some(e => e.code === 'S:01007' && e.message.includes('Widersprüchliche Angaben')));

  assert.throws(() => buildDtaFile(f), /Widersprüchliche Angaben.*position_frei ist true, aber Forderungs-Zuzahlung ist/);
});

test('VKZ 03: position_frei=true mit zuzahlungProPos=0 oder weggelassen ist gültig und erzeugt synchron 0,00 €', () => {
  for (const zeroCopay of [0, 0.00, '0', '0,00', undefined, null]) {
    const f = createVkz03Fixture();
    f.prescriptions[0].sessions = [
      { positionsnummer: '10210', datumLeistung: '2026-05-05', anzahl: 1, einzelbetrag: 50.00, position_frei: true, zuzahlungProPos: zeroCopay },
      { positionsnummer: '10211', datumLeistung: '2026-05-06', anzahl: 1, einzelbetrag: 50.00, zuzahlungProPos: 5.00 },
    ];

    const res = buildDtaFile(f);
    const ehe = findeSegmente(res.content, 'EHE');
    assert.equal(ehe[0], 'EHE+22:00501+10210+1,00+50,00+20260505+0,00');
    assert.equal(ehe[1], 'EHE+22:00501+10211+1,00+50,00+20260506+5,00');

    // Totals: Session 1 copay 0 + Session 2 copay 5 = 5.00 % + 10.00 Flat = 15.00
    const gzf = findeSegmente(res.content, 'GZF');
    assert.equal(gzf[0], 'GZF+15,00+5,00+10,00');

    const pf = preflight(f);
    assert.equal(pf.ok, true);
    assert.equal(pf.totals.zuzahlung, 15.00);
  }
});

test('VKZ 03: Nicht-boolescher position_frei-Wert (z.B. "false", "true", 1) wird strikt abgewiesen', () => {
  for (const nonBool of ['false', 'true', 1, 0, [true], {}]) {
    const f = createVkz03Fixture();
    f.prescriptions[0].sessions[0].position_frei = nonBool;

    const pf = preflight(f);
    assert.equal(pf.ok, false);
    assert.ok(pf.errors.some(e => e.code === 'S:01007' && e.message.includes('position_frei muss boolesch')));

    assert.throws(() => buildDtaFile(f), /position_frei.*muss boolesch/);
  }
});

test('VKZ 03: Array- und Objekt-Eingaben für Finanzfelder werden strikt abgewiesen', () => {
  for (const badVal of [[5], {}, { value: 5 }]) {
    // anzahl
    const fQty = createVkz03Fixture();
    fQty.prescriptions[0].sessions[0].anzahl = badVal;
    assert.equal(preflight(fQty).ok, false);
    assert.throws(() => buildDtaFile(fQty), /Anzahl.*ungültig/);

    // einzelbetrag
    const fPrice = createVkz03Fixture();
    fPrice.prescriptions[0].sessions[0].einzelbetrag = badVal;
    assert.equal(preflight(fPrice).ok, false);
    assert.throws(() => buildDtaFile(fPrice), /Einzelbetrag.*ungültig/);

    // zuzahlungProPos
    const fCopay = createVkz03Fixture();
    fCopay.prescriptions[0].sessions[0].zuzahlungProPos = badVal;
    assert.equal(preflight(fCopay).ok, false);
    assert.throws(() => buildDtaFile(fCopay), /Forderungs-Zuzahlung.*ungültig/);
  }
});

test('VKZ 03: Mehr als 2 Nachkommastellen bei Menge, Einzelbetrag oder Zuzahlung werden strikt abgewiesen', () => {
  // Menge mit Subcent / mehr als 2 Dezimalstellen
  for (const badQty of [1.234, '1.234', '1,234', 1.005]) {
    const f = createVkz03Fixture();
    f.prescriptions[0].sessions[0].anzahl = badQty;
    const pf = preflight(f);
    assert.equal(pf.ok, false);
    assert.ok(pf.errors.some(e => e.code === 'S:01007' && e.where.includes('anzahl')));
    assert.throws(() => buildDtaFile(f), /Anzahl.*Nachkommastellen/);
  }

  // Einzelbetrag mit Subcent
  for (const badPrice of [10.005, '10.005', '10,005', 50.123]) {
    const f = createVkz03Fixture();
    f.prescriptions[0].sessions[0].einzelbetrag = badPrice;
    const pf = preflight(f);
    assert.equal(pf.ok, false);
    assert.ok(pf.errors.some(e => e.code === 'S:01007' && e.where.includes('einzelbetrag')));
    assert.throws(() => buildDtaFile(f), /Einzelbetrag.*Nachkommastellen/);
  }

  // Zuzahlung mit Subcent
  for (const badCopay of [2.123, '2.123', '2,123', 0.001]) {
    const f = createVkz03Fixture();
    f.prescriptions[0].sessions[0].zuzahlungProPos = badCopay;
    const pf = preflight(f);
    assert.equal(pf.ok, false);
    assert.ok(pf.errors.some(e => e.code === 'S:01007' && e.where.includes('zuzahlungProPos')));
    assert.throws(() => buildDtaFile(f), /Forderungs-Zuzahlung.*Nachkommastellen/);
  }
});
