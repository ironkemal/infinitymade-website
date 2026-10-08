/**
 * PII-Maskierer v2 (Deterministisch, Node >= 18, ohne externe Abhängigkeiten)
 * 
 * DSGVO Art. 32 + DSFA R3 Konformität:
 * - Pseudonymisierung mit Nonce pro Aufruf (z.B. ⟦NAME_ab12_1⟧)
 * - Anti-Injection: Frühe Neutralisierung von <<...>> und ⟦...⟧
 * - Kontext- und Mustererkennung: Namen, DOB, Adressen, IDs, Telefone, Einrichtungen
 * - Schutz klinischer Fachbegriffe (Wagner-Stadien, Diagnosen, Medikamente)
 * - Restscanner (befunde) zur Fail-Closed Absicherung vor KI-Aufrufen
 */

import crypto from 'node:crypto';

// Stoppwörter, die nicht isoliert als Namensteil matchen dürfen
const NAME_STOP_WORDS = new Set([
  'herr', 'herrn', 'frau', 'fräulein', 'hr', 'fr', 'dr', 'med', 'prof', 'dres',
  'doktor', 'schwester', 'von', 'und', 'der', 'die', 'das', 'den', 'dem', 'des',
  'am', 'im', 'in', 'an', 'zu', 'zum', 'zur'
]);

// Nachnamen, die zugleich alltägliche deutsche Wörter sind
const COMMON_WORD_SURNAMES = new Set([
  'koch', 'fuchs', 'weber', 'klein', 'bach', 'wagner', 'bauer', 'sommer',
  'vogel', 'berg', 'kraft', 'könig', 'koenig', 'engel', 'sauer', 'franke',
  'mai', 'wolf', 'braun', 'schwarz', 'weiß', 'weiss', 'groß', 'gross',
  'lang', 'jung', 'busch', 'stein', 'schneider', 'richter', 'schulz'
]);

const MONATE = '(?:Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)';

// Umlaut-Transliteration für Namen (ä↔ae, ö↔oe, ü↔ue, ß↔ss)
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

// Levenshtein-Distanz (für Längen >= 5 und Distanz <= 1)
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

// Befund-Ausschnitt kürzen und maskieren
function maskSnippet(s) {
  const str = String(s || '').trim();
  if (str.length <= 4) return '*'.repeat(str.length);
  return str.slice(0, 2) + '*'.repeat(Math.min(str.length - 3, 6)) + str.slice(-1);
}

// Variantenbildung für bekannte Namen (Vollname, Teile ≥3 Zeichen, Genitiv)
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

// Klinische Fachbegriffe schützen (dürfen keinesfalls maskiert werden)
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
    /\b(?:AOK(?:\s+Rheinland(?:\/Hamburg)?)?|Barmer|Techniker(?:\s+Krankenkasse)?)\b/gi
  ];

  for (const re of protectedPatterns) {
    let m;
    while ((m = re.exec(text)) !== null) spans.push({ start: m.index, end: m.index + m[0].length, isProtected: true });
  }
  return spans;
}

