// Was hier schiefgeht, kostet Geld oder erzeugt eine Buchhaltung, die zwei
// verschiedene Wahrheiten fuer dieselbe Datei zeigt:
//
//   · Die Zuzahlungsformel muss ZEICHENGLEICH die der beiden Routen sein
//     (totalBrutto/totalZu). Weicht sie ab, passt die Summe der Zeilen nicht
//     zur Kopfsumme abrechnung.total_eur.
//   · Die Gesamtrechnungs-Gruppe (karten_ik + einzel_rechnungsnummer) ist die
//     Einheit, die die Kasse bezahlt. Faellt sie flach, laesst sich eine
//     Teilzahlung keiner Gruppe mehr zuordnen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betraegeFuerVerordnung, leistungenAusSessions, zeilenAusDta }
  from './abrechnung-zeilen.js';

const rx = (sessions, befreit = false) => ({
  patient: { vorname: 'Anna', nachname: 'Muster', kvnr: 'A123456789', belegnummer: '7-1' },
  verordnung: { ausstellungsdatum: '2026-03-01', zuzahlungskennzeichen: befreit ? '1' : '0' },
  sessions,
});

test('betraege: 10 Sitzungen a 20 EUR, Zuzahlung gedeckelt bei 10 % + 10 EUR', () => {
  const s = Array.from({ length: 10 }, () => ({ einzelbetrag: 20, anzahl: 1, zuzahlungProPos: 2 }));
  const b = betraegeFuerVerordnung(rx(s));
  assert.equal(b.brutto, 200);
  assert.equal(b.zuzahlung, 30);          // 10 x 2 = 20 Prozentanteil + 10 Pauschale
  assert.equal(b.netto, 170);
});

test('betraege: die Zuzahlung uebersteigt nie das Brutto', () => {
  // Eine einzelne billige Position: die 10-EUR-Pauschale wuerde sonst mehr
  // fordern, als die Leistung wert ist (Anlage 1 TP5 V21 §5.5.2, GES).
  const b = betraegeFuerVerordnung(rx([{ einzelbetrag: 6, anzahl: 1, zuzahlungProPos: 0.6 }]));
  assert.equal(b.brutto, 6);
  assert.equal(b.zuzahlung, 6);
  assert.equal(b.netto, 0);
});

test('betraege: befreit heisst die Kasse zahlt alles', () => {
  const s = [{ einzelbetrag: 20, anzahl: 3, zuzahlungProPos: 2 }];
  const b = betraegeFuerVerordnung(rx(s, true));
  assert.equal(b.brutto, 60);
  assert.equal(b.zuzahlung, 0);
  assert.equal(b.netto, 60);
});

test('betraege: anzahl > 1 zaehlt mit, auch bei der Zuzahlung', () => {
  const b = betraegeFuerVerordnung(rx([{ einzelbetrag: 10, anzahl: 6, zuzahlungProPos: 1 }]));
  assert.equal(b.brutto, 60);
  assert.equal(b.zuzahlung, 16);
  assert.equal(b.netto, 44);
});

test('leistungen tragen genau die vier Felder, die VKZ 04 braucht', () => {
  const l = leistungenAusSessions([
    { positionsnummer: '2478010', datumLeistung: '2026-03-02', anzahl: 1, einzelbetrag: 28.4,
      therapistId: 'x', requiredCert: 'MLD', hasCert: true },
  ]);
  assert.deepEqual(l, [{ datum: '2026-03-02', positionsnummer: '2478010', anzahl: 1, einzelbetrag: 28.4 }]);
});

