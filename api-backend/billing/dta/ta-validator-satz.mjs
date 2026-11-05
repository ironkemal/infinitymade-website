// Testdateien für den TA-Validator (portal.davaso.de, IQVIA HSS) — ein Satz
// typischer Podologie-Fälle, erzeugt mit dem PRODUKTIVEN Builder samt Preflight.
//
//   node api-backend/billing/dta/ta-validator-satz.mjs [ausgabe-ordner]
//
// Warum ein eigener Satz neben `fixtures.js`: die Fixtures sind eingefrorene
// Golden-Eingaben (absichtlich ungültige IK-Prüfziffern, preflight aus). Für
// den Validator braucht es das Gegenteil — gültige IKs, Preflight an, echte
// Positionen und Preise (`codes/podologie_positions.js`, ab 01.07.2026) und
// die echte Zuordnung Kasse → Datenannahmestelle aus `kostentraeger_annahmestellen`
// (21.10.2026: TK 101575519 → IQVIA HSS 661430035, BARMER 104940005 → DDG 660510336).
//
// ⛔ Nur SYNTHETISCHE Daten (ABRECHNUNG_ECHTBETRIEB_PLAN.md Adım 2.0b) —
// Namen, KVNR, Arzt-Nummern sind erfunden. Nie echte Patientendaten hier eintragen.
// Testindikator 0 (kind 'test'), Absender ist eine erfundene Praxis-IK, NICHT
// die Softwarehersteller-IK (die gehört ins Testverfahren mit der DAS, Adım 2.1).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDtaFile } from './builder.js';
import { pruefeDatenstrom } from './preflight.js';
import { legsFuer, abrechnungscodeAusLegs, tarifkennzeichenAusLegs } from '../codes/legs.js';
import { findPodologiePosition } from '../codes/podologie_positions.js';

// `--aze`: Satz für das Abrechnungszentrum Emmendingen (E-Mail-Test, A. Kiss 03.11.2026):
// Absender = unsere Softwarehersteller-IK (für Testlieferungen ausdrücklich erlaubt),
// Empfänger = AZE 107436557, Kasse = mhplus BKK (VKG 03 → AZE), unverschlüsselt,
// Auftragssatz 00/00. Je Fall ein Paar TSOL0nnn + TSOL0nnn.AUF — ein Paar pro E-Mail.
const AZE_MODUS = process.argv.includes('--aze');
const argOrdner = process.argv.slice(2).find(a => !a.startsWith('--'));
const ausgabe = resolve(argOrdner || (AZE_MODUS ? 'aze-testsatz' : 'ta-validator-satz'));
const RECHNUNGSDATUM = '2026-10-21';

const legs = legsFuer('podologie');
const TARIF = { abrechnungscode: abrechnungscodeAusLegs(legs), tarifkennzeichen: tarifkennzeichenAusLegs(legs) };

const ABSENDER = AZE_MODUS
  ? { ik: '590537440', name: 'Yavuz Kemal Demir Softwaretest' }
  : { ik: '801234561', name: 'Podologie Teststadt' };
const DAS = {
  iqvia: { ik: '661430035', name: 'IQVIA HSS' },
  ddg:   { ik: '660510336', name: 'DDG Essen' },
  aze:   { ik: '107436557', name: 'Abrechnungszentrum Emmendingen' },
};
const KASSE = { tk: '101575519', barmer: '104940005', mhplus: '108035612' };

/** Preis + Zuzahlung der Position am Leistungstag — aus derselben Tabelle wie die App. */
function pos(hpnr, datum, anzahl = 1) {
  const p = findPodologiePosition(hpnr, datum);
  if (!p) throw new Error(`Position ${hpnr} am ${datum} nicht im Katalog`);
  return { positionsnummer: hpnr, datumLeistung: datum, anzahl, einzelbetrag: p.preis, zuzahlungProPos: p.zuzahlung ?? 0 };
}

let belegnr = 0;
function patient(nachname, vorname, geburtsdatum, kvnr, versichertenstatus = '10000') {
  belegnr += 1;
  return {
    kvnr, versichertenstatus, nachname, vorname, geburtsdatum,
    strasse: 'Teststraße 1', plz: '53721', ort: 'Siegburg',
    belegnummer: String(belegnr).padStart(7, '0'),
  };
}

