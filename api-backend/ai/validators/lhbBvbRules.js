// LHB (Langfristiger Heilmittelbedarf) / BVB (Besonderer Verordnungsbedarf) rules.
//
// When an ICD-10 is on the KBV Diagnoseliste:
//   - The standard Höchstmenge can be exceeded.
//   - Behandlungsmenge may cover up to 12 weeks per Verordnung.
//   - The prescription is exempt from Wirtschaftlichkeitsprüfung (LHB)
//     or excluded from the doctor's Verordnungsvolumen (BVB).
//
// Hinweis field may carry a temporal restriction, e.g.
//   "längstens 1 Jahr nach Akutereignis"
// We surface this as a warning so the receptionist confirms the Akutereignis-Datum.

import { lookupLhbBvb, getDiagnosegruppe } from './catalog.js';

const MAX_WEEKS_PER_VERORDNUNG = 12;
const DEFAULT_GUELTIG_TAGE = 28;
const DRINGEND_GUELTIG_TAGE = 14;

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}
function addDays(d, days) {
  return new Date(d.getTime() + days * 86400000);
}

export function validateLhbBvb(rezept) {
  const warnings = [];
  const blockers = [];

  const entry = lookupLhbBvb(rezept.icd10);
  if (!entry) {
    return {
      ok: false,
      warnings: [],
      blockers: [{
        code: 'NOT_ON_LHB_BVB_LIST',
        msg: `ICD-10 ${rezept.icd10} ist nicht auf der KBV-Diagnoseliste für LHB/BVB. Bitte als Standardverordnung prüfen oder Genehmigung der Krankenkasse einholen.`,
        field: 'icd10'
      }],
      computed: { verordnung_typ: 'lhb_bvb' }
    };
  }

  // Verify the Diagnosegruppe declared on the rezept is in the allowed list for this ICD.
  if (rezept.diagnosegruppe && !entry.diagnosegruppen.includes(rezept.diagnosegruppe)) {
    // Tolerate group prefix match: rezept WS2 vs catalog WS
    const prefixHit = entry.diagnosegruppen.some(d =>
      rezept.diagnosegruppe.startsWith(d) || d.startsWith(rezept.diagnosegruppe)
    );
    if (!prefixHit) {
      warnings.push({
        code: 'DG_MISMATCH_LHB',
        msg: `Diagnosegruppe '${rezept.diagnosegruppe}' passt nicht zu den auf der LHB/BVB-Liste für ${rezept.icd10} hinterlegten Gruppen: ${entry.diagnosegruppen.join(', ')}.`,
        field: 'diagnosegruppe',
        allowed: entry.diagnosegruppen
      });
    }
  }

  // Hinweis surfacing (temporal restriction)
  if (entry.hinweis) {
    warnings.push({
      code: 'LHB_BVB_HINWEIS',
      msg: `Bedingung der LHB/BVB-Anerkennung für ${rezept.icd10}: "${entry.hinweis}". Bitte sicherstellen, dass diese Bedingung erfüllt ist (z. B. Akutereignis-Datum prüfen).`,
      field: 'icd10',
      hinweis: entry.hinweis
    });
  }

  // Compute max sessions: 12 weeks × frequency hint upper bound from DG metadata
  const dgMeta = getDiagnosegruppe(rezept.diagnosegruppe || entry.diagnosegruppen[0]);
  let maxSessions = null;
  if (dgMeta?.frequency_hint) {
    const m = dgMeta.frequency_hint.match(/(\d+)\s*-\s*(\d+)\s*x\s*w/i);
    if (m) {
      const maxFreqPerWeek = parseInt(m[2], 10);
      maxSessions = MAX_WEEKS_PER_VERORDNUNG * maxFreqPerWeek;
    }
  }
  maxSessions = maxSessions || (dgMeta?.orientierende_menge ?? 36);

  const anzahl = Number(rezept.anzahl_einheiten) || 0;
  if (anzahl > maxSessions) {
    warnings.push({
      code: 'OVER_12_WEEKS_HEURISTIC',
      msg: `Bei LHB/BVB sind bis zu 12 Wochen Behandlungsmenge je Verordnung zulässig. Bei der hinterlegten Frequenz ergibt das ca. ${maxSessions} Einheiten. Angegeben: ${anzahl}. Bitte ärztliche Bestätigung sichern.`,
      field: 'anzahl_einheiten',
      heuristic_max: maxSessions,
      regulation: 'KBV PraxisWissen Heilmittel 2026 — LHB/BVB-Regel'
    });
  } else if (anzahl <= 0) {
    blockers.push({
      code: 'ANZAHL_REQUIRED',
      msg: 'Anzahl der Behandlungseinheiten fehlt.',
      field: 'anzahl_einheiten'
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

  return {
    ok: blockers.length === 0,
    warnings,
    blockers,
    computed: {
      verordnung_typ: entry.physio ? 'lhb_bvb_physio' : (entry.ergo ? 'lhb_bvb_ergo' : 'lhb_bvb'),
      lhb_bvb_diagnose: entry.diagnose,
      allowed_diagnosegruppen: entry.diagnosegruppen,
      hinweis: entry.hinweis,
      max_sessions_heuristic: maxSessions,
      max_weeks_per_verordnung: MAX_WEEKS_PER_VERORDNUNG,
      latest_start_date: latestStart ? latestStart.toISOString().slice(0,10) : null,
      exempt_from_wirtschaftlichkeitspruefung: true,
      zuzahlung_required: true,
      zuzahlung_percent: 10,
      zuzahlung_eur_per_blatt: 10,
      regulation_source: 'KBV Diagnoseliste § 32 Abs. 1a SGB V / § 106b Abs. 2 Satz 4 SGB V'
    }
  };
}
