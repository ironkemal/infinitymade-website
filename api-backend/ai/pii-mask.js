// PII masking utility for AI calls (M4.1 / M4.3 / K4 safety).
//
// DSGVO Art. 32 + DSFA R3: minimize personal data sent to external AI models.
// Features:
// - Per-call cryptographic nonce (e.g. ⟦NAME_a1b2_1⟧) to prevent token collisions and nonce-crossing
// - Anti-injection: early neutralization of <<...>> and ⟦...⟧ in input
// - Context and pattern detection: KVNR, IBAN, Email, Phone, LANR/BSNR/IK, Address, DOB
// - Protected clinical terms: ICD-10 codes, diagnoses, medications, Wagner grades, health insurances
// - Strict unmasking: blocks unknown placeholders or foreign-nonce tokens in model responses
// - Residual scanner (scanneReste): detects remaining unmasked sensitive entities
// - Output scanning: prevents PII leakage and validates placeholder integrity
// - Unmasks parsed values only, never object keys (unmaskValues)
// - Prototype-pollution-proof maps (Object.create(null) / Map)

import crypto from 'node:crypto';

// Stop words that cannot match in isolation as a name part
const NAME_STOP_WORDS = new Set([
  'herr', 'herrn', 'frau', 'fräulein', 'hr', 'fr', 'dr', 'med', 'prof', 'dres',
  'doktor', 'schwester', 'von', 'und', 'der', 'die', 'das', 'den', 'dem', 'des',
  'am', 'im', 'in', 'an', 'zu', 'zum', 'zur', 'mit', 'fuer', 'für', 'bei'
]);

// Common German surnames that are also normal everyday words
const COMMON_WORD_SURNAMES = new Set([
  'koch', 'fuchs', 'weber', 'klein', 'bach', 'wagner', 'bauer', 'sommer',
  'vogel', 'berg', 'kraft', 'könig', 'koenig', 'engel', 'sauer', 'franke',
  'mai', 'wolf', 'braun', 'schwarz', 'weiß', 'weiss', 'groß', 'gross',
  'lang', 'jung', 'busch', 'stein', 'schneider', 'richter', 'schulz'
]);

const MONATE = '(?:Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)';

// Umlaut transliteration (ä↔ae, ö↔oe, ü↔ue, ß↔ss)
function getUmlautVariants(str) {
  const variants = new Set([str]);
  variants.add(str.replace(/ä/g, 'ae').replace(/Ä/g, 'Ae')
    .replace(/ö/g, 'oe').replace(/Ö/g, 'Oe')
    .replace(/ü/g, 'ue').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss'));
  variants.add(str.replace(/ae/g, 'ä').replace(/Ae/g, 'Ä')
    .replace(/oe/g, 'ö').replace(/Oe/g, 'Ö')
    .replace(/ue/g, 'ü').replace(/Ue/g, 'Ü').replace(/ss/g, 'ß'));
  return Array.from(variants);
}

// Levenshtein distance for fuzzy name matching (length >= 5, max dist <= 1)
function levenshteinDist(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  if (a === b) return 0;
  let edits = 0, i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] !== b[j]) {
      if (++edits > 1) return 2;
      if (a.length > b.length) i++;
      else if (a.length < b.length) j++;
      else { i++; j++; }
    } else { i++; j++; }
  }
  if (i < a.length || j < b.length) edits++;
  return edits;
}

function maskSnippet(s) {
  const str = String(s || '').trim();
  if (str.length <= 4) return '*'.repeat(str.length);
  return str.slice(0, 2) + '*'.repeat(Math.min(str.length - 3, 6)) + str.slice(-1);
}

// Generate variants for known names (full name, parts >= 3 chars, genitive)
function buildNameVariants(namesList) {
  const variants = [];
  for (const rawName of namesList) {
    if (!rawName || typeof rawName !== 'string') continue;
    const clean = rawName.trim();
    if (clean.length < 2) continue;

    const parts = clean.split(/[\s\-_/.,;:!?()]+/)
      .map(p => p.trim())
      .filter(p => p.length >= 3 && !NAME_STOP_WORDS.has(p.toLowerCase()));

    for (const cand of [clean, ...parts]) {
      for (const uVar of getUmlautVariants(cand)) {
        variants.push(uVar);
        if (!uVar.endsWith('s') && !uVar.endsWith('ß')) variants.push(uVar + 's');
      }
    }
  }
  return Array.from(new Set(variants)).filter(v => v.length >= 3).sort((a, b) => b.length - a.length);
}

