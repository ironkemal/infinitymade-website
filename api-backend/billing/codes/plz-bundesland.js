// Postleitzahl → Bundesland, für die Preisabfrage der §302-Abrechnung.
//
// WARUM ES DIESE DATEI GIBT
// -------------------------
// In abrechnung.routes.js stand eine Tabelle aus 2-stelligen PLZ-Präfixen.
// Sie war ein JS-Objektliteral, in dem neun Schlüssel doppelt vorkamen
// ('19', '21', '22', '27', '36', '37', '38', '63', '07'). JavaScript behält
// still den letzten — eine Praxis in Braunschweig (38xxx) galt damit als
// Sachsen-Anhalt, eine in Hamburg (22xxx) als Schleswig-Holstein. Kein Fehler,
// keine Warnung, nur ein falscher Buchstabe.
//
// Zusätzlich endete die Funktion auf `|| 'NW'`: jede unbekannte PLZ wurde
// stillschweigend Nordrhein-Westfalen. Ein geratener Vorgabewert ist hier
// schlimmer als ein Abbruch, weil das Ergebnis in Geld umschlägt.
//
// WOFÜR — und wofür NICHT
// -----------------------
// Abnehmer ist ausschliesslich die Preisabfrage `heilmittel_tarif.bundesland`.
// Vergütungen werden je Bundesland verhandelt, dort ist die Geografie die
// richtige Achse.
//
// NICHT für das Tarifkennzeichen der DTA-Datei. Das kommt aus dem Vertrag,
// nicht aus dem Ort — siehe billing/codes/legs.js. Wer diese Funktion für
// einen LEGS benutzt, baut den Fehler von 2026-08 wieder ein.
//
// DATENGRUNDLAGE
// --------------
// plz-bundesland.json, erzeugt mit `node tools/plz-orte.mjs <csv> --bundesland`
// (zauberware/postal-codes-json-xml-csv, Basis GeoNames, CC BY 4.0).
// 8.309 Postleitzahlen, vollständige Zuordnung statt Präfix-Schätzung.
//
// Elf PLZ liegen wirklich auf einer Landesgrenze (z. B. 07919 SN/TH,
// 21039 HH/SH). Dort steht eine Liste statt eines Werts. Aus dieser Liste
// still einen Wert zu wählen wäre genau der Fehler, der hier abgestellt wird —
// deshalb gelten sie als nicht eindeutig und der Aufrufer muss nachfragen.

import { readFileSync } from 'node:fs';

const { bundesland: TABELLE } = JSON.parse(
  readFileSync(new URL('./plz-bundesland.json', import.meta.url), 'utf8')
);

/** Die 16 Länderkürzel, wie sie in heilmittel_tarif.bundesland stehen. */
export const BUNDESLAENDER = Object.freeze([
  'BB', 'BE', 'BW', 'BY', 'HB', 'HE', 'HH', 'MV',
  'NI', 'NW', 'RP', 'SH', 'SL', 'SN', 'ST', 'TH',
]);

/**
 * Alle Bundesländer, die zu einer PLZ passen.
 * @returns {string[]} 0 = unbekannte PLZ · 1 = eindeutig · 2 = Grenzfall
 */
export function bundeslandKandidaten(plz) {
  const p = String(plz ?? '').trim();
  if (!/^\d{5}$/.test(p)) return [];
  const treffer = TABELLE[p];
  if (!treffer) return [];
  return Array.isArray(treffer) ? [...treffer] : [treffer];
}

/**
 * Bundesland einer PLZ — oder null, wenn es keine eindeutige Antwort gibt.
 * Bewusst ohne Vorgabewert: der Aufrufer muss den Fall behandeln.
 * @returns {string|null}
 */
export function bundeslandFuerPlz(plz) {
  const k = bundeslandKandidaten(plz);
  return k.length === 1 ? k[0] : null;
}

/**
 * Klartext für die 422-Antwort, wenn die PLZ keine eindeutige Antwort hergibt.
 * @returns {string|null} null, wenn alles in Ordnung ist
 */
export function bundeslandFehlerText(plz) {
  const p = String(plz ?? '').trim();
  const k = bundeslandKandidaten(p);
  if (k.length === 1) return null;
  if (k.length > 1) {
    return `Die Postleitzahl ${p} liegt auf einer Landesgrenze (${k.join(' / ')}). ` +
      'Bitte das Bundesland der Praxis in den Stammdaten hinterlegen — die ' +
      'Heilmittelpreise werden je Bundesland verhandelt.';
  }
  return `Zur Postleitzahl "${p}" der Praxis ist kein Bundesland bekannt. ` +
    'Bitte die Postleitzahl in den Stammdaten prüfen — ohne Bundesland lassen ' +
    'sich die Heilmittelpreise nicht bestimmen.';
}

/** Anzahl Postleitzahlen in der Tabelle (für Tests/Diagnose). */
export const PLZ_ANZAHL = Object.keys(TABELLE).length;
