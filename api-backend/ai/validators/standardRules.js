// Standard prescription rules (klassische Verordnung) per G-BA Heilmittel-Richtlinie.
//
// Input shape (rezept):
// {
//   icd10:                 "M54.5",
//   diagnosegruppe:        "WS2",          // optional, derived if missing
//   anzahl_einheiten:      6,
//   ausstellungsdatum:     "2026-05-10",   // ISO date
//   behandlungsbeginn:     "2026-05-14",   // ISO date (optional, just planned)
//   is_dringend:           false,          // "Dringender Behandlungsbedarf" checkbox
//   patient_geburtsdatum:  "1985-03-12",   // optional, for Zuzahlung exemption
// }
//
// Output (uniform across all validators):
// {
//   ok:        boolean,            // false if any blocker
//   warnings:  [{code, msg, ...}],
//   blockers:  [{code, msg, ...}],
//   computed:  {
//     max_sessions, frequency_hint, latest_start_date,
//     zuzahlung_required, zuzahlung_eur_per_blatt, zuzahlung_percent,
//     verordnung_typ: 'standard'
//   }
// }

import { getDiagnosegruppe, getIcdDgRules } from './catalog.js';
import { checkIcdDg } from './icdDgRules.js';
import { parseIsoDatum, pruefeBehandlungsbeginn } from './fristen.js';

const ZUZAHLUNG_PERCENT = 10;
const ZUZAHLUNG_PER_BLATT_EUR = 10;

/**
 * @typedef {import('./validate.js').RezeptEingabe} RezeptEingabe
 * @typedef {import('./validate.js').ValidatorBefund} ValidatorBefund
 */

/**
 * @param {string | null | undefined} geburtsdatum
 * @param {Date | null | undefined} [referenceDate]
 * @returns {boolean}
 */
function isUnder18(geburtsdatum, referenceDate) {
  const dob = parseIsoDatum(geburtsdatum);
  if (!dob) return false;
  const ref = referenceDate || new Date();
  const age = ref.getFullYear() - dob.getFullYear()
    - (ref < new Date(ref.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
  return age < 18;
}

/**
 * @param {RezeptEingabe} rezept
 */
export function validateStandard(rezept) {
  /** @type {ValidatorBefund[]} */
  const warnings = [];
  /** @type {ValidatorBefund[]} */
  const blockers = [];

  const dg = rezept.diagnosegruppe;
  const dgMeta = getDiagnosegruppe(dg);
  if (!dgMeta) {
    blockers.push({
      code: 'DG_UNKNOWN',
      msg: `Diagnosegruppe '${dg || '(leer)'}' ist unbekannt oder fehlt.`,
      field: 'diagnosegruppe'
    });
  }

  const maxSessions = dgMeta?.hoechstmenge ?? 6;
  const anzahl = Number(rezept.anzahl_einheiten) || 0;
  if (anzahl <= 0) {
    blockers.push({
      code: 'ANZAHL_REQUIRED',
      msg: 'Anzahl der Behandlungseinheiten fehlt.',
      field: 'anzahl_einheiten'
    });
  } else if (anzahl > maxSessions) {
    // EU-MDR compliance: this is an informational billing-preparation hint, not a clinical block.
    // The licensed therapist must confirm whether a doctor-authorised exception (BVB/LHB) applies.
    warnings.push({
      code: 'OVER_HOECHSTMENGE',
      msg: `Für Diagnosegruppe ${dg} liegt die Regelhöchstmenge bei ${maxSessions} Behandlungseinheiten je Verordnung (angegeben: ${anzahl}). Bitte prüfen Sie, ob ein ärztlich genehmigter Ausnahmefall (BVB/LHB) vorliegt. Die therapeutische Entscheidung obliegt dem behandelnden Therapeuten.`,
      field: 'anzahl_einheiten',
      max_allowed: maxSessions,
      requested: anzahl,
      regulation: 'G-BA Heilmittel-Richtlinie § 7 / Heilmittelkatalog',
      requires_confirmation: true
    });
  }

  const ausstellung = parseIsoDatum(rezept.ausstellungsdatum);
  if (!ausstellung) {
    blockers.push({
      code: 'AUSSTELLUNGSDATUM_INVALID',
      msg: 'Ausstellungsdatum fehlt oder ist ungültig.',
      field: 'ausstellungsdatum'
    });
  }

  // EU-MDR compliance: validity-window enforcement is an administrative billing hint.
  // The therapist (not the software) decides whether to accept a late-start prescription.
  const fristPruefung = pruefeBehandlungsbeginn({
    ausstellungsdatum: ausstellung,
    behandlungsbeginn: rezept.behandlungsbeginn,
    isDringend: !!rezept.is_dringend
  });
  blockers.push(.../** @type {ValidatorBefund[]} */ (fristPruefung.blockers));
  warnings.push(.../** @type {ValidatorBefund[]} */ (fristPruefung.warnings));

  // Zuzahlung
  const under18 = isUnder18(rezept.patient_geburtsdatum, ausstellung);
  const isPrivat = rezept?.insurance_type === 'privat';
  const zuzahlungRequired = !under18 && !isPrivat;
  if (under18 && rezept.patient_geburtsdatum) {
    warnings.push({
      code: 'ZUZAHLUNG_BEFREIT',
      msg: 'Patient ist unter 18 Jahre alt — Zuzahlung entfällt.',
      field: 'patient_geburtsdatum'
    });
  }

  // ICD <-> Diagnosegruppe-Prüfung (Podologie: DF/NF/QF/UI1/UI2)
  // Physio/Logo/Ergo haben keinen ICD-Pool => checkIcdDg gibt [] zurueck.
  const icdDgWarnings = checkIcdDg(
    { icd10: rezept.icd10, diagnosegruppe: dg, diagnosetext: rezept.diagnose_freitext ?? rezept.diagnosetext },
    getIcdDgRules()
  );
  warnings.push(...icdDgWarnings);

  return {
    ok: blockers.length === 0,
    warnings,
    blockers,
    computed: {
      verordnung_typ: 'standard',
      max_sessions: maxSessions,
      requested_sessions: anzahl,
      frequency_hint: dgMeta?.frequency_hint || null,
      latest_start_date: fristPruefung.latestStartIso,
      zuzahlung_required: zuzahlungRequired,
      zuzahlung_percent: zuzahlungRequired ? ZUZAHLUNG_PERCENT : 0,
      zuzahlung_eur_per_blatt: zuzahlungRequired ? ZUZAHLUNG_PER_BLATT_EUR : 0,
      diagnosegruppe_title: dgMeta?.title || null,
      regulation_source: 'G-BA Heilmittel-Richtlinie 2025-05 / Heilmittelkatalog'
    }
  };
}
