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

// Two-letter capitalised words that are far more often ordinary words or weekday
// abbreviations than a name. A patient called "Do" is only masked with an Anrede.
const KURZWORT_KEIN_NAME = new Set([
  'an', 'am', 'im', 'in', 'zu', 'da', 'so', 'ja', 'ob', 'um', 'es', 'er', 'du', 'wo',
  'ab', 'ok', 'je', 'mo', 'di', 'mi', 'do', 'fr', 'sa', 'nr', 'dr', 'hr', 'st', 'kg'
]);

// Capitalised words that follow "Am/Im/Zum …" or "Hausbesuch" without being a street or place.
const KALENDER_WORTE = new Set([
  'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonnabend', 'sonntag',
  'januar', 'februar', 'märz', 'maerz', 'april', 'mai', 'juni', 'juli', 'august', 'september',
  'oktober', 'november', 'dezember', 'vormittag', 'nachmittag', 'mittag', 'abend', 'morgen',
  'wochenende', 'anfang', 'ende', 'termin', 'tag', 'datum', 'rezept', 'herr', 'herrn', 'frau',
  'heute', 'dr', 'prof', 'familie'
]);

/**
 * @typedef {{ value: string, type: string }} PiiEntity
 * @typedef {{ start: number, end: number, type: string, isExplicit?: boolean, isContextual?: boolean }} PiiSpan
 * @typedef {{ start: number, end: number, isProtected?: boolean, trusted?: boolean }} ProtectedSpan
 * @typedef {{ art: string, text: string, ausschnitt: string }} ResteBefund
 * @typedef {{
 *   ctx?: MaskingContext,
 *   nonce?: string,
 *   strict?: boolean,
 *   entities?: PiiEntity[],
 *   mandantNamen?: string[],
 *   dictionary?: string[],
 *   preserveAppointments?: boolean,
 *   strengeDaten?: boolean,
 *   ignoreProtected?: boolean
 * }} MaskOptions
 * @typedef {{
 *   allocate: (type: string, original: string) => string,
 *   map: Record<string, string>,
 *   nonce: string,
 *   clear: () => void,
 *   unmask: (s: string, unmaskOpts?: { strict?: boolean }) => string,
 *   unmaskStreng: (s: string) => string,
 *   entities: PiiEntity[],
 *   mandantNamen: string[],
 *   dictionary: string[],
 *   preserveAppointments: boolean
 * }} MaskingContext
 */

