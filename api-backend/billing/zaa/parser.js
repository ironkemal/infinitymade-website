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
import { segmenteTrennen, felderTrennen } from '../dta/preflight.js';

const FIELD_SEP = '+';

// Segmente trennen — dieselbe Routine wie beim Erzeugen (dta/preflight.js),
// bewusst nicht noch einmal hier nachgebaut. Der frühere `split("'")` kannte
// das Entwertungszeichen nicht: schickt die Kasse in einem FEHL-Freitext ein
// entwertetes Apostroph (`?'`), zerschnitt er das Segment an der falschen
// Stelle und eine Absetzung ging verloren oder landete auf dem falschen Beleg.
// Das `\r`-Strippen und das Trimmen bleiben hier, weil Antwortdateien mit
// CRLF und Zeilenumbrüchen zwischen den Segmenten ankommen.
function splitSegments(content) {
  return segmenteTrennen(String(content || '').replace(/\r/g, ''))
    .map(s => s.trim())
    .filter(Boolean);
}

const CODE_REGEX = /^\d{1,3}$/;

function hasTerminalApostrophe(str) {
  const trimmed = String(str || '').trim();
  if (!trimmed.endsWith("'")) return false;
  let qCount = 0;
  for (let i = trimmed.length - 2; i >= 0 && trimmed[i] === '?'; i--) {
    qCount++;
  }
  return qCount % 2 === 0;
}

function parseEdifactFehl(content) {
  const errs = [];
  const segs = splitSegments(content);
  let hasFehl = false;
  let hasEdifact = false;
  let isMalformed = false;
  // Track current belegnummer from INV segments so FEHL without explicit belegnummer
  // can be associated with the most recent prescription context.
  let currentBeleg = null;

  for (const raw of segs) {
    if (/\n\s*(?:FEHL|FEH|ERR|INV|UNB|UNH|UNT|UNZ)\+/i.test(raw)) {
      isMalformed = true;
    }
    // Entwertungsfest (`?+` in einem Freitext ist KEIN Feldtrenner) — die
    // zweite Haelfte des Fundes von `d8249d6`, der nur die Segmentebene
    // geheilt hatte. Ein falsch zerlegtes FEHL setzt die Absetzung auf den
    // falschen Beleg.
    const fields = felderTrennen(raw);
    const tag = (fields[0] || '').trim().toUpperCase();
    if (tag === 'UNB' || tag === 'UNH' || tag === 'UNT' || tag === 'UNZ') {
      hasEdifact = true;
    } else if (tag === 'INV') {
      hasEdifact = true;
      if (fields.length > 1) {
        // Belegnummer is the 4th sub-element of INV per Anlage 1 V21;
        // but in response files it's typically field index 3 or 4 — try both.
        currentBeleg = (fields[3] || fields[4] || '').trim() || currentBeleg;
      }
    } else if (tag === 'FEHL' || tag === 'FEH') {
      hasFehl = true;
      hasEdifact = true;
      // Minimum explicit code + belegslot: fields.length must be >= 3
      if (fields.length < 3) {
        isMalformed = true;
        continue;
      }
      const code  = (fields[1] || '').trim();
      const beleg = (fields[2] || '').trim() || currentBeleg;
      const text  = (fields.slice(3).join(' ').trim()) || '';
      if (!CODE_REGEX.test(code)) {
        isMalformed = true;
      } else {
        errs.push({ code, belegnummer: beleg || null, text });
      }
    } else if (tag === 'ERR') {
      hasFehl = true;
      hasEdifact = true;
      // Minimum explicit code + textslot: fields.length must be >= 3
      if (fields.length < 3) {
        isMalformed = true;
        continue;
      }
      // alternative variant: ERR+code+text
      const code = (fields[1] || '').trim();
      const text = (fields.slice(2).join(' ').trim()) || '';
      if (!CODE_REGEX.test(code)) {
        isMalformed = true;
      } else {
        errs.push({ code, belegnummer: currentBeleg, text });
      }
    }
  }

  if (hasEdifact || hasFehl) {
    if (!hasTerminalApostrophe(content)) {
      isMalformed = true;
    }
  }

  return { hasFehl, hasEdifact, isMalformed, errs };
}