// Protected clinical terms that must never be masked
function findProtectedSpans(text) {
  const spans = [];
  const protectedPatterns = [
    /\bWagner(?:-Grad|-Stadium|-Armstrong)?\s*[0-5][A-Za-z]?\b/gi,
    /\b(?:Dig\.|D)\s*[1-5](?:\s+(?:links|rechts|bds\.|lateral|medial|plantar))?\b/gi,
    /\bMFK[-\s]*(?:I{1,3}|IV|V|[1-5])\b/gi,
    /\b(?:Hallux(?:\s+valgus)?|Clavus(?:\s+neurovasculare)?|Hyperkeratosen|Nagelmykose|Unguis\s+incarnatus|Onychogrypose|Rhagaden|Polyneuropathie|pAVK|VHF|DFS)\b/gi,
    /\bDiabetes(?:\s+mellitus(?:\s+Typ\s+[12])?)?\b/gi,
    /\b[A-Z]\d{2}(?:\.\d{1,2}[A-Z*]?)?\b/g, // ICD-Codes
    /\b(?:Marcumar|Eliquis|Phenprocoumon|Copoline|Ringerlösung|Alginat|Propolisbalsam)\b/gi,
    /\b(?:INR(?:\s+aktuell)?\s+\d+(?:[.,]\d+)?|Quick\s+\d+%)\b/gi,
    /\b(?:Ross\s+Fraser|nach\s+Fontaine)\b/gi,
    /\b(?:AOK(?:\s+Rheinland(?:\/Hamburg)?)?|Barmer|Techniker(?:\s+Krankenkasse)?|DAK|IKK|TK|BKK)\b/gi
  ];

  for (const re of protectedPatterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, isProtected: true });
    }
  }
  return spans;
}

