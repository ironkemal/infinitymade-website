/**
 * datum.js — ein Kalendertag als `YYYY-MM-DD`, in der Zeitzone des Nutzers.
 *
 * Warum es das gibt
 * ─────────────────
 * `d.toISOString().split('T')[0]` sieht aus wie „das Datum von d", ist aber
 * das Datum in UTC. Berlin liegt immer VOR UTC (+1 im Winter, +2 im Sommer),
 * also fällt jede lokale Mitternacht beim Umweg über UTC auf den Vortag
 * zurück.
 *
 * Das ist kein theoretischer Fall, sondern der gemeldete Fehler vom
 * 31.08.2026: die Monatsansicht baut ihre Kacheln als `new Date(jahr, monat,
 * tag)` — lokale Mitternacht. Ein Klick auf den 19. reichte das Date an
 * `dashboard.js` weiter, dort lief es durch `toISOString()`, und die
 * Tagesansicht öffnete den 18. Gemessen: 6 von 6 Kacheln daneben, Sommer wie
 * Winter, auch am DST-Wechsel und am Monatsersten (1. Jan → 31. Dez des
 * Vorjahres).
 *
 * Die Zahl links steht in `alsISODatum` deshalb nie über UTC, sondern über
 * `getFullYear()` / `getMonth()` / `getDate()` — dieselben Felder, die der
 * Nutzer auf seiner Uhr sieht. Für einen reinen Kalendertag ist das die
 * richtige Rechnung und zugleich DST-sicher: es wird nicht gerechnet,
 * sondern abgelesen.
 *
 * Vorher lag dieselbe Funktion dreimal im Baum (`kalender-monat.js`,
 * `kalender-woche.js`, `fussbefund.js`) und in `dashboard.js` stand die
 * kaputte UTC-Fassung. Drei richtige Kopien schützen nicht vor der vierten,
 * falschen — darum jetzt an einer Stelle.
 *
 * ⚠️ Nicht zuständig für Zeitzonen-Umrechnung. Wer einen Zeitpunkt in
 * *Berliner* Zeit braucht, unabhängig davon, wo der Browser steht, rechnet
 * weiter über `Intl.DateTimeFormat` mit `timeZone: 'Europe/Berlin'` — so wie
 * `dashboard.js` es in `renderGapsForDate` tut. Hier geht es um den Tag, den
 * der Nutzer vor sich sieht.
 */

const zwei = (n) => String(n).padStart(2, '0');

/**
 * Der Kalendertag eines Zeitpunkts als `YYYY-MM-DD`, lokal gelesen.
 *
 * Nimmt absichtlich mehr als ein `Date` entgegen: aus der Datenbank kommen
 * Zeitstempel als Zeichenkette (`row.erstellt_am`), und die Aufrufer sollen
 * dafür nicht jedes Mal selbst ein `Date` bauen müssen.
 *
 * @param {Date|string|number} d  Zeitpunkt — Date, ISO-Zeichenkette oder ms
 * @returns {string} `YYYY-MM-DD`, oder `''` wenn `d` kein gültiger Zeitpunkt
 *                   ist. Leerstring statt `"NaN-NaN-NaN"`, weil der Wert
 *                   meist direkt in ein `<input type="date">` fliesst — das
 *                   zeigt bei Unsinn sonst gar nichts an und verschluckt den
 *                   Fehler still.
 */
export function alsISODatum(d) {
  // `new Date(null)` ist nicht ungültig, sondern der 1. Januar 1970 — dasselbe
  // gilt für `''` und `0`. Eine leere Datenbankspalte würde sonst stumm als
  // "1970-01-01" im Formular stehen. Darum vorher aussortieren.
  if (d === null || d === undefined || d === '') return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${zwei(x.getMonth() + 1)}-${zwei(x.getDate())}`;
}
