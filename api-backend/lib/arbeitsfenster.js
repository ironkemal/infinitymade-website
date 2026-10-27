/**
 * Pure window core extracted from getAvailableSlots (B07, 27.10.2026).
 * Intended shared source for the future Startseite and existing slot lookup.
 * Callers resolve users/locations and project absences into original minute values.
 * This module makes no claim about bookings, groups, Google or online bookability.
 */

/**
 * @param {object} input
 * @param {number} input.wochentag JavaScript weekday (Sunday = 0).
 * @param {number[]} [input.closedDays] Resolved location's closed_days, strict includes.
 * @param {boolean} [input.hatOwner] Employee has an owner (not the owner's own record).
 * @param {object|null} [input.arbeitszeit] Requested user's working_hours row.
 * @param {object|null} [input.ownerArbeitszeit] Already resolved fallback working_hours row.
 * @param {object|null} [input.customDay] Original type/start_time/end_time fields.
 * @param {object[]} [input.pausen] Requested user's breaks rows, in query order.
 * @param {{start:number,end:number}[]} [input.abwesenheitsIntervalle] Already projected.
 * @returns {{arbeitsintervall: object|null, sperrintervalle: object[], reason?: string}}
 */
export function arbeitsfensterFuerTag({
  wochentag, closedDays, hatOwner, arbeitszeit, ownerArbeitszeit, customDay,
  pausen = [], abwesenheitsIntervalle = []
}) {
  if (Array.isArray(closedDays) && closedDays.includes(wochentag)) {
    return { arbeitsintervall: null, sperrintervalle: [], reason: 'business_closed_day' };
  }

  if (customDay && (customDay.type === 'closed' || customDay.type === 'holiday') &&
      !customDay.start_time && !customDay.end_time) {
    return { arbeitsintervall: null, sperrintervalle: [], reason: 'custom_day_closed' };
  }

  let wh = arbeitszeit;
  if (!wh && hatOwner) wh = ownerArbeitszeit;
  if (customDay && customDay.type === 'special' && customDay.start_time && customDay.end_time) {
    wh = { start_time: customDay.start_time, end_time: customDay.end_time, is_active: true };
  }
  if (!wh || !wh.is_active) {
    return { arbeitsintervall: null, sperrintervalle: [], reason: 'working_hours_inactive' };
  }

  // Same HH:MM conversion as the original: seconds ignored, no overnight extension.
  const toMinutes = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const arbeitsintervall = { start: toMinutes(wh.start_time), end: toMinutes(wh.end_time) };
  const sperrintervalle = [];
  if (customDay && (customDay.type === 'closed' || customDay.type === 'holiday') &&
      customDay.start_time && customDay.end_time) {
    sperrintervalle.push({ start: toMinutes(customDay.start_time), end: toMinutes(customDay.end_time) });
  }
  pausen.forEach(p => {
    sperrintervalle.push({ start: toMinutes(p.start_time), end: toMinutes(p.end_time) });
  });
  abwesenheitsIntervalle.forEach(a => {
    sperrintervalle.push({ start: a.start, end: a.end });
  });
  return { arbeitsintervall, sperrintervalle };
}

/**
 * Ordered subtraction using the original strict overlap predicate.
 * No sorting, merging, clipping, normalization or rejection of zero/reverse inputs.
 * Reverse blockers can produce overlapping windows: never sum these unchecked.
 * This helper is NOT a slot generator. Slot raster must stay anchored at the original
 * working start; duration/buffer, today/lead time and other blockers stay with callers.
 * Raw arbeitsfensterFuerTag output is authoritative for slot-parity integration.
 * @param {{start:number,end:number}[]} intervalle
 * @param {{start:number,end:number}[]} sperrintervalle
 * @returns {{start:number,end:number}[]}
 */
export function zieheIntervalleAb(intervalle, sperrintervalle) {
  let fenster = intervalle.map(i => ({ start: i.start, end: i.end }));
  for (const sperre of sperrintervalle) {
    fenster = fenster.flatMap(i => {
      if (!(i.start < sperre.end && i.end > sperre.start)) return [i];
      const teile = [];
      if (i.start < sperre.start) teile.push({ start: i.start, end: sperre.start });
      if (i.end > sperre.end) teile.push({ start: sperre.end, end: i.end });
      return teile;
    });
  }
  return fenster;
}
