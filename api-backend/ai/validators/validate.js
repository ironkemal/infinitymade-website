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

// Guard: Blankoverordnung ist nach § 125a SGB V bislang nur für Ergotherapie (ab 01.04.2024)
// und Physiotherapie (ab 01.11.2024) vertraglich in Kraft. Dieses Modul bildet ausschließlich
// das Physiotherapie-Schulterprofil ab. Läuft ein Rezept mit Blanko-Kennzeichnung in die
// Blanko-Weiche, passt aber nicht auf dieses Profil (z. B. Podologie: Diagnosegruppe DF,
// ICD E11.7x), wird die Engine gar nicht erst betreten — sonst entstünden mehrere irreführende
// Einzelfehler (NOT_ON_BLANKO_LIST + BLANKO_DG_NOT_EX) statt einer verständlichen Aussage.
// Ratsbeschluss 2026-08-05 (konsey/tutanak/2026-08-05-blanko-fachbereich.md).
function blankoScopeGuard(rezept) {
  const icdOffList = !lookupBlankoShoulder(rezept.icd10);
  const dgNotEx = !!rezept.diagnosegruppe && rezept.diagnosegruppe !== 'EX';
  if (!icdOffList && !dgNotEx) return null;
  return {
    ok: false,
    warnings: [],
    blockers: [{
      code: 'BLANKO_NICHT_VERFUEGBAR',
      msg: 'Blankoverordnung ist derzeit nur für Physiotherapie mit Schulter-Diagnosen (Diagnosegruppe EX) vorgesehen — für andere Fachbereiche wie Podologie besteht kein Vertrag nach §125a SGB V. Bitte ICD-10 und Diagnosegruppe prüfen oder als Standardverordnung (Muster 13) ausstellen.',
      field: 'rezept_typ',
      regulation: '§125a SGB V — Blankoverordnung nur Ergotherapie (ab 01.04.2024) und Physiotherapie (ab 01.11.2024)'
    }],
    computed: {}
  };
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

  if (typ === 'blanko') {
    const guarded = blankoScopeGuard(rezept);
    if (guarded) return { ...guarded, engine: 'blanko' };
  }

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
