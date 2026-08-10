/**
 * icdDgRules.js -- ICD-10-Kode <-> Diagnosegruppe-Pruefung fuer Podologie
 *
 * Was dieses Modul tut:
 *   Gegeben eine Menge von ICD-10-Kodes und eine Regelsammlung (icd_accept / icd_exclude /
 *   icd_accept_unsicher / icd_auto_select aus diagnosegruppen.json Podologie) entscheidet
 *   das Modul, ob die Kodierung zur Diagnosegruppe passt.
 *
 * Warum nur Warnungen, keine Blocker:
 *   Die ICD-Zuordnung folgt Anlage 3 k der HeilM-RL: der ICD-Kode auf Muster 13 ist nicht
 *   Pflicht -- Klartext ist zulaessig. Ein abweichender Kode kann medizinisch korrekt sein
 *   (Nebendiagnose, Doppelkodierung, ICD-10-GM-Revision). Die Entscheidung, ob eine
 *   Verordnung abgerechnet werden darf, trifft der behandelnde Therapeut, nicht die Software.
 *   Unmittelbar vor der DTA-Erzeugung kann der Aufrufer bei enforcement === 'hard_before_dta'
 *   eigenstaendig blockieren -- dieses Modul bereitet nur die Information auf.
 *
 * Oberflaechenparitaet:
 *   dashboard.js faehrt dieselbe Semantik gegen die Supabase-Tabelle diagnosegruppen
 *   (Spalten icd_accept / icd_exclude / icd_auto_select / icd_accept_unsicher).
 *   Beide Fassungen MUESSEN gleich bleiben. Aenderungen hier muessen dort gespiegelt werden
 *   und umgekehrt. Drift wird mit node check_diagnosegruppen_icd.js --check geprueft.
 */

// RegExp-Cache -- compiled einmal pro re-String, nie doppelt.
const _reCache = new Map();

function getRegExp(re) {
  if (!_reCache.has(re)) {
    _reCache.set(re, new RegExp(re));
  }
  return _reCache.get(re);
}

/**
 * Normalisiert einen ICD-10-Kode fuer den Regex-Vergleich.
 * - Grossbuchstaben
 * - Alle Leerzeichen entfernt
 * - Zeichen dagger, * und ! bleiben erhalten
 * - Nichts anderes wird entfernt
 */
export function normalizeIcd(code) {
  if (typeof code !== 'string') return '';
  // \s statt ' ': Tabulatoren und geschuetzte Leerzeichen kommen aus der OCR
  // regelmaessig vor. Die Oberflaeche (icd-dg-match.js) normalisiert genauso.
  return code.toUpperCase().replace(/\s+/g, '');
}

/**
 * Form eines ICD-10-GM-Kodes: Buchstabe, zwei Ziffern, optional Punkt mit ein
 * bis zwei Stellen, optional †, * oder !. Beispiele: E11.74, G63.2*, G82.60!
 * Identisch mit icd-dg-match.js (Oberflaeche).
 */
const ICD_SHAPE = /^[A-Z]\d{2}(?:\.\d{1,2})?[†*!]?$/;

/**
 * Parst eine rohe ICD-Angabe (String mit Komma-/Semikolon-Trennung oder Array)
 * und gibt ein Array normalisierter, nicht leerer Kodes zurueck.
 */
export function parseIcdList(raw) {
  if (!raw) return [];
  const items = Array.isArray(raw)
    ? raw
    : String(raw).split(/[,;\n]/);
  return items
    // Die Diagnosefelder der Oberflaeche zeigen „Kode – Titel", und die OCR
    // liefert oft denselben Aufbau. Der Titel enthaelt selbst Kommas, ein
    // Split am Komma allein zieht „E11.74 – Diabetes mellitus, Typ 2: …"
    // deshalb zu einem Pseudokode zusammen und meldet faelschlich eine
    // Abweichung. Erst am Trennstrich abschneiden, dann alles verwerfen, was
    // nicht die Form eines ICD-Kodes hat. Freitext erzeugt so keine Warnung —
    // richtig, denn der ICD ist nicht Pflicht (Anlage 3 k).
    .map(s => String(s ?? '').split(/\s[–—-]\s/)[0])
    .map(s => normalizeIcd(s.trim()))
    .filter(s => ICD_SHAPE.test(s));
}

