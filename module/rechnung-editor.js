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

/**
 * Baut eine Tabellenzeile für den Rechnungseditor.
 *
 * Umzug aus dashboard.js (buildInvLineRow) — Konsey 2026-08-13: was angefasst
 * wird, zieht um. Der Picker (rechnung-leistung-picker.js) ersetzt das Anlegen
 * leerer Zeilen; diese Funktion rendert Zeilen, die bereits einen Titel tragen.
 *
 * @param {object} line          {title, quantity, unit_price}
 * @param {number} idx           Zeilenindex in invLines
 * @param {object} deps
 * @param {Array}  deps.ownerServices
 * @param {Function} deps.escapeHtml
 * @param {Function} deps.formatEur
 * @returns {string} HTML-String für ein <tr>
 */
export function baueLeistungszeile(line, idx, { ownerServices, escapeHtml, formatEur }) {
  return `<tr data-idx="${idx}">
    <td><select class="form-select inv-line-svc" style="min-width:180px;font-size:13px;">${leistungOptionen(ownerServices, line.title || '', escapeHtml)}</select></td>
    <td><input type="number" class="form-input inv-line-qty" value="${line.quantity || 1}" min="0" style="width:72px;text-align:center;" /></td>
    <td><input type="number" class="form-input inv-line-price" value="${line.unit_price || 0}" min="0" step="0.01" style="width:100px;text-align:right;" /></td>
    <td style="text-align:right;font-weight:600;">${formatEur((line.quantity || 1) * (line.unit_price || 0))}</td>
    <td><button class="btn-icon inv-del-line" type="button" title="Entfernen">🗑</button></td>
  </tr>`;
}

/**
 * Fasst Rechnungszeilen mit gleichem Titel und gleichem Einzelpreis zusammen.
 * Zeilen gleichen Titels aber unterschiedlicher Preise bleiben getrennt.
 *
 * Umzug aus dashboard.js — wird von rechnung-druck.js als übergebene
 * Abhängigkeit genutzt und muss daher exportiert sein.
 *
 * @param {Array} lines  [{title, quantity, unit_price}]
 * @returns {Array}
 */
export function aggregateInvLines(lines) {
  const groups = new Map();
  const order = [];
  for (const l of lines || []) {
    const title = (l.title || '').trim();
    const price = parseFloat(l.unit_price) || 0;
    const qty = parseFloat(l.quantity) || 1;
    const key = `${title}::${price.toFixed(2)}`;
    if (!groups.has(key)) {
      groups.set(key, { title, unit_price: price, quantity: 0 });
      order.push(key);
    }
    groups.get(key).quantity += qty;
  }
  return order.map(k => groups.get(k));
}
