// EDIFACT encoding helpers for § 302 SGB V DTA files.
//
// Format constants per GKV Spitzenverband Technische Anlage. The UNA header
// `UNA:+,? '` at the start of every interchange declares these chars.

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
export function escapeEdifact(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Escape RELEASE_CHAR FIRST, otherwise we double-escape later substitutions.
  s = s.replace(/\?/g, '??');
  for (const ch of RESERVED) {
    if (ch === EDIFACT.RELEASE_CHAR) continue;
    s = s.split(ch).join(EDIFACT.RELEASE_CHAR + ch);
  }
  return s;
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
  const parts = elements.map(el => {
    if (Array.isArray(el)) {
      // Render composite, then strip trailing empty components.
      const subs = el.map(sub => escapeEdifact(sub));
      while (subs.length > 1 && subs[subs.length - 1] === '') subs.pop();
      return subs.join(EDIFACT.COMPONENT_SEP);
    }
    return escapeEdifact(el);
  });
  // Strip trailing empty top-level fields.
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  const body = parts.length ? EDIFACT.ELEMENT_SEP + parts.join(EDIFACT.ELEMENT_SEP) : '';
  return tag + body + EDIFACT.SEGMENT_TERM;
}

// UNA service string advice (always first 9 chars of an EDIFACT interchange).
export const UNA_HEADER = 'UNA' +
  EDIFACT.COMPONENT_SEP +
  EDIFACT.ELEMENT_SEP +
  EDIFACT.DECIMAL_MARK +
  EDIFACT.RELEASE_CHAR +
  ' ' +
  EDIFACT.SEGMENT_TERM;