test('zeilenAusDta: je Gesamtrechnung eine eigene Gruppe, sort_order zaehlt darin', () => {
  const prescriptions = [
    rx([{ einzelbetrag: 20, anzahl: 1, zuzahlungProPos: 2 }]),
    rx([{ einzelbetrag: 30, anzahl: 1, zuzahlungProPos: 3 }]),
    rx([{ einzelbetrag: 40, anzahl: 1, zuzahlungProPos: 4 }]),
  ];
  const quellen = [
    { id: 'rx-1', therapie_bereich: null,   heilmittel_position: 'X0501', anzahl_einheiten: 1 },
    { id: 'rx-2', therapie_bereich: null,   heilmittel_position: 'X0501', anzahl_einheiten: 1 },
    { id: 'rx-3', therapie_bereich: 'podo', heilmittel_position: null,    anzahl_einheiten: 4 },
  ];
  const dta = { gruppen: [
    { kostentraegerIk: '101', kartenIk: '101575519', einzelRechnungsnummer: '1', prescriptionIndices: [0, 2] },
    { kostentraegerIk: '101', kartenIk: '108310400', einzelRechnungsnummer: '2', prescriptionIndices: [1] },
  ] };

  const z = zeilenAusDta({ abrechnungId: 'ab-1', ownerId: 'own-1', businessId: 'biz-1',
                           kostentraegerIk: '101', dta, prescriptions, quellen });

  assert.equal(z.length, 3);
  assert.deepEqual(z.map(x => x.einzel_rechnungsnummer), ['1', '1', '2']);
  assert.deepEqual(z.map(x => x.sort_order), [0, 1, 0], 'sort_order zaehlt je Gruppe, nicht je Datei');
  assert.deepEqual(z.map(x => x.karten_ik), ['101575519', '101575519', '108310400']);
  assert.deepEqual(z.map(x => x.prescription_id), ['rx-1', 'rx-3', 'rx-2']);
  assert.equal(z[0].patient_name, 'Anna Muster');
  assert.equal(z[0].versichertennummer, 'A123456789');
  assert.equal(z[1].therapie_bereich, 'podo');
  assert.equal(z[1].heilmittel_position, null, 'Podologie traegt ihre Positionen in leistungen');
  assert.equal(z[0].status, 'eingereicht');
  assert.equal(z[0].herkunft, 'einreichung');
});

test('zeilenAusDta: ohne Gruppen ist die ganze Datei EINE Gesamtrechnung "0"', () => {
  // So sahen alle Dateien bis zum 07.09.2026 aus, und so uebergeben beide
  // Routen es weiterhin, wenn keine Sammelrechnung entsteht.
  const prescriptions = [rx([{ einzelbetrag: 20, anzahl: 1, zuzahlungProPos: 2 }])];
  const quellen = [{ id: 'rx-1' }];
  const z = zeilenAusDta({ abrechnungId: 'ab', ownerId: 'own', kostentraegerIk: '101',
                           dta: {}, prescriptions, quellen });
  assert.equal(z.length, 1);
  assert.equal(z[0].einzel_rechnungsnummer, '0');
  assert.equal(z[0].karten_ik, null);
  assert.equal(z[0].kostentraeger_ik, '101');
});

test('zeilenAusDta: die Zeilensumme passt zur Kopfsumme der Route', () => {
  // Genau die Schleife, die beide Routen fuer total_eur/zuzahlung_total fahren.
  const prescriptions = [
    rx([{ einzelbetrag: 20, anzahl: 5, zuzahlungProPos: 2 }]),
    rx([{ einzelbetrag: 15, anzahl: 2, zuzahlungProPos: 1.5 }], true),
  ];
  const quellen = [{ id: 'a' }, { id: 'b' }];
  const z = zeilenAusDta({ abrechnungId: 'ab', ownerId: 'own', kostentraegerIk: '101',
                           dta: {}, prescriptions, quellen });

  let totalBrutto = 0, totalZu = 0;
  for (const p of prescriptions) {
    const brutto = p.sessions.reduce((a, s) => a + Number(s.einzelbetrag) * Number(s.anzahl || 1), 0);
    totalBrutto += brutto;
    if (p.verordnung.zuzahlungskennzeichen === '0') {
      totalZu += Math.min(brutto, p.sessions.reduce((a, s) => a + Number(s.zuzahlungProPos) * Number(s.anzahl || 1), 0) + 10);
    }
  }
  assert.equal(z.reduce((a, x) => a + x.brutto_eur, 0), +totalBrutto.toFixed(2));
  assert.equal(z.reduce((a, x) => a + x.zuzahlung_eur, 0), +totalZu.toFixed(2));
});

test('zeilenAusDta: ein Index ohne Quelle bricht nicht ab', () => {
  const z = zeilenAusDta({
    abrechnungId: 'ab', ownerId: 'own', kostentraegerIk: '101',
    dta: { gruppen: [{ einzelRechnungsnummer: '1', prescriptionIndices: [0, 9] }] },
    prescriptions: [rx([{ einzelbetrag: 10, anzahl: 1, zuzahlungProPos: 1 }])],
    quellen: [{ id: 'a' }],
  });
  assert.equal(z.length, 1);
});
