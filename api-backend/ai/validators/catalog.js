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
 * Accepts e.g. "WS2", "EX", "ZN1", "DF", "DF-a", "UI1".
 * Strips trailing -a/-b/-c suffix before lookup.
 * Searches physio first, then podologie (skips _-prefixed meta keys).
 * Returns hoechstmenge/orientierende_menge/frequency_hint or null.
 */
export function getDiagnosegruppe(dg) {
  if (!dg) return null;
  // Suffix -a/-b/-c abschneiden (z. B. DF-a -> DF)
  const key = dg.trim().replace(/-[abc]$/i, '');
  if (diagnosegruppen.physio[key]) return diagnosegruppen.physio[key];
  const podo = diagnosegruppen.podologie;
  if (podo && !key.startsWith('_') && podo[key]) return podo[key];
  return null;
}

/**
 * Returns the ICD-rule map for all Podologie Diagnosegruppen.
 * Keys with leading _ are metadata and excluded.
 * Shape: { DF: {...}, NF: {...}, QF: {...}, UI1: {...}, UI2: {...} }
 */
export function getIcdDgRules() {
  const podo = diagnosegruppen.podologie || {};
  return Object.fromEntries(
    Object.entries(podo).filter(([k]) => !k.startsWith('_'))
  );
}

export const BLANKO_AMPEL = diagnosegruppen.blanko_ampel;
export const BLANKO_VERGUETUNG = diagnosegruppen.blanko_verguetung_eur;
