/**
 * kalender-raster.js — Zeitraster und Zeitbeschriftung der Kalenderansichten.
 *
 * Warum es das gibt
 * ─────────────────
 * Zwei kleine Dinge im Terminkalender hingen am 30-Minuten-Raster fest, obwohl
 * die Praxis nicht in halben Stunden denkt:
 *
 *   1. Im Terminblock stand keine Uhrzeit. Das Datum steht über der Spalte, die
 *      Zeitleiste steht am linken Rand — aber ein Block, der zwischen zwei
 *      Rasterlinien beginnt, zwang zum Schätzen oder zum Aufklappen.
 *   2. Verschieben rastete auf :00 und :30 ein. Ein Termin um 09:20 landete
 *      dabei stumm auf 09:00 oder 09:30, und niemand sah es, bis der Patient
 *      zur falschen Zeit vor der Tür stand.
 *
 * Beides sind Rechnungen zwischen Minuten und Pixeln, und beide gehören
 * zusammen: `DV_SLOT_MIN` und `DV_SLOT_PX` sind das Raster der Tagesansicht
 * (dashboard.css `.dv-slot`). Ändert sich dort die Zeilenhöhe, ändert sich hier
 * eine Zahl — und nicht an vier Stellen in `dashboard.js`.
 *
 * Konsey 2026-08-13: neuer Code kommt in ein eigenes Modul.
 */

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/** Ein Rasterfeld der Tagesansicht: 30 Minuten hoch, 56 Pixel hoch. */
export const DV_SLOT_MIN = 30;
export const DV_SLOT_PX = 56;

/**
 * Feinheit beim Verschieben. Bewusst 5 und nicht 1: eine Minute genau trifft
 * niemand mit der Maus, und die Vorschau würde bei jedem Wackeln springen.
 */
export const MOVE_RASTER_MIN = 5;

/**
 * Uhrzeit-Beschriftung für einen Terminblock.
 *
 * Sie gehört in die Namenszeile, nicht in den Untertitel: bei kurzen Terminen
 * blendet `.dv-booking-block--compact` den Untertitel aus, und ausgerechnet
 * kurze Termine liegen oft nicht auf der Rasterlinie.
 *
 * @returns {string} HTML-Schnipsel, leer wenn kein Startzeitpunkt vorliegt
 */
export function terminZeitLabel(booking) {
  if (!booking?.start_time) return '';
  const s = new Date(booking.start_time);
  if (Number.isNaN(s.getTime())) return '';
  const e = booking.end_time ? new Date(booking.end_time) : null;
  const fmt = (d) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const txt = e && !Number.isNaN(e.getTime()) ? `${fmt(s)}–${fmt(e)}` : fmt(s);
  return `<span class="dv-booking-time" style="flex-shrink:0;font-variant-numeric:tabular-nums;opacity:0.85;font-weight:500;">${escapeHtml(txt)}</span>`;
}

/**
 * Minuten-Versatz innerhalb des angeklickten Rasterfelds, gerundet auf
 * `MOVE_RASTER_MIN`.
 *
 * Ohne Klickereignis (Tastatur, Aufruf von aussen) sind es 0 Minuten — also
 * der Feldanfang und damit genau das bisherige Verhalten. Raten wäre hier
 * schlechter als nichts zu tun.
 */
export function moveVersatzMinuten(slotEl, ev) {
  if (!slotEl || !ev || typeof ev.clientY !== 'number') return 0;
  const kasten = slotEl.getBoundingClientRect();
  if (!kasten.height) return 0;
  const anteil = Math.min(Math.max((ev.clientY - kasten.top) / kasten.height, 0), 0.999);
  const roh = anteil * DV_SLOT_MIN;
  // Nie auf den Anfang des NÄCHSTEN Feldes runden — dort steht schon das
  // nächste Rasterfeld, und der Versatz wäre doppelt gezählt.
  return Math.min(Math.round(roh / MOVE_RASTER_MIN) * MOVE_RASTER_MIN, DV_SLOT_MIN - MOVE_RASTER_MIN);
}

/**
 * "2026-08-16T09:00" + 20 → "2026-08-16T09:20".
 * Bewusst über ein Date-Objekt, damit ein Versatz über die volle Stunde
 * hinaus richtig überläuft.
 */
export function zeitPlusMinuten(timeStr, min) {
  if (!min) return timeStr;
  const d = new Date(timeStr + ':00');
  if (Number.isNaN(d.getTime())) return timeStr;
  d.setMinutes(d.getMinutes() + min);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
