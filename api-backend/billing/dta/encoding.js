// EDIFACT encoding helpers for § 302 SGB V DTA files.
//
// Format constants per GKV Spitzenverband Technische Anlage. Die Anlage legt
// diese Trennzeichen fest; sie werden NICHT per UNA-Segment angekuendigt
// (siehe UNA_HEADER am Dateiende).

export const EDIFACT = Object.freeze({
  COMPONENT_SEP: ':',   // sub-element separator
  ELEMENT_SEP:   '+',   // element separator
  DECIMAL_MARK:  ',',   // numbers use comma, not dot
  RELEASE_CHAR:  '?',   // escape (release) character
  SEGMENT_TERM:  "'",   // segment terminator
});

const RESERVED = [
  EDIFACT.COMPONENT_SEP,
  EDIFACT.ELEMENT_SEP,
  EDIFACT.RELEASE_CHAR,
  EDIFACT.SEGMENT_TERM,
];

// Per ITSG specification, DTA uses the ISO 8859-1 (Latin-1) character set
// with German umlauts intact. We do not normalise — the upstream OCR/UI must
// already produce Latin-1-safe text. This helper only escapes reserved EDIFACT
// control chars by prefixing them with '?'.
//
// Das Komma ist ein Sonderfall (Anlage 1 TP5 V21, Kap. 5.1 (11)): die
// Spezifikation zaehlt es zu den Steuerzeichen, weil es das Dezimalzeichen
// ist — in FREITEXT muss es deshalb mit '?' entwertet werden. In Zahlen darf
// es das gerade NICHT: `fmtAmount(51.92)` liefert "51,92", und "51?,92" waere
// ein kaputter Betrag. Beide Werte laufen durch dieselbe Funktion, deshalb ist
// die Unterscheidung ein ausdruecklicher Schalter und keine Heuristik —
// geraten wuerde hier frueher oder spaeter falsch geraten.
export function escapeEdifact(value, { komma = false } = {}) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Escape RELEASE_CHAR FIRST, otherwise we double-escape later substitutions.
  s = s.replace(/\?/g, '??');
  const zeichen = komma ? [...RESERVED, EDIFACT.DECIMAL_MARK] : RESERVED;
  for (const ch of zeichen) {
    if (ch === EDIFACT.RELEASE_CHAR) continue;
    s = s.split(ch).join(EDIFACT.RELEASE_CHAR + ch);
  }
  return s;
}

// Markierung „dies ist ein Freitextfeld" fuer buildSegment().
//
// Warum eine Markierung am Wert statt einer Feldliste im Builder: welche
// Stelle Freitext ist, weiss das Segment (segments.js), nicht die Kodierung.
// Eine zentrale Liste „NAD Feld 1 und 4 und 6" muesste bei jeder
// Segmentaenderung mitgepflegt werden und waere genau die Sorte Tabelle, die
// still veraltet. Ein Symbol-Container kann dagegen nicht versehentlich
// verloren gehen: er ueberlebt den Weg durch buildSegment unveraendert oder
// gar nicht.
//
// Nicht markierte Werte verhalten sich exakt wie vorher — Ziffern, Kodes,
// Betraege und Datumsangaben bleiben unberuehrt.
const FREITEXT = Symbol('edifact.freitext');

export function freitext(value) {
  if (value === null || value === undefined || value === '') return '';
  return { [FREITEXT]: String(value) };
}

export function istFreitext(v) {
  return typeof v === 'object' && v !== null && FREITEXT in v;
}

// Format a number with German decimal mark and no thousands separator.
// Used for EUR amounts: 12.50 -> "12,50"
export function fmtAmount(eur, decimals = 2) {
  if (eur === null || eur === undefined || eur === '') return '';
  const n = typeof eur === 'number' ? eur : parseFloat(eur);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(decimals).replace('.', EDIFACT.DECIMAL_MARK);
}

// Dates in §302 are mostly YYYYMMDD, no separator.
export function fmtDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// Build a single segment line.
//   buildSegment('FKT', ['01', '', '123456789'])
//     -> "FKT+01++123456789'"
// Sub-elements: pass nested array.
//   buildSegment('NAD', ['Mustermann', 'Hans'])
//     -> "NAD+Mustermann+Hans'"
//   buildSegment('REC', [['SAMMEL01', '0'], '20260518', '1'])
//     -> "REC+SAMMEL01:0+20260518+1'"
//
// Per §302 Anlage 1: trailing empty Kann-fields are dropped (segment ends
// immediately at last non-empty); empty Kann-fields in the middle keep their
// `+` placeholder. Composite trailing empties inside a DEG are likewise dropped.
export function buildSegment(tag, elements = []) {
  const kodiere = (v) => istFreitext(v)
    ? escapeEdifact(v[FREITEXT], { komma: true })
    : escapeEdifact(v);
  const parts = elements.map(el => {
    if (Array.isArray(el)) {
      // Render composite, then strip trailing empty components.
      const subs = el.map(sub => kodiere(sub));
      while (subs.length > 1 && subs[subs.length - 1] === '') subs.pop();
      return subs.join(EDIFACT.COMPONENT_SEP);
    }
    return kodiere(el);
  });
  // Strip trailing empty top-level fields.
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  const body = parts.length ? EDIFACT.ELEMENT_SEP + parts.join(EDIFACT.ELEMENT_SEP) : '';
  return tag + body + EDIFACT.SEGMENT_TERM;
}

// UNA service string advice.
//
// ⛔ WIRD NICHT MEHR ERZEUGT (gkv-302 Audit 19.09.2026). Die Anlage 1 TP5 V21
// sieht das Segment nirgends vor — sie legt die Trennzeichen fest, statt sie
// in der Datei ankuendigen zu lassen — und in der echten, von der Kasse
// angenommenen Referenzdatei des Beta-Kunden steht es ebenfalls nicht. Ein
// Zeichen zuviel am Dateianfang faellt in Pruefstufe 1, und dort wird die
// ganze Datei abgewiesen.
//
// Die Konstante bleibt als Referenz stehen (und weil die Trennzeichen-Tabelle
// oben sich daran ablesen laesst); sie darf nicht wieder in `builder.js`
// aufgenommen werden, ohne dass es dafuer eine Fundstelle in der Anlage gibt.
export const UNA_HEADER = 'UNA' +
  EDIFACT.COMPONENT_SEP +
  EDIFACT.ELEMENT_SEP +
  EDIFACT.DECIMAL_MARK +
  EDIFACT.RELEASE_CHAR +
  ' ' +
  EDIFACT.SEGMENT_TERM;