// Find PII spans in text
function findPiiSpans(text, entities = [], mandantNamen = [], preserveAppointments = true, map = null) {
  const spans = [];
  const currentYear = new Date().getFullYear();

  const add = (re, type, fn = null) => {
    let m;
    while ((m = re.exec(text)) !== null) {
      const res = fn ? fn(m) : { start: m.index, end: m.index + m[0].length, type };
      if (res) spans.push(res);
    }
  };

  // 1. Anti-injection: neutralize preexisting tokens <<...>> and ⟦...⟧
  add(/(?:<<[^>\r\n]+>>|⟦[^⟧\r\n]+⟧)/g, 'INJECTION', (m) => {
    if (map && map[m[0]] !== undefined) return null;
    return { start: m.index, end: m.index + m[0].length, type: 'INJECTION' };
  });

  // 2. KVNR (1 letter + 9 digits)
  add(/\b[A-Za-z]\d{9}\b/g, 'KVNR');

  // 3. IBAN
  add(/\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]){11,30}\b/g, 'IBAN');

  // 4. Email
  add(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, 'EMAIL');

  // 5. Phone numbers (German formats with +49, 0049, local area codes, min 7 digits)
  add(/(?:\+49|0049|\(0\d{2,5}\)|\b0\d{2,5})[\s/()-]*\d[\s/()-]*\d[\s/()-]*\d[\s/()-]*\d(?:[\s/()-]*\d)*/g, 'PHONE', (m) => {
    return m[0].replace(/\D/g, '').length >= 7 ? { start: m.index, end: m.index + m[0].length, type: 'PHONE' } : null;
  });

  // 6. LANR / BSNR / IK
  add(/\b(?:LANR|BSNR|Betriebsstätte|Betriebsstättennummer|Arztnummer|IK(?:\s+der\s+Kasse)?)(?:\s*:?|\s+)\s*(\d{9})\b/gi, null, (m) => {
    const digits = m[1];
    const idx = m.index + m[0].lastIndexOf(digits);
    const up = m[0].toUpperCase();
    const type = (up.includes('BSNR') || up.includes('BETRIEB')) ? 'BSNR' : (up.includes('IK') ? 'IK' : 'LANR');
    return { start: idx, end: idx + digits.length, type };
  });

  // 7. Organizations / Facilities
  add(/\b(Pflegeheim|Altenzentrum|Seniorenresidenz|Seniorenheim|Wohnstift|Caritas-Haus|Caritas|Pflegedienst|Klinik|Klinikum|Taxi)\s+(?:(?:am|an|der|die|das|im|in|zum|zur|St\.|Sankt)\s+)?(?:[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9\-\.]*(?:\s+(?:am|an|der|die|das|im|in|zum|zur|St\.|Sankt)\b|\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9\-\.]*)*)\b/gu, 'ORGANIZATION');

  // 8. Addresses: Street + Number
  add(/\b(?:(?:[A-ZÄÖÜ][a-zäöüß]+(?:str\.|straße|strasse|weg|allee|platz|ring|gasse|damm|kamp|chaussee|ufer)|[A-ZÄÖÜ][a-zäöüß]+\s+(?:Str\.|Straße|Strasse|Weg|Allee|Platz|Ring|Gasse)|Markt)\s+\d{1,4}\s*[a-zA-Z]?(?:[-/]\d{1,4}\s*[a-zA-Z]?)?)(?:,?\s*\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)?\b/gu, 'ADDRESS');
  add(/\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?\b/gu, 'ADDRESS');

  // 9. DOB (Date of birth) — only if explicitly labeled, or year is well in the past (>= 10 yrs ago)
  // NEVER mask current/future dates or times when preserving appointments!
  add(/\bJg\.\s*\d{2,4}\b/gi, 'DOB');
  add(/(?<=\b(?:geb\.|geboren|Geburtsdatum)(?:\s*:?|\s+))(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2})/gi, 'DOB');

  {
    // Historical full dates can identify birth dates; current/future appointments stay unchanged.
    add(new RegExp(`\\b\\d{1,2}\\.\\s*${MONATE}\\s+(\\d{2,4})\\b`, 'gui'), null, (m) => {
      const rawY = parseInt(m[1], 10);
      const yr = rawY < 100 ? (rawY > 30 ? 1900 + rawY : 2000 + rawY) : rawY;
      return (yr <= currentYear - 10) ? { start: m.index, end: m.index + m[0].length, type: 'DOB' } : null;
    });

    add(/\b(0?[1-9]|[12]\d|3[01])\.(0?[1-9]|1[0-2])\.(19\d\d|20\d\d)\b/g, null, (m) => {
      const yr = parseInt(m[3], 10);
      return (yr <= currentYear - 10) ? { start: m.index, end: m.index + m[0].length, type: 'DOB' } : null;
    });
  }

  // 10. Known names from entities + dictionary / mandantNamen
  const allNames = [
    ...entities.filter(e => e && e.type === 'NAME').map(e => e.value),
    ...mandantNamen
  ];
  for (const variant of buildNameVariants(allNames)) {
    const isCommon = COMMON_WORD_SURNAMES.has(variant.toLowerCase());
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const varRe = new RegExp(`(?<=^|[^\\p{L}\\p{N}])${escaped}(?=[^\\p{L}\\p{N}]|$)`, 'gui');
    add(varRe, null, (m) => {
      if (isCommon) {
        const isUpper = /^[A-ZÄÖÜ]/.test(m[0]);
        const prefix = text.slice(Math.max(0, m.index - 20), m.index);
        const hasAnrede = /\b(?:herr|herrn|frau|fräulein|dr|med|prof|dres)\b[.\s]*$/i.test(prefix);
        return (isUpper || hasAnrede) ? { start: m.index, end: m.index + m[0].length, type: 'NAME', isExplicit: true } : null;
      }
      return { start: m.index, end: m.index + m[0].length, type: 'NAME', isExplicit: true };
    });
  }

  // 11. Contextual names: Anrede / Titel + Name
  add(/\b(Herr|Herrn|Frau|Fräulein|Hr\.|Fr\.|Dr\. med\.|Dr\.|Prof\. Dr\.|Prof\.|Dres\.|Schwester)\s+([A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?(?:\s+[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?)*(?:\s*(?:&|und)\s*(?:[A-ZÄÖÜ][a-zäöüß]+(?:\s+(?:Partner|Kollegen)\b)?|Partner\b|Kollegen\b))?)/gu, 'NAME', (m) => {
    const nameStart = m.index + m[0].indexOf(m[2]);
    return { start: nameStart, end: m.index + m[0].length, type: 'NAME', isContextual: true };
  });

  // Verwandtschaft / Rolle + Name
  add(/\b(?:Tochter|Sohn|Ehemann|Ehefrau|Gatte|Gattin|Mutter|Vater|Bruder|Nachbar|Nachbarin|Pfleger|Pflegerin|Pflegekraft|Schwiegersohn|Schwiegertochter|Betreuer|Betreuerin|Therapeut|Therapeutin|Behandler|Behandlerin|Kollege|Kollegin|Fahrer|Fahrerin|Hausarzt|Hausärztin|Facharzt|Fachärztin|Patient|Patientin|Bewohner|Bewohnerin)\s+(?:(?:Herr|Herrn|Frau|Dr\.|Dr\. med\.)\s+)?([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\b/gu, null, (m) => {
    const namePart = m[1];
    const idx = m.index + m[0].lastIndexOf(namePart);
    return { start: idx, end: idx + namePart.length, type: 'NAME', isContextual: true };
  });

  // Familie + Name
  add(/\bFamilie\s+([A-ZÄÖÜ][a-zäöüß]+)\b/gu, null, (m) => {
    const fName = m[1];
    const idx = m.index + m[0].lastIndexOf(fName);
    return { start: idx, end: idx + fName.length, type: 'NAME', isContextual: true };
  });

  // Genitiv-Name ohne Artikel
  add(/(?<=^|[.!?]\s+|[;:,]\s+)([A-ZÄÖÜ][a-zäöüß]+)s\s+([A-ZÄÖÜ][a-zäöüß]+)/gu, null, (m) => {
    const genName = m[1] + 's';
    if (['aus', 'als', 'bis', 'dies', 'das'].includes(genName.toLowerCase())) return null;
    return { start: m.index, end: m.index + genName.length, type: 'NAME', isContextual: true };
  });

  // Locality only with explicit identity/ residence context, never arbitrary capitalized nouns.
  add(/\b(?:aus|in|wohnhaft\s+in|Wohnort\s*:)\s+([A-ZÄÖÜ][\p{L}]+(?:-[A-ZÄÖÜ][\p{L}]+)*)/gu, null, (m) => {
    const prefix = text.slice(Math.max(0, m.index - 100), m.index);
    if (/^(?:aus|in)\s/.test(m[0]) && !/(?:\bDr\.|\b(?:Herr|Herrn|Frau|Hausarzt|Hausärztin|Facharzt|Fachärztin|Patient|Patientin|Bewohner|Bewohnerin|Ehefrau|Ehemann)\b)/.test(prefix)) return null;
    const location = m[1];
    return { start: m.index + m[0].lastIndexOf(location), end: m.index + m[0].length, type: 'LOCATION' };
  });

  // 12. Other explicit entities (non-NAME)
  for (const ent of entities) {
    if (!ent || !ent.value || ent.type === 'NAME') continue;
    const vStr = String(ent.value).trim();
    if (vStr.length < 2) continue;
    add(new RegExp(vStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (ent.type || 'PII').toUpperCase(), (m) => {
      return { start: m.index, end: m.index + m[0].length, type: (ent.type || 'PII').toUpperCase(), isExplicit: true };
    });
  }

  return spans;
}

function resolveSpans(spans, protectedSpans) {
  // Explicit local identity wins over clinical heuristics; trusted generated tokens remain opaque.
  const isProtected = (s, e) => protectedSpans.some(p => Math.max(s, p.start) < Math.min(e, p.end));

  const valid = spans.filter(s => !protectedSpans.some(p => p.trusted && Math.max(s.start, p.start) < Math.min(s.end, p.end)) && (s.isExplicit || !isProtected(s.start, s.end)));

  // Sort: explicit entities first if overlapping, then start position, then length
  valid.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.isExplicit && !b.isExplicit) return -1;
    if (!a.isExplicit && b.isExplicit) return 1;
    return (b.end - b.start) - (a.end - a.start);
  });

  // Keep previously unknown name parts when a contextual full name overlaps known surname.
  const explicitSpans = valid.filter(s => s.isExplicit);
  const nonOverlapping = valid.flatMap(s => {
    if (s.isExplicit || !s.isContextual) return [s];
    let pieces = [{ ...s }];
    for (const exp of explicitSpans) {
      pieces = pieces.flatMap(piece => {
        if (Math.max(piece.start, exp.start) >= Math.min(piece.end, exp.end)) return [piece];
        const out = [];
        if (piece.start < exp.start) out.push({ ...piece, end: exp.start });
        if (piece.end > exp.end) out.push({ ...piece, start: exp.end });
        return out;
      });
    }
    return pieces;
  }).sort((a, b) => a.start - b.start || Number(b.isExplicit) - Number(a.isExplicit) || (b.end - b.start) - (a.end - a.start));

  const resolved = [];
  let lastEnd = 0;
  for (const span of nonOverlapping) {
    if (span.start >= lastEnd) {
      resolved.push(span);
      lastEnd = span.end;
    }
  }
  return resolved;
}

/**
 * Residual scanner (scanneReste) according to v2 rules.
 * Scans masked text for unmasked sensitive fragments.
 */
export function scanneReste(maskedText, mandantNamen = []) {
  if (!maskedText || typeof maskedText !== 'string') return [];
  const befunde = [];
  const clean = maskedText.replace(/⟦[A-Za-z0-9_]+⟧|<<[A-Za-z0-9_]+>>/g, ' ');

  const anredeRestRe = /\b(?:Herr|Herrn|Frau|Fräulein|Dr\.|Dr\. med\.|Prof\.|Dres\.)\s+([A-ZÄÖÜ][a-zäöüß]+)/gu;
  let am;
  while ((am = anredeRestRe.exec(maskedText)) !== null) {
    befunde.push({ art: 'ANREDE_REST', text: am[0], ausschnitt: maskSnippet(am[0]) });
  }

  const digitRe = /\b\d{7,}\b/g;
  let dm;
  while ((dm = digitRe.exec(clean)) !== null) {
    befunde.push({ art: 'ZIFFERNFOLGE', text: dm[0], ausschnitt: maskSnippet(dm[0]) });
  }

  if (/@/.test(clean)) {
    const at = clean.match(/\S+@\S+/);
    befunde.push({ art: 'EMAIL_REST', text: at ? at[0] : '@', ausschnitt: maskSnippet(at ? at[0] : '@') });
  }

  const plzRe = /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+/gu;
  let pm;
  while ((pm = plzRe.exec(clean)) !== null) {
    befunde.push({ art: 'PLZ_REST', text: pm[0], ausschnitt: maskSnippet(pm[0]) });
  }

  const rareAgeContext = /\b(?:9\d|1\d{2})[-\s]*(?:jährige[rns]?|Jahre\s+alt)\b/iu;
  if (rareAgeContext.test(clean) && /\b(?:Patient|Patientin|Bewohner|Bewohnerin)\b/iu.test(clean) && /\b(?:aus|wohnhaft|Wohnort)\b/iu.test(clean)) {
    befunde.push({ art: 'QUASI_REIDENTIFIKATION', text: '', ausschnitt: '[REDACTED]' });
  }

  const tokens = clean.split(/[^\p{L}\p{N}]+/u).filter(t => t.length >= 5);
  const nameParts = [];
  for (const n of mandantNamen) {
    if (!n) continue;
    for (const p of n.split(/[\s\-_/.]+/)) {
      if (p.length >= 5 && !NAME_STOP_WORDS.has(p.toLowerCase())) {
        nameParts.push(p.toLowerCase());
      }
    }
  }

  for (const tok of tokens) {
    const tokLower = tok.toLowerCase();
    for (const np of nameParts) {
      if (levenshteinDist(tokLower, np) <= 1) {
        befunde.push({ art: 'FUZZY_NAME_REST', text: tok, ausschnitt: maskSnippet(tok) });
        break;
      }
    }
  }

  return befunde;
}

export function unmaskStreng(text, knownMap) {
  if (typeof text !== 'string' || !text) return text;
  const isMap = knownMap instanceof Map;
  const has = (k) => isMap ? knownMap.has(k) : Object.prototype.hasOwnProperty.call(knownMap, k);
  const get = (k) => isMap ? knownMap.get(k) : knownMap[k];

  const matches = text.match(/⟦[A-Za-z0-9_]+⟧|<<[A-Za-z0-9_]+>>/g) || [];
  for (const m of matches) {
    if (!has(m)) {
      const err = new Error(`Unbekannter oder ungültiger Platzhalter in Modellantwort entdeckt: ${m}`);
      err.code = 'KI_UNBEKANNTER_PLATZHALTER';
      err.status = 502;
      throw err;
    }
  }

  return text.replace(/⟦[A-Za-z0-9_]+⟧|<<[A-Za-z0-9_]+>>/g, (m) => has(m) ? get(m) : m);
}

export function unmaskValues(val, unmaskFn) {
  if (typeof val === 'string') {
    return unmaskFn(val);
  }
  if (Array.isArray(val)) {
    return val.map(item => unmaskValues(item, unmaskFn));
  }
  if (val !== null && typeof val === 'object') {
    const out = Object.create(null);
    for (const k of Object.keys(val)) {
      out[k] = unmaskValues(val[k], unmaskFn);
    }
    return out;
  }
  return val;
}

export function scanOutputPII(text, knownMap = new Map(), { dictionary = [] } = {}) {
  const violations = [];
  if (typeof text !== 'string') return { safe: true, violations };
  const entries = knownMap instanceof Map ? [...knownMap.entries()] : Object.entries(knownMap);
  const has = key => knownMap instanceof Map ? knownMap.has(key) : Object.hasOwn(knownMap, key);
  const tokens = text.match(/⟦[^⟧\r\n]*⟧|<<[^>\r\n]*>>/g) || [];
  for (const token of tokens) if (!/^⟦[A-Z_]+_[a-f0-9]{32}_[1-9][0-9]*⟧$/.test(token) || !has(token)) violations.push('Unbekannter Platzhalter');
  const clean = text.replace(/⟦[^⟧\r\n]*⟧|<<[^>\r\n]*>>/g, ' ');
  if (/\b[A-Za-z]\d{9}\b/.test(clean)) violations.push('KVNR');
  if (/[⟦⟧]|<<|>>/.test(clean)) violations.push('MALFORMED_PLACEHOLDER');
  if (findPiiSpans(clean, [], dictionary, true).length > 0 || scanneReste(clean, dictionary).length > 0) violations.push('RAW_PII');
  for (const value of [...dictionary, ...entries.map(([, value]) => value)]) {
    if (typeof value !== 'string' || value.length < 2) continue;
    const escape = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('(?<![\\p{L}\\p{N}])' + escape + '(?![\\p{L}\\p{N}])', 'iu').test(clean)) violations.push('RAW_KNOWN_VALUE');
  }
  return { safe: violations.length === 0, violations: [...new Set(violations)] };
}

