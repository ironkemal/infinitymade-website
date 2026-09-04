/**
 * kalender-heute.js — der "Heute"-Knopf im Terminkalender.
 *
 * Tag-, Wochen- und Monatsansicht blaettern nur relativ (kalenderBlaettern()
 * in dashboard.js) — wer sich ein paar Wochen weit vor- oder zurueckgeklickt
 * hat, musste bisher denselben Weg zurueck. Der Knopf springt unabhaengig
 * von der offenen Ansicht sofort auf das aktuelle Datum.
 *
 * Haelt selbst keinen Zustand: dayViewDate/monthViewYear/monthViewMonth
 * leben als module-scope Variablen in dashboard.js, darum bekommt dieser
 * Knopf nur eine Callback uebergeben statt eigener Setter/Getter.
 */

/**
 * Verdrahtet den Klick auf #calTodayBtn.
 * @param {() => void} aufHeuteSpringen - setzt Tag/Monat/Jahr im Aufrufer
 *   auf heute zurueck und rendert die aktuell offene Ansicht neu.
 */
export function verdrahteHeuteButton(aufHeuteSpringen) {
  const btn = document.getElementById('calTodayBtn');
  if (!btn) return;
  btn.addEventListener('click', aufHeuteSpringen);
}
