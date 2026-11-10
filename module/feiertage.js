/**
 * feiertage.js — gesetzliche Feiertage je Bundesland (reine Rechnung, kein Netz, keine Bibliothek).
 *
 * Warum es das gibt (canli-test 10.11.2026): die öffentliche Buchungsseite sperrte nur, was der Inhaber als
 * Sondertag eintrug. Am 25.12. war hoffmann-schwabing frei buchbar — der Patient steht vor verschlossener Tür.
 * Statt neuer Sperrlogik legt der Knopf (feiertage-knopf.js) die Feiertage als ganztägige Sondertage
 * (custom_days, type 'holiday') an; damit greifen Online-Sperre, Kalender-Etikett, Warnung und Anrufliste.
 *
 * Quelle der Regeln: Feiertagsgesetze der Länder (Stand 2026). `optional: true` = nur in einzelnen Gemeinden
 * gesetzlich (Fronleichnam SN/TH, Mariä Himmelfahrt BY) — wird nie vorausgewählt.
 * Nicht enthalten: Sonntage (Ostersonntag/Pfingstsonntag BB), 24.12./31.12. (kein gesetzlicher Feiertag).
 */

export const BUNDESLAENDER = {
  BW: 'Baden-Württemberg', BY: 'Bayern', BE: 'Berlin', BB: 'Brandenburg', HB: 'Bremen', HH: 'Hamburg',
  HE: 'Hessen', MV: 'Mecklenburg-Vorpommern', NI: 'Niedersachsen', NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz', SL: 'Saarland', SN: 'Sachsen', ST: 'Sachsen-Anhalt', SH: 'Schleswig-Holstein', TH: 'Thüringen',
};

const ALLE = Object.keys(BUNDESLAENDER);

/** Ostersonntag (anonymer gregorianischer Algorithmus) als [monat(1-12), tag]. */
export function ostersonntag(jahr) {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return [monat, tag];
}

const iso = (d) => d.toISOString().slice(0, 10);
const utc = (j, m, t) => new Date(Date.UTC(j, m - 1, t));
const plus = (d, n) => new Date(d.getTime() + n * 86400000);

/**
 * @param {number} jahr
 * @param {string} land  Kürzel BW … TH
 * @returns {{datum:string,name:string,optional:boolean}[]} nach Datum sortiert; unbekanntes Land -> []
 */
export function feiertage(jahr, land) {
  if (!ALLE.includes(land) || !Number.isInteger(jahr)) return [];
  const [om, ot] = ostersonntag(jahr);
  const ostern = utc(jahr, om, ot);
  const liste = [];
  const add = (datum, name, laender = ALLE, optional = false) => {
    if (laender.includes(land)) liste.push({ datum: iso(datum), name, optional });
  };
  add(utc(jahr, 1, 1), 'Neujahr');
  add(utc(jahr, 1, 6), 'Heilige Drei Könige', ['BW', 'BY', 'ST']);
  add(utc(jahr, 3, 8), 'Internationaler Frauentag', ['BE', 'MV']);
  add(plus(ostern, -2), 'Karfreitag');
  add(plus(ostern, 1), 'Ostermontag');
  add(utc(jahr, 5, 1), 'Tag der Arbeit');
  add(plus(ostern, 39), 'Christi Himmelfahrt');
  add(plus(ostern, 50), 'Pfingstmontag');
  add(plus(ostern, 60), 'Fronleichnam', ['BW', 'BY', 'HE', 'NW', 'RP', 'SL']);
  add(plus(ostern, 60), 'Fronleichnam (nur in einzelnen Gemeinden)', ['SN', 'TH'], true);
  add(utc(jahr, 8, 15), 'Mariä Himmelfahrt', ['SL']);
  add(utc(jahr, 8, 15), 'Mariä Himmelfahrt (nur in Gemeinden mit überwiegend katholischer Bevölkerung)', ['BY'], true);
  add(utc(jahr, 9, 20), 'Weltkindertag', ['TH']);
  add(utc(jahr, 10, 3), 'Tag der Deutschen Einheit');
  add(utc(jahr, 10, 31), 'Reformationstag', ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH']);
  add(utc(jahr, 11, 1), 'Allerheiligen', ['BW', 'BY', 'NW', 'RP', 'SL']);
  // Buß- und Bettag: Mittwoch vor dem 23.11.
  const ref = utc(jahr, 11, 23); const wt = ref.getUTCDay(); // 0=So
  add(plus(ref, -(((wt - 3 + 7) % 7) || 7)), 'Buß- und Bettag', ['SN']);
  add(utc(jahr, 12, 25), '1. Weihnachtstag');
  add(utc(jahr, 12, 26), '2. Weihnachtstag');
  return liste.sort((x, y) => x.datum.localeCompare(y.datum));
}

/**
 * Zeilen für custom_days: ganztägig, type 'holiday', nur ab `heute`, nur pflichtige Feiertage
 * plus ausdrücklich gewählte optionale (Namen in `optionaleNamen`).
 * @returns {{owner_id:string,date:string,type:'holiday',note:string,start_time:null,end_time:null}[]}
 */
export function feiertageZeilen({ ownerId, land, heute, jahre, optionaleNamen = [] }) {
  const tag = String(heute || '').slice(0, 10);
  const gewaehlt = new Set(optionaleNamen);
  const out = [];
  for (const j of jahre || []) {
    for (const f of feiertage(j, land)) {
      if (f.datum < tag) continue;
      if (f.optional && !gewaehlt.has(f.name)) continue;
      out.push({ owner_id: ownerId, date: f.datum, type: 'holiday', note: f.name, start_time: null, end_time: null });
    }
  }
  return out;
}
