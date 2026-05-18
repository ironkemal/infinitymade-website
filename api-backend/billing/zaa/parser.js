// ZAA response file parser.
//
// ITSG response files come in two shapes in the wild:
//   1. EDIFACT-style FEHL segments inside a UNB envelope. Each FEHL row has
//      "+"-separated fields, typically:
//        FEHL+<errorCode>+<belegnummer>+<freetext>'
//   2. Plain text / CSV reports from older DAS portals (Davaso historically
//      shipped a tab-separated TXT). Lines like:
//        <belegnummer><TAB><code><TAB><text>
//      or                                   "Beleg 0001234: Fehler 101 — Pos.Nr"
//
// We try EDIFACT first, then fall back to a regex-driven plain-text scan.

import { translateZaaCode } from './error-translations.js';

const SEG_END = "'";
const FIELD_SEP = '+';

function splitSegments(content) {
  // EDIFACT segments terminated by apostrophe; handle CRLF / LF noise.
  return content
    .replace(/\r/g, '')
    .split(SEG_END)
    .map(s => s.trim())
    .filter(Boolean);
}

function parseEdifactFehl(content) {
  const errs = [];
  const segs = splitSegments(content);
  let hasFehl = false;
  // Track current belegnummer from INV segments so FEHL without explicit belegnummer
  // can be associated with the most recent prescription context.
  let currentBeleg = null;

  for (const raw of segs) {
    const fields = raw.split(FIELD_SEP);
    const tag = (fields[0] || '').trim().toUpperCase();
    if (tag === 'INV' && fields.length > 1) {
      // Belegnummer is the 4th sub-element of INV per Anlage 1 V21;
      // but in response files it's typically field index 3 or 4 — try both.
      currentBeleg = (fields[3] || fields[4] || '').trim() || currentBeleg;
    } else if (tag === 'FEHL' || tag === 'FEH') {
      hasFehl = true;
      const code  = (fields[1] || '').trim();
      const beleg = (fields[2] || '').trim() || currentBeleg;
      const text  = (fields.slice(3).join(' ').trim()) || '';
      if (code) errs.push({ code, belegnummer: beleg || null, text });
    } else if (tag === 'ERR') {
      hasFehl = true;
      // alternative variant: ERR+code+text
      const code = (fields[1] || '').trim();
      const text = (fields.slice(2).join(' ').trim()) || '';
      if (code) errs.push({ code, belegnummer: currentBeleg, text });
    }
  }
  return hasFehl ? errs : null;
}

const PLAIN_PATTERNS = [
  // "Fehler 101 — Belegnummer 12345 — Pos.Nr"
  /Fehler[:\s]*(\d{1,3})[^\n]*?Belegnummer[:\s]*([A-Za-z0-9\-]+)\s*[—\-:]\s*([^\n]+)/i,
  // "0001234<TAB>101<TAB>Positionsnummer unbekannt"
  /^([A-Za-z0-9\-]{4,20})\s+(\d{1,3})\s+(.+)$/,
  // "Code 101  Beleg 12345  Text"
  /Code[:\s]*(\d{1,3})[^\n]*?Beleg[:\s]*([A-Za-z0-9\-]+)\s+(.+)/i,
];

function parsePlainText(content) {
  const errs = [];
  const lines = content.split(/\n+/);
  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line || line.length < 4) continue;
    for (const re of PLAIN_PATTERNS) {
      const m = line.match(re);
      if (m) {
        const isFirstPattern = re === PLAIN_PATTERNS[0] || re === PLAIN_PATTERNS[2];
        const code  = isFirstPattern ? m[1] : m[2];
        const beleg = isFirstPattern ? m[2] : m[1];
        const text  = (m[3] || '').trim();
        errs.push({ code: code.trim(), belegnummer: beleg.trim() || null, text });
        break;
      }
    }
  }
  return errs;
}

/**
 * Parse a ZAA response file. Returns an array of error rows enriched with
 * German translation + fix hint via the error-translations dictionary.
 *
 * @param {string|Buffer} input  Raw file content (latin1 string or Buffer).
 * @returns {{ format: 'edifact'|'plain'|'empty', errors: Array<{code,belegnummer,text,uebersetzung,loesung}> }}
 */
export function parseZaaFile(input) {
  const content = Buffer.isBuffer(input) ? input.toString('latin1') : String(input || '');

  let format = 'empty';
  let rows = parseEdifactFehl(content);
  if (rows && rows.length) {
    format = 'edifact';
  } else {
    rows = parsePlainText(content);
    if (rows.length) format = 'plain';
  }

  const enriched = (rows || []).map(r => {
    const tr = translateZaaCode(r.code);
    return {
      code:         r.code,
      belegnummer:  r.belegnummer || null,
      text:         r.text || (tr?.text || ''),
      uebersetzung: tr?.text || null,
      loesung:      tr?.loesung || null,
    };
  });

  return { format, errors: enriched };
}
