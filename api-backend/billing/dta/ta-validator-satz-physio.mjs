// Testdateien für den TA-Validator / AZE — Physiotherapie (Gegenstück zu
// `ta-validator-satz.mjs`, das nur Podologie kennt).
//
//   node api-backend/billing/dta/ta-validator-satz-physio.mjs [ausgabe-ordner] [--aze]
//
// Warum ein eigener Satz: bis 19.11.2026 lief noch keine Physio-Datei durch einen
// externen Prüfer (Physio/PILOT-PLAN.md §5). `fixtures.js` → `physioFixture` ist
// ein eingefrorenes Golden (ungültige IK, preflight aus, Preis fest im Fixture)
// und taugt dafür nicht.
//
// Weg je Fall = derselbe wie `mapPrescriptionToDtaShape` (abrechnung.routes.js):
//   validatePhysioAbrechnung → physioLeistungszeilen → resolvePreis → buildDtaFile
// → pruefeDatenstrom. Der Mapper selbst ist nicht exportiert (hängt an Express/
// Supabase); die Bausteine sind dieselben, nichts ist hier nachgebaut.
//
// Bewusst NICHT im Satz:
//   • Entlassmanagement — der Builder schreibt heute kein Entlass-Merkmal in die
//     Datei (grep "entlass" dta/builder.js → 0); Publikation hängt hinter
//     PHYSIO_PUBLIKATION_V1. Erst klären (gkv-302), dann Fall ergänzen.
//   • Blanko — validatePhysioAbrechnung sperrt absichtlich (PHYSIO_BLANKO_TAXIERUNG_UNGEPRUEFT).
//   • Zuzahlung mit 18. Geburtstag / Befreiung über Jahreswechsel — Partnerfrage #22.
//
// ⛔ Nur SYNTHETISCHE Daten. Namen, KVNR, Arzt-Nummern sind erfunden.
// Testindikator 0 (kind 'test'). Versand an AZE/Validator nur mit GO (rote Linie „Senden").

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDtaFile } from './builder.js';
import { pruefeDatenstrom } from './preflight.js';
import { validatePhysioAbrechnung } from './physio-verfahren.js';
import { heilmittelBereichFuer, therapiefrequenzFuer } from './zhe-kennzeichen.js';
import { legsFuer, abrechnungscodeAusLegs, tarifkennzeichenAusLegs } from '../codes/legs.js';
import { physioLeistungszeilen } from '../codes/physio-leistungszeilen.js';
import { resolvePositionsnummer } from '../codes/physio_positions.js';
import { resolvePreis } from '../preise/resolver.js';

const SECTOR = 'physiotherapy';
const AZE_MODUS = process.argv.includes('--aze');
const argOrdner = process.argv.slice(2).find(a => !a.startsWith('--'));
const ausgabe = resolve(argOrdner || (AZE_MODUS ? 'aze-testsatz-physio' : 'ta-validator-satz-physio'));
const RECHNUNGSDATUM = '2026-10-30';

const legs = legsFuer(SECTOR);
const AC = abrechnungscodeAusLegs(legs);
const TARIF = { abrechnungscode: AC, tarifkennzeichen: tarifkennzeichenAusLegs(legs) };

// Gleiche Absender/Empfänger-Logik wie der Podologie-Satz (dort begründet).
const ABSENDER = AZE_MODUS
  ? { ik: '590537440', name: 'Yavuz Kemal Demir Softwaretest' }
  : { ik: '801234561', name: 'Physiotherapie Teststadt' };
const DAS = {
  iqvia: { ik: '661430035', name: 'IQVIA HSS' },
  aze:   { ik: '107436557', name: 'Abrechnungszentrum Emmendingen' },
};
const KASSE = { tk: '101575519', mhplus: '108035612' };

let belegnr = 0;
/**
 * @param {string} nachname
 * @param {string} vorname
 * @param {string} geburtsdatum
 * @param {string} kvnr
 * @param {string} [versichertenstatus]
 */
function patient(nachname, vorname, geburtsdatum, kvnr, versichertenstatus = '10000') {
  belegnr += 1;
  return {
    kvnr, versichertenstatus, nachname, vorname, geburtsdatum,
    strasse: 'Teststraße 1', plz: '53721', ort: 'Siegburg',
    belegnummer: String(belegnr).padStart(7, '0'),
  };
}

/**
 * Ein Fall in der Form einer `prescriptions`-Zeile + erbrachter Sitzungen,
 * dann derselbe Weg wie im produktiven Mapper.
 * @param {{
 *   pat: ReturnType<typeof patient>,
 *   icd10: string, diagnosegruppe: string,
 *   position: string, anzahl: number, tage: string[],
 *   ergaenzend?: string, hausbesuch?: boolean, befreit?: boolean,
 *   ausstellungsdatum?: string, frequenz?: string,
 * }} f
 */