// PII-Fundstellen im Text sammeln
function findPiiSpans(text, entities = [], mandantNamen = []) {
  const spans = [];
  const currentYear = new Date().getFullYear();

  const add = (re, type, fn = null) => {
    let m;
    while ((m = re.exec(text)) !== null) {
      const res = fn ? fn(m) : { start: m.index, end: m.index + m[0].length, type };
      if (res) spans.push(res);
    }
  };

  // 1. Anti-Injection: Bestehende Platzhalter wie <<...>> oder ⟦...⟧ vorab neutralisieren
  add(/(?:<<[^>\r\n]+>>|⟦[^⟧\r\n]+⟧)/g, 'INJECTION');

  // 2. KVNR (1 Buchstabe + 9 Ziffern, case-insensitive)
  add(/\b[A-Za-z]\d{9}\b/g, 'KVNR');

  // 3. IBAN
  add(/\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]){11,30}\b/g, 'IBAN');

  // 4. E-Mail
  add(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, 'EMAIL');

  // 5. Telefonnummern (DE-Formate mit +49, 0049, Vorwahlen, Klammern, Schrägstrich; ≥7 Ziffern)
  add(/(?:\+49|0049|\(0\d{2,5}\)|\b0\d{2,5})[\s/()-]*\d[\s/()-]*\d[\s/()-]*\d[\s/()-]*\d(?:[\s/()-]*\d)*/g, 'PHONE', (m) => {
    return m[0].replace(/\D/g, '').length >= 7 ? { start: m.index, end: m.index + m[0].length, type: 'PHONE' } : null;
  });

  // 6. LANR / BSNR / IK (9-stellig, gelabelt oder freistehend)
  add(/\b(?:LANR|BSNR|Betriebsstätte|Betriebsstättennummer|Arztnummer|IK(?:\s+der\s+Kasse)?)(?:\s*:?|\s+)\s*(\d{9})\b/gi, null, (m) => {
    const digits = m[1], idx = m.index + m[0].lastIndexOf(digits), up = m[0].toUpperCase();
    const type = (up.includes('BSNR') || up.includes('BETRIEB')) ? 'BSNR' : (up.includes('IK') ? 'IK' : 'LANR');
    return { start: idx, end: idx + digits.length, type };
  });

  // 7. Einrichtungen / Organisationen
  add(/\b(Pflegeheim|Altenzentrum|Seniorenresidenz|Seniorenheim|Wohnstift|Caritas-Haus|Caritas|Pflegedienst|Klinik|Klinikum|Taxi)\s+(?:(?:am|an|der|die|das|im|in|zum|zur|St\.|Sankt)\s+)?(?:[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9\-\.]*(?:\s+(?:am|an|der|die|das|im|in|zum|zur|St\.|Sankt)\b|\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9\-\.]*)*)\b/gu, 'ORGANIZATION');

  // 8. Adressen: Straßenname mit Endung/Markt + Hausnummer; optional PLZ + Ort
  add(/\b(?:(?:[A-ZÄÖÜ][a-zäöüß]+(?:str\.|straße|strasse|weg|allee|platz|ring|gasse|damm|kamp|chaussee|ufer)|[A-ZÄÖÜ][a-zäöüß]+\s+(?:Str\.|Straße|Strasse|Weg|Allee|Platz|Ring|Gasse)|Markt)\s+\d{1,4}\s*[a-zA-Z]?(?:[-/]\d{1,4}\s*[a-zA-Z]?)?)(?:,?\s*\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)?\b/gu, 'ADDRESS');
  add(/\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?\b/gu, 'ADDRESS');

  // Städteangaben im Kontext von Ärzten / Praxen ("aus Hennef", "Dr. Kroll Troisdorf", etc.)
  add(/(?:(?:\b(?:Dr\.|Dr\. med\.|Herr|Frau)\s+[A-ZÄÖÜ][a-zäöüß]+|\bPraxis(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\s+(?:aus\s+)?([A-ZÄÖÜ][a-zäöüß]+)\b(?=\s*(?:verordnet|informiert|angerufen|überwiesen|veranlasst|empfiehlt|[.,;])))/gu, null, (m) => {
    const city = m[1], idx = m.index + m[0].lastIndexOf(city);
    return { start: idx, end: idx + city.length, type: 'ADDRESS' };
  });

  // 9. Datumsangaben & Geburtsdatum (DOB)
  add(/\bJg\.\s*\d{2,4}\b/gi, 'DOB');
  add(/(?<=\b(?:geb\.|geboren|Geburtsdatum)(?:\s*:?|\s+))(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2})/gi, 'DOB');

  add(new RegExp(`\\b\\d{1,2}\\.\\s*${MONATE}\\s+(\\d{2,4})\\b`, 'gui'), null, (m) => {
    const rawY = parseInt(m[1], 10), yr = rawY < 100 ? (rawY > 30 ? 1900 + rawY : 2000 + rawY) : rawY;
    return { start: m.index, end: m.index + m[0].length, type: (yr <= currentYear - 10) ? 'DOB' : 'DATUM' };
  });

  add(/\b(0?[1-9]|[12]\d|3[01])\.(0?[1-9]|1[0-2])\.(?:(19\d\d|20\d\d|\d{2}))?\b/g, null, (m) => {
    let type = 'DATUM';
    if (m[3]) {
      const rawY = parseInt(m[3], 10), yr = rawY < 100 ? (rawY > 30 ? 1900 + rawY : 2000 + rawY) : rawY;
      if (yr <= currentYear - 10) type = 'DOB';
    }
    return { start: m.index, end: m.index + m[0].length, type };
  });

  // 10. Bekannte Namen aus entities + mandantNamen
  const allNames = [...entities.filter(e => e && e.type === 'NAME').map(e => e.value), ...mandantNamen];
  for (const variant of buildNameVariants(allNames)) {
    const isCommon = COMMON_WORD_SURNAMES.has(variant.toLowerCase());
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const varRe = new RegExp(`(?<=^|[^\\p{L}\\p{N}])${escaped}(?=[^\\p{L}\\p{N}]|$)`, 'gui');
    add(varRe, null, (m) => {
      if (isCommon) {
        const isUpper = /^[A-ZÄÖÜ]/.test(m[0]);
        const prefix = text.slice(Math.max(0, m.index - 20), m.index);
        const hasAnrede = /\b(?:herr|herrn|frau|fräulein|dr|med|prof|dres)\b[.\s]*$/i.test(prefix);
        return (isUpper || hasAnrede) ? { start: m.index, end: m.index + m[0].length, type: 'NAME' } : null;
      }
      return { start: m.index, end: m.index + m[0].length, type: 'NAME' };
    });
  }

  // 11. Unbekannte Namen per Kontext
  // A) Anrede/Titel + Name(n), inkl. & Partner / Kollegen
  add(/\b(Herr|Herrn|Frau|Fräulein|Hr\.|Fr\.|Dr\. med\.|Dr\.|Prof\. Dr\.|Prof\.|Dres\.|Schwester)\s+([A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?(?:\s+[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?)*(?:\s*(?:&|und)\s*(?:[A-ZÄÖÜ][a-zäöüß]+(?:\s+(?:Partner|Kollegen)\b)?|Partner\b|Kollegen\b))?)/gu, 'NAME');

  // B) Verwandtschafts- & Rollenkontext: Tochter, Sohn, Ehefrau, Nachbar, etc.
  add(/\b(?:Tochter|Sohn|Ehemann|Ehefrau|Gatte|Gattin|Mutter|Vater|Bruder|Nachbar|Nachbarin|Pfleger|Pflegerin|Pflegekraft|Schwiegersohn|Schwiegertochter|Betreuer|Betreuerin|Therapeut|Therapeutin|Behandler|Behandlerin|Kollege|Kollegin|Fahrer|Fahrerin|Patient|Patientin|Bewohner|Bewohnerin)\s+(?:(?:Herr|Herrn|Frau|Dr\.|Dr\. med\.)\s+)?([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\b/gu, null, (m) => {
    const namePart = m[1], idx = m.index + m[0].lastIndexOf(namePart);
    return { start: idx, end: idx + namePart.length, type: 'NAME' };
  });

  // C) Familie + Name
  add(/\bFamilie\s+([A-ZÄÖÜ][a-zäöüß]+)\b/gu, null, (m) => {
    const fName = m[1], idx = m.index + m[0].lastIndexOf(fName);
    return { start: idx, end: idx + fName.length, type: 'NAME' };
  });

  // D) Genitiv-Name ohne Artikel vor Substantiv (z.B. "Müllers Nagelkorrekturspange")
  add(/(?<=^|[.!?]\s+|[;:,]\s+)([A-ZÄÖÜ][a-zäöüß]+)s\s+([A-ZÄÖÜ][a-zäöüß]+)/gu, null, (m) => {
    const genName = m[1] + 's';
    return { start: m.index, end: m.index + genName.length, type: 'NAME' };
  });

  // E) Sonstige explizite Entitäten
  for (const ent of entities) {
    if (!ent || !ent.value || ent.type === 'NAME') continue;
    const vStr = String(ent.value).trim();
    if (vStr.length < 2) continue;
    add(new RegExp(vStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ent.type.toUpperCase());
  }

  return spans;
}

// Überlappungsauflösung: geschützte Spans priorisieren, sonst längste Spans
function resolveSpans(spans, protectedSpans) {
  const isProtected = (s, e) => protectedSpans.some(p => Math.max(s, p.start) < Math.min(e, p.end));
  const valid = spans.filter(s => !isProtected(s.start, s.end));
  valid.sort((a, b) => (a.start !== b.start) ? a.start - b.start : (b.end - b.start) - (a.end - a.start));

  const resolved = [];
  let lastEnd = 0;
  for (const span of valid) {
    if (span.start >= lastEnd) {
      resolved.push(span);
      lastEnd = span.end;
    }
  }
  return resolved;
}

// Restscanner für unmaskierte Verdachtsstellen nach dem Maskieren
export function scanneReste(maskedText, mandantNamen = []) {
  const befunde = [];
  const clean = maskedText.replace(/⟦[A-Za-z0-9_]+⟧/g, ' ');

  // 1. Großgeschriebene Wörter nach Anrede
  const anredeRestRe = /\b(?:Herr|Herrn|Frau|Fräulein|Dr\.|Dr\. med\.|Prof\.|Dres\.)\s+([A-ZÄÖÜ][a-zäöüß]+)/gu;
  let am;
  while ((am = anredeRestRe.exec(maskedText)) !== null) befunde.push({ art: 'ANREDE_REST', ausschnitt: maskSnippet(am[0]) });

  // 2. Unmaskierte Ziffernfolgen >= 7
  const digitRe = /\b\d{7,}\b/g;
  let dm;
  while ((dm = digitRe.exec(clean)) !== null) befunde.push({ art: 'ZIFFERNFOLGE', ausschnitt: maskSnippet(dm[0]) });

  // 3. Übrig gebliebenes @
  if (/@/.test(clean)) {
    const at = clean.match(/\S+@\S+/);
    befunde.push({ art: 'EMAIL_REST', ausschnitt: maskSnippet(at ? at[0] : '@') });
  }

  // 4. PLZ-Muster
  const plzRe = /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+/gu;
  let pm;
  while ((pm = plzRe.exec(clean)) !== null) befunde.push({ art: 'PLZ_REST', ausschnitt: maskSnippet(pm[0]) });

  // 5. Fuzzy-Restprüfung für Mandantennamen (Levenshtein <= 1 für >= 5 Zeichen)
  const tokens = clean.split(/[^\p{L}\p{N}]+/u).filter(t => t.length >= 5);
  const nameParts = [];
  for (const n of mandantNamen) {
    if (!n) continue;
    for (const p of n.split(/[\s\-_/.]+/)) {
      if (p.length >= 5 && !NAME_STOP_WORDS.has(p.toLowerCase())) nameParts.push(p.toLowerCase());
    }
  }

  for (const tok of tokens) {
    const tokLower = tok.toLowerCase();
    for (const np of nameParts) {
      if (levenshteinDist(tokLower, np) <= 1) {
        befunde.push({ art: 'FUZZY_NAME_REST', ausschnitt: maskSnippet(tok) });
        break;
      }
    }
  }

  return befunde;
}

/**
 * Maskiert PII in einem gegebenen Text.
 * 
 * @param {string} text
 * @param {Object} [options]
 * @param {Array<{value:string, type:string}>} [options.entities]
 * @param {string[]} [options.mandantNamen]
 * @returns {{ masked: string, unmask: (s: string) => string, befunde: Array<{art: string, ausschnitt: string}>, unmaskStreng: (s: string) => string }}
 */
export function maskiere(text, { entities = [], mandantNamen = [] } = {}) {
  if (typeof text !== 'string' || !text) {
    return { masked: text || '', unmask: (s) => s, befunde: [], unmaskStreng: (s) => s };
  }

  const nonce = crypto.randomBytes(2).toString('hex');
  const placeholderMap = new Map();
  const reverseMap = new Map();
  const typeCounters = {};

  const allocate = (type, original) => {
    if (reverseMap.has(original)) return reverseMap.get(original);
    typeCounters[type] = (typeCounters[type] || 0) + 1;
    const ph = `⟦${type}_${nonce}_${typeCounters[type]}⟧`;
    placeholderMap.set(ph, original);
    reverseMap.set(original, ph);
    return ph;
  };

  const protectedSpans = findProtectedSpans(text);
  const rawSpans = findPiiSpans(text, entities, mandantNamen);
  const resolvedSpans = resolveSpans(rawSpans, protectedSpans);

  let masked = '';
  let cursor = 0;
  for (const span of resolvedSpans) {
    masked += text.slice(cursor, span.start);
    masked += allocate(span.type, text.slice(span.start, span.end));
    cursor = span.end;
  }
  masked += text.slice(cursor);

  const befunde = scanneReste(masked, mandantNamen);

  // Unmask: Ersetzt exakt bekannte Platzhalter dieses Aufrufs
  const unmask = (responseStr) => {
    if (typeof responseStr !== 'string' || !responseStr) return responseStr;
    return responseStr.replace(/⟦[A-Za-z0-9_]+⟧/g, (match) => {
      return placeholderMap.has(match) ? placeholderMap.get(match) : match;
    });
  };

  // Hilfsmethode zur Erkennung unbekannter Platzhalter in der Modellantwort
  unmask.getUnbekannte = (responseStr) => {
    if (typeof responseStr !== 'string') return [];
    const matches = responseStr.match(/⟦[A-Za-z0-9_]+⟧|<<[^>]+>>/g) || [];
    return matches.filter(m => !placeholderMap.has(m));
  };

  const unmaskStrengFn = (responseStr) => unmaskStreng(responseStr, placeholderMap);

  return { masked, unmask, befunde, unmaskStreng: unmaskStrengFn };
}

/**
 * Adapter für das Messskript messen.mjs
 */
export function messeAdapter(text, { entities = [] } = {}) {
  const mandantNamen = entities
    .filter(e => e && e.type === 'NAME')
    .map(e => e.value);

  const res = maskiere(text, { entities, mandantNamen });
  return { masked: res.masked, unmask: res.unmask };
}

/**
 * Strenge Unmaskierung: Wirft Fehler bei unbekannten Platzhaltern in Modellantworten
 */
export function unmaskStreng(text, knownMap) {
  if (typeof text !== 'string') return text;
  const matches = text.match(/⟦[A-Za-z0-9_]+⟧/g) || [];
  for (const m of matches) {
    if (!knownMap.has(m)) {
      throw new Error(`Unbekannter Platzhalter in Modellantwort entdeckt: ${m}`);
    }
  }
  return text.replace(/⟦[A-Za-z0-9_]+⟧/g, (m) => knownMap.get(m) || m);
}

// Selbsttest für Direktaufruf (node maske-v2.mjs)
if (process.argv[1] && process.argv[1].endsWith('maske-v2.mjs')) {
  const { messe } = await import('./messen.mjs');
  console.log('Starte Selbsttest mit messe(messeAdapter)...');
  messe(messeAdapter);
}
