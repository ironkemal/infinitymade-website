// Top-level rezept validator — picks the right engine based on input shape.
//
// Strategy:
//   1. If `heilmittel_feld_text` contains "BLANKOVERORDNUNG" OR rezept_typ === 'blanko'
//      → run blankoRules
//   2. Else if ICD is on KBV LHB/BVB Diagnoseliste
//      → run lhbBvbRules (with explicit opt-in flag `rezept_typ === 'lhb_bvb'` for
//        clean separation; we auto-detect but mark in 'computed' so user can override)
//   3. Else → standardRules
//
// Always returns the same shape: { ok, warnings, blockers, computed, engine }.

import { validateStandard } from './standardRules.js';
import { validateLhbBvb } from './lhbBvbRules.js';
import { validateBlanko } from './blankoRules.js';
import { lookupLhbBvb, lookupBlankoShoulder } from './catalog.js';

function inferRezeptTyp(rezept) {
  if (rezept.rezept_typ) return rezept.rezept_typ;
  const marker = (rezept.heilmittel_feld_text || '').toUpperCase();
  if (marker.includes('BLANKOVERORDNUNG')) return 'blanko';
  if (rezept.icd10 && lookupBlankoShoulder(rezept.icd10) && rezept.diagnosegruppe === 'EX') {
    // Strong hint: ICD on Blanko list + EX. But without the marker, this is only suggestive.
    // Don't auto-promote — surface as warning instead.
    return 'standard';
  }
  if (rezept.icd10 && lookupLhbBvb(rezept.icd10)) {
    return 'lhb_bvb';
  }
  return 'standard';
}

export function validateRezept(rezept) {
  if (!rezept || typeof rezept !== 'object') {
    return {
      ok: false,
      engine: null,
      warnings: [],
      blockers: [{ code: 'INVALID_INPUT', msg: 'Rezept payload missing or not an object.' }],
      computed: {}
    };
  }

  const typ = inferRezeptTyp(rezept);
  let result;
  switch (typ) {
    case 'blanko':
      result = validateBlanko(rezept);
      break;
    case 'lhb_bvb':
      result = validateLhbBvb(rezept);
      break;
    case 'standard':
    default:
      result = validateStandard(rezept);
      // Cross-check: did the user miss a Blanko or LHB opportunity?
      if (rezept.icd10) {
        if (lookupBlankoShoulder(rezept.icd10) && rezept.diagnosegruppe === 'EX' && !result.warnings.some(w => w.code === 'BLANKO_HINT')) {
          result.warnings.push({
            code: 'BLANKO_HINT',
            msg: `ICD ${rezept.icd10} ist für Blankoverordnung Physiotherapie zugelassen. Falls eine Blankoverordnung gewünscht ist, muss "BLANKOVERORDNUNG" im Feld "Heilmittel nach Maßgabe des Kataloges" eingetragen sein.`,
            field: 'heilmittel_feld_text'
          });
        }
        if (lookupLhbBvb(rezept.icd10) && !result.warnings.some(w => w.code === 'LHB_HINT')) {
          result.warnings.push({
            code: 'LHB_HINT',
            msg: `ICD ${rezept.icd10} ist auf der KBV-Diagnoseliste für langfristigen Heilmittelbedarf / besonderen Verordnungsbedarf. Bei chronischem/schwerem Verlauf kann der Arzt bis zu 12 Wochen Behandlungsmenge verordnen.`,
            field: 'icd10'
          });
        }
      }
      break;
  }

  return { ...result, engine: typ };
}
