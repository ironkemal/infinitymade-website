// Generate a sample valid §302 EDIFACT file and write it to ./sample.edi
// Used for manual testing against online EDIFACT parsers.
//
//   node api-backend/billing/dta/dump.js [output-path]
//
// IKs used here are SYNTHETIC but pass our Modulo-10 Prüfziffer check:
//   801234561 — Leistungserbringer (LE) test IK
//   108310400 — AOK Bayern (real Kostenträger IK, used for plausibility only)

import { buildDtaFile } from './builder.js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = process.argv[2] || 'sample.edi';

const result = buildDtaFile({
  absender:   { ik: '801234561', name: 'Physiopraxis Test' },
  empfaenger: { ik: '108310400', name: 'AOK Bayern' },
  rechnung: {
    sammelRechnungsnummer: 'R2026-W21-001',
    einzelRechnungsnummer: '0',
    datum: '2026-05-23',
    datennummer: 1,
    rechnungsart: '1',
  },
  kind: 'test',  // → EHM filename, testindikator='0'
  vkz: '01',
  prescriptions: [{
    patient: {
      kvnr: 'A123456789',
      versichertenstatus: '10000',
      nachname: 'Müller',
      vorname: 'Hans',
      geburtsdatum: '1972-04-13',
      strasse: 'Königsallee 1',
      plz: '80331',
      ort: 'München',
      belegnummer: '0000001',
    },
    doctor: { lanr: '999999900', bsnr: '999999999' },
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
      kostentraegerIk: '108310400',
      krankenkasseIk:  '108310400',
    },
    tarif: { abrechnungscode: '22', tarifkennzeichen: '02001' },
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

writeFileSync(resolve(out), result.content, { encoding: 'latin1' });

console.log(`✓ Wrote ${result.byteLength} bytes (${result.segmentCount} segments, ${result.messageCount} messages) to ${out}`);
console.log(`  Filename per spec: ${result.filename}`);
console.log(`  Totals: brutto ${result.totals.brutto} € / Zuzahlung ${result.totals.gesZuzahlung} € / netto ${result.totals.netto} €`);
console.log('');
console.log('Preview (first 400 chars):');
console.log('  ' + result.content.slice(0, 400).replace(/'/g, "'\n  "));