function verordnung({ kasse = AZE_MODUS ? KASSE.mhplus : KASSE.tk, icd10, diagnosegruppe, leitsymptomatik = '1010',
                      zuzahlungskennzeichen = '3', hausbesuch = false, ausstellungsdatum = '2026-09-22' }) {
  return {
    arztLanr: '999999900', arztBsnr: '999999999',
    ausstellungsdatum, icd10, diagnosegruppe, verordnungsart: '03', leitsymptomatik,
    dringend: false, hausbesuch, heilmittelBereich: '2', therapiefrequenz: '0',
    zuzahlungskennzeichen, kostentraegerIk: kasse, krankenkasseIk: kasse,
  };
}

const rx = (pat, vo, sessions) => ({ patient: pat, verordnung: vo, tarif: TARIF, sessions });

// ── Die Fälle ───────────────────────────────────────────────────────────────
const alleFaelle = [
  {
    name: '01_df_erstverordnung_zuzahlungspflichtig',
    hinweis: 'DF, Eingangsbefundung 78040 + 4× Behandlung groß 78020, zuzahlungspflichtig',
    prescriptions: [rx(
      patient('Probe', 'Anna', '1952-03-14', 'T100000017'),
      verordnung({ icd10: 'E11.74', diagnosegruppe: 'DF' }),
      [pos('78040', '2026-09-29'), pos('78020', '2026-09-29'), pos('78020', '2026-10-27'),
       pos('78020', '2026-11-24'), pos('78020', '2026-12-22')].filter(s => s.datumLeistung <= RECHNUNGSDATUM),
    )],
  },
  {
    name: '02_df_befreit',
    hinweis: 'DF, Patient von der Zuzahlung befreit (Kennzeichen 1), 78030 + 78010',
    prescriptions: [rx(
      patient('Muster', 'Bernd', '1948-11-02', 'T200000013', '50000'),
      verordnung({ icd10: 'E11.74', diagnosegruppe: 'DF', zuzahlungskennzeichen: '1' }),
      [pos('78030', '2026-09-30'), pos('78010', '2026-09-30'), pos('78010', '2026-10-21')],
    )],
  },
  {
    name: '03_df_hausbesuch',
    hinweis: 'DF, Hausbesuch ärztlich verordnet: je Tag 78020 + 79933',
    prescriptions: [rx(
      patient('Beispiel', 'Clara', '1940-06-21', 'T300000019', '50000'),
      verordnung({ icd10: 'E11.74', diagnosegruppe: 'DF', hausbesuch: true }),
      [pos('78020', '2026-09-25'), pos('79933', '2026-09-25'),
       pos('78020', '2026-10-20'), pos('79933', '2026-10-20')],
    )],
  },
  {
    name: '04_df_hausbesuch_soziale_einrichtung',
    hinweis: 'DF, Hausbesuch in sozialer Einrichtung (Pflegeheim): 78010 + 79934',
    prescriptions: [rx(
      patient('Versuch', 'Dieter', '1936-01-09', 'T400000015', '50000'),
      verordnung({ icd10: 'E11.74', diagnosegruppe: 'DF', hausbesuch: true }),
      [pos('78010', '2026-10-02'), pos('79934', '2026-10-02')],
    )],
  },
  {
    name: '05_nf_neuropathie',
    hinweis: 'NF (Neuropathie ohne Diabetes), 78010 zweimal',
    prescriptions: [rx(
      patient('Kontrolle', 'Eva', '1961-08-30', 'T500000011'),
      verordnung({ icd10: 'G60.0', diagnosegruppe: 'NF' }),
      [pos('78010', '2026-10-05'), pos('78010', '2026-10-19')],
    )],
  },
  {
    name: '06_ui1_nagelspange',
    hinweis: 'UI1 (eingewachsener Nagel): Erstbefundung 78100, Spange 78610, Kontrolle 78510, Abschluss 78520',
    prescriptions: [rx(
      patient('Nagel', 'Felix', '1999-04-12', 'T600000018'),
      verordnung({ icd10: 'L60.0', diagnosegruppe: 'UI1' }),
      [pos('78100', '2026-09-28'), pos('78610', '2026-09-28'),
       pos('78510', '2026-10-12'), pos('78520', '2026-10-19')],
    )],
  },
  {
    name: '07_mehrere_verordnungen_gemischter_status',
    hinweis: 'Drei Patienten in einer Datei: Mitglied (1), Familienversichert (3), Rentner (5) — GES-Summen je Status',
    prescriptions: [
      rx(patient('Eins', 'Gerda', '1958-02-02', 'T700000014', '10000'),
         verordnung({ icd10: 'E11.74', diagnosegruppe: 'DF' }),
         [pos('78020', '2026-10-01')]),
      rx(patient('Zwei', 'Hans', '1966-05-05', 'T710000017', '30000'),
         verordnung({ icd10: 'E10.74', diagnosegruppe: 'DF' }),
         [pos('78010', '2026-10-06'), pos('78010', '2026-10-20')]),
      rx(patient('Drei', 'Ilse', '1944-09-09', 'T720000010', '50000'),
         verordnung({ icd10: 'E11.74', diagnosegruppe: 'DF', zuzahlungskennzeichen: '1' }),
         [pos('78020', '2026-10-08')]),
    ],
  },
  {
    name: '08_barmer_an_ddg',
    hinweis: 'BARMER → DDG Essen (nicht IQVIA). Prüft, ob der Validator fremde DAS-Dateien annimmt',
    das: DAS.ddg,
    prescriptions: [rx(
      patient('Anders', 'Jana', '1957-12-24', 'T800000010'),
      verordnung({ kasse: KASSE.barmer, icd10: 'E11.74', diagnosegruppe: 'DF' }),
      [pos('78020', '2026-10-09')],
    )],
  },
];

