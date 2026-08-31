/**
 * icd-dg-match.js — Frontend-Gegenstück zu api-backend/ai/validators/icdDgRules.js
 *
 * Reines Modul: keine DOM-Zugriffe, keine Netzwerkaufrufe, keine Abhängigkeiten.
 * Semantik identisch mit dem Backend — Datenquelle ist jedoch die Tabelle
 * `diagnosegruppen` (Spalten icd_accept / icd_exclude / icd_auto_select /
 * icd_accept_unsicher / icd_enforcement), nicht die JSON-Datei.
 *
 * Regulaere Ausdruecke werden einmalig kompiliert und gecacht; ein nicht
 * kompilierbarer Ausdruck wird einmalig auf der Konsole gemeldet und
 * uebersprungen — kein Absturz.
 */

// ── RegExp-Cache ──────────────────────────────────────────────────────────────
const _reCache = new Map();
const _reBad   = new Set();

function _compileRe(pattern) {
  if (_reCache.has(pattern)) return _reCache.get(pattern);
  if (_reBad.has(pattern)) return null;
  try {
    const re = new RegExp(pattern);
    _reCache.set(pattern, re);
    return re;
  } catch (e) {
    if (!_reBad.has(pattern)) {
      console.warn('[icd-dg-match] Ungültiger Regulärausdruck, wird übersprungen:', pattern, e.message);
      _reBad.add(pattern);
    }
    return null;
  }
}

// ── Exportierte Funktionen ────────────────────────────────────────────────────

/**
 * Normalisiert einen ICD-10-Kode: Großbuchstaben, alle Leerzeichen entfernt.
 * Die Sonderzeichen †, * und ! bleiben erhalten.
 */
