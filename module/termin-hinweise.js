/**
 * termin-hinweise.js — kleine Hinweise an Terminen in der Tagesübersicht.
 *
 * Warum (canli-test 20.10.2026): morgens fehlte der Blick „wer kommt, was ist
 * zu tun" — Rezept fehlt, Zuzahlung offen, Hausbesuch. Die Termine standen da,
 * die Aufgaben dazu musste man je Termin aufklappen.
 *
 * Nur, was aus den schon geladenen Termindaten sicher folgt (TERMIN_SELECT):
 *  - Hausbesuch: `bookings.hausbesuch`.
 *  - Ohne VO: Kassenleistung (fünfstelliger Positionscode der Leistung) ohne
 *    zugeordnete Verordnung. Privat/Selbstzahler/BG brauchen keine.
 *  - Zuzahlung offen: Verordnung im Termin geladen (Sitzungsbuch), weder
 *    befreit noch kassiert. Podologie-VOs hängen nur über `verordnung_id` am
 *    Termin und sind hier nicht mitgeladen — dort fehlt der Hinweis bewusst
 *    lieber, als falsch zu sein.
 */

const KEINE_VO_NOETIG = new Set(['privat', 'selbstzahler', 'bg']);

/** @returns {Array<{key:string, text:string, titel:string}>} */
export function terminHinweise(b) {
  if (!b) return [];
  const out = [];
  const rx = b.prescription_sessions?.[0]?.prescriptions || null;
  if (b.hausbesuch) out.push({ key: 'hausbesuch', text: 'Hausbesuch', titel: 'Hausbesuch — Fahrt einplanen' });
  // Positionsnummer steht bei Podologie in gkv_position_nr, der Code ist ein Kürzel (canli-test 21.10.2026).
  const kassenleistung = [b.services?.gkv_position_nr, b.services?.code].some(c => /^\d{5}$/.test(String(c || '').trim()));
  if (kassenleistung && !b.verordnung_id && !rx && !KEINE_VO_NOETIG.has(String(b.rezeptart || '').toLowerCase())) {
    out.push({ key: 'ohne-vo', text: 'Ohne VO', titel: 'Kassenleistung ohne zugeordnete Verordnung' });
  }
  if (rx && !rx.zuzahlung_befreit && !rx.zuzahlung_kassiert_am && !KEINE_VO_NOETIG.has(String(rx.rezeptart || '').toLowerCase())) {
    out.push({ key: 'zuzahlung', text: 'Zuzahlung offen', titel: 'Zuzahlung dieser Verordnung noch nicht kassiert' });
  }
  return out;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** HTML-Leiste der Hinweise, leer ohne Hinweis. */
export function terminHinweiseHtml(b) {
  const h = terminHinweise(b);
  return h.length
    ? `<div class="termin-hinweise">${h.map(x => `<span class="termin-hinweis termin-hinweis--${x.key}" title="${esc(x.titel)}">${esc(x.text)}</span>`).join('')}</div>`
    : '';
}
