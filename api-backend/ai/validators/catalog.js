// Catalog loader — lazy reads JSON files once at module load.
//
// heilmittel-catalog.json   → built from KBV Diagnoseliste (build-catalog.py)
// diagnosegruppen.json      → hand-curated Höchstmenge/frequency per DG

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJson(name) {
  return JSON.parse(readFileSync(join(__dirname, name), 'utf-8'));
}

export const heilmittelCatalog = loadJson('heilmittel-catalog.json');
export const diagnosegruppen = loadJson('diagnosegruppen.json');

/** Lookup ICD-10 in LHB/BVB index. Returns entry or null. */
export function lookupLhbBvb(icd) {
  if (!icd) return null;
  return heilmittelCatalog.lhb_bvb[icd.trim()] || null;
}

/** Lookup ICD-10 in Blanko physio shoulder index. Returns entry or null. */
export function lookupBlankoShoulder(icd) {
  if (!icd) return null;
  return heilmittelCatalog.blanko_physio_shoulder[icd.trim()] || null;
}

/**
 * Resolve Diagnosegruppe metadata.
 * Accepts e.g. "WS2", "EX", "ZN1". Returns hoechstmenge/orientierende_menge/frequency_hint or null.
 */
export function getDiagnosegruppe(dg) {
  if (!dg) return null;
  return diagnosegruppen.physio[dg.trim()] || null;
}

export const BLANKO_AMPEL = diagnosegruppen.blanko_ampel;
export const BLANKO_VERGUETUNG = diagnosegruppen.blanko_verguetung_eur;
