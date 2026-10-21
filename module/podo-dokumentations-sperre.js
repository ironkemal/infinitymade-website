/**
 * podo-dokumentations-sperre.js — darf an DIESE Verordnung noch eine Behandlung
 * dokumentiert werden? Reine Funktion, kein DOM, keine Abfrage.
 *
 * gkv-302, 10.10.2026 (UE Korrekturverfahren Heilmittel 13.02.2025 Frage 1/2/5,
 * Anlage 3 Podologie lit. p; SPEC-RULES.md „Teilabrechnung" korrigiert 29.09.2026):
 *  • abgerechnet → Sperre. Mit der Einreichung sind offene Einheiten verfallen
 *    (Reform S2.3, Kemal 28.09.2026). Einzige legitime Ausnahme ist eine VOR der
 *    Einreichung erbrachte, aber nicht berechnete Leistung (VKZ 02 Nachforderung)
 *    — dieser Weg ist nicht gebaut, daher nur ein Hinweis auf den Support.
 *  • storniert / archiviert → Sperre.
 *  • verordnete Menge erreicht (abrechenbare Behandlungstage, derselbe Zähler wie
 *    die Statusmaschine beim Speichern) → Sperre für einen NEUEN Tag.
 *  • abrechenbar („bereit", noch nicht eingereicht) / abgesetzt → Warnung mit
 *    einer Bestätigung im Formular, kein Modal (podoloji 10.10.2026: 1 Klick,
 *    Verordnung bleibt in ihrem Status — kein „wieder öffnen").
 *  • aktiv → frei.
 * Behandlungsabbruch-Datum: gibt es im Schema nicht — die Regel „kein Tag nach
 * dem Abbruch" greift erst, wenn es ein solches Feld gibt.
 */
import { abrechenbareBehandlungstage, bestehenderBehandlungstag } from './podo-behandlungstag-regel.js?v=20261003a';

const SUPPORT_HINWEIS = 'Nachträgliche Leistung, die vor der Einreichung erbracht wurde? → Korrekturabrechnung über den Support.';

/**
 * @param {{status?:string, behandlungseinheiten?:?number}} vord  podologischer Wortschatz (ausTopf)
 * @param {Array} behandlungen  `podologie_behandlungen` dieser Verordnung (auch stornierte)
 * @param {string} datum        geplantes Behandlungsdatum `YYYY-MM-DD`
 * @returns {{stufe:'frei'|'warnung'|'sperre', grund?:string, titel?:string, text?:string}}
 */
export function dokumentationsLage(vord, behandlungen, datum) {
  const status = vord?.status || 'aktiv';
  if (status === 'abgerechnet') {
    return { stufe: 'sperre', grund: 'abgerechnet', titel: 'Abgerechnet – keine Behandlung mehr möglich',
      text: `Die Verordnung ist bei der Kasse eingereicht; offene Einheiten sind damit verfallen. Für eine weitere Behandlung bitte eine neue Verordnung erfassen. ${SUPPORT_HINWEIS}` };
  }
  if (status === 'storniert' || status === 'archiviert') {
    return { stufe: 'sperre', grund: status, titel: status === 'storniert' ? 'Storniert' : 'Archiviert',
      text: 'An diese Verordnung kann keine Behandlung mehr dokumentiert werden. Bitte die gültige Verordnung wählen oder eine neue erfassen.' };
  }
  const menge = Number(vord?.behandlungseinheiten) || 0;
  if (menge > 0) {
    const tage = abrechenbareBehandlungstage(behandlungen);
    if (tage >= menge && !bestehenderBehandlungstag(behandlungen, datum)) {
      return { stufe: 'sperre', grund: 'menge', titel: `Verordnete Menge erreicht (${tage} von ${menge})`,
        text: 'Alle verordneten Einheiten sind dokumentiert. Für eine weitere Behandlung bitte eine neue Verordnung erfassen — oder, falls die Menge falsch eingetragen ist, die Verordnung korrigieren.' };
    }
  }
  if (status === 'abrechenbar') {
    return { stufe: 'warnung', grund: 'abrechenbar', titel: 'Abgeschlossen – noch nicht abgerechnet',
      text: 'Die Verordnung steht schon zur Abrechnung bereit. Nur eintragen, wenn die Behandlung wirklich zu dieser Verordnung gehört (z. B. vergessene letzte Einheit).' };
  }
  if (status === 'abgesetzt' || status === 'teilabsetzung') {
    return { stufe: 'warnung', grund: status, titel: 'Von der Kasse abgesetzt',
      text: 'Nur eintragen, wenn die Behandlung vor der Einreichung erbracht wurde. Die Korrektur der Absetzung läuft getrennt.' };
  }
  return { stufe: 'frei' };
}
