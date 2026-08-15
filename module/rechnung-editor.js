/**
 * rechnung-editor.js — der Rechnungseditor, Stück für Stück aus dashboard.js
 * herausgelöst (Umzingelung nach Konsey 2026-08-13: was angefasst wird, zieht um).
 *
 * Hier landen die Teile, die beim Live-Test vom 15.08.2026 aufgefallen sind.
 */

/**
 * Die Auswahlliste einer Rechnungszeile.
 *
 * Fehler aus dem Live-Test: „Hizmet seçin yazıyor hala dropdown'da ve hizmet boş
 * gözüküyor … fiyat iniyor ama ismi inmiyor."
 *
 * Ursache: die Liste wurde ausschliesslich aus dem Leistungskatalog der Praxis
 * (`ownerServices`) gebaut. Eine Zeile, die aus einem Termin übernommen wurde,
 * trägt aber den Titel, unter dem der Termin gebucht war — heisst der im
 * Katalog anders oder steht er gar nicht (mehr) darin, passte kein `<option>`,
 * und das Feld fiel auf „-- Leistung wählen --" zurück. Der Titel war die ganze
 * Zeit in der Zeile; nur die Liste konnte ihn nicht darstellen.
 *
 * Deshalb: ein Titel, der nicht im Katalog steht, bekommt seinen eigenen
 * Eintrag. Der Beleg zeigt damit, was tatsächlich gebucht wurde, statt einer
 * leeren Auswahl.
 *
 * @param {Array} ownerServices
 * @param {string} selectedTitle
 * @param {Function} escapeHtml
 * @returns {string} HTML der <option>-Liste
 */
export function leistungOptionen(ownerServices, selectedTitle, escapeHtml) {
  const katalog = ownerServices || [];
  const titel = (selectedTitle || '').trim();
  const imKatalog = katalog.some(s => (s.title || '') === titel);

  const eigener = (titel && !imKatalog)
    ? `<option value="${escapeHtml(titel)}" data-price="0" selected>${escapeHtml(titel)}</option>`
    : '';

  const opts = katalog.map(s =>
    `<option value="${escapeHtml(s.title || '')}" data-price="${parseFloat(s.price) || 0}"${(s.title || '') === titel ? ' selected' : ''}>${escapeHtml(s.title || '')}</option>`
  ).join('');

  return `<option value="" data-price="0"${titel ? '' : ' selected'}>-- Leistung wählen --</option>${eigener}${opts}`;
}

/**
 * Leert die Terminauswahl über der Leistungstabelle.
 *
 * Fehler aus dem Live-Test: Rechnungen verlassen, zurückkommen — kein Patient
 * ausgewählt, aber die Termine des vorigen Patienten stehen noch da, samt
 * gesetzter Haken. `resetInvEditor()` räumte Zeilen, Patient und Summen auf,
 * fasste diesen Block aber nicht an. Wer dann speicherte, hängte die Termine
 * des einen Patienten an die Rechnung des nächsten.
 */
export function leereTerminAuswahl() {
  const checks = document.getElementById('invBookingChecks');
  if (checks) checks.innerHTML = '';
  const wrap = document.getElementById('invBookingWrap');
  if (wrap) wrap.hidden = true;
  const info = document.getElementById('invPatientInfo');
  if (info) info.textContent = '';
}