/**
 * Prueft eine Menge normalisierter ICD-Kodes gegen eine Diagnosegruppen-Regel.
 *
 * @param {string[]} codes  - Bereits normalisierte Kodes (Ausgabe von parseIcdList)
 * @param {object}   rule   - Regelobjekt aus diagnosegruppen.json (podologie-Abschnitt)
 * @returns {{ status: 'skip'|'ok'|'unsicher'|'mismatch', matched: string[], excluded: string[], hints: string[] }}
 */
export function matchIcdToDg(codes, rule) {
  const result = { status: 'skip', matched: [], excluded: [], hints: [] };

  // Keine Kodes => kein ICD angegeben => skip (keine Warnung, ICD ist nicht Pflicht)
  if (!codes || codes.length === 0) return result;

  // Keine Regel oder leerer icd_accept-Pool => skip (physio/logo/ergo: kein Pool hinterl.)
  const acceptRules = rule?.icd_accept;
  if (!acceptRules || acceptRules.length === 0) return result;

  const excludeRules = rule?.icd_exclude ?? [];
  const unsicherRules = rule?.icd_accept_unsicher ?? [];

  // Schritt 1: Ausschluesse identifizieren
  const excludedSet = new Set();
  for (const code of codes) {
    for (const entry of excludeRules) {
      if (getRegExp(entry.re).test(code)) {
        excludedSet.add(code);
        if (entry.note && !result.hints.includes(entry.note)) {
          result.hints.push(entry.note);
        }
      }
    }
  }

  const activeCodes = codes.filter(c => !excludedSet.has(c));
  result.excluded = [...excludedSet];

  // Schritt 2: icd_accept -- mindestens ein aktiver Kode muss passen
  for (const code of activeCodes) {
    for (const entry of acceptRules) {
      if (getRegExp(entry.re).test(code)) {
        if (!result.matched.includes(code)) result.matched.push(code);
        if (entry.note && !result.hints.includes(entry.note)) {
          result.hints.push(entry.note);
        }
      }
    }
  }

  if (result.matched.length > 0) {
    result.status = 'ok';
    return result;
  }

  // Schritt 3: icd_accept_unsicher
  const unsicherMatched = [];
  for (const code of activeCodes) {
    for (const entry of unsicherRules) {
      if (getRegExp(entry.re).test(code)) {
        if (!unsicherMatched.includes(code)) unsicherMatched.push(code);
        if (entry.note && !result.hints.includes(entry.note)) {
          result.hints.push(entry.note);
        }
      }
    }
  }

  if (unsicherMatched.length > 0) {
    result.matched = unsicherMatched;
    result.status = 'unsicher';
    return result;
  }

  // Schritt 4: kein Treffer => mismatch
  result.status = 'mismatch';
  return result;
}

/**
 * Gibt alle Diagnosegruppen-Kuerzel zurueck, deren Regel die Kodemenge mit Status 'ok' akzeptiert.
 */
export function dgsAcceptingIcd(codes, rulesByDg) {
  if (!rulesByDg) return [];
  return Object.entries(rulesByDg)
    .filter(([, rule]) => matchIcdToDg(codes, rule).status === 'ok')
    .map(([dg]) => dg);
}

/**
 * Automatische Diagnosegruppen-Selektion ueber icd_auto_select-Eintraege.
 * Ausschluesse (icd_exclude) gelten weiterhin.
 * Passt genau eine DG => gibt deren Kuerzel zurueck; sonst null.
 */
export function autoSelectDg(codes, rulesByDg) {
  if (!codes || codes.length === 0 || !rulesByDg) return null;

  const matches = [];

  for (const [dg, rule] of Object.entries(rulesByDg)) {
    const autoRules = rule?.icd_auto_select;
    if (!autoRules || autoRules.length === 0) continue;

    const excludeRules = rule?.icd_exclude ?? [];
    const excludedSet = new Set();
    for (const code of codes) {
      for (const entry of excludeRules) {
        if (getRegExp(entry.re).test(code)) excludedSet.add(code);
      }
    }
    const activeCodes = codes.filter(c => !excludedSet.has(c));

    const hit = activeCodes.some(code =>
      autoRules.some(entry => getRegExp(entry.re).test(code))
    );
    if (hit) matches.push(dg);
  }

  return matches.length === 1 ? matches[0] : null;
}