function fall({ pat, icd10, diagnosegruppe, position, anzahl, tage, ergaenzend, hausbesuch = false,
                befreit = false, ausstellungsdatum = '2026-09-28', frequenz = '2' }) {
  const kasse = AZE_MODUS ? KASSE.mhplus : KASSE.tk;
  const rx = {
    heilmittel_position: position,
    anzahl_einheiten: anzahl,
    vorrangig_einheiten: anzahl,
    ergaenzend_position: ergaenzend || null,
    ergaenzend_einheiten: ergaenzend ? anzahl : null,
    hausbesuch,
    hausbesuch_ort: hausbesuch ? 'haeuslich' : null,
    ausstellungsdatum, diagnosegruppe, icd10,
    zuzahlung_befreit: befreit,
    is_dringend: false,
  };
  const sessions = tage.map((d, i) => ({
    id: `s${i + 1}`,
    done_at: `${d}T08:00:00Z`,
    ergaenzend_erbracht: !!ergaenzend,
    bookings: { hausbesuch },
  }));

  const gate = validatePhysioAbrechnung({
    rx: { ...rx, patient_geburtsdatum: pat.geburtsdatum }, sessions, entlassmanagement: false,
  });
  if (!gate.ok || !gate.verordnungsart) throw new Error(`Physio-Prüfung: ${gate.errors.map(e => e.code).join(', ')}`);
  const verordnungsart = gate.verordnungsart;

  const zeilen = physioLeistungszeilen(rx, sessions).map(z => {
    const datum = String(z.done_at).slice(0, 10);
    const { preis_eur, zuzahlung_eur } = resolvePreis({ bereich: 'physiotherapie', code: z.code, datum, abrechnungscode: AC, abrechnung: true });
    return {
      positionsnummer: resolvePositionsnummer(z.code, AC),
      datumLeistung: datum, anzahl: z.anzahl,
      einzelbetrag: preis_eur, zuzahlungProPos: befreit ? 0 : zuzahlung_eur,
    };
  });

  return {
    patient: pat,
    doctor: { lanr: '999999999', bsnr: '999999999' },
    verordnung: {
      ausstellungsdatum, icd10, icd10Liste: [icd10], diagnosegruppe,
      verordnungsart, leitsymptomatik: '1000',
      dringend: false, hausbesuch,
      heilmittelBereich: heilmittelBereichFuer(SECTOR),
      therapiefrequenz: therapiefrequenzFuer(SECTOR, frequenz),
      zuzahlungskennzeichen: befreit ? '1' : '3',
      kostentraegerIk: kasse, krankenkasseIk: kasse,
    },
    tarif: TARIF,
    sessions: zeilen,
  };
}

const KG = 'X0501', MT = 'X1201', HEISSE_ROLLE = 'X1530';

const faelle = [
  {
    name: '01_ws_kg_zuzahlungspflichtig',
    hinweis: 'WS, 6× KG (X0501), 2×/Woche, zuzahlungspflichtig',
    prescriptions: [fall({ pat: patient('Probe', 'Anna', '1962-03-14', 'T100000015'),
      icd10: 'M54.4', diagnosegruppe: 'WS', position: KG, anzahl: 6,
      tage: ['2026-10-05', '2026-10-08', '2026-10-12', '2026-10-15', '2026-10-19', '2026-10-22'] })],
  },
  {
    name: '02_ex_mt_befreit',
    hinweis: 'EX, 6× Manuelle Therapie (X1201), Patient befreit (Kennzeichen 1)',
    prescriptions: [fall({ pat: patient('Muster', 'Bernd', '1948-11-02', 'T200000016', '50000'),
      icd10: 'M17.1', diagnosegruppe: 'EX', position: MT, anzahl: 6, befreit: true,
      tage: ['2026-10-06', '2026-10-09', '2026-10-13', '2026-10-16', '2026-10-20', '2026-10-23'] })],
  },
  {
    name: '03_ws_kg_plus_waerme',
    hinweis: 'WS, 6× KG + ergänzend Heiße Rolle (X1530) je Sitzung',
    prescriptions: [fall({ pat: patient('Beispiel', 'Clara', '1970-06-21', 'T300000017'),
      icd10: 'M54.4', diagnosegruppe: 'WS', position: KG, anzahl: 6, ergaenzend: HEISSE_ROLLE,
      tage: ['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14', '2026-10-19', '2026-10-21'] })],
  },
  {
    name: '04_ex_kg_hausbesuch',
    hinweis: 'EX, 6× KG mit ärztlich verordnetem Hausbesuch (häuslich, X9950)',
    prescriptions: [fall({ pat: patient('Versuch', 'Dieter', '1938-01-09', 'T400000018', '50000'),
      icd10: 'M17.1', diagnosegruppe: 'EX', position: KG, anzahl: 6, hausbesuch: true,
      tage: ['2026-10-06', '2026-10-08', '2026-10-13', '2026-10-15', '2026-10-20', '2026-10-22'] })],
  },
  {
    name: '05_mehrere_verordnungen',
    hinweis: 'Zwei Patienten in einer Datei: Mitglied (1) KG, Rentner (5) MT — GES-Summen je Status',
    prescriptions: [
      fall({ pat: patient('Eins', 'Gerda', '1975-02-02', 'T700000011', '10000'),
        icd10: 'M54.4', diagnosegruppe: 'WS', position: KG, anzahl: 6,
        tage: ['2026-10-05', '2026-10-08', '2026-10-12'] }),
      fall({ pat: patient('Drei', 'Ilse', '1944-09-09', 'T720000015', '50000'),
        icd10: 'M17.1', diagnosegruppe: 'EX', position: MT, anzahl: 6,
        tage: ['2026-10-06', '2026-10-09'] }),
    ],
  },
];

