/**
 * @fileoverview Berlin datum and day boundary helper.
 */

const dtfBerlinParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin',
  hourCycle: 'h23',
  era: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function isValidGregorian(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

function createUTCDate(year, monthIndex, day, hour = 0, minute = 0, second = 0) {
  const dt = new Date(0);
  dt.setUTCFullYear(year, monthIndex, day);
  dt.setUTCHours(hour, minute, second, 0);
  return dt;
}

function formatInstantBerlin(ms) {
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime()) || dt.getUTCFullYear() < 1 || dt.getUTCFullYear() > 9999) return '';
  const parts = dtfBerlinParts.formatToParts(dt);
  let y = '', m = '', d = '';
  for (const p of parts) {
    if (p.type === 'year') y = p.value;
    else if (p.type === 'month') m = p.value;
    else if (p.type === 'day') d = p.value;
  }
  if (Number(y) < 1 || Number(y) > 9999) return '';
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * Converts an instant/date to a Europe/Berlin YYYY-MM-DD date string.
 * Accepts Date, numeric finite instant (including 0 Epoch), or ISO instant string with explicit tz (Z/+HH:MM).
 * Calendar dates (YYYY-MM-DD, years 0001–9999) remain identical if valid Gregorian.
 * Zoneless datetime, invalid calendar dates, or non-finite values return ''.
 */
export function alsBerlinDatum(zeitpunkt) {
  if (zeitpunkt === null || zeitpunkt === undefined) return '';
  if (typeof zeitpunkt === 'boolean') return '';

  if (zeitpunkt instanceof Date) {
    const ms = zeitpunkt.getTime();
    if (Number.isNaN(ms)) return '';
    return formatInstantBerlin(ms);
  }

  if (typeof zeitpunkt === 'number') {
    if (!Number.isFinite(zeitpunkt)) return '';
    return formatInstantBerlin(zeitpunkt);
  }

  if (typeof zeitpunkt === 'object') return '';

  if (typeof zeitpunkt === 'string') {
    const s = zeitpunkt.trim();
    if (!s) return '';

    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (dateMatch) {
      const y = Number(dateMatch[1]);
      const m = Number(dateMatch[2]);
      const d = Number(dateMatch[3]);
      if (!isValidGregorian(y, m, d)) return '';
      return s;
    }

    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?([Zz]|[+-]\d{2}(?::?\d{2})?)$/.exec(s);
    if (!isoMatch) return '';

    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (!isValidGregorian(y, m, d)) return '';

    const h = Number(isoMatch[4]);
    const min = Number(isoMatch[5]);
    const sec = isoMatch[6] ? Number(isoMatch[6]) : 0;
    if (h > 23 || min > 59 || sec > 59) return '';

    const ms = Date.parse(s);
    if (Number.isNaN(ms)) return '';
    return formatInstantBerlin(ms);
  }

  return '';
}

function getNextDay(year, month, day) {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < daysInMonth[month - 1]) {
    return [year, month, day + 1];
  }
  if (month < 12) {
    return [year, month + 1, 1];
  }
  return [year + 1, 1, 1];
}

function findBerlinMidnightUTC(year, month, day) {
  let candidateMs = createUTCDate(year, month - 1, day, 0, 0, 0).getTime();
  for (let i = 0; i < 6; i++) {
    const candDate = new Date(candidateMs);
    const parts = dtfBerlinParts.formatToParts(candDate);
    let py = 0, pm = 0, pd = 0, ph = 0, pmin = 0, ps = 0;
    for (const p of parts) {
      if (p.type === 'year') py = Number(p.value);
      else if (p.type === 'month') pm = Number(p.value);
      else if (p.type === 'day') pd = Number(p.value);
      else if (p.type === 'hour') ph = Number(p.value);
      else if (p.type === 'minute') pmin = Number(p.value);
      else if (p.type === 'second') ps = Number(p.value);
    }
    if (parts.some(p => p.type === 'era' && p.value === 'BC')) py = 1 - py;
    if (py === year && pm === month && pd === day && ph === 0 && pmin === 0 && ps === 0) {
      return candDate.toISOString();
    }
    const bpDate = createUTCDate(py, pm - 1, pd, ph, pmin, ps);
    const targetDate = createUTCDate(year, month - 1, day, 0, 0, 0);
    const diffMs = bpDate.getTime() - targetDate.getTime();
    candidateMs -= diffMs;
  }
  return null;
}

/**
 * Returns { tag, von: UTCISO, bisExklusiv: nextBerlinMidnightUTCISO } for a valid YYYY-MM-DD date.
 * Each boundary is computed independently via bounded iteration; no convergence returns null.
 */
export function berlinTagesgrenzen(tag) {
  if (typeof tag !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tag);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!isValidGregorian(y, m, d)) return null;

  const von = findBerlinMidnightUTC(y, m, d);
  const [ny, nm, nd] = getNextDay(y, m, d);
  const bisExklusiv = findBerlinMidnightUTC(ny, nm, nd);
  if (!von || !bisExklusiv) return null;

  return {
    tag,
    von,
    bisExklusiv,
  };
}

