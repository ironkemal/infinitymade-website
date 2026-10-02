// Berliner Kalendertag als 'YYYY-MM-DD' — EINE Stelle statt drei Inline-Kopien.
//
// Warum nicht UTC: zwischen 00:00 und 01:00/02:00 Berliner Zeit liegt UTC noch
// auf dem Vortag. Ein Stichtag-Vergleich (Gültigkeit der Datenannahmestelle,
// Quartalswechsel 01.10.) wäre in dieser Stunde um einen Tag falsch — die Datei
// ginge an den Empfänger des Vorquartals (O-139, gkv-302 30.09.2026).
// `Intl` statt Offset-Rechnung: DST-sicher, wie der Rest des Backends.

const FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** @param {Date} [jetzt]  nur für Tests */
export function berlinHeute(jetzt = new Date()) {
  return FORMAT.format(jetzt);
}

/**
 * Prüft einen Stichtag: echtes Kalenderdatum im Format YYYY-MM-DD.
 * @returns {boolean}
 */
export function istStichtag(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Berechnet das Jahresende in 'jahre' Jahren (YYYY-12-31) basierend auf dem Berliner Jahr.
 * @param {number} jahre
 * @param {Date} [jetzt]
 * @returns {string} 'YYYY-12-31'
 */
export function jahresendePlus(jahre, jetzt = new Date()) {
  const jahr = parseInt(berlinHeute(jetzt).slice(0, 4), 10) + jahre;
  return `${jahr}-12-31`;
}