// ── Erzeugen ────────────────────────────────────────────────────────────────
// Physio ab Transfer-/Dateinummer 101 (TSOL0101 …), damit sich die Dateinamen
// beim selben Absender nie mit dem Podologie-Satz (TSOL0001 …) überschneiden.
const NUMMER_AB = 100;
mkdirSync(ausgabe, { recursive: true });
let fehler = 0;
faelle.forEach((f, i) => {
  const das = AZE_MODUS ? DAS.aze : DAS.iqvia;
  try {
    const r = buildDtaFile({
      absender: ABSENDER,
      empfaenger: das,
      davIk: das.ik,
      kassenart: AZE_MODUS ? 'BK' : 'EK',
      rechnung: { sammelRechnungsnummer: `P2026-10-${String(i + 1).padStart(3, '0')}`, einzelRechnungsnummer: '0',
                  datum: RECHNUNGSDATUM, datennummer: NUMMER_AB + i + 1, rechnungsart: '1' },
      kind: 'test',
      transfernummer: NUMMER_AB + i + 1,
      vkz: '01',
      prescriptions: f.prescriptions,
    });
    const check = /** @type {{ ok?: boolean, errors?: unknown } | null | undefined} */ (pruefeDatenstrom(r.content));
    if (AZE_MODUS) {
      const ordner = join(ausgabe, `${r.filename}_${f.name}`);
      mkdirSync(ordner, { recursive: true });
      writeFileSync(join(ordner, r.filename), r.content, { encoding: 'latin1' });
      writeFileSync(join(ordner, `${r.filename}.AUF`), r.auftragsdatei, { encoding: 'latin1' });
      if (Buffer.byteLength(r.auftragsdatei, 'latin1') !== 348) throw new Error('Auftragssatz ≠ 348 Byte');
    } else {
      writeFileSync(join(ausgabe, `${f.name}.edi`), r.content, { encoding: 'latin1' });
    }
    const ok = check?.ok !== false;
    if (!ok) fehler += 1;
    console.log(`${ok ? 'OK ' : 'ERR'} ${AZE_MODUS ? r.filename + ' ' : ''}${f.name}  ${r.byteLength} B, ${r.segmentCount} Seg., brutto ${r.totals.brutto} €, Zuzahlung ${r.totals.gesZuzahlung} €` +
      (r.preflightWarnings?.length ? `  [Warnungen: ${r.preflightWarnings.map(w => w.code).join(', ')}]` : '') +
      (ok ? '' : `  Selbstprüfung: ${JSON.stringify(check?.errors || check).slice(0, 300)}`));
  } catch (e) {
    fehler += 1;
    console.log(`ERR ${f.name}: ${e instanceof Error ? e.message : String(e)}`);
  }
});
writeFileSync(join(ausgabe, 'LIESMICH.txt'),
  'TA-Validator-Satz Physiotherapie ' + RECHNUNGSDATUM + ' — synthetische Daten, Testindikator 0.\n\n' +
  faelle.map(f => `${f.name}\n  ${f.hinweis}`).join('\n') + '\n', 'utf8');
console.log(`\n${faelle.length - fehler}/${faelle.length} Dateien → ${ausgabe}`);
process.exitCode = fehler ? 1 : 0;