const PLAIN_PATTERNS = [
  // "Fehler 101 — Belegnummer 12345 — Pos.Nr"
  /Fehler[:\s]*(\d{1,3})[^\n]*?Belegnummer[:\s]*([A-Za-z0-9\-]+)\s*[—\-:]\s*([^\n]+)/i,
  // "0001234<TAB>101<TAB>Positionsnummer unbekannt"
  // Untergrenze 1, nicht 4: seit der Umstellung auf
  // <Patientennummer>-<Verordnungsnummer> ist "1-1" eine gueltige Belegnummer
  // und war mit {4,20} unsichtbar — die Absetzung waere still verlorengegangen.
  // Die Zeile bleibt eindeutig, weil Fehlercode und Text folgen muessen.
  /^([A-Za-z0-9\-]{1,20})\s+(\d{1,3})\s+(.+)$/,
  // "Code 101  Beleg 12345  Text"
  /Code[:\s]*(\d{1,3})[^\n]*?Beleg[:\s]*([A-Za-z0-9\-]+)\s+(.+)/i,
];

function parsePlainText(content) {
  const errs = [];
  let isMalformed = false;
  const lines = content.split(/\n+/);
  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line || line.length < 4) continue;
    let matched = false;
    for (const re of PLAIN_PATTERNS) {
      const m = line.match(re);
      if (m) {
        matched = true;
        const isFirstPattern = re === PLAIN_PATTERNS[0] || re === PLAIN_PATTERNS[2];
        const code  = isFirstPattern ? m[1] : m[2];
        const beleg = isFirstPattern ? m[2] : m[1];
        const text  = (m[3] || '').trim();
        errs.push({ code: code.trim(), belegnummer: beleg.trim() || null, text });
        break;
      }
    }
    if (!matched) {
      // Heuristic: check if line is a malformed candidate error record without
      // matching report headings (e.g. 'Bericht ZAA', 'Fehlerbericht', 'Code Beleg Text').
      if (/^Fehler[:\s]/i.test(line) ||
          /^Code[:\s]+(?:\d|Beleg[:\s]*\d)/i.test(line) ||
          /^[A-Za-z0-9\-]{1,20}\s+\d+/.test(line)) {
        isMalformed = true;
      }
    }
  }
  return { errs, isMalformed };
}

/**
 * Parse a ZAA response file. Returns an array of error rows enriched with
 * German translation + fix hint via the error-translations dictionary.
 *
 * @param {string|Buffer} input  Raw file content (latin1 string or Buffer).
 * @returns {{ valid: boolean, reason: null|'empty'|'unknown'|'invalid', format: 'edifact'|'plain'|'empty', errors: Array<{code,belegnummer,text,uebersetzung,loesung}> }}
 */
export function parseZaaFile(input) {
  if (input === null || input === undefined) {
    return { valid: false, reason: 'empty', format: 'empty', errors: [] };
  }

  if (typeof input !== 'string' && !Buffer.isBuffer(input)) {
    return { valid: false, reason: 'invalid', format: 'empty', errors: [] };
  }

  const content = Buffer.isBuffer(input) ? input.toString('latin1') : input;

  if (content.trim().length === 0) {
    return { valid: false, reason: 'empty', format: 'empty', errors: [] };
  }

  let format = 'empty';
  let rows = [];

  const ediResult = parseEdifactFehl(content);
  if (ediResult.isMalformed) {
    // Recognized malformed EDIFACT error segments must not fall back to plain text.
    return { valid: false, reason: 'invalid', format: 'empty', errors: [] };
  }

  if (ediResult.hasFehl && ediResult.errs.length > 0) {
    format = 'edifact';
    rows = ediResult.errs;
  } else if (ediResult.hasEdifact) {
    // Recognized EDIFACT envelope/structural tags with no errors reject without plain fallback.
    return { valid: false, reason: 'unknown', format: 'empty', errors: [] };
  } else {
    const plainResult = parsePlainText(content);
    if (plainResult.isMalformed) {
      return { valid: false, reason: 'invalid', format: 'empty', errors: [] };
    }
    if (plainResult.errs.length > 0) {
      format = 'plain';
      rows = plainResult.errs;
    }
  }

  if (!rows || rows.length === 0) {
    // Zero recognized errors NEVER implies authentic DAS acceptance.
    return { valid: false, reason: 'unknown', format: 'empty', errors: [] };
  }

  const enriched = rows.map(r => {
    const tr = translateZaaCode(r.code);
    return {
      code:         r.code,
      belegnummer:  r.belegnummer || null,
      text:         r.text || (tr?.text || ''),
      uebersetzung: tr?.text || null,
      loesung:      tr?.loesung || null,
    };
  });

  return { valid: true, reason: null, format, errors: enriched };
}
