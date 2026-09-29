/**
 * lanr-pruefung.js — Pruefziffer der LANR im Browser
 *
 * Spiegel von api-backend/billing/dta/preflight.js isValidLanr — beide
 * gemeinsam aendern. `api-backend/` liegt in .vercelignore, das Frontend kann
 * es nicht importieren; module/lanr-pruefung.test.js haelt die zwei Kopien
 * gegeneinander (gleiche Beispiele, direkter Vergleich).
 *
 * Reform S3.7: eine LANR mit falscher Pruefziffer ist NUR eine Warnung
 * (die §302-Spezifikation schreibt keine Pruefziffernpruefung vor). Sie darf
 * das Speichern der Verordnung nicht verhindern.
 */

export const LANR_ERSATZWERT = '999999999';

export function isValidLanr(lanr) {
  if (lanr === LANR_ERSATZWERT) return true;
  if (!/^\d{9}$/.test(lanr || '')) return false;
  const weights = [4, 9, 4, 9, 4, 9];
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += Number(lanr[i]) * weights[i];
  const check = (10 - (sum % 10)) % 10;
  return check === Number(lanr[6]);
}

export const LANR_PRUEFZIFFER_HINWEIS = 'LANR-Prüfziffer stimmt nicht — bitte mit der Verordnung vergleichen.';

/** Warntext oder '' — nur bei 9 Ziffern; ein Formatfehler hat seinen eigenen Hinweis. */
export function lanrPruefzifferWarnung(lanr) {
  const l = String(lanr || '').trim();
  if (!/^\d{9}$/.test(l)) return '';
  return isValidLanr(l) ? '' : LANR_PRUEFZIFFER_HINWEIS;
}