export function normalizeIcd(code) {
  return String(code || '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Form eines ICD-10-GM-Kodes: Buchstabe, zwei Ziffern, optional Punkt mit ein
 * bis zwei Stellen, optional †, * oder !. Beispiele: E11.74, G63.2*, G82.60!
 */
const ICD_SHAPE = /^[A-Z]\d{2}(?:\.\d{1,2})?[†*!]?$/;

/**
 * Zerlegt einen rohen ICD-String (Komma- oder Semikolon-getrennt) oder ein
 * Array in ein Array normalisierter, nicht-leerer Kodes.
 *
 * Die Diagnosefelder zeigen „Kode – Titel" an (katalog-suche.js, toText).
 * Der Titel enthaelt selbst Kommas, deshalb reicht ein Split am Komma nicht:
 * „E11.74 – Diabetes mellitus, Typ 2: …" wurde sonst zu einem einzigen
 * Pseudokode zusammengezogen und meldete faelschlich eine Abweichung.
 * Darum: erst am Trennstrich abschneiden, dann alles verwerfen, was nicht die
 * Form eines ICD-Kodes hat. Freitext fuehrt so zu keiner Warnung — richtig,
 * denn der ICD ist ohnehin nicht Pflicht (Anlage 3 k).
 */
export function parseIcdList(raw) {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : String(raw).split(/[,;\n]/);
  return items
    .map(s => String(s ?? '').split(/\s[–—-]\s/)[0])
    .map(c => normalizeIcd(c))
    .filter(c => ICD_SHAPE.test(c));
}

/**
 * Prueft, ob eine Menge von ICD-Kodes zur Regel einer Diagnosegruppe passt.
 *
 * @param {string[]} codes - Normalisierte ICD-Kodes (via parseIcdList)
 * @param {{ icd_accept, icd_exclude, icd_auto_select, icd_accept_unsicher, icd_enforcement }} rule
 * @returns {{ status: 'skip'|'ok'|'unsicher'|'mismatch', matched: string[], excluded: string[], hints: string[] }}
 */
export function matchIcdToDg(codes, rule) {
  const empty = { status: 'skip', matched: [], excluded: [], hints: [] };
  if (!codes || codes.length === 0) return empty;
  if (!rule || !rule.icd_accept || rule.icd_accept.length === 0) return empty;

  const excludeRules  = rule.icd_exclude        || [];
  const acceptRules   = rule.icd_accept          || [];
  const unsicherRules = rule.icd_accept_unsicher || [];

  const hints    = [];
  const excluded = [];

  // Schritt 1: Kodes nach Ausschlussregeln filtern
  const remaining = codes.filter(code => {
    const hit = excludeRules.find(e => { const re = _compileRe(e.re); return re && re.test(code); });
    if (hit) {
      excluded.push(code);
      if (hit.note) hints.push(hit.note);
      return false;
    }
    return true;
  });

  // Schritt 2: Mindestens einer muss icd_accept treffen → ok
  const matched = [];
  for (const code of remaining) {
    const hit = acceptRules.find(e => { const re = _compileRe(e.re); return re && re.test(code); });
    if (hit) {
      matched.push(code);
      if (hit.note && !hints.includes(hit.note)) hints.push(hit.note);
    }
  }
  if (matched.length > 0) return { status: 'ok', matched, excluded, hints };

  // Schritt 3: icd_accept_unsicher → kein Hinweis, keine automatische Auswahl
  const unsicherMatched = [];
  for (const code of remaining) {
    const hit = unsicherRules.find(e => { const re = _compileRe(e.re); return re && re.test(code); });
    if (hit) {
      unsicherMatched.push(code);
      if (hit.note && !hints.includes(hit.note)) hints.push(hit.note);
    }
  }
  if (unsicherMatched.length > 0) return { status: 'unsicher', matched: unsicherMatched, excluded, hints };

  return { status: 'mismatch', matched: [], excluded, hints };
}

/**
 * Gibt alle Diagnosegruppen-Kuerzel zurueck, fuer die der Status 'ok' ist.
 */
export function dgsAcceptingIcd(codes, rulesByDg) {
  if (!codes || codes.length === 0 || !rulesByDg) return [];
  return Object.entries(rulesByDg)
    .filter(([, rule]) => matchIcdToDg(codes, rule).status === 'ok')
    .map(([dg]) => dg);
}

/**
 * Gibt genau ein Diagnosegruppen-Kuerzel zurueck, wenn ueber icd_auto_select
 * eindeutig eine Gruppe ermittelt werden kann — sonst null.
 * Auschluesse (icd_exclude) gelten weiterhin.
 */
export function autoSelectDg(codes, rulesByDg) {
  if (!codes || codes.length === 0 || !rulesByDg) return null;
  const hits = [];
  for (const [dg, rule] of Object.entries(rulesByDg)) {
    const autoRules   = rule.icd_auto_select || [];
    if (autoRules.length === 0) continue;
    const excludeRules = rule.icd_exclude || [];
    const remaining = codes.filter(code => {
      const excl = excludeRules.find(e => { const re = _compileRe(e.re); return re && re.test(code); });
      return !excl;
    });
    if (remaining.length === 0) continue;
    const anyMatch = remaining.some(code =>
      autoRules.some(e => { const re = _compileRe(e.re); return re && re.test(code); })
    );
    if (anyMatch) hits.push(dg);
  }
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Gibt den ICD-Klartext-Kode zurueck, wenn icd_accept genau einen Eintrag hat,
 * dessen `re` ein vollstaendig verankertes Literal ist (^...$, keine
 * Metazeichen ausser maskierten Punkten). Sonst null.
 * Beispiel: ^L60\.0$ → "L60.0"
 */
export function soleIcdForDg(rule) {
  if (!rule || !rule.icd_accept || rule.icd_accept.length !== 1) return null;
  const { re } = rule.icd_accept[0];
  if (!re) return null;
  if (!re.startsWith('^') || !re.endsWith('$')) return null;
  const inner = re.slice(1, -1);
  // Nur Buchstaben, Ziffern, maskierte Punkte erlaubt
  if (!/^[A-Za-z0-9]+(\\.[A-Za-z0-9]+)*$/.test(inner)) return null;
  return normalizeIcd(inner.replace(/\\\./g, '.'));
}

/**
 * Normalisiert ein Diagnosegruppen-Kuerzel auf seinen Wurzelkode: Grossbuchstaben,
 * ohne Leerzeichen, ohne Untergruppen-Suffix. "df-a" → "DF".
 * Die Untergruppen a/b/c sind Leitsymptomatik, keine eigene Gruppe — die
 * ICD-Regeln haengen immer an der Wurzel.
 */
export function normDgCode(raw) {
  return String(raw || '').replace(/\s+/g, '').toUpperCase().replace(/-[ABC]$/, '');
}

/**
 * Welche Diagnosegruppen sind mit diesen ICD-Kodes ausgeschlossen?
 *
 * Gesperrt wird NUR, wo die Regel `icd_enforcement === 'hard_before_dta'` traegt
 * (heute UI1/UI2). Das ist eine Grenze aus der Sache, nicht aus Bequemlichkeit:
 * nach Anlage 3 k der HeilM-RL ist der ICD auf Muster 13 nicht Pflicht, und ein
 * abweichender Kode kann medizinisch richtig sein (Nebendiagnose, Doppel-
 * kodierung, ICD-10-GM-Revision). Wo die Regel `warn` sagt, entscheidet der
 * Therapeut — dort wird gewarnt, nicht gesperrt. Gleiche Begruendung wie im
 * Kopfkommentar von api-backend/ai/validators/icdDgRules.js.
 *
 * @returns {{ dg: string, grund: 'hart', erwartet: string|null, hints: string[] }[]}
 *   `erwartet` ist der einzige zulaessige Kode, wenn die Regel genau einen
 *   verankerten Literaltreffer hat (UI1/UI2 → "L60.0") — sonst null.
 */
export function dgSperrenFuerIcd(codes, rulesByDg) {
  if (!codes || codes.length === 0 || !rulesByDg) return [];
  const out = [];
  for (const [dg, rule] of Object.entries(rulesByDg)) {
    if (!rule || rule.icd_enforcement !== 'hard_before_dta') continue;
    if (!rule.icd_accept || rule.icd_accept.length === 0) continue;
    const res = matchIcdToDg(codes, rule);
    if (res.status !== 'mismatch') continue;
    out.push({ dg, grund: 'hart', erwartet: soleIcdForDg(rule), hints: res.hints });
  }
  return out;
}

/**
 * Das vollstaendige Bild zu einer Kodemenge: was vorgeschlagen wird, was noch
 * in Frage kommt und was ausgeschlossen ist.
 *
 * Zwei verschiedene Sperrgruende, absichtlich getrennt:
 *
 *   'hart'     — die Regel der Gruppe selbst verbietet den Kode
 *                (icd_enforcement = hard_before_dta, s. dgSperrenFuerIcd).
 *
 *   'normativ' — der Kode gehoert nachweislich woanders hin. Das gilt nur,
 *                wenn JEDER eingegebene Kode der normativ eindeutige Kode
 *                einer Gruppe ist (soleIcdForDg — heute L60.0 → UI1/UI2).
 *                Dann scheidet jede Gruppe ausserhalb von `kandidaten` aus,
 *                auch eine mit `warn`.
 *                Steht daneben noch ein freier Kode (z. B. L60.0 + E11.74 bei
 *                einem Diabetiker mit eingewachsenem Nagel), greift das NICHT:
 *                dann ist die Kodemenge nicht mehr eindeutig zugeordnet und
 *                es bleibt bei der Warnung. Genau dieser Fall hat die frueher
 *                fest verdrahtete L60.0-Sonderbehandlung falsch beschieden —
 *                sie hat DF auch dann ausgeblendet.
 *
 * @returns {{ auto: string|null, kandidaten: string[],
 *             gesperrt: {dg,grund,erwartet,hints}[], normativ: boolean }}
 */
export function dgVorschlag(codes, rulesByDg) {
  const leer = { auto: null, kandidaten: [], gesperrt: [], normativ: false };
  if (!codes || codes.length === 0 || !rulesByDg) return leer;

  const kandidaten = dgsAcceptingIcd(codes, rulesByDg);
  const gesperrt   = dgSperrenFuerIcd(codes, rulesByDg);

  const soleCodes = new Set();
  for (const rule of Object.values(rulesByDg)) {
    const sole = soleIcdForDg(rule);
    if (sole) soleCodes.add(sole);
  }
  const normativ = codes.every(c => soleCodes.has(c)) && kandidaten.length > 0;

  if (normativ) {
    const schon = new Set(gesperrt.map(g => g.dg));
    for (const [dg, rule] of Object.entries(rulesByDg)) {
      if (kandidaten.includes(dg) || schon.has(dg)) continue;
      if (!rule || !rule.icd_accept || rule.icd_accept.length === 0) continue;
      gesperrt.push({ dg, grund: 'normativ', erwartet: null, hints: matchIcdToDg(codes, rule).hints });
    }
  }

  return { auto: autoSelectDg(codes, rulesByDg), kandidaten, gesperrt, normativ };
}
