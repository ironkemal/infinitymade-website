// Arztangaben auf der podologischen Verordnung — harte Sperre vor „Bereit".
//
// Reform S3.7 (29.09.2026, gkv-302 + wissensbank; wissensbank/SPEC-RULES.md,
// Abschnitt „Podologie: Arzt-Nr. oder Arztstempel/Unterschrift fehlt"):
// Podologie-Vertrag Anlage 3 Ziffer 3 + Ziffer 5 a): ohne Arzt-Nr. (LANR) oder
// ohne Stempel/Unterschrift darf die Behandlung nicht beginnen. Kein Override.
// BSNR fehlt und LANR-Pruefziffer sind DAGEGEN nur Warnungen (preflight.js).
//
// Spiegel im Browser: module/podo-arztangaben.js — beide gemeinsam aendern.
// Die Spalten heissen in `prescriptions` doctor_lanr / unterschrift_vorhanden.

export const LANR_ERSATZWERT = '999999999';

/** @returns {string[]} leer = Arztangaben vollstaendig */
export function fehlendeArztangaben(v) {
  const fehlt = [];
  const lanr = String(v?.doctor_lanr || '').trim();
  if (!lanr || lanr === LANR_ERSATZWERT) {
    fehlt.push('Arzt-Nr. (LANR) fehlt (Podologie-Vertrag Anlage 3)');
  }
  if (v?.unterschrift_vorhanden !== true) {
    fehlt.push('Unterschrift/Stempel des Arztes fehlt (Podologie-Vertrag Anlage 3)');
  }
  return fehlt;
}
