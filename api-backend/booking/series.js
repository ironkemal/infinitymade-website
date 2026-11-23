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

/** @type {Record<string, number>} */
const WOCHENTAG_KURZ = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * @param {unknown} v
 * @returns {boolean}
 */
export function isStrictInteger(v) {
  if (typeof v === 'number') return Number.isInteger(v);
  if (typeof v === 'string') return /^\d+$/.test(v.trim());
  return false;
}

/**
 * @param {unknown} ds
 * @returns {ds is string}
 */
export function isValidCalendarDate(ds) {
  if (typeof ds !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ds)) return false;
  const d = new Date(ds + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().substring(0, 10) === ds;
}

/**
 * `YYYY-MM-DD` plus n Tage, wieder als `YYYY-MM-DD`.
 * @param {string} ds
 * @param {number} tage
 * @returns {string}
 */
export function plusTage(ds, tage) {
  const d = new Date(ds + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().substring(0, 10);
}

/**
 * Der Wochentag eines Datums in Berlin (0=So … 6=Sa).
 * @param {string} ds
 * @returns {number}
 */
export function wochentag(ds) {
  const probe = new Date(ds + 'T12:00:00Z');
  return WOCHENTAG_KURZ[new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', weekday: 'short' }).format(probe)];
}

/**
 * Berechnet die Termintage einer Serie deterministisch.
 * @param {object} [opts]
 * @param {string | null} [opts.startDatum]
 * @param {string | null} [opts.startDate]
 * @param {number | string | null} [opts.anzahl]
 * @param {number | string | null} [opts.count]
 * @param {number | string | null} [opts.intervalDays]
 * @param {boolean} [opts.taeglich=false]
 * @param {string | null} [opts.recurrence]
 * @param {unknown} [opts.wochentage]
 * @param {unknown} [opts.weekdays]
 * @returns {string[]}
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
  const zahl = parseInt(/** @type {string} */ (rawCount), 10);
  if (zahl < 1) return [];

  const isDaily = taeglich === true || recurrence === 'daily';
  if (isDaily) {
    return Array.from({ length: zahl }, (_, i) => plusTage(rawStart, i));
  }

  let schritt;
  const parsedStep = parseInt(/** @type {string} */ (intervalDays), 10);
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

/**
 * Ruhiger Hinweis im Serienbericht, wenn die KI nicht mitgerechnet hat (Box-Test 22.11.2026,
 * Pflichtpunkt 5). Der Vorschlag kommt dann aus den festen Regeln (Slot-Suche) — das ist kein
 * Fehler, soll aber sichtbar sein. Kutu: AI_MODE=aus ist der Normalfall (K4/K-20).
 * @param {'ok'|'error'|string} status  seriesStatus aus der Route
 * @param {string|null} [code]          safeAiError(err).code
 * @returns {string} leer, wenn die KI lief
 */
export function kiHinweisFuerSerie(status, code = null) {
  if (status !== 'error') return '';
  if (code === 'AI_MODE_AUS' || code === 'AI_OWNER_DISABLED') {
    return 'ℹ KI-Unterstützung ist ausgeschaltet — Vorschlag nach festen Regeln berechnet.';
  }
  return 'ℹ KI-Unterstützung gerade nicht erreichbar — Vorschlag nach festen Regeln berechnet.';
}