// Fall 08 prüft eine fremde DAS — gehört nicht in den AZE-Satz.
const faelle = AZE_MODUS ? alleFaelle.filter(f => !f.das) : alleFaelle;

// ── Erzeugen ────────────────────────────────────────────────────────────────
mkdirSync(ausgabe, { recursive: true });
let fehler = 0;
faelle.forEach((fall, i) => {
  const das = AZE_MODUS ? DAS.aze : (fall.das || DAS.iqvia);
  try {
    const r = buildDtaFile({
      absender: ABSENDER,
      empfaenger: das,
      davIk: das.ik,
      kassenart: AZE_MODUS ? 'BK' : 'EK',
      rechnung: { sammelRechnungsnummer: `T2026-10-${String(i + 1).padStart(3, '0')}`, einzelRechnungsnummer: '0',
                  datum: RECHNUNGSDATUM, datennummer: i + 1, rechnungsart: '1' },
      kind: 'test',
      transfernummer: i + 1,
      vkz: '01',
      prescriptions: fall.prescriptions,
    });
    const check = pruefeDatenstrom(r.content);
    if (AZE_MODUS) {
      // Anlage 7 Prüfung 2: Nutzdatei und Auftragsdatei tragen dieselben ersten 8 Stellen.
      const ordner = join(ausgabe, `${r.filename}_${fall.name}`);
      mkdirSync(ordner, { recursive: true });
      writeFileSync(join(ordner, r.filename), r.content, { encoding: 'latin1' });
      writeFileSync(join(ordner, `${r.filename}.AUF`), r.auftragsdatei, { encoding: 'latin1' });
      if (Buffer.byteLength(r.auftragsdatei, 'latin1') !== 348) throw new Error('Auftragssatz ≠ 348 Byte');
    } else {
      writeFileSync(join(ausgabe, `${fall.name}.edi`), r.content, { encoding: 'latin1' });
    }
    const ok = check?.ok !== false;
    if (!ok) fehler += 1;
    console.log(`${ok ? 'OK ' : 'ERR'} ${AZE_MODUS ? r.filename + ' ' : ''}${fall.name}  ${r.byteLength} B, ${r.segmentCount} Seg., brutto ${r.totals.brutto} €, Zuzahlung ${r.totals.gesZuzahlung} €` +
      (r.preflightWarnings?.length ? `  [Warnungen: ${r.preflightWarnings.map(w => w.code).join(', ')}]` : '') +
      (ok ? '' : `  Selbstprüfung: ${JSON.stringify(check.errors || check).slice(0, 300)}`));
  } catch (e) {
    fehler += 1;
    console.log(`ERR ${fall.name}: ${e.message}`);
  }
});
writeFileSync(join(ausgabe, 'LIESMICH.txt'),
  'TA-Validator-Satz ' + RECHNUNGSDATUM + ' — synthetische Daten, Testindikator 0.\n\n' +
  faelle.map(f => `${f.name}.edi\n  ${f.hinweis}`).join('\n') + '\n', 'utf8');
console.log(`\n${faelle.length - fehler}/${faelle.length} Dateien → ${ausgabe}`);
process.exitCode = fehler ? 1 : 0;
