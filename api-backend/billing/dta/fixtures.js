// Gemeinsame Testfixtures für den DTA-Bau.
//
// Warum eine eigene Datei: die Gesamtrechnungs-Gruppierung (Ops #283) durfte
// die Ausgabe des heutigen Ein-Kassen-Falls NICHT verändern. Um das beweisen
// zu können, mussten die beiden Fixtures aus `smoke.test.js` von dort
// herauslösbar sein — sonst hätte der Golden-Vergleich seine eigene Kopie
// geprüft statt derselben Eingabe.
//
// Die Objekte sind zeichengleich aus smoke.test.js übernommen (Stand
// 07.09.2026, vor dem Umbau). Wer sie ändert, macht die Golden-Dateien in
// `__golden__/` ungültig — sie sind der eingefrorene Ist-Zustand von VOR dem
// Umbau und dürfen nicht neu erzeugt werden, um einen Test grün zu bekommen.

import { legsFuer, abrechnungscodeAusLegs, tarifkennzeichenAusLegs } from '../codes/legs.js';

export const physioFixture = {
  preflight: false,
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
    tarif: { abrechnungscode: '22', tarifkennzeichen: '00501' },
    sessions: ['2026-05-05','2026-05-07','2026-05-12','2026-05-14','2026-05-19','2026-05-21']
      .map(d => ({
        positionsnummer: '10210',
        datumLeistung: d,
        anzahl: 1,
        einzelbetrag: 22.50,
        zuzahlungProPos: 2.25,
      })),
  }],
};

const podoLegs = legsFuer('podologie');

export const podoFixture = {
  preflight: false,
  absender:   { ik: '123456789', name: 'Podologie am Markt' },
  empfaenger: { ik: '987654321', name: 'AOK DAS' },
  rechnung: {
    sammelRechnungsnummer: 'R2026-W35-002',
    einzelRechnungsnummer: '0',
    datum: '2026-08-28',
    datennummer: 24,
    rechnungsart: '1',
  },
  kind: 'echt',
  vkz: '01',
  prescriptions: [{
    patient: {
      kvnr: 'B987654321',
      versichertenstatus: '10000',
      nachname: 'Schulz',
      vorname: 'Erika',
      geburtsdatum: '1955-09-30',
      strasse: 'Marktplatz 3',
      plz: '53721',
      ort: 'Siegburg',
      belegnummer: '0000002',
    },
    verordnung: {
      arztLanr: '999999999',
      arztBsnr: '888888888',
      ausstellungsdatum: '2026-08-20',
      icd10: 'E11.40',
      diagnosegruppe: 'DF',
      verordnungsart: '03',
      leitsymptomatik: '1010',
      dringend: false,
      hausbesuch: false,
      heilmittelBereich: '5',
      therapiefrequenz: '1',
      zuzahlungskennzeichen: '3',
      kostentraegerIk: '101000000',
      krankenkasseIk:  '101000000',
    },
    tarif: {
      abrechnungscode:  abrechnungscodeAusLegs(podoLegs),
      tarifkennzeichen: tarifkennzeichenAusLegs(podoLegs),
    },
    sessions: [{
      positionsnummer: '78010',
      datumLeistung: '2026-08-28',
      anzahl: 1,
      einzelbetrag: 28.90,
      zuzahlungProPos: 2.89,
    }],
  }],
};
