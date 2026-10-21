/**
 * podo-unterbrechung.js — 12-Wochen-Pause an einer podologischen Verordnung.
 *
 * Warum (gkv-302 21.10.2026): Podologie-Vertrag § 7 Abs. 7 (Stand 16.06.2025) —
 * „Die Verordnung verliert bei einer Unterbrechung von 12 Kalenderwochen nach dem
 * Tag der letzten Behandlung (bei Nagelspangenbehandlungen auch Kontrolltermin)
 * ihre Gültigkeit." Bei der Terminvergabe bleibt das ein Hinweis (frequenz-pruefung.js,
 * PE-008), beim Dokumentieren darf die Behandlung aber nicht mehr an die alte VO —
 * sonst stoppt der Preflight (S:01010) später die ganze Abrechnungsdatei.
 *
 * Gezählt ab dem Tag nach der letzten nicht stornierten Behandlung (78510 zählt mit,
 * weil jede Zeile in podologie_behandlungen zählt): > 84 Tage = ungültig, 84 = noch gültig.
 */

export const PODO_PAUSE_MAX_TAGE = 84;

const tagNr = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : null;
};

/**
 * @param {Array<{behandlungsdatum:string, storniert_am?:?string}>} behandlungen  dieser VO
 * @param {string} datum  geplanter Behandlungstag YYYY-MM-DD
 * @returns {{ungueltig:boolean, letzteAm:?string, tage:?number}}
 */
export function pauseLage(behandlungen, datum) {
  const ziel = tagNr(datum);
  if (ziel == null) return { ungueltig: false, letzteAm: null, tage: null };
  let letzte = null;
  for (const b of behandlungen || []) {
    if (!b || b.storniert_am) continue;
    const t = tagNr(b.behandlungsdatum);
    if (t != null && t < ziel && (letzte == null || t > tagNr(letzte))) letzte = String(b.behandlungsdatum).slice(0, 10);
  }
  if (!letzte) return { ungueltig: false, letzteAm: null, tage: null };
  const tage = ziel - tagNr(letzte);
  return { ungueltig: tage > PODO_PAUSE_MAX_TAGE, letzteAm: letzte, tage };
}

/** Meldung für die Sperre beim Dokumentieren. */
export function pauseMeldung({ letzteAm, tage }) {
  const d = new Date(letzteAm + 'T12:00:00Z').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
  return `Seit der letzten Behandlung dieser Verordnung (${d}) sind ${tage} Tage vergangen. `
    + 'Nach mehr als 12 Kalenderwochen ist die Verordnung ungültig (Podologie-Vertrag § 7 Abs. 7) — '
    + 'bitte die Behandlung auf einer neuen Verordnung dokumentieren.';
}
