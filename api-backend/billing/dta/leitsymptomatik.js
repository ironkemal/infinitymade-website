/**
 * leitsymptomatik.js — den Buchstaben in die Bitmaske uebersetzen.
 *
 * Warum es das gibt
 * ─────────────────
 * Das ZHE-Feld „Leitsymptomatik" ist an4: vier Stellen, je „0" oder „1", in
 * der Reihenfolge a-b-c-patientenindividuell (Anlage 1 TP5 V21, Kap. 5.5.3.3,
 * Seite 71: „1. Stelle: Leitsymptomatik a … 4. Stelle: patientenindividuelle
 * Leitsy., je Stelle '0' = nein, '1' = ja").
 *
 * Die Muster-13-Maske schreibt dieses Format bereits richtig (`lsCollect()` in
 * dashboard.js baut „1010" aus den vier Kaestchen). Falsch sind zwei andere
 * Quellen, beide am 06.09.2026 in der Datenbank nachgezaehlt:
 *
 *   „DF-c"  3 Zeilen  — der Ruecklauf `vord.leitsymptomatik || vord.diagnosegruppe`
 *                       im podologischen Zweig schrieb die Diagnosegruppe ins
 *                       Leitsymptomatik-Feld
 *   „c"     1 Zeile   — Altbestand aus dem alten Podologie-Topf, blosser Buchstabe
 *
 * Warum das nicht wartet: ein Formatfehler faellt in Pruefstufe 2, und dort
 * wird nicht die einzelne Verordnung abgewiesen, sondern DIE GANZE DATEI.
 * Eine einzige alte Zeile haette also die komplette Monatsabrechnung
 * zurueckgeworfen.
 *
 * Warum hier und nicht im Builder: der Preflight liest die Werte, die die
 * Routen zusammenstellen. Wuerde erst der Builder uebersetzen, pruefte der
 * Preflight noch den Rohwert und meldete „in Ordnung" fuer etwas, das so nie
 * verschickt wird.
 */

/** Was das ZHE-Feld ueberhaupt tragen darf. */
export const LEITSYMPTOMATIK_MUSTER = /^([01]{4}|9999)$/;

/**
 * Podologie: der Heilmittelkatalog koppelt zwei Diagnosegruppen fest an einen
 * Buchstaben — „buchstabenkodierter Leitsymptomatik a), b), c) (UI1 = a) oder
 * UII = b))", Podologie-Vertrag Anlage 3 Buchstabe l), Lesefassung 17.06.2025.
 *
 * Nur Rueckfallebene: steht auf dem Papier ein Kreuz, gilt das Kreuz.
 */
const DG_BUCHSTABE = { UI1: 'a', UI2: 'b' };

/**
 * Rohwert auf die an4-Bitmaske bringen.
 *
 * Spiegel von `leitsymptomatikListe()` in `module/verordnung-pruefung.js` —
 * dieselbe Lesart eines rohen Leitsymptomatik-Wertes, zweimal geschrieben,
 * weil Browser und Server keinen gemeinsamen Modulpfad haben. Wer die eine
 * Regel aendert, aendert die andere mit.
 *
 * @param {*} roh              gespeicherter Wert (`prescriptions.leitsymptomatik`)
 * @param {object} [ctx]
 * @param {string} [ctx.diagnosegruppe]  fuer den UI1/UI2-Rueckfall und zum
 *                                       Abschneiden eines Praefixes wie „DF-"
 * @param {string} [ctx.patientenText]   Freitext; gesetzt heisst 4. Stelle = 1
 * @returns {string} vier Zeichen aus 0/1 — bei voelliger Leere „0000"
 */
export function leitsymptomatikAlsBitmaske(roh, { diagnosegruppe = '', patientenText = '' } = {}) {
  const wert = String(roh ?? '').trim();

  // Schon richtig (Maske) oder ausdruecklich „ausserhalb HeilM-RL": nicht
  // anfassen. Ein vorhandenes Kreuz ist die Aussage des Arztes.
  if (LEITSYMPTOMATIK_MUSTER.test(wert)) return wert;

  const dg = String(diagnosegruppe || '').trim().toUpperCase();

  // „DF-c" → „c". Nur das FUEHRENDE Praefix faellt weg, und nur wenn es
  // wirklich die Diagnosegruppe dieser Zeile ist. Ein plumpes „alles ausser
  // [abcd] wegwerfen" waere hier falsch: „DF-c" enthaelt ein d, und die
  // 4. Stelle haette dann faelschlich „patientenindividuell" behauptet.
  let rest = wert;
  if (dg && rest.toUpperCase().startsWith(dg)) rest = rest.slice(dg.length);
  rest = rest.replace(/^[\s\-–—:.]+/, '');
  // Zweite Sicherung fuer Praefixe fremder Schreibweise (z. B. „NF -b").
  rest = rest.replace(/^[A-Z]{2}\d?[\s\-–—:.]+/i, '');

  const klein = rest.toLowerCase();
  const stellen = ['a', 'b', 'c'].map(l => (klein.includes(l) ? '1' : '0'));

  // 4. Stelle: ein ausdrueckliches „d" auf dem Papier ODER ein vorhandener
  // Freitext. Anlage 1 macht den Text zur Pflicht, wenn diese Stelle „1" ist —
  // umgekehrt waere ein Text ohne gesetzte Stelle nicht uebermittelbar.
  const patInd = klein.includes('d') || String(patientenText || '').trim() !== '';
  stellen.push(patInd ? '1' : '0');

  const maske = stellen.join('');

  // Nichts erkannt: der Katalog kennt fuer UI1/UI2 die Antwort. Diese Zeilen
  // duerfen laut Anlage 3 l) ohnehin nicht korrigiert werden muessen.
  if (maske === '0000' && DG_BUCHSTABE[dg]) {
    const b = DG_BUCHSTABE[dg];
    return ['a', 'b', 'c'].map(l => (l === b ? '1' : '0')).join('') + '0';
  }

  return maske;
}
