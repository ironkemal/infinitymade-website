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

import { getDiagnosegruppe } from './catalog.js';

const ZUZAHLUNG_PERCENT = 10;
const ZUZAHLUNG_PER_BLATT_EUR = 10;
const DEFAULT_GUELTIG_TAGE = 28;   // Verordnung verfällt nach 28 Tagen
const DRINGEND_GUELTIG_TAGE = 14;  // mit "dringend"-Flag: 14 Tage

function parseDate(s) {
  if (!s) return null;
  // Force UTC midnight to avoid timezone off-by-one
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

function addDays(d, days) {
  return new Date(d.getTime() + days * 86400000);
}

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function isUnder18(geburtsdatum, referenceDate) {
  const dob = parseDate(geburtsdatum);
  if (!dob) return false;
  const ref = referenceDate || new Date();
  const age = ref.getFullYear() - dob.getFullYear()
    - (ref < new Date(ref.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
  return age < 18;
}

export function validateStandard(rezept) {
  const warnings = [];
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

  const ausstellung = parseDate(rezept.ausstellungsdatum);
  if (!ausstellung) {
    blockers.push({
      code: 'AUSSTELLUNGSDATUM_INVALID',
      msg: 'Ausstellungsdatum fehlt oder ist ungültig.',
      field: 'ausstellungsdatum'
    });
  }

  const gueltigTage = rezept.is_dringend ? DRINGEND_GUELTIG_TAGE : DEFAULT_GUELTIG_TAGE;
  const latestStart = ausstellung ? addDays(ausstellung, gueltigTage) : null;

  if (ausstellung && rezept.behandlungsbeginn) {
    const begin = parseDate(rezept.behandlungsbeginn);
    if (begin && latestStart && begin > latestStart) {
      // EU-MDR compliance: validity-window enforcement is an administrative billing hint.
      // The therapist (not the software) decides whether to accept a late-start prescription.
      warnings.push({
        code: 'START_AFTER_DEADLINE',
        msg: `Behandlungsbeginn (${rezept.behandlungsbeginn}) liegt nach der regulären Verordnungsgültigkeit (${latestStart.toISOString().slice(0,10)}). ${rezept.is_dringend ? 'Bei "dringender Behandlungsbedarf" soll die Behandlung innerhalb von 14 Tagen beginnen.' : 'Verordnungen sind 28 Tage nach Ausstellung gültig.'} Bitte prüfen Sie mit dem verordnenden Arzt, ob eine erneute Ausstellung erforderlich ist.`,
        field: 'behandlungsbeginn',
        latest_allowed: latestStart.toISOString().slice(0,10),
        requires_confirmation: true
      });
    } else if (begin && ausstellung && daysBetween(ausstellung, begin) < 0) {
      blockers.push({
        code: 'START_BEFORE_AUSSTELLUNG',
        msg: 'Behandlungsbeginn liegt vor dem Ausstellungsdatum.',
        field: 'behandlungsbeginn'
      });
    }
  }

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

  return {
    ok: blockers.length === 0,
    warnings,
    blockers,
    computed: {
      verordnung_typ: 'standard',
      max_sessions: maxSessions,
      requested_sessions: anzahl,
      frequency_hint: dgMeta?.frequency_hint || null,
      latest_start_date: latestStart ? latestStart.toISOString().slice(0,10) : null,
      zuzahlung_required: zuzahlungRequired,
      zuzahlung_percent: zuzahlungRequired ? ZUZAHLUNG_PERCENT : 0,
      zuzahlung_eur_per_blatt: zuzahlungRequired ? ZUZAHLUNG_PER_BLATT_EUR : 0,
      diagnosegruppe_title: dgMeta?.title || null,
      regulation_source: 'G-BA Heilmittel-Richtlinie 2025-05 / Heilmittelkatalog'
    }
  };
}
