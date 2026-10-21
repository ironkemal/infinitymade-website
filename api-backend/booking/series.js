/**
 * series.js — Deterministische Berechnung von Serienterminen für das Backend.
 *
 * Paritätsidentisch mit module/serien-termine.js (Frontend).
 * Stellt sicher:
 * - Exakte Anzahl Termine, aufsteigend sortiert.
 * - Keine Termine VOR dem Startdatum.
 * - Strikte Kalenderdatum-Validierung (kein Rollover wie 2026-02-30).
 * - Strikte Integer-Validierung für Terminzahl (kein fractional count 1.5).
 * - Ungültige Wochentage fallen nicht still auf Startwochentag zurück, sondern liefern [].
 * - Leere Wochentage fallen korrekt auf den Startwochentag zurück.
 * - recurrence === 'biweekly' ohne intervalDays liefert 14 Tage Abstand.
 * - Benutzerdefinierte Intervalle: Vielfache von 7 im Bereich 7..84.
 * - Sommerzeit-/DST-sicher über Berliner Kalendertage (12:00 UTC Probe).
 */

const WOCHENTAG_KURZ = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isStrictInteger(v) {
  if (typeof v === 'number') return Number.isInteger(v);
  if (typeof v === 'string') return /^\d+$/.test(v.trim());
  return false;
}

export function isValidCalendarDate(ds) {
  if (typeof ds !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ds)) return false;
  const d = new Date(ds + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().substring(0, 10) === ds;
}

/** `YYYY-MM-DD` plus n Tage, wieder als `YYYY-MM-DD`. */
export function plusTage(ds, tage) {
  const d = new Date(ds + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().substring(0, 10);
}

/**
 * Der Wochentag eines Datums in Berlin (0=So … 6=Sa).
 */
export function wochentag(ds) {
  const probe = new Date(ds + 'T12:00:00Z');
  return WOCHENTAG_KURZ[new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(probe)];
}

/**
 * Berechnet die Termintage einer Serie deterministisch.
 */
export function serienDaten({
  startDatum,
  startDate,
  anzahl,
  count,
  intervalDays,
  taeglich = false,
  recurrence,
  wochentage,
  weekdays,
} = {}) {
  const rawStart = startDatum || startDate;
  if (!isValidCalendarDate(rawStart)) return [];

  const rawCount = anzahl ?? count;
  if (!isStrictInteger(rawCount)) return [];
  const zahl = parseInt(rawCount, 10);
  if (zahl < 1) return [];

  const isDaily = taeglich === true || recurrence === 'daily';
  if (isDaily) {
    return Array.from({ length: zahl }, (_, i) => plusTage(rawStart, i));
  }

  let schritt;
  const parsedStep = parseInt(intervalDays, 10);
  if (isStrictInteger(intervalDays) && parsedStep >= 7 && parsedStep <= 84 && parsedStep % 7 === 0) {
    schritt = parsedStep;
  } else if (recurrence === 'biweekly') {
    schritt = 14;
  } else {
    schritt = 7;
  }

  const rawWd = (Array.isArray(wochentage) && wochentage.length > 0)
    ? wochentage
    : (Array.isArray(weekdays) && weekdays.length > 0 ? weekdays : (wochentage ?? weekdays));

  let tage;
  if (Array.isArray(rawWd)) {
    if (rawWd.length === 0) {
      tage = [wochentag(rawStart)];
    } else {
      const allValid = rawWd.every(n => isStrictInteger(n) && Number(n) >= 0 && Number(n) <= 6);
      if (!allValid) return [];
      tage = Array.from(new Set(rawWd.map(Number))).sort((a, b) => a - b);
    }
  } else if (rawWd === undefined || rawWd === null) {
    tage = [wochentag(rawStart)];
  } else {
    return [];
  }

  const startWd = wochentag(rawStart);
  let woche = plusTage(rawStart, -startWd);
  const raus = [];
  const maxRunden = Math.max(104, zahl * 20);

  for (let runde = 0; runde < maxRunden && raus.length < zahl; runde++) {
    for (const tagNr of tage) {
      if (raus.length >= zahl) break;
      const kandidat = plusTage(woche, tagNr);
      if (wochentag(kandidat) === tagNr && kandidat >= rawStart) {
        raus.push(kandidat);
      }
    }
    woche = plusTage(woche, schritt);
  }
  return raus;
}
