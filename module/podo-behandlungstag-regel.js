/**
 * podo-behandlungstag-regel.js — was ein podologischer Behandlungstag ist und
 * wie viele davon abrechenbar sind. Reine Funktionen, kein DOM.
 *
 * gkv-302, 30.09.2026 (Podologie-Reform S4, Zusatz 5 + 6):
 *
 *  • Je Tag ist nur EINE Behandlung abrechenbar (HeilM-RL § 12 Abs. 8). Wer für
 *    dieselbe Verordnung am selben Tag ein zweites Mal speichert, soll gefragt
 *    werden — nicht gesperrt: die Sperre im Preflight ist Sache des Servers.
 *  • „Bereit zur Abrechnung" setzt mindestens einen abrechenbaren
 *    Behandlungstag voraus: nicht storniert UND 78010/78020 (UI2: 78610) enthalten,
 *    derselbe Kalendertag zählt einmal. Befundung allein (78030/78040), Kontrolle
 *    oder Zuschlag machen noch keine abrechenbare Behandlung.
 *
 * ⚠️ Das ist NICHT der Zähler „0 / 3 Einheiten" der Verordnungsliste
 * (`podoZaehler` in verordnung-uebersicht.js): der zählt Zeilen, nimmt auch
 * 78610 (Nagelspange) und Altzeilen ohne Codes mit. Zwei verschiedene Fragen —
 * „wie viel der verordneten Menge ist verbraucht" und „gibt es überhaupt etwas
 * Abrechenbares". Die Zählung am Server (verordnung-status.routes.js) ist
 * getrennt und gehört zu Oturum B.
 */

/** Die Positionen, die einen Behandlungstag abrechenbar machen. */
// UI2: die Behandlung ist die Nagelkorrekturspange (78610; 78620 ist Zuschlag, keine Einheit — wie verordnung-uebersicht.js) — ohne sie könnte eine
// UI2-Verordnung nie „Bereit" werden (Hauptkoordinator 30.09, Kontrolle nach S4-Paket 1).
import { datumDe } from './datum.js?v=20260930f';

export const ABRECHENBARE_BEHANDLUNG = new Set(['78010', '78020', '78610']);

const tagVon = (b) => String(b?.behandlungsdatum || '').slice(0, 10);
const aktiv = (b) => !!b && !b.storniert_am;

/**
 * Anzahl abrechenbarer Behandlungstage einer Verordnung.
 * @param {Array<{behandlungsdatum:string, hpnr_codes:?Array<string>, storniert_am?:?string}>} behandlungen
 * @returns {number}
 */
export function abrechenbareBehandlungstage(behandlungen) {
  const tage = new Set();
  for (const b of behandlungen || []) {
    if (!aktiv(b) || !tagVon(b)) continue;
    const codes = Array.isArray(b.hpnr_codes) ? b.hpnr_codes : [];
    if (codes.some(c => ABRECHENBARE_BEHANDLUNG.has(String(c).trim()))) tage.add(tagVon(b));
  }
  return tage.size;
}

/**
 * Steht für diesen Tag schon eine nicht stornierte Behandlung an der Verordnung?
 * Gleich welche Positionen — der Tag zählt (§ 12 Abs. 8).
 * @param {Array} behandlungen  `podologie_behandlungen` EINER Verordnung
 * @param {string} datum        `YYYY-MM-DD`
 * @returns {?object} die vorhandene Zeile oder null
 */
export function bestehenderBehandlungstag(behandlungen, datum) {
  const tag = String(datum || '').slice(0, 10);
  if (!tag) return null;
  return (behandlungen || []).find(b => aktiv(b) && tagVon(b) === tag) || null;
}


/** Frage des Bestätigungsdialogs bei einem zweiten Behandlungstag. */
export function zweiterBehandlungstagFrage(datum) {
  return `Für diese Verordnung ist am ${datumDe(datum, String(datum || ''))} bereits ein Behandlungstag erfasst. `
    + 'Je Tag ist nur eine Behandlung abrechenbar (HeilM-RL § 12 Abs. 8) — trotzdem speichern?';
}