// Unify context
export function createMaskingContext(opts = {}) {
  const nonce = opts.nonce || crypto.randomBytes(16).toString('hex');
  const sharedMap = Object.create(null);
  const sharedReverse = Object.create(null);
  const counters = Object.create(null);

  const allocate = (type, original) => {
    if (sharedReverse[original]) return sharedReverse[original];
    counters[type] = (counters[type] || 0) + 1;
    const placeholder = `⟦${type}_${nonce}_${counters[type]}⟧`;
    sharedMap[placeholder] = original;
    sharedReverse[original] = placeholder;
    return placeholder;
  };

  const clear = () => {
    for (const key in sharedMap) delete sharedMap[key];
    for (const key in sharedReverse) delete sharedReverse[key];
    for (const key in counters) delete counters[key];
  };

  const unmaskStrengFn = (s) => unmaskStreng(s, sharedMap);
  const unmask = (s, unmaskOpts = {}) => {
    if (typeof s !== 'string' || !s) return s;
    if (opts.strict || unmaskOpts?.strict) {
      return unmaskStreng(s, sharedMap);
    }
    let out = s;
    const placeholders = Object.keys(sharedMap).sort((a, b) => b.length - a.length);
    for (const p of placeholders) {
      out = out.split(p).join(sharedMap[p]);
    }
    return out;
  };

  return { allocate, map: sharedMap, nonce, clear, unmask, unmaskStreng: unmaskStrengFn, entities: opts.entities || [], mandantNamen: opts.mandantNamen || [], dictionary: opts.dictionary || [], preserveAppointments: opts.preserveAppointments !== false };
}

