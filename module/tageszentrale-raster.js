/**
 * module/tageszentrale-raster.js — Interaktion und Auto-Scroll für das
 * Dashboard-Tagesraster (`#upcoming-bookings-list`, F-04).
 *
 * Warum eigenes Modul:
 * - `dashboard.js` darf nicht wachsen (`tools/check-dashboard-size.sh`).
 * - Reine Scroll-Berechnung (`berechneRasterScrollTop`) bleibt unit-testbar
 *   in Europe/Berlin (DST-sicher).
 * - Slot-Klicks nutzen dieselbe Vorbelegung und Rechte wie der Hauptkalender
 *   (`renderDayView`), mit Doppelklick-Entprellung und Tastaturbedienung.
 */

import { berlinMinuten } from './tageszentrale-logik.js?v=20261121f03';

let letzterSlotKlickMs = 0;

/**
 * Berechnet `scrollTop` (in Pixeln) für das Dashboard-Raster, sodass entweder
 * der erste relevante Termin (mit 30 Min. Vorlauf) oder — bei leerem Heute —
 * die aktuelle Uhrzeit in Europe/Berlin sofort sichtbar ist.
 *
 * @param {{
 *   bookings?: Array<{ start_time?: string | null, status?: string | null }>,
 *   dayStart?: number,
 *   slotPx?: number,
 *   isToday?: boolean,
 *   jetzt?: Date,
 * }} [opts]
 * @returns {number}
 */
export function berechneRasterScrollTop({
  bookings = [],
  dayStart = 8,
  slotPx = 48,
  isToday = false,
  jetzt = new Date(),
} = {}) {
  const startMin = dayStart * 60;
  let zielMin = null;

  for (const b of bookings || []) {
    if (!b?.start_time || b.status === 'cancelled') continue;
    const d = new Date(b.start_time);
    if (Number.isNaN(d.getTime())) continue;
    const m = berlinMinuten(d);
    if (zielMin === null || m < zielMin) zielMin = m;
  }

  if (zielMin !== null) {
    zielMin = Math.max(startMin, zielMin - 30);
  } else if (isToday) {
    const jetztMin = Math.floor(berlinMinuten(jetzt) / 30) * 30;
    zielMin = Math.max(startMin, jetztMin - 30);
  } else {
    return 0;
  }

  return Math.max(0, Math.round(((zielMin - startMin) / 30) * slotPx));
}

/**
 * Merkt die gewünschte Scroll-Position am Raster-Container und wendet sie an,
 * sobald das Element sichtbar ist.
 *
 * @param {HTMLElement | null} gridEl
 * @param {number} scrollTop
 */
export function scrollRasterSichtbar(gridEl, scrollTop) {
  if (!gridEl) return;
  const wert = Math.max(0, Math.round(Number(scrollTop) || 0));
  gridEl.dataset.tzScrollZiel = String(wert);
  wendeRasterScrollAn(gridEl);
}

/**
 * Wendet die vorgemerkte Scroll-Position an (auch direkt nach dem Aufklappen
 * von `data-tz-raster="1"` per `requestAnimationFrame`).
 *
 * @param {HTMLElement | null} gridEl
 */
export function wendeRasterScrollAn(gridEl) {
  if (!gridEl) return;
  const ziel = Number(gridEl.dataset.tzScrollZiel);
  if (!Number.isFinite(ziel) || ziel < 0) return;
  const anwenden = () => {
    if (gridEl.offsetParent !== null) gridEl.scrollTop = ziel;
  };
  anwenden();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(anwenden);
  }
}

/**
 * Verdrahtet einen freien 30-Min.-Slot im Dashboard-Raster für Klick und
 * Tastatur (Enter/Space), mit Doppelklick-Entprellung. Speichert nie selbst.
 *
 * @param {HTMLElement} slot
 * @param {{
 *   timeStr: string,
 *   empId?: string | null,
 *   empName?: string,
 *   oeffneTermin: (timeStr: string, empId: string | null) => Promise<void> | void,
 * }} opts
 */
export function verdrahteRasterSlot(slot, { timeStr, empId = null, empName = '', oeffneTermin }) {
  if (!slot || !timeStr || typeof oeffneTermin !== 'function') return;
  slot.dataset.time = timeStr;
  if (empId) slot.dataset.empId = empId;
  slot.tabIndex = 0;
  slot.setAttribute('role', 'button');
  const uhrzeit = timeStr.slice(11, 16);
  slot.setAttribute('aria-label', `Freier Termin-Slot ${uhrzeit}${empName ? ` bei ${empName}` : ''}`);
  slot.style.cursor = 'pointer';

  const ausloesen = () => {
    const jetzt = Date.now();
    if (jetzt - letzterSlotKlickMs < 350) return;
    letzterSlotKlickMs = jetzt;
    void oeffneTermin(timeStr, empId || null);
  };

  slot.addEventListener('click', (ev) => {
    if (ev.target instanceof HTMLElement && ev.target.closest('.dv-booking-block')) return;
    ausloesen();
  });
  slot.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      ausloesen();
    }
  });
}
