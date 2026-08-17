/**
 * belegnummer.js — die lesbare Nummer einer Verordnung für die Oberfläche.
 *
 * Warum eine eigene Datei
 * ───────────────────────
 * Die Nummer `<Patientennummer>-<Verordnungsnummer>` (z. B. `12-3`) entsteht in
 * der Datenbank: `leads.patientennummer` vergibt `vergebe_patientennummer()`,
 * `prescriptions.verordnungsnummer` / `verordnungen.verordnungsnummer` vergibt
 * der jeweilige Trigger — fortlaufend JE PATIENT, über beide Verordnungstöpfe
 * hinweg (Migration `20260815233848_verordnungsnummer_belegnummer`).
 *
 * `belegnummer` selbst wird erst bei der DTA-Erzeugung EINMAL geschrieben und
 * danach nie mehr geändert (Anlage 1 TP5 V21 Kap. 7.3) — sonst findet eine
 * späte Kassenrückmeldung ihren Beleg nicht mehr wieder. Das heisst: bei jeder
 * noch nicht abgerechneten Verordnung ist die Spalte LEER. Für die Anzeige
 * reicht das nicht, denn gerade die offenen Verordnungen liegen auf dem Tisch.
 * Deshalb setzt diese Datei die Nummer aus ihren beiden Teilen zusammen, wenn
 * die eingefrorene Spalte noch leer ist.
 *
 * Regel für alle Aufrufer: die GESPEICHERTE `belegnummer` hat immer Vorrang.
 * Wird sie überschrieben, weicht das, was auf dem Bildschirm steht, von dem ab,
 * was in der DTA-Datei bei der Kasse liegt.
 *
 * § 4 Abs. 1 der Richtlinien (Fassung 20.11.2006) verlangt, dass die Nummer aus
 * dem Datensatz auch auf dem Urbeleg steht. Mit `12-3` ist das von Hand machbar
 * — vorher stand dort der Anfang der UUID.
 */

/**
 * Nummer einer Verordnung als Text.
 *
 * @param {object} row  Verordnungszeile — gelesen werden `belegnummer` und
 *                      `verordnungsnummer`.
 * @param {object} [opt]
 * @param {number|string|null} [opt.patientennummer]
 *        `leads.patientennummer`. Fehlt sie (Liste zeigt nur EINEN Patienten,
 *        oder der Join wurde nicht mitgeladen), bleibt nur die
 *        Verordnungsnummer übrig — dann `#3` statt `12-3`, damit niemand die
 *        blanke `3` für eine Patientennummer hält.
 * @returns {string} `"12-3"` · `"#3"` · `""` wenn gar nichts vorliegt.
 */
export function belegnummerText(row, opt = {}) {
  if (!row) return '';
  if (row.belegnummer) return String(row.belegnummer);

  const vo = row.verordnungsnummer;
  if (vo === null || vo === undefined || vo === '') return '';

  const pat = opt.patientennummer;
  if (pat === null || pat === undefined || pat === '') return '#' + vo;

  return `${pat}-${vo}`;
}

/**
 * Dieselbe Nummer als Rosette für Listenzeilen — monospace, damit `1-3` und
 * `12-11` untereinander lesbar bleiben.
 *
 * Gibt einen LEEREN String zurück, wenn keine Nummer vorliegt. Kein `—`:
 * ein Platzhalter neben dem Patientennamen liest sich wie ein Fehler, die
 * fehlende Rosette dagegen wie „noch keine Nummer".
 *
 * @param {object} row
 * @param {object} opt
 * @param {number|string|null} [opt.patientennummer]
 * @param {(s:string)=>string} opt.escapeHtml  Muss übergeben werden — dieses
 *        Modul bringt bewusst keine eigene Fluchtfunktion mit.
 * @param {string} [opt.titel]  title-Attribut (Tooltip).
 * @returns {string} HTML oder ''
 */
export function belegnummerRosette(row, opt = {}) {
  const esc = opt.escapeHtml || (s => String(s));
  const text = belegnummerText(row, opt);
  if (!text) return '';
  const titel = opt.titel || 'Patientennummer-Verordnungsnummer';
  return `<span class="belegnr-rosette" title="${esc(titel)}" style="` +
    'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:600;' +
    'padding:1px 7px;border-radius:10px;border:1px solid var(--border);' +
    'background:var(--bg-card-solid,#1f2937);color:var(--text-main);white-space:nowrap;">' +
    esc(text) + '</span>';
}
