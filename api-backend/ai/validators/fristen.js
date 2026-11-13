/**
 * Gemeinsame Fristen- und Datumshelfer für die Backend-Rezeptvalidierung
 * (`standardRules.js`, `lhbBvbRules.js`, `blankoRules.js`).
 *
 * Quelle: G-BA HeilM-RL § 15 Abs. 1 (und § 13a Abs. 2 für Blankoverordnung) —
 * 28 Kalendertage regulär, 14 Kalendertage bei dringlichem Behandlungsbedarf.
 */

/** @type {Readonly<{ normal: number, dringend: number }>} */
export const FRIST_TAGE = Object.freeze({ normal: 28, dringend: 14 });

const MS_PRO_TAG = 86400000;

/**
 * Parst ein ISO-Datum (`YYYY-MM-DD`) als UTC-Mitternacht, um Zeitzonen-Versatz zu vermeiden.
 * @param {string | null | undefined} s
 * @returns {Date | null}
 */
export function parseIsoDatum(s) {
  if (typeof s !== 'string') return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const d = new Date(`${trimmed}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Addiert eine Tagesanzahl (in UTC-Millisekunden) auf ein Datum.
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
export function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PRO_TAG);
}

/**
 * Berechnet die gerundete Tagesdifferenz `b - a`.
 * @param {Date} a
 * @param {Date} b
 * @returns {number}
 */
export function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / MS_PRO_TAG);
}

/**
 * Wandelt `Date` oder ISO-String sicher in ein `Date`-Objekt (UTC-Mitternacht) um.
 * @param {Date | string | null | undefined} wert
 * @returns {Date | null}
 */
function alsDatum(wert) {
  if (wert instanceof Date) {
    return Number.isNaN(wert.getTime()) ? null : wert;
  }
  return parseIsoDatum(wert);
}

/**
 * Berechnet das späteste erlaubte Datum für den Behandlungsbeginn:
 * 14 Kalendertage bei `isDringend`, sonst 28 Kalendertage ab Ausstellungsdatum.
 * @param {Date | string | null | undefined} ausstellungsdatum
 * @param {boolean} [isDringend=false]
 * @returns {Date | null}
 */
export function spaetesterBeginn(ausstellungsdatum, isDringend = false) {
  const ausstellung = alsDatum(ausstellungsdatum);
  if (!ausstellung) return null;
  const tage = isDringend ? FRIST_TAGE.dringend : FRIST_TAGE.normal;
  return addDays(ausstellung, tage);
}

/**
 * Prüft den Behandlungsbeginn gegen Ausstellungsdatum und Beginnfrist (§ 15 HeilM-RL).
 *
 * @param {object} [opts]
 * @param {Date | string | null | undefined} [opts.ausstellungsdatum]
 * @param {Date | string | null | undefined} [opts.behandlungsbeginn]
 * @param {boolean} [opts.isDringend=false]
 * @param {string} [opts.afterDeadlineCode='START_AFTER_DEADLINE']
 * @param {boolean} [opts.afterDeadlineBlocker=false]
 * @param {string} [opts.beforeMessage]
 * @param {string | ((ctx: { beginIso: string, latestStartIso: string, tage: number, isDringend: boolean }) => string)} [opts.afterMessage]
 * @param {Record<string, unknown>} [opts.afterExtra]
 * @returns {{ latestStart: Date | null, latestStartIso: string | null, blockers: Array<object>, warnings: Array<object> }}
 */
export function pruefeBehandlungsbeginn({
  ausstellungsdatum,
  behandlungsbeginn,
  isDringend = false,
  afterDeadlineCode = 'START_AFTER_DEADLINE',
  afterDeadlineBlocker = false,
  beforeMessage = 'Behandlungsbeginn liegt vor dem Ausstellungsdatum.',
  afterMessage,
  afterExtra
} = {}) {
  const blockers = [];
  const warnings = [];
  const ausstellung = alsDatum(ausstellungsdatum);
  const latestStart = spaetesterBeginn(ausstellung, isDringend);
  const latestStartIso = latestStart ? latestStart.toISOString().slice(0, 10) : null;

  const begin = alsDatum(behandlungsbeginn);
  if (!ausstellung || !begin || !latestStart || !latestStartIso) {
    return { latestStart, latestStartIso, blockers, warnings };
  }

  if (daysBetween(ausstellung, begin) < 0) {
    blockers.push({
      code: 'START_BEFORE_AUSSTELLUNG',
      msg: beforeMessage,
      field: 'behandlungsbeginn'
    });
    return { latestStart, latestStartIso, blockers, warnings };
  }

  if (begin > latestStart) {
    const beginIso = typeof behandlungsbeginn === 'string' && behandlungsbeginn.trim()
      ? behandlungsbeginn.trim()
      : begin.toISOString().slice(0, 10);
    const tage = isDringend ? FRIST_TAGE.dringend : FRIST_TAGE.normal;
    const msg = typeof afterMessage === 'function'
      ? afterMessage({ beginIso, latestStartIso, tage, isDringend: !!isDringend })
      : (afterMessage || (
        `Behandlungsbeginn (${beginIso}) liegt nach der regulären Verordnungsgültigkeit (${latestStartIso}). `
        + `${isDringend ? 'Bei "dringender Behandlungsbedarf" soll die Behandlung innerhalb von 14 Tagen beginnen.' : 'Verordnungen sind 28 Tage nach Ausstellung gültig.'} `
        + 'Bitte prüfen Sie mit dem verordnenden Arzt, ob eine erneute Ausstellung erforderlich ist.'
      ));

    const meldung = {
      code: afterDeadlineCode,
      msg,
      field: 'behandlungsbeginn',
      latest_allowed: latestStartIso,
      ...(afterDeadlineBlocker ? {} : { requires_confirmation: true }),
      ...(afterExtra || {})
    };
    if (afterDeadlineBlocker) {
      blockers.push(meldung);
    } else {
      warnings.push(meldung);
    }
  }

  return { latestStart, latestStartIso, blockers, warnings };
}