// Prueft ob re ein vollstaendig verankertes Literal ist (^..$ ohne Regex-Metazeichen ausser \.)
// Erlaubt: Buchstaben A-Z, Ziffern 0-9, Punkt (literal und escaped), sowie dagger, *, !
const LITERAL_ANCHORED_RE = /^\^[A-Z0-9.*!\\]+\$$/;

/**
 * Wenn icd_accept genau einen Eintrag enthaelt und dessen re ein vollstaendig
 * verankertes Literal ist (^..$ ohne Regex-Metazeichen ausser \.), gibt diese
 * Funktion den Kode als Klartext zurueck. Fuer UI1/UI2 ergibt das "L60.0".
 */
export function soleIcdForDg(rule) {
  const acceptRules = rule?.icd_accept;
  if (!acceptRules || acceptRules.length !== 1) return null;
  const { re } = acceptRules[0];
  if (!LITERAL_ANCHORED_RE.test(re)) return null;
  return re.slice(1, -1).replace(/\\\./g, '.');
}

/**
 * Erzeugt Warnungen fuer das warnings-Array von standardRules.js / validateStandard.
 * Gibt NIEMALS Blocker zurueck -- nur Warnungen.
 *
 * @param {{ icd10: string|string[]|undefined, diagnosegruppe: string|undefined }} input
 * @param {object} rulesByDg - Ausgabe von catalog.getIcdDgRules()
 * @returns {Array}
 */
export function checkIcdDg({ icd10, diagnosegruppe }, rulesByDg) {
  if (!diagnosegruppe || !rulesByDg) return [];

  // Suffix -a/-b/-c abschneiden
  const dgRoot = diagnosegruppe.replace(/-[abc]$/i, '');

  const rule = rulesByDg[dgRoot];
  if (!rule) return []; // Physio/Logo/Ergo: kein Pool => still

  const codes = parseIcdList(icd10);
  const { status, excluded, hints } = matchIcdToDg(codes, rule);

  if (status === 'skip' || status === 'ok' || status === 'unsicher') return [];

  // status === 'mismatch'
  const enforcement = rule.enforcement ?? 'warn';
  // Alle eingegebenen Kodes nennen — auch die ausgeschlossenen. Gerade der
  // ausgeschlossene Kode ist ja der Grund der Warnung (NF + G63.2), er darf in
  // der Meldung nicht fehlen.
  const betroffeneKodes = codes;
  const hintsText = hints.length > 0 ? ' (' + hints.join('; ') + ')' : '';

  if (enforcement === 'hard_before_dta') {
    return [{
      code: 'ICD_DG_MISMATCH_STRENG',
      msg: 'Code stimmt nicht mit der Diagnosegruppe überein. Diagnosegruppe: ' + dgRoot + '. ' +
        'Betroffene Kodes: ' + betroffeneKodes.join(', ') + '.' + hintsText + ' ' +
        'Eine Korrektur ist nur mit erneuter Arztunterschrift und Datumsangabe zulässig und muss ' +
        'vor der Einreichung zur Abrechnung erfolgt sein.',
      field: 'icd10',
      diagnosegruppe: dgRoot,
      affected_codes: betroffeneKodes,
      hints
    }];
  }

  // enforcement === 'warn' (DF, NF, QF)
  return [{
    code: 'ICD_DG_MISMATCH',
    msg: 'Code stimmt nicht mit der Diagnosegruppe überein. Diagnosegruppe: ' + dgRoot + '. ' +
      'Betroffene Kodes: ' + betroffeneKodes.join(', ') + '.' + hintsText + ' ' +
      'Die Zuordnungen sind Richtwerte, ein abweichender Kode ist nicht automatisch falsch.',
    field: 'icd10',
    diagnosegruppe: dgRoot,
    affected_codes: betroffeneKodes,
    hints
  }];
}