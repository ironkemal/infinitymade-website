/**
 * podo-behandlungsposition-regel.js — Vorbelegung der Behandlungsposition
 * (78010/78020) im Tagesbehandlungs-Formular.
 *
 * Reform-Sprint S1.5 (28.09.2026). Eigene Datei nach demselben Muster wie
 * `eingangsbefundung-regel.js`: reine Regel, kein DOM, kein `ctx` — dadurch
 * in node importierbar und neben ihrem Test testbar. `podologie-abrechnung.js`
 * selbst laesst sich nicht importieren (`document.addEventListener` im
 * Modulrumpf).
 *
 * Vorher (`module/podologie-abrechnung.js:743-752`, `autoChecked`/`geplant`)
 * wurde nur die im TERMIN geplante Position vorbelegt (`geplanteHpnr`). Wer
 * ohne gebuchten Termin dokumentierte — typisch die 2. Sitzung einer Serie —
 * bekam 78010 leer, obwohl das Rezept die Behandlung eindeutig trägt.
 *
 * Fatura-Regel (gkv-302, Quelle Anlage 1a Podologie Teil 2 Ziff. 1-3 + FAK
 * Podologie Q25):
 *   a) Hornhautabtragung        → immer 78010
 *   b) Nagelbearbeitung         → immer 78010
 *   c) Podologische Komplexbehandlung → 78010 als Vorschlag; 78020 nur bei
 *      Therapiezeit > 20 Minuten AN DIESEM TAG — das entscheidet der
 *      Podologe je Sitzung, nicht das Rezept. Deshalb wird c) hier NICHT auf
 *      78020 vorbelegt, obwohl 78020 für c) grundsätzlich zulässig ist
 *      (die Sperre gegen 78020 bei a)/b) sitzt separat in
 *      `podologie-abrechnung.js`, Prüfung beim Speichern).
 *
 * Ist die Maßnahme unbekannt (sehr alte Verordnung ohne `leitsymptomatik`
 * und ohne `massnahme` in den `heilmittel_items` — s.
 * `podVordMassnahme()`-Doku in `podologie-abrechnung.js`), wird die rohe
 * Rezeptposition übernommen, aber nur wenn sie 78010 oder 78020 ist; sonst
 * lieber keine Vorbelegung als eine falsche.
 */

/**
 * @param {'a'|'b'|'c'|''} massnahme  aus `podVordMassnahme(vord)`
 * @param {string} [rohPosition]      `heilmittel_position || erstePositionAusItems(heilmittel_items)`
 * @returns {'78010'|'78020'|''}
 */
export function behandlungspositionVorschlag(massnahme, rohPosition = '') {
  if (massnahme === 'a' || massnahme === 'b' || massnahme === 'c') return '78010';
  const roh = String(rohPosition || '').trim();
  return (roh === '78010' || roh === '78020') ? roh : '';
}
