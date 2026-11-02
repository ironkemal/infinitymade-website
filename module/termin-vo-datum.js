/**
 * @fileoverview Reines Hilfsmodul für die Datumsprüfung bei der Termin-Verordnungs-Bindung (#339).
 *
 * Regel:
 * Liegt ein Termin vor dem Ausstellungsdatum der Verordnung (Europe/Berlin Kalendertag),
 * ist die Leistung nach HeilM-RL / §302 SGB V nicht abrechenbar und das Binden wird blockiert.
 */

import { alsBerlinDatum } from './berlin-datum.js';

export const FEHLER_TERMIN_VOR_AUSSTELLUNG =
  'Dieser Termin liegt vor dem Ausstellungsdatum der Verordnung und ist nicht abrechenbar.';

/**
 * Ermittelt den Europe/Berlin-Kalendertag (YYYY-MM-DD) eines Termins.
 * Unterstützt Date-Objekte, Zeitstempel, ISO-Strings und Termin-Objekte mit
 * start_time, date+time oder date.
 *
 * @param {Date|string|number|object|null|undefined} termin
 * @returns {string} YYYY-MM-DD oder ''
 */
export function terminKalendertagBerlin(termin) {
  if (!termin) return '';
  if (typeof termin === 'object' && !(termin instanceof Date)) {
    if (termin.start_time) return terminKalendertagBerlin(termin.start_time);
    if (termin.date && termin.time) return terminKalendertagBerlin(`${termin.date}T${termin.time}`);
    if (termin.date) return terminKalendertagBerlin(termin.date);
    if (termin.start) return terminKalendertagBerlin(termin.start);
    if (termin.behandlungsdatum) return terminKalendertagBerlin(termin.behandlungsdatum);
  }
  const direkt = alsBerlinDatum(termin);
  if (direkt) return direkt;

  if (typeof termin === 'string') {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(termin.trim());
    if (m) return m[1];
  }
  return '';
}

/**
 * Ermittelt den Europe/Berlin-Kalendertag (YYYY-MM-DD) des Ausstellungsdatums einer Verordnung.
 * Unterstützt Date-Objekte, ISO-Datumsstrings oder Verordnungsobjekte.
 *
 * @param {Date|string|number|object|null|undefined} vo
 * @returns {string} YYYY-MM-DD oder ''
 */
export function verordnungAusstellungstagBerlin(vo) {
  if (!vo) return '';
  if (typeof vo === 'object' && !(vo instanceof Date)) {
    if (vo.ausstellungsdatum) return verordnungAusstellungstagBerlin(vo.ausstellungsdatum);
    if (vo.verordnungsdatum) return verordnungAusstellungstagBerlin(vo.verordnungsdatum);
  }
  const direkt = alsBerlinDatum(vo);
  if (direkt) return direkt;

  if (typeof vo === 'string') {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(vo.trim());
    if (m) return m[1];
  }
  return '';
}

/**
 * Prüft, ob ein Termin vor dem Ausstellungsdatum einer Verordnung liegt.
 * Ist der Kalendertag in Berlin strikt kleiner als das Ausstellungsdatum,
 * ist die Bindung unzulässig.
 *
 * @param {Date|string|number|object} terminZeit  Termin-Startzeitpunkt oder Termin-Objekt
 * @param {Date|string|number|object} ausstellungsdatum  Ausstellungsdatum oder Verordnungsobjekt
 * @returns {{ok: boolean, fehler?: string}}
 */
export function pruefeTerminVoDatum(terminZeit, ausstellungsdatum) {
  const tTag = terminKalendertagBerlin(terminZeit);
  const voTag = verordnungAusstellungstagBerlin(ausstellungsdatum);

  if (tTag && voTag && tTag < voTag) {
    return {
      ok: false,
      fehler: FEHLER_TERMIN_VOR_AUSSTELLUNG,
    };
  }
  return { ok: true };
}