// Invisible characters split a name for a regex but not for a reader or a model:
// "Yil<U+200B>maz" would pass every name rule. Detection therefore runs on a copy without them.
const UNSICHTBAR_RE = /[\u00AD\u034F\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
/**
 * @param {string} text
 * @returns {string}
 */
export function bereinigeUnsichtbares(text) {
  if (typeof text !== 'string' || !text) return text;
  return text.replace(UNSICHTBAR_RE, '');
}

// Detection copy plus a way back: spans found in the copy are cut out of the ORIGINAL text, so an
// invisible character inside a name disappears into the token and unmasking restores the input exactly.
/**
 * @param {string} text
 * @returns {{ sicht: string, zurueck: (span: PiiSpan) => PiiSpan }}
 */
function erkennungsSicht(text) {
  UNSICHTBAR_RE.lastIndex = 0;
  if (!UNSICHTBAR_RE.test(text)) return { sicht: text, zurueck: span => span };
  /** @type {number[]} */
  const pos = [];
  let sicht = '';
  for (let i = 0; i < text.length; i++) {
    UNSICHTBAR_RE.lastIndex = 0;
    if (UNSICHTBAR_RE.test(text[i])) continue;
    pos.push(i);
    sicht += text[i];
  }
  return { sicht, zurueck: span => ({ ...span, start: pos[span.start], end: pos[span.end - 1] + 1 }) };
}

// One pass for both entry points: find spans in the detection copy, replace them in the original.
/**
 * @param {string} text
 * @param {{
 *   allocate: (type: string, original: string) => string,
 *   map: Record<string, string>,
 *   entities: PiiEntity[],
 *   namen: string[],
 *   preserveAppointments: boolean,
 *   strengeDaten: boolean,
 *   ignoreProtected: boolean
 * }} opts
 * @returns {string}
 */
function maskiereText(text, { allocate, map, entities, namen, preserveAppointments, strengeDaten, ignoreProtected }) {
  const { sicht, zurueck } = erkennungsSicht(text);
  const protectedSpans = ignoreProtected ? [] : findProtectedSpans(sicht);
  for (const key of Object.keys(map)) { let at = sicht.indexOf(key); while (at >= 0) { protectedSpans.push({ start: at, end: at + key.length, trusted: true }); at = sicht.indexOf(key, at + key.length); } }
  const rawSpans = findPiiSpans(sicht, entities, namen, preserveAppointments, map, strengeDaten);
  let masked = '';
  let cursor = 0;
  for (const span of resolveSpans(rawSpans, protectedSpans).map(zurueck)) {
    masked += text.slice(cursor, span.start);
    masked += allocate(span.type, text.slice(span.start, span.end));
    cursor = span.end;
  }
  return masked + text.slice(cursor);
}

// A full calendar date strictly before today. Today and later always stay readable (appointments).
// Ten or more years back: always hidden (DOB). Younger than that it may be the birth date of a child
// or an ordinary past appointment — the corpus gate (m4-corpus.test.js) requires past appointments to
// stay readable, so it is hidden only where the words before it speak of a child or a birth
// (kontext = true). Structured prompt pass and answer scan never pass kontext.
const GEBURTS_KONTEXT_RE = /(?:\b(?:Kind|Kindes|Säugling|Baby|Frühchen|Junge|Mädchen|Sohn|Tochter|Enkel|Enkelin|Zwilling|Geburt|Geburtstag|geboren|geb|Alter|Jahre\s+alt|Monate\s+alt|Wochen\s+alt)\b|jährige[rns]?\b)[^.!?\n]{0,40}$/iu;
/**
 * @param {number} tag
 * @param {number} monat
 * @param {number} jahr
 * @param {number} currentYear
 * @param {boolean} kontext
 * @returns {'DOB' | 'DATE' | null}
 */
function vergangenesDatum(tag, monat, jahr, currentYear, kontext) {
  let y = jahr;
  if (y < 100) y = (2000 + y <= currentYear + 5) ? 2000 + y : 1900 + y;
  if (y < 1900 || y > 2100 || monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  const heute = new Date();
  const d = new Date(y, monat - 1, tag);
  const start = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate());
  if (d >= start) return null;
  if (y <= currentYear - 10) return 'DOB';
  return kontext ? 'DATE' : null;
}

const MONATE = '(?:Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)';

// Umlaut transliteration (ä↔ae, ö↔oe, ü↔ue, ß↔ss)
/**
 * @param {string} str
 * @returns {string[]}
 */
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
/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
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

/**
 * @param {unknown} s
 * @returns {string}
 */
function maskSnippet(s) {
  const str = String(s || '').trim();
  if (str.length <= 4) return '*'.repeat(str.length);
  return str.slice(0, 2) + '*'.repeat(Math.min(str.length - 3, 6)) + str.slice(-1);
}

// Generate variants for known names (full name, parts >= 3 chars, genitive)
/**
 * @param {ReadonlyArray<unknown>} namesList
 * @returns {string[]}
 */
function buildNameVariants(namesList) {
  const variants = [];
  for (const rawName of namesList) {
    if (!rawName || typeof rawName !== 'string') continue;
    const clean = bereinigeUnsichtbares(rawName).trim();
    if (clean.length < 2) continue;
    // The same name may be stored composed and typed decomposed ("Zoë"), or the other way round.
    const formen = new Set([clean, clean.normalize('NFC'), clean.normalize('NFD')]);

    const parts = clean.split(/[\s\-_/.,;:!?()]+/)
      .map(p => p.trim())
      .filter(p => p.length >= 3 && !NAME_STOP_WORDS.has(p.toLowerCase()));

    for (const cand of [...formen, ...parts, ...parts.map(p => p.normalize('NFC')), ...parts.map(p => p.normalize('NFD'))]) {
      for (const uVar of getUmlautVariants(cand)) {
        variants.push(uVar);
        if (uVar.length >= 3 && !uVar.endsWith('s') && !uVar.endsWith('ß')) variants.push(uVar + 's');
      }
    }
  }
  // Two-letter entries survive only as a whole dictionary entry ("Li", "Wu"); see the case-sensitive rule in findPiiSpans.
  return Array.from(new Set(variants)).filter(v => v.length >= 2).sort((a, b) => b.length - a.length);
}

// Protected clinical terms that must never be masked
/**
 * @param {string} text
 * @returns {ProtectedSpan[]}
 */
function findProtectedSpans(text) {
  /** @type {ProtectedSpan[]} */
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
/**
 * @param {string} text
 * @param {PiiEntity[]} [entities=[]]
 * @param {string[]} [mandantNamen=[]]
 * @param {boolean} [preserveAppointments=true]
 * @param {Record<string, string> | null} [map=null]
 * @param {boolean} [strengeDaten=false]
 * @returns {PiiSpan[]}
 */
function findPiiSpans(text, entities = [], mandantNamen = [], preserveAppointments = true, map = null, strengeDaten = false) {
  /** @type {PiiSpan[]} */
  const spans = [];
  const currentYear = new Date().getFullYear();

  /**
   * @param {RegExp} re
   * @param {string | null} type
   * @param {((m: RegExpExecArray) => PiiSpan | null) | null} [fn=null]
   */
  const add = (re, type, fn = null) => {
    let m;
    while ((m = re.exec(text)) !== null) {
      const res = fn ? fn(m) : { start: m.index, end: m.index + m[0].length, type: /** @type {string} */ (type) };
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
  add(/(?:\+\d{1,3}|\b00\d{2,3}|\(0\d{2,5}\)|\b0\d{2,5})[\s/()-]*\d[\s/()-]*\d[\s/()-]*\d[\s/()-]*\d(?:[\s/()-]*\d)*/g, 'PHONE', (m) => {
    return m[0].replace(/\D/g, '').length >= 7 ? { start: m.index, end: m.index + m[0].length, type: 'PHONE' } : null;
  });

  // 5b. Labelled numbers without a leading 0 ("Handy: 171 234 56 78")
  add(/\b(?:Handy|Mobil|Mobilnummer|Tel\.?|Telefon|Telefonnummer|Fon|Fax|Rückruf|Rückrufnummer)\s*(?:nummer|nr\.?)?\s*:?\s*(\d[\d\s/()-]{5,}\d)/gi, null, (m) => {
    if (m[1].replace(/\D/g, '').length < 7) return null;
    const idx = m.index + m[0].lastIndexOf(m[1]);
    return { start: idx, end: idx + m[1].length, type: 'PHONE' };
  });

  // 5c. Grouped digit runs (insurance / customer / phone numbers written with separators).
  // The residual scanner only sees 7+ contiguous digits, so "123 456 789" needs its own rule.
  add(/\b\d{2,}(?:[ /-]\d{2,}){2,}\b/g, null, (m) => {
    if (m[0].replace(/\D/g, '').length < 8) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(m[0]) || /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(m[0])) return null; // dates: rule 9
    return { start: m.index, end: m.index + m[0].length, type: 'NUMBER' };
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
  add(/\b(Pflegeheim|Altenzentrum|Seniorenresidenz|Seniorenheim|Wohnstift|Caritas-Haus|Caritas|Pflegedienst|Klinik|Klinikum|Krankenhaus|Gemeinschaftspraxis|Arztpraxis|MVZ|Kita|Kindergarten|Grundschule|Realschule|Gymnasium|Schule|Firma|Taxi)\s+(?:(?:am|an|der|die|das|im|in|zum|zur|St\.|Sankt)\s+)?(?:[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9\-\.]*(?:\s+(?:am|an|der|die|das|im|in|zum|zur|St\.|Sankt)\b|\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9\-\.]*)*)\b/gu, 'ORGANIZATION');

  // 7b. Employer ("arbeitet bei Zurich Versicherung")
  add(/\b(?:arbeitet|beschäftigt|angestellt|tätig)\s+(?:bei(?:\s+der|\s+dem)?|beim|in\s+der|im)\s+([A-ZÄÖÜ][\p{L}0-9&-]*(?:\s+[A-ZÄÖÜ][\p{L}0-9&-]*){0,2})/gu, null, (m) => {
    const idx = m.index + m[0].lastIndexOf(m[1]);
    return { start: idx, end: idx + m[1].length, type: 'ORGANIZATION' };
  });

  // 8. Addresses: Street + Number
  add(/\b(?:(?:(?:[A-ZÄÖÜ][a-zäöüß]+-)*[A-ZÄÖÜ][a-zäöüß]+(?:str\.?|straße|strasse|weg|allee|platz|ring|gasse|damm|kamp|chaussee|ufer)|(?:[A-ZÄÖÜ][a-zäöüß]+-)*[A-ZÄÖÜ][a-zäöüß]+[\s-]+(?:Str\.?|Straße|Strasse|Weg|Allee|Platz|Ring|Gasse)|Markt)\s+\d{1,4}(?:\s?[a-zA-Z]\b)?(?:[-/]\d{1,4}(?:\s?[a-zA-Z]\b)?)?)(?:,?\s*\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)?\b/gu, 'ADDRESS');
  add(/\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?\b/gu, 'ADDRESS');

  // 8b. Streets named with a preposition ("Am Turm 4b", "Zur Mühle 12"). The house number must end
  // the phrase, so "Am Montag 3 Termine" or "Im Rezept 6 KG" are not addresses.
  add(/\b(?:Am|An\s+der|Im|In\s+der|Zum|Zur|Auf\s+dem|Auf\s+der|Unter\s+den)\s+([A-ZÄÖÜ][a-zäöüß]+)(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?\s+\d{1,4}\s?[a-zA-Z]?(?=\s*(?:$|[,;!?)\n]|\.(?!\d)|\d{5}\b|in\s|bei\s|Klingel\b))/gu, null, (m) => {
    if (KALENDER_WORTE.has(m[1].toLowerCase())) return null;
    return { start: m.index, end: m.index + m[0].length, type: 'ADDRESS' };
  });

  // 9. DOB (Date of birth) — only if explicitly labeled, or year is well in the past (>= 10 yrs ago)
  // NEVER mask current/future dates or times when preserving appointments!
  add(/\b(?:Jg\.|Jahrgang)\s*\d{2,4}\b/gi, 'DOB');
  // Labelled birth date in any notation, also "geb. am …" and "*12.03.1959".
  add(new RegExp(`(?<=(?:\\b(?:geb\\.?|geboren|Geburtsdatum|Geburtstag)\\s*:?\\s*(?:am\\s+)?|\\*\\s?))(\\d{1,2}[./-]\\d{1,2}[./-](?:\\d{4}|\\d{2})|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\.\\s*${MONATE}\\s+\\d{2,4})(?!\\d)`, 'gi'), 'DOB');

  {
    // Unlabelled full dates: everything before today is hidden, today and later stay (appointments).
    add(new RegExp(`\\b(\\d{1,2})\\.\\s*(${MONATE})\\s+(\\d{4}|\\d{2})\\b`, 'gui'), null, (m) => {
      const namen = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
      const monat = namen.indexOf(m[2].toLowerCase().replace('maerz', 'märz')) + 1;
      const type = vergangenesDatum(parseInt(m[1], 10), monat, parseInt(m[3], 10), currentYear, strengeDaten && GEBURTS_KONTEXT_RE.test(text.slice(Math.max(0, m.index - 60), m.index)));
      return type ? { start: m.index, end: m.index + m[0].length, type } : null;
    });

    // 12.03.1959 · 12.03.59 · 12/03/1959 · 12-03-1959 (two-digit year only with dots)
    add(/\b(0?[1-9]|[12]\d|3[01])([./-])(0?[1-9]|1[0-2])\2(\d{4}|\d{2})\b(?!\.\d)/g, null, (m) => {
      if (m[4].length === 2 && m[2] !== '.') return null;
      const type = vergangenesDatum(parseInt(m[1], 10), parseInt(m[3], 10), parseInt(m[4], 10), currentYear, strengeDaten && GEBURTS_KONTEXT_RE.test(text.slice(Math.max(0, m.index - 60), m.index)));
      return type ? { start: m.index, end: m.index + m[0].length, type } : null;
    });

    // 1959-03-12
    add(/\b(19\d\d|20\d\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g, null, (m) => {
      const type = vergangenesDatum(parseInt(m[3], 10), parseInt(m[2], 10), parseInt(m[1], 10), currentYear, strengeDaten && GEBURTS_KONTEXT_RE.test(text.slice(Math.max(0, m.index - 60), m.index)));
      return type ? { start: m.index, end: m.index + m[0].length, type } : null;
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
    // Two-letter names ("Li", "Wu") match only in their exact capitalisation and never as an ordinary short word.
    const isShort = variant.length === 2;
    if (isShort && (!/^[A-ZÄÖÜ][a-zäöüß]$/.test(variant) || KURZWORT_KEIN_NAME.has(variant.toLowerCase()))) continue;
    const varRe = new RegExp(`(?<=^|[^\\p{L}\\p{N}])${escaped}(?=[^\\p{L}\\p{N}]|$)`, isShort ? 'gu' : 'gui');
    add(varRe, null, (m) => {
      if (isCommon) {
        const isUpper = /^[A-ZÄÖÜ]/.test(m[0]);
        const prefix = text.slice(Math.max(0, m.index - 20), m.index);
        const hasAnrede = /\b(?:herr|herrn|frau|fräulein|dr|med|prof|dres)\b[.\s]*$/i.test(prefix);
        // Sloppy typing: "koch hat abgesagt." — a lower-case common-word surname opening a sentence is a name.
        const satzAnfang = /(?:^|[.!?\n])\s*$/.test(text.slice(0, m.index));
        return (isUpper || hasAnrede || satzAnfang) ? { start: m.index, end: m.index + m[0].length, type: 'NAME', isExplicit: true } : null;
      }
      return { start: m.index, end: m.index + m[0].length, type: 'NAME', isExplicit: true };
    });
  }

  // 11. Contextual names: Anrede / Titel + Name
  add(/\b(Herr|Herrn|Frau|Fräulein|Hr\.|Fr\.|Dr\.? med\.?|Dr\.?|Prof\.? Dr\.?|Prof\.?|Dres\.?|Schwester)\s+(\p{Lu}[\p{Ll}\p{M}]+(?:-\p{Lu}[\p{Ll}\p{M}]+)?(?:\s+\p{Lu}[\p{Ll}\p{M}]+(?:-\p{Lu}[\p{Ll}\p{M}]+)?)*(?:\s*(?:&|und)\s*(?:\p{Lu}[\p{Ll}\p{M}]+(?:\s+(?:Partner|Kollegen)\b)?|Partner\b|Kollegen\b))?)/gu, 'NAME', (m) => {
    const nameStart = m.index + m[0].indexOf(m[2]);
    return { start: nameStart, end: m.index + m[0].length, type: 'NAME', isContextual: true };
  });

  // Verwandtschaft / Rolle + Name
  add(/\b(?:Tochter|Sohn|Ehemann|Ehefrau|Gatte|Gattin|Mutter|Vater|Bruder|Tante|Onkel|Cousine|Cousin|Schwager|Schwägerin|Nichte|Neffe|Großmutter|Großvater|Oma|Opa|Enkel|Enkelin|Lebensgefährte|Lebensgefährtin|Nachbar|Nachbarin|Pfleger|Pflegerin|Pflegekraft|Schwiegersohn|Schwiegertochter|Betreuer|Betreuerin|Therapeut|Therapeutin|Behandler|Behandlerin|Kollege|Kollegin|Fahrer|Fahrerin|Hausarzt|Hausärztin|Facharzt|Fachärztin|Patient|Patientin|Bewohner|Bewohnerin)\s+(?:(?:Herr|Herrn|Frau|Dr\.|Dr\. med\.)\s+)?(\p{Lu}[\p{Ll}\p{M}]+(?:\s+\p{Lu}[\p{Ll}\p{M}]+)?)\b/gu, null, (m) => {
    const namePart = m[1];
    const idx = m.index + m[0].lastIndexOf(namePart);
    return { start: idx, end: idx + namePart.length, type: 'NAME', isContextual: true };
  });

  // Klingel / c/o + Name
  add(/(?:\bKlingel|\bc\/o|\bz\.\s?Hd\.)\s+(\p{Lu}[\p{Ll}\p{M}]+(?:\s+\p{Lu}[\p{Ll}\p{M}]+)?)/gu, null, (m) => {
    const idx = m.index + m[0].lastIndexOf(m[1]);
    return { start: idx, end: idx + m[1].length, type: 'NAME', isContextual: true };
  });

  // Hausbesuch + place ("Hausbesuch Siegburg Kaldauen")
  add(/\bHausbesuch(?:\s+in)?\s+([A-ZÄÖÜ][\p{L}]+(?:-[A-ZÄÖÜ][\p{L}]+)*)(\s+[A-ZÄÖÜ][\p{L}]+)?/gu, null, (m) => {
    if (KALENDER_WORTE.has(m[1].toLowerCase())) return null;
    const second = m[2] && !KALENDER_WORTE.has(m[2].trim().toLowerCase()) ? m[2] : '';
    const idx = m.index + m[0].indexOf(m[1]);
    return { start: idx, end: idx + m[1].length + second.length, type: 'LOCATION' };
  });

  // Familie + Name
  add(/\bFamilie\s+(\p{Lu}[\p{Ll}\p{M}]+)\b/gu, null, (m) => {
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
    if (/^(?:aus|in)\s/.test(m[0]) && !/(?:\bDr\.|\b(?:Herr|Herrn|Frau|Hausarzt|Hausärztin|Facharzt|Fachärztin|Patient|Patientin|Bewohner|Bewohnerin|Ehefrau|Ehemann|wohnt|Wohnung|Hausbesuch|Adresse|Anschrift)\b|(?:[Ss]tr\.?|[Ss]tra(?:ß|ss)e|weg|platz|allee|gasse|ring)\s+\d)/.test(prefix)) return null;
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

/**
 * @param {PiiSpan[]} spans
 * @param {ProtectedSpan[]} protectedSpans
 * @returns {PiiSpan[]}
 */
function resolveSpans(spans, protectedSpans) {
  // Explicit local identity wins over clinical heuristics; trusted generated tokens remain opaque.
  /** @param {number} s @param {number} e */
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
    } else if (span.end > lastEnd) {
      // A longer finding that starts inside an earlier one keeps its tail:
      // "Gemeinschaftspraxis Dres. Meurer" must not leave "& Schultze" readable.
      resolved.push({ ...span, start: lastEnd });
      lastEnd = span.end;
    }
  }
  return resolved;
}

/**
 * Residual scanner (scanneReste) according to v2 rules.
 * Scans masked text for unmasked sensitive fragments.
 * @param {string} maskedText
 * @param {string[]} [mandantNamen=[]]
 * @returns {ResteBefund[]}
 */
export function scanneReste(maskedText, mandantNamen = []) {
  if (!maskedText || typeof maskedText !== 'string') return [];
  maskedText = bereinigeUnsichtbares(maskedText); // "1234<U+200B>5678" is still an eight-digit run
  /** @type {ResteBefund[]} */
  const befunde = [];
  const clean = maskedText.replace(/⟦[A-Za-z0-9_]+⟧|<<[A-Za-z0-9_]+>>/g, ' ');

  const anredeRestRe = /\b(?:Herr|Herrn|Frau|Fräulein|Dr\.?|Dr\.? med\.?|Prof\.?|Dres\.?)\s+([A-ZÄÖÜ][a-zäöüß]+)/gu;
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

/**
 * @param {string} text
 * @param {Map<string, string> | Record<string, string>} knownMap
 * @returns {string}
 */
export function unmaskStreng(text, knownMap) {
  if (typeof text !== 'string' || !text) return text;
  const isMap = knownMap instanceof Map;
  /** @param {string} k */
  const has = (k) => isMap ? knownMap.has(k) : Object.prototype.hasOwnProperty.call(knownMap, k);
  /** @param {string} k */
  const get = (k) => /** @type {string} */ (isMap ? knownMap.get(k) : knownMap[k]);

  const matches = text.match(/⟦[A-Za-z0-9_]+⟧|<<[A-Za-z0-9_]+>>/g) || [];
  for (const m of matches) {
    if (!has(m)) {
      /** @type {Error & { code?: string, status?: number }} */
      const err = new Error(`Unbekannter oder ungültiger Platzhalter in Modellantwort entdeckt: ${m}`);
      err.code = 'KI_UNBEKANNTER_PLATZHALTER';
      err.status = 502;
      throw err;
    }
  }

  return text.replace(/⟦[A-Za-z0-9_]+⟧|<<[A-Za-z0-9_]+>>/g, (m) => has(m) ? get(m) : m);
}

/**
 * @template T
 * @param {T} val
 * @param {(s: string) => string} unmaskFn
 * @returns {T}
 */
export function unmaskValues(val, unmaskFn) {
  if (typeof val === 'string') {
    return /** @type {T} */ (/** @type {unknown} */ (unmaskFn(val)));
  }
  if (Array.isArray(val)) {
    return /** @type {T} */ (/** @type {unknown} */ (val.map(item => unmaskValues(item, unmaskFn))));
  }
  if (val !== null && typeof val === 'object') {
    const out = Object.create(null);
    const obj = /** @type {Record<string, unknown>} */ (val);
    for (const k of Object.keys(obj)) {
      out[k] = unmaskValues(obj[k], unmaskFn);
    }
    return out;
  }
  return val;
}

/**
 * @param {string} text
 * @param {Map<string, string> | Record<string, string>} [knownMap=new Map()]
 * @param {{ dictionary?: string[] }} [opts={}]
 * @returns {{ safe: boolean, violations: string[] }}
 */
export function scanOutputPII(text, knownMap = new Map(), { dictionary = [] } = {}) {
  /** @type {string[]} */
  const violations = [];
  if (typeof text !== 'string') return { safe: true, violations };
  const entries = knownMap instanceof Map ? [...knownMap.entries()] : Object.entries(knownMap);
  /** @param {string} key */
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
/**
 * @param {MaskOptions} [opts={}]
 * @returns {MaskingContext}
 */
export function createMaskingContext(opts = {}) {
  const nonce = opts.nonce || crypto.randomBytes(16).toString('hex');
  /** @type {Record<string, string>} */
  const sharedMap = Object.create(null);
  /** @type {Record<string, string>} */
  const sharedReverse = Object.create(null);
  /** @type {Record<string, number>} */
  const counters = Object.create(null);

  /**
   * @param {string} type
   * @param {string} original
   * @returns {string}
   */
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

  /** @param {string} s */
  const unmaskStrengFn = (s) => unmaskStreng(s, sharedMap);
  /**
   * @param {string} s
   * @param {{ strict?: boolean }} [unmaskOpts={}]
   * @returns {string}
   */
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

/**
 * @param {string} text
 * @param {MaskOptions} [opts={}]
 */
export function maskPII(text, opts = {}) {
  const ctx = opts.ctx || createMaskingContext(opts);
  const { allocate, map, nonce, unmask, unmaskStreng, entities, mandantNamen, dictionary, preserveAppointments } = ctx;
  if (typeof text !== 'string' || !text) {
    return { masked: text || '', map, unmask, unmaskStreng, nonce, befunde: /** @type {ResteBefund[]} */ ([]) };
  }

  const allMandantNamen = [...mandantNamen, ...dictionary];
  const masked = maskiereText(text, { allocate, map, entities, namen: allMandantNamen, preserveAppointments, strengeDaten: opts.strengeDaten !== false, ignoreProtected: !!opts.ignoreProtected });

  const allNames = [
    ...entities.filter(e => e && e.type === 'NAME').map(e => e.value),
    ...allMandantNamen
  ];
  const befunde = scanneReste(masked, allNames);

  return { masked, map, unmask, unmaskStreng, nonce, befunde };
}

/**
 * @template {Array<{ role?: string, content?: unknown }>} T
 * @param {T} messages
 * @param {MaskOptions} [opts={}]
 */
export function maskMessages(messages, opts = {}) {
  const ctx = opts.ctx || createMaskingContext(opts);
  const { allocate, map: sharedMap, nonce, unmask, unmaskStreng, entities, mandantNamen, dictionary, preserveAppointments } = ctx;
  if (!Array.isArray(messages)) {
    return { messages, map: sharedMap, unmask, unmaskStreng, nonce, befunde: /** @type {ResteBefund[]} */ ([]) };
  }

  const allMandantNamen = [...mandantNamen, ...dictionary];

  /** @param {string} text */
  const maskOneText = (text) => {
    if (typeof text !== 'string' || !text) return text;
    // Structured prompt pass: recent past dates stay (see vergangenesDatum).
    return maskiereText(text, { allocate, map: sharedMap, entities, namen: allMandantNamen, preserveAppointments, strengeDaten: false, ignoreProtected: false });
  };

  const maskedMessages = /** @type {T} */ (messages.map(m => {
    if (!m || typeof m !== 'object') return m;
    if (typeof m.content === 'string') {
      return { ...m, content: maskOneText(m.content) };
    }
    if (Array.isArray(m.content)) {
      return {
        ...m,
        content: m.content.map((/** @type {{ type?: string, text?: unknown }} */ part) =>
          part && part.type === 'text' && typeof part.text === 'string'
            ? { ...part, text: maskOneText(part.text) }
            : part
        )
      };
    }
    return m;
  }));

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

/**
 * @param {Array<{
 *   name?: string,
 *   contact_name?: string,
 *   first_name?: string,
 *   last_name?: string,
 *   email?: string,
 *   phone?: string,
 *   geburtsdatum?: string,
 *   kvnr?: string,
 *   company?: string
 * }>} [contacts=[]]
 * @returns {PiiEntity[]}
 */
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
