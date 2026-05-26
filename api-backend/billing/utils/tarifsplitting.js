/**
 * tarifsplitting.js
 *
 * Splits a prescription's total session count across multiple tariff periods
 * that were active during the prescription's lifespan.
 *
 * Use-case: A patient's prescription spans e.g. 01 Jan – 28 Feb.  On 01 Feb
 * the clinic's tariff changed.  This helper calculates how many of the total
 * sessions fall under each tariff period (proportional to calendar days) so
 * that billing can produce a correct line-item breakdown.
 */

/**
 * Splits sessions across tariff periods proportional to calendar-day coverage.
 *
 * @param {object} opts
 * @param {Date}   opts.startDate      - Start of the prescription period
 * @param {Date}   opts.endDate        - End of the prescription period (or today)
 * @param {number} opts.totalSessions  - Total number of sessions in the prescription
 * @param {Array}  opts.tarifeHistory  - Chronologically ordered tariff records:
 *                                       [{ tarife_id, valid_from, valid_to, preis_eur, pos_nr }, ...]
 *                                       valid_from / valid_to may be Date objects or ISO strings.
 *                                       valid_to = null means "open-ended / still active".
 * @returns {Array} Array of split results:
 *   [{ tarife_id, pos_nr, preis_eur, sessions_in_period, subtotal_eur }, ...]
 *   Only entries with sessions_in_period > 0 are included.
 */
export function splitSessionsByTarif(opts) {
  const { startDate, endDate, totalSessions, tarifeHistory } = opts;

  if (!tarifeHistory || tarifeHistory.length === 0) {
    return [];
  }
  if (!totalSessions || totalSessions <= 0) {
    return [];
  }

  const rxStart = toDate(startDate);
  const rxEnd   = toDate(endDate);

  if (rxStart > rxEnd) {
    throw new Error('startDate must be before or equal to endDate');
  }

  // ── Step 1: Calculate the effective overlap (in whole days) of each tariff
  //            period with the prescription period. ─────────────────────────

  const totalRxDays = daysBetween(rxStart, rxEnd) || 1; // guard against 0-day edge case

  const overlaps = tarifeHistory.map(tarif => {
    const tStart = toDate(tarif.valid_from);
    const tEnd   = tarif.valid_to ? toDate(tarif.valid_to) : rxEnd; // open-ended → use rxEnd

    // Effective overlap window
    const overlapStart = maxDate(rxStart, tStart);
    const overlapEnd   = minDate(rxEnd,   tEnd);

    const days = overlapStart <= overlapEnd ? daysBetween(overlapStart, overlapEnd) : 0;

    return {
      tarife_id: tarif.tarife_id ?? tarif.id ?? null,
      pos_nr:    tarif.pos_nr    ?? null,
      preis_eur: Number(tarif.preis_eur) || 0,
      days,
    };
  });

  // ── Step 2: Distribute sessions proportionally across overlapping periods ─

  const totalOverlapDays = overlaps.reduce((sum, o) => sum + o.days, 0);

  if (totalOverlapDays === 0) {
    // No tariff overlaps the prescription at all — return everything under the
    // first tariff to avoid losing sessions.
    const first = tarifeHistory[0];
    const preis = Number(first.preis_eur) || 0;
    return [{
      tarife_id:         first.tarife_id ?? first.id ?? null,
      pos_nr:            first.pos_nr    ?? null,
      preis_eur:         preis,
      sessions_in_period: totalSessions,
      subtotal_eur:      round2(preis * totalSessions),
    }];
  }

  let assignedSessions = 0;
  const results = [];

  overlaps.forEach((o, idx) => {
    if (o.days === 0) return; // no overlap — skip

    const isLast = (idx === overlaps.length - 1) ||
                   overlaps.slice(idx + 1).every(r => r.days === 0);

    let sessions;
    if (isLast) {
      // Last active period gets any remainder from rounding
      sessions = totalSessions - assignedSessions;
    } else {
      sessions = Math.round((o.days / totalOverlapDays) * totalSessions);
    }

    if (sessions <= 0) return;

    assignedSessions += sessions;

    results.push({
      tarife_id:          o.tarife_id,
      pos_nr:             o.pos_nr,
      preis_eur:          o.preis_eur,
      sessions_in_period: sessions,
      subtotal_eur:       round2(o.preis_eur * sessions),
    });
  });

  return results;
}

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Normalise a value to a plain Date (UTC midnight for date-only strings).
 * Accepts Date objects, ISO strings, or "YYYY-MM-DD" strings.
 */
function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    // Date-only string → treat as UTC midnight to avoid TZ drift
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00Z`);
    }
    return new Date(value);
  }
  throw new TypeError(`Cannot convert ${value} to Date`);
}

/** Whole calendar days between two dates (inclusive of startDate day, exclusive of endDate day). */
function daysBetween(a, b) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / msPerDay));
}

function maxDate(a, b) { return a > b ? a : b; }
function minDate(a, b) { return a < b ? a : b; }

/** Round to 2 decimal places (banker's rounding avoided intentionally). */
function round2(n) { return Math.round(n * 100) / 100; }
