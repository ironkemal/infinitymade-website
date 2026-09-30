/**
 * lead-status.js — Deutsche Anzeige des Lead-/Patientenpost-Status.
 *
 * Warum es das gibt: die Tabelle „Patientenpost" zeigte den Rohwert der Spalte
 * (`new`, `contacted` …) im Badge (canli-test 30.09.2026, P3). Unbekannte Werte
 * bleiben absichtlich roh — lieber ein fremdes Wort als ein falsches.
 */
export const LEAD_STATUS_DE = {
  new: 'Neu',
  contacted: 'Kontaktiert',
  booked: 'Termin vereinbart',
  won: 'Gewonnen',
  lost: 'Verloren',
};

/** @param {?string} status @returns {string} */
export function leadStatusLabel(status) {
  if (!status) return '—';
  return LEAD_STATUS_DE[status] || status;
}
