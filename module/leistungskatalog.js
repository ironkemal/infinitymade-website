/**
 * leistungskatalog.js — der Wächter, der entscheidet, ob `ownerServices`
 * nachgeladen werden muss.
 *
 * Warum es das gibt
 * ─────────────────
 * `ownerServices` (dashboard.js) hatte bis 09.09.2026 nur eine echte
 * Füllstelle: `populateSrvSelect()`, aufgerufen ausschließlich aus
 * Buchungsmodal-Pfaden. Wer nach dem Login direkt auf „Rechnungen" klickt
 * (oder über die Podologie-Brücke „Rechnung erstellen" drückt), hat nie einen
 * Buchungsmodal-Pfad durchlaufen — `ownerServices` blieb `[]`, und der
 * Leistungs-Picker zeigte „Kein Leistungskatalog hinterlegt.", obwohl ein
 * Katalog existiert.
 *
 * Diese Regel ist wörtlich der Wächter, der vorher nur in
 * `populateSrvSelect()` stand — herausgezogen, damit auch der
 * Rechnungs-Editor und die Podologie-Brücke ihn benutzen können, statt eine
 * zweite Kopie zu schreiben.
 *
 * Bewusst kein eifriges Nachladen beim Dashboard-Start: `loadServices()` ist
 * kein Lesevorgang — sie migriert Altdaten, sät den GKV-Katalog und rendert
 * drei Panels. Das bei jedem Login für jeden Mitarbeiter auszulösen, der nie
 * Leistungen öffnet, wäre ein größerer Eingriff als der Fehler, den es behebt.
 */

/**
 * @param {object} p
 * @param {Array<Record<string, unknown>> | undefined} p.katalog Aktueller Stand von `servicesCache`.
 * @param {boolean} p.sektorHatGkvKatalog   Hat der Fachbereich einen GKV-Katalog
 *                                          (GKV_LEISTUNGSKATALOG[sector].length > 0)?
 * @returns {boolean} true, wenn `loadServices()` erneut laufen muss.
 */
export function katalogNachladen({ katalog, sektorHatGkvKatalog }) {
  const liste = katalog || [];
  if (!liste.length) return true;
  if (sektorHatGkvKatalog && !liste.some(s => s.gkv_position_nr)) return true;
  return false;
}

/** @typedef {{id: string, title: string, duration_minutes?: number, code?: string, is_internal?: boolean, gkv_position_nr?: string, employee_services?: {employee_id: string}[]}} TerminLeistung */

/** Beim Öffnen bestehender Buchungen bleibt die gespeicherte Auswahl sichtbar.
 * @param {TerminLeistung[]} servicesCache
 * @param {string|null} employeeId
 * @param {string|null} selectedId
 * @param {(text: string) => string} escapeHtml
 */
export function leistungsOptionen(servicesCache, employeeId, selectedId, escapeHtml) {
  let visible = servicesCache.filter(s => !s.is_internal || s.id === selectedId);
  if (employeeId) {
    visible = visible.filter(s => {
      const assigned = s.employee_services || [];
      return assigned.length === 0 || assigned.some(es => es.employee_id === employeeId) || s.id === selectedId;
    });
  }

  const gkvSrvs     = visible.filter(s => s.gkv_position_nr);
  const privateSrvs = visible.filter(s => !s.gkv_position_nr);

  /** @param {TerminLeistung} s */
  const makeOption = s =>
    `<option value="${s.id}" data-duration="${s.duration_minutes || 30}" data-code="${escapeHtml(s.code || '')}" ${s.id === selectedId ? 'selected' : ''}>${escapeHtml(s.title)}</option>`;

  let html = '<option value="">— Leistung wählen —</option>';
  if (gkvSrvs.length) {
    html += `<optgroup label="⚕ GKV-Leistungen (§125 SGB V)">${gkvSrvs.map(makeOption).join('')}</optgroup>`;
  }
  if (privateSrvs.length) {
    html += `<optgroup label="✦ Private Leistungen">${privateSrvs.map(makeOption).join('')}</optgroup>`;
  }
  return html;
}