export function maskPII(text, opts = {}) {
  const ctx = opts.ctx || createMaskingContext(opts);
  const { allocate, map, nonce, unmask, unmaskStreng, entities, mandantNamen, dictionary, preserveAppointments } = ctx;
  if (typeof text !== 'string' || !text) {
    return { masked: text || '', map, unmask, unmaskStreng, nonce, befunde: [] };
  }

  const allMandantNamen = [...mandantNamen, ...dictionary];

  const protectedSpans = opts.ignoreProtected ? [] : findProtectedSpans(text);
  for (const key of Object.keys(map)) { let at = text.indexOf(key); while (at >= 0) { protectedSpans.push({ start: at, end: at + key.length, trusted: true }); at = text.indexOf(key, at + key.length); } }
  const rawSpans = findPiiSpans(text, entities, allMandantNamen, preserveAppointments, map);
  const resolvedSpans = resolveSpans(rawSpans, protectedSpans);

  let masked = '';
  let cursor = 0;
  for (const span of resolvedSpans) {
    masked += text.slice(cursor, span.start);
    masked += allocate(span.type, text.slice(span.start, span.end));
    cursor = span.end;
  }
  masked += text.slice(cursor);

  const allNames = [
    ...entities.filter(e => e && e.type === 'NAME').map(e => e.value),
    ...allMandantNamen
  ];
  const befunde = scanneReste(masked, allNames);

  return { masked, map, unmask, unmaskStreng, nonce, befunde };
}

