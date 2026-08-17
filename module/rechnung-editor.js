/**
 * rechnung-editor.js — der Rechnungseditor, Stück für Stück aus dashboard.js
 * herausgelöst (Umzingelung nach Konsey 2026-08-13: was angefasst wird, zieht um).
 *
 * Hier landen die Teile, die beim Live-Test vom 15.08.2026 aufgefallen sind.
 */

import { verordnungenZuruecksetzen } from './rechnung-verordnung.js?v=20260817';

/**
 * Lädt die Termine eines Patienten für die Einzeltermin-Auswahl (Selbstzahler).
 *
 * Umzug aus dashboard.js (loadPatientBookings) — Konsey/Aufgabe 2026-08-15:
 * Der Verordnungsblock ist die neue primäre Abrechnungseinheit. Diese Funktion
 * bleibt für Selbstzahler ohne Verordnung und für Praxen, die noch keine
 * Verordnungen erfasst haben.
 *
 * Inhalt: unverändert aus dashboard.js — inklusive der Kommentare über lead_id,
 * die teuer erkämpft sind. Einzige Anpassungen: supabase → sb, getOwnerId() → ownerId.
 *
 * @param {object} sb        Supabase-Client
 * @param {object} opts
 * @param {string} opts.ownerId
 * @param {string} opts.leadId   Patient-ID (leads.id)
 * @returns {Promise<Array>} bookings-Zeilen mit services-Join
 */
export async function terminAuswahlLaden(sb, { ownerId, leadId }) {
  const patientId = leadId;
  if (!patientId) return [];

  // 1. Bookings linked through prescription_sessions for this patient
  const { data: linkedRows } = await sb
    .from('prescription_sessions')
    .select('booking_id, prescriptions!inner(patient_id)')
    .eq('prescriptions.patient_id', patientId)
    .not('booking_id', 'is', null);
  const linkedIds = (linkedRows || []).map(r => r.booking_id).filter(Boolean);

  // 2. Bookings matched by customer identifiers (legacy/non-physio path)
  const { data: lead } = await sb
    .from('leads')
    .select('first_name,last_name,title,phone,email,phone_normalized')
    .eq('id', patientId)
    .maybeSingle();
  // Der direkte Weg zuerst: seit die Terminbuchung den Patienten verknüpft,
  // steht die Zuordnung als `bookings.lead_id` in der Zeile. Ohne diese Zeile
  // suchte die Rechnungsmaske den Termin nur über den Rezeptbezug oder über
  // Textvergleiche auf Name/Telefon/E-Mail — und fand nichts, sobald der
  // Termin unter „Nachname, Vorname", mit Titel oder ohne Telefonnummer
  // angelegt war. Von 222 verknüpften Terminen waren 83 auf diese Weise
  // unsichtbar; die Leistungsauswahl blieb dann leer (Kemal, 15.08.2026).
  const orParts = [`lead_id.eq.${patientId}`];
  const names = new Set();
  if (lead?.title) names.add(lead.title);
  const composed = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ');
  if (composed) names.add(composed);
  names.forEach(n => orParts.push(`customer_name.eq.${n}`));
  if (lead?.phone) orParts.push(`customer_phone.eq.${lead.phone}`);
  if (lead?.phone_normalized) orParts.push(`customer_phone_normalized.eq.${lead.phone_normalized}`);
  if (lead?.email) orParts.push(`customer_email.eq.${lead.email}`);

  let query = sb.from('bookings')
    .select('id,start_time,end_time,status,customer_name,service_id, services(title,price,duration_minutes,price_config)')
    .eq('owner_id', ownerId)
    .order('start_time', { ascending: false });

  if (linkedIds.length && orParts.length) {
    query = query.or(`id.in.(${linkedIds.join(',')}),${orParts.join(',')}`);
  } else if (linkedIds.length) {
    query = query.in('id', linkedIds);
  } else if (orParts.length) {
    query = query.or(orParts.join(','));
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) { console.error('[bookings]', error); return []; }
  // Dedupe just in case the OR overlapped with linked ids
  const seen = new Set();
  return (data || []).filter(b => (seen.has(b.id) ? false : (seen.add(b.id), true)));
}

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
 * Leert die Terminauswahl und den Verordnungsblock über der Leistungstabelle.
 *
 * Fehler aus dem Live-Test: Rechnungen verlassen, zurückkommen — kein Patient
 * ausgewählt, aber die Termine des vorigen Patienten stehen noch da, samt
 * gesetzter Haken. `resetInvEditor()` räumte Zeilen, Patient und Summen auf,
 * fasste diesen Block aber nicht an. Wer dann speicherte, hängte die Termine
 * des einen Patienten an die Rechnung des nächsten.
 *
 * Dasselbe gilt für den Verordnungsblock: invVordList und invVordWrap werden
 * hier ebenfalls geleert/versteckt, damit die Verordnungen des vorigen Patienten
 * nicht stehen bleiben.
 */
export function leereTerminAuswahl() {
  const checks = document.getElementById('invBookingChecks');
  if (checks) checks.innerHTML = '';
  const wrap = document.getElementById('invBookingWrap');
  if (wrap) wrap.hidden = true;
  // Verordnungsblock (neu): ebenfalls leeren, damit der vorige Patient
  // nicht in der Auswahl der nächsten Rechnung erscheint. Das DOM allein
  // reicht dafür nicht — die Auswahl lebt als Modulzustand weiter.
  verordnungenZuruecksetzen();
  const vordList = document.getElementById('invVordList');
  if (vordList) vordList.innerHTML = '';
  const vordWrap = document.getElementById('invVordWrap');
  if (vordWrap) vordWrap.hidden = true;
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
