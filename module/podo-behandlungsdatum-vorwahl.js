/**
 * podo-behandlungsdatum-vorwahl.js — welches Datum das Tagesbehandlungs-
 * Formular vorbelegt, wenn es aus einem Termin heraus geöffnet wird.
 *
 * Reform-Sprint S1.7 (28.09.2026). `setPodVorwahl(id, { datum })` in
 * `podologie-abrechnung.js` übergibt seither ein Termin-Datum; ohne das war
 * das Formular unabhängig vom gewählten Termin immer auf "heute" fixiert
 * (`today`/`todayStr`) — HPNR-Gültigkeit, Eingangsbefundungs-Prüfung und die
 * geplanten Positionen liefen dadurch am falschen Tag.
 *
 * Reine Regel, kein DOM, kein `ctx` — dadurch in node importierbar und neben
 * ihrem Test testbar (gleiches Muster wie `podo-behandlungsposition-regel.js`).
 *
 * `max="heute"` am Datumsfeld bleibt bewusst bestehen (S:01005/S:01006 —
 * s. `podologie-abrechnung.js`): liegt der Termin in der Zukunft, wird das
 * Datum trotzdem eingesetzt (der Podologe soll den Termin wiedererkennen),
 * aber nicht auf heute heruntergezogen — die eigentliche Sperre bleibt der
 * bestehende Speichern-Handler, hier kommt nur der Hinweistext dazu.
 */

/**
 * @param {string|null|undefined} vorwahlDatum  `YYYY-MM-DD` aus `setPodVorwahl(id, { datum })`, oder leer
 * @param {string} heuteStr                      `YYYY-MM-DD`, `alsISODatum(new Date())`
 * @returns {{ datum: string, istZukunft: boolean }}
 *   `datum` — was ins Formular gehört (Vorwahl, sonst heute).
 *   `istZukunft` — ob `datum` nach `heuteStr` liegt (Warnzeile im Formular).
 */
export function podBehandlungsdatumVorschlag(vorwahlDatum, heuteStr) {
  const datum = (vorwahlDatum && String(vorwahlDatum).trim()) || heuteStr;
  return { datum, istZukunft: datum > heuteStr };
}