export function maskMessages(messages, opts = {}) {
  const ctx = opts.ctx || createMaskingContext(opts);
  const { allocate, map: sharedMap, nonce, unmask, unmaskStreng, entities, mandantNamen, dictionary, preserveAppointments } = ctx;
  if (!Array.isArray(messages)) {
    return { messages, map: sharedMap, unmask, unmaskStreng, nonce, befunde: [] };
  }

  const allMandantNamen = [...mandantNamen, ...dictionary];

  const maskOneText = (text) => {
    if (typeof text !== 'string' || !text) return text;
    const protectedSpans = findProtectedSpans(text);
    for (const key of Object.keys(sharedMap)) { let at = text.indexOf(key); while (at >= 0) { protectedSpans.push({ start: at, end: at + key.length, trusted: true }); at = text.indexOf(key, at + key.length); } }
    const rawSpans = findPiiSpans(text, entities, allMandantNamen, preserveAppointments, sharedMap);
    const resolvedSpans = resolveSpans(rawSpans, protectedSpans);

    let masked = '';
    let cursor = 0;
    for (const span of resolvedSpans) {
      masked += text.slice(cursor, span.start);
      masked += allocate(span.type, text.slice(span.start, span.end));
      cursor = span.end;
    }
    masked += text.slice(cursor);
    return masked;
  };

  const maskedMessages = messages.map(m => {
    if (!m || typeof m !== 'object') return m;
    if (typeof m.content === 'string') {
      return { ...m, content: maskOneText(m.content) };
    }
    if (Array.isArray(m.content)) {
      return {
        ...m,
        content: m.content.map(part =>
          part && part.type === 'text' && typeof part.text === 'string'
            ? { ...part, text: maskOneText(part.text) }
            : part
        )
      };
    }
    return m;
  });

  const allNames = [
    ...entities.filter(e => e && e.type === 'NAME').map(e => e.value),
    ...allMandantNamen
  ];
  const allMaskedText = maskedMessages
    .map(m => typeof m.content === 'string' ? m.content : '')
    .join('\\n');
  const befunde = scanneReste(allMaskedText, allNames);

  return { messages: maskedMessages, map: sharedMap, unmask, unmaskStreng, nonce, befunde };
}

export function entitiesFromContacts(contacts = []) {
  const out = [];
  for (const c of contacts || []) {
    if (!c || typeof c !== 'object') continue;
    const fullName = c.name || c.contact_name ||
      [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
    if (fullName && fullName.length > 2) out.push({ value: fullName, type: 'NAME' });
    if (c.email) out.push({ value: String(c.email).trim(), type: 'EMAIL' });
    if (c.phone) out.push({ value: String(c.phone).trim(), type: 'PHONE' });
    if (c.geburtsdatum) out.push({ value: String(c.geburtsdatum).trim(), type: 'DOB' });
    if (c.kvnr) out.push({ value: String(c.kvnr).trim(), type: 'KVNR' });
    if (c.company) out.push({ value: String(c.company).trim(), type: 'ORGANIZATION' });
  }
  return out;
}
