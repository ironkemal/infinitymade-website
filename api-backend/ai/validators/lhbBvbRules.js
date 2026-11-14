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
import { parseIsoDatum, pruefeBehandlungsbeginn } from './fristen.js';

const MAX_WEEKS_PER_VERORDNUNG = 12;

/**
 * @typedef {import('./validate.js').RezeptEingabe} RezeptEingabe
 * @typedef {import('./validate.js').ValidatorBefund} ValidatorBefund
 */

/**
 * @param {RezeptEingabe} rezept
 */
export function validateLhbBvb(rezept) {
  /** @type {ValidatorBefund[]} */
  const warnings = [];
  /** @type {ValidatorBefund[]} */
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
  let hasDgMismatch = false;
  if (rezept.diagnosegruppe && !entry.diagnosegruppen.includes(rezept.diagnosegruppe)) {
    // Tolerate group prefix match (e.g. sub-specifier suffix like DF-a vs catalog DF)
    const dg = rezept.diagnosegruppe;
    const prefixHit = entry.diagnosegruppen.some((/** @type {string} */ d) =>
      dg.startsWith(d) || d.startsWith(dg)
    );
    if (!prefixHit) {
      hasDgMismatch = true;
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

  const dgMeta = getDiagnosegruppe(rezept.diagnosegruppe || entry.diagnosegruppen[0]);
  const anzahl = Number(rezept.anzahl_einheiten) || 0;
  let maxSessions = null;

  if (hasDgMismatch) {
    // Ohne passende Diagnosegruppe greift die LHB/BVB-Ausnahme nicht (HeilM-RL § 7 Abs. 5 / § 8 Abs. 2 S. 1):
    // 12-Wochen-Heuristik überspringen; Regelhöchstmenge nur prüfen, wenn DG-Metadaten bekannt sind (kein 6er-Fallback).
    if (anzahl <= 0) {
      blockers.push({
        code: 'ANZAHL_REQUIRED',
        msg: 'Anzahl der Behandlungseinheiten fehlt.',
        field: 'anzahl_einheiten'
      });
    } else if (dgMeta?.hoechstmenge != null && anzahl > dgMeta.hoechstmenge) {
      warnings.push({
        code: 'OVER_HOECHSTMENGE',
        msg: `Für Diagnosegruppe ${rezept.diagnosegruppe} liegt die Regelhöchstmenge bei ${dgMeta.hoechstmenge} Behandlungseinheiten je Verordnung (angegeben: ${anzahl}). Bei nicht passender Diagnosegruppe greift die LHB/BVB-Ausnahme nicht.`,
        field: 'anzahl_einheiten',
        max_allowed: dgMeta.hoechstmenge,
        requested: anzahl,
        regulation: 'HeilM-RL § 7 Abs. 5 / § 8 Abs. 2 S. 1',
        requires_confirmation: true
      });
    }
  } else {
    // Compute max sessions: 12 weeks × frequency hint upper bound from DG metadata
    if (dgMeta?.frequency_hint) {
      const m = dgMeta.frequency_hint.match(/(\d+)\s*-\s*(\d+)\s*x\s*w/i);
      if (m) {
        const maxFreqPerWeek = parseInt(m[2], 10);
        maxSessions = MAX_WEEKS_PER_VERORDNUNG * maxFreqPerWeek;
      }
    }
    maxSessions = maxSessions || (dgMeta?.orientierende_menge ?? 36);

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
  }

  const ausstellung = parseIsoDatum(rezept.ausstellungsdatum);
  if (!ausstellung) {
    blockers.push({
      code: 'AUSSTELLUNGSDATUM_INVALID',
      msg: 'Ausstellungsdatum fehlt oder ist ungültig.',
      field: 'ausstellungsdatum'
    });
  }

  // § 15 HeilM-RL (28 Tage regulär, 14 Tage bei dringendem Bedarf) gilt auch für LHB/BVB.
  const fristPruefung = pruefeBehandlungsbeginn({
    ausstellungsdatum: ausstellung,
    behandlungsbeginn: rezept.behandlungsbeginn,
    isDringend: !!rezept.is_dringend
  });
  blockers.push(.../** @type {ValidatorBefund[]} */ (fristPruefung.blockers));
  warnings.push(.../** @type {ValidatorBefund[]} */ (fristPruefung.warnings));

  const lhbTyp = entry.physio ? 'lhb_bvb_physio' : (entry.ergo ? 'lhb_bvb_ergo' : 'lhb_bvb');

  return {
    ok: blockers.length === 0,
    warnings,
    blockers,
    computed: {
      verordnung_typ: hasDgMismatch ? 'standard' : lhbTyp,
      lhb_bvb_diagnose: entry.diagnose,
      allowed_diagnosegruppen: entry.diagnosegruppen,
      hinweis: entry.hinweis,
      max_sessions_heuristic: maxSessions,
      max_weeks_per_verordnung: hasDgMismatch ? null : MAX_WEEKS_PER_VERORDNUNG,
      latest_start_date: fristPruefung.latestStartIso,
      exempt_from_wirtschaftlichkeitspruefung: !hasDgMismatch,
      zuzahlung_required: true,
      zuzahlung_percent: 10,
      zuzahlung_eur_per_blatt: 10,
      regulation_source: hasDgMismatch
        ? 'HeilM-RL § 7 Abs. 5 / § 8 Abs. 2 S. 1'
        : 'KBV Diagnoseliste § 32 Abs. 1a SGB V / § 106b Abs. 2 Satz 4 SGB V'
    }
  };
}
