/**
 * verordnung-import.js — offene Verordnungen (Podologie, Physiotherapie, Ergotherapie) aus der Altsoftware.
 *
 * Warum (20.10.2026 / 02.11.2026): Teil des Praxiswechsels (Datenübernahme-Paket, Kemal).
 * Schritt 1 nach gkv-302: NUR Verordnungen, auf die noch keine Einheit
 * erbracht und die nirgends abgerechnet wurden (Fall D). Grund: eine
 * Verordnung rechnet genau ein System genau einmal ab, nach Abschluss
 * (Richtlinien §302 § 7 Abs. 1; Podologie Anlage 3 p; Physio Bundesvertrag § 125).
 * Für Physiotherapie/Ergotherapie gilt: "geleistet"/"bereits erbracht" > 0 wird
 * rot abgelehnt („Bereits begonnene Verordnungen bitte von Hand anlegen.").
 * Regel und Quellen: wissensbank/SPEC-RULES.md „Übernahme offener VOs aus Altsoftware".
 *
 * Schreibweg: ausschließlich POST /api/rezept/confirm über
 * `verordnungFuerBackend()` + `sendeAnServer()` — derselbe Weg wie die
 * Muster-13-Maske (Beschluss 06.09.2026: kein zweiter Weg in prescriptions).
 * Der Server prüft dort nicht hart; die Pflichtprüfung passiert HIER, vor dem
 * Senden. Der Patient muss schon im Stamm sein (patient_id wird immer
 * mitgeschickt — der Server würde sonst mit eigener Regel suchen/anlegen).
 *
 * Zuordnung der Spalten: `zuordnungsSchritt()` aus patienten-import.js.
 */

import { leseCsv, leseDatum, norm, teileName, esc, BTN, SPALTEN, zuordnungsSchritt, dekodiereDateiText } from './patienten-import.js?v=20261103s';
import { nameGeburtSchluessel } from './patient-dublette.js?v=20261021b';
import { verordnungPatientenAbgleich } from './verordnung-patient-abgleich.js?v=20261003e';
import { kartenIkNormalisieren } from './krankenkasse-suche.js?v=20261003e';
import { pruefeKvnr } from './kvnr.js?v=20260814';
import { behandlungsbeginnFrist } from './heilmittel-fristen.js?v=20261004m113';
import { normDgCode } from '../icd-dg-match.js?v=20261001b';
import { isValidLanr, LANR_ERSATZWERT } from './lanr-pruefung.js?v=20260929r';
import { POD_KATALOG, regelnFuerBereich } from './verordnung-regeln.js?v=20261031k3';
import { regelsatzLaden } from './verordnung-regelsatz-cache.js?v=20261031k3';
import { pruefeVerordnung } from './verordnung-pruefung.js?v=20261031k3';
import { verordnungFuerBackend } from './verordnung-an-backend.js?v=20261109a';
import { sendeAnServer } from './verordnung-maske.js?v=20261110chip';
import { gleicheSitzungenAb } from './sitzung-abgleich.js?v=20261103q';
import { alsBerlinDatum } from './berlin-datum.js';
import { normalizeBereich, pruefeHeilmittelZeilen } from './heilmittel-zeilen.js';

// ── Spalten ─────────────────────────────────────────────────────────────

export const VO_SPALTEN = {
  altsystem_vo_nr: ['vonr', 'verordnungsnummer', 'verordnungsnr', 'rezeptnr', 'rezeptnummer', 'vonummer'],
  nachname: SPALTEN.nachname,
  vorname: SPALTEN.vorname,
  vollname: SPALTEN.vollname,
  geburtsdatum: SPALTEN.geburtsdatum,
  versichertennummer: SPALTEN.versichertennummer,
  versichertenstatus: ['versichertenstatus', 'versstatus'],
  krankenkasse: SPALTEN.krankenkasse,
  krankenkasse_ik: [...SPALTEN.krankenkasse_ik, 'ikkrankenkasse', 'ikkrankenkasse9stellig'],
  ausstellungsdatum: ['ausstellungsdatum', 'verordnungsdatum', 'ausgestelltam', 'vodatum', 'rezeptdatum', 'datumverordnung', 'ausstellung'],
  lanr: ['lanr', 'arztnummer', 'arztnr'],
  bsnr: ['bsnr', 'betriebsstaettennummer', 'betriebsstaettennr'],
  arztname: ['arzt', 'arztname', 'verordner', 'verordnenderarzt'],
  unterschrift: ['unterschrift', 'arztunterschrift', 'unterschriftvorhanden', 'stempelunterschrift', 'arztstempelunterschriftvorhanden', 'arztstempelunterschriftvorhandenjanein'],
  diagnosegruppe: ['diagnosegruppe', 'dg', 'indikationsschluessel', 'indikation'],
  icd10: ['icd10', 'icd', 'icd101', 'icdcode', 'icd1'],
  icd10_2: ['icd102', 'icd2'],
  diagnose_text: ['diagnose', 'diagnoseklartext', 'diagnosetext'],
  leitsymptomatik: ['leitsymptomatik', 'leitsymptomatikabc'],
  heilmittel: ['heilmittel', 'leistung', 'behandlungsart', 'vorrangigesheilmittel', 'position', 'positionsnummer', 'posnr', 'pos', 'xcode', 'leistungscode', 'gkvposition'],
  heilmittel_position: ['position', 'positionsnummer', 'posnr', 'pos', 'xcode', 'leistungscode', 'gkvposition'],
  anzahl: ['anzahl', 'anzahleinheiten', 'einheiten', 'anzahleinheitenverordnet', 'menge', 'verordnungsmenge'],
  heilmittel2: ['heilmittel2', 'leistung2', 'behandlungsart2', 'vorrangigesheilmittel2', 'position2'],
  anzahl2: ['anzahl2', 'anzahleinheiten2', 'einheiten2', 'menge2', 'verordnungsmenge2'],
  heilmittel3: ['heilmittel3', 'leistung3', 'behandlungsart3', 'vorrangigesheilmittel3', 'position3'],
  anzahl3: ['anzahl3', 'anzahleinheiten3', 'einheiten3', 'menge3', 'verordnungsmenge3'],
  heilmittel4: ['heilmittel4', 'leistung4', 'behandlungsart4', 'vorrangigesheilmittel4', 'position4'],
  anzahl4: ['anzahl4', 'anzahleinheiten4', 'einheiten4', 'menge4', 'verordnungsmenge4'],
  ergaenzend_heilmittel: ['ergaenzend', 'ergaenzendesheilmittel', 'ergaenzung', 'ergaenzungsheilmittel', 'ergaenzendesteilmittel', 'ergaenzendeposition'],
  ergaenzend_anzahl: ['ergaenzendeinheiten', 'ergaenzendanzahl', 'einheitenergaenzend', 'anzahlergaenzend'],
  frequenz: ['frequenz', 'therapiefrequenz'],
  hausbesuch: ['hausbesuch', 'hausbesuchjanein'],
  doppelbehandlung: ['doppelbehandlung', 'doppelbehandlungjanein', 'doppel'],
  dringlich: ['dringlich', 'dringend', 'dringlichjanein', 'dringlicherbehandlungsbedarf'],
  bericht: ['therapiebericht', 'therapieberichtangefordert', 'therapieberichtangefordertjanein', 'bericht'],
  zuzahlung_befreit: ['zuzahlungsbefreit', 'zuzahlungsbefreitjanein', 'befreit', 'zuzahlungsfrei'],
  nagel: ['nagel', 'nagelzb', 'nagelzbu1links', 'zeh'],
  wagner_grad: ['wagner', 'wagnergrad'],
  erster_tag: ['ersterbehandlungstag', 'erstebehandlung', 'behandlungsbeginn', 'beginn'],
  zuzahlung_alt: ['zuzahlungbereitskassiert', 'zuzahlungkassiert', 'zuzahlungkassierteur', 'zuzahlungbereitskassierteur', 'kassiertezuzahlung'],
  zuzahlung_alt_am: ['zuzahlungkassiertam', 'kassiertam'],
  zuzahlung_alt_beleg: ['zuzahlungbeleg', 'zuzahlungbelegnr', 'belegnr', 'quittungsnr'],
  erbracht: ['erbracht', 'einheitenerbracht', 'einheitenschonerbracht', 'schonerbracht', 'bereitserbracht', 'behandelt', 'erbrachteeinheiten', 'geleistet', 'einheitengeleistet'],
  abgerechnet: ['abgerechnet', 'imaltsystemabgerechnet', 'imaltsystemabgerechnetjanein', 'eingereicht'],
};

export const VO_FELDER = {
  nachname: 'Nachname', vorname: 'Vorname', vollname: 'Name komplett', geburtsdatum: 'Geburtsdatum',
  versichertennummer: 'Versichertennummer', versichertenstatus: 'Versichertenstatus',
  krankenkasse: 'Krankenkasse (Name)', krankenkasse_ik: 'IK der Krankenkasse',
  ausstellungsdatum: 'Ausstellungsdatum', lanr: 'LANR', bsnr: 'BSNR', arztname: 'Arzt (Name)',
  unterschrift: 'Arztstempel/Unterschrift vorhanden',
  diagnosegruppe: 'Diagnosegruppe', icd10: 'ICD-10', icd10_2: 'ICD-10 (2)', diagnose_text: 'Diagnose (Klartext)',
  leitsymptomatik: 'Leitsymptomatik (a/b/c)', heilmittel: 'Heilmittel / Position',
  anzahl: 'Anzahl Einheiten',
  heilmittel2: 'Heilmittel 2 (optional)', anzahl2: 'Anzahl Einheiten 2 (optional)',
  heilmittel3: 'Heilmittel 3 (optional)', anzahl3: 'Anzahl Einheiten 3 (optional)',
  ergaenzend_heilmittel: 'Ergänzendes Heilmittel (optional)', ergaenzend_anzahl: 'Ergänzende Einheiten (optional)',
  frequenz: 'Frequenz', hausbesuch: 'Hausbesuch (ja/nein)', doppelbehandlung: 'Doppelbehandlung (ja/nein)',
  dringlich: 'Dringlich (ja/nein)', bericht: 'Therapiebericht angefordert',
  zuzahlung_befreit: 'Zuzahlungsbefreit (ja/nein)', nagel: 'Nagel (z. B. U1 links)', wagner_grad: 'Wagner-Grad',
  erbracht: 'Einheiten schon erbracht / geleistet', erster_tag: 'Erster Behandlungstag', zuzahlung_alt: 'Zuzahlung bereits kassiert (EUR)', zuzahlung_alt_am: 'Zuzahlung kassiert am', zuzahlung_alt_beleg: 'Zuzahlung Beleg-Nr. (alt)', abgerechnet: 'Im Altsystem abgerechnet', altsystem_vo_nr: 'VO-Nr. (alt)',
};

const PFLICHT_PODO = ['Name', 'Geburtsdatum', 'Ausstellungsdatum', 'LANR', 'Diagnosegruppe', 'Heilmittel', 'Anzahl'];

export function voFehlendePflicht(zu, bereich = 'podo') {
  const normBereich = normalizeBereich(bereich);
  const fehlt = [];
  if (zu.nachname == null && zu.vollname == null) fehlt.push('Name');
  if (zu.geburtsdatum == null) fehlt.push('Geburtsdatum');
  if (zu.ausstellungsdatum == null) fehlt.push('Ausstellungsdatum');
  if (zu.lanr == null) fehlt.push('LANR');
  if (zu.diagnosegruppe == null) fehlt.push('Diagnosegruppe');
  if (normBereich === 'physio' || normBereich === 'ergo') {
    if (zu.heilmittel == null && zu.heilmittel_position == null) fehlt.push('Heilmittel');
  } else {
    if (zu.leitsymptomatik == null && zu.heilmittel == null && zu.heilmittel_position == null) fehlt.push('Heilmittel');
  }
  if (zu.anzahl == null) fehlt.push('Anzahl');
  return fehlt;
}

// ── Werte & Katalog ─────────────────────────────────────────────────────

const DG_ERLAUBT = new Set(['DF', 'NF', 'QF', 'UI1', 'UI2']);
/** Höchstmenge je Verordnung (verordnung-regeln.js, [Q1]: UI2 = 4). */
const HOECHSTMENGE = { DF: 6, NF: 6, QF: 6, UI1: 8, UI2: 4 };
const LS_CODE = { a: '1000', b: '0100', c: '0010' };

/** Standard-Höchstmengen für Physiotherapie nach Heilmittel-Richtlinie (Fallback wenn DB offline/Test). */
export const PHYSIO_FALLBACK_HOECHSTMENGE = {
  WS1: 6, WS2: 6, WS: 6,
  EX1: 6, EX2: 6, EX3: 10, EX: 6,
  ZN1: 10, ZN2: 10, ZN: 10,
  PN: 10,
  AT1: 6, AT2: 6, AT3: 6, AT: 6,
  LY1: 6, LY2: 6, LY3: 10, LY: 6,
  CS: 6, GE: 6,
  SO1: 6, SO2: 6, SO3: 6,
  PS1: 10, PS2: 10, SB1: 10, SB2: 10,
};

/** Normalisiert Heilmittel-Positionsnummer (z. B. X0501 ↔ 20501). */
export function normalizeVoCode(code) {
  const raw = typeof code === 'object' && code !== null
    ? (code.code || code.position || code.positionsnummer || code.x || code.bezeichnung || '')
    : code;
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return '';
  // 5-stellige GKV-Positionsnummern (z. B. 20501, 10501, 60501, 80501, X0501 -> X0501)
  if (/^[0-9X]\d{4}$/.test(s)) {
    return 'X' + s.slice(1);
  }
  return s;
}

/** Extrahiert alle relevanten Heilmittel-Positionskodes aus einer Verordnung (DB-Zeile oder Objekt). */
export function codesAusVerordnung(v = {}) {
  const c = [];
  if (Array.isArray(v.heilmittel_items)) {
    for (const it of v.heilmittel_items) {
      if (!it) continue;
      const code = typeof it === 'object' ? (it.code || it.position || it.positionsnummer || it.bezeichnung) : it;
      if (code) c.push(code);
    }
  }
  if (v.heilmittel_position) c.push(v.heilmittel_position);
  if (v.ergaenzend_position) c.push(v.ergaenzend_position);
  if (v.ergaenzendes_heilmittel) c.push(v.ergaenzendes_heilmittel);
  if (!c.length && v.heilmittel) c.push(v.heilmittel);
  return c;
}

/** Normalisiert Datum auf ISO YYYY-MM-DD (Berlin-Tag). */
export function normalizeVoDatum(ausstellungsdatum) {
  if (!ausstellungsdatum) return '';
  if (typeof ausstellungsdatum === 'string') {
    const s = ausstellungsdatum.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = leseDatum(s);
    if (d) return d;
  }
  const berlin = alsBerlinDatum(ausstellungsdatum);
  if (berlin) return berlin;
  return '';
}

/**
 * Eindeutiger Dubletten-Schlüssel für eine Verordnung beim Import.
 * Erkennt Dubletten konsistent über CSV-Zeilen und DB-Abfragen hinweg.
 * Berücksichtigt X0501 ↔ 20501 Äquivalenz und sortierte Codes.
 */
export function voImportSchluessel({
  patientId,
  nameGeburt,
  ausstellungsdatum,
  codes = [],
  lanr = '',
  dg = '',
  bereich = '',
} = {}) {
  const pat = String(patientId || (nameGeburt ? `name:${nameGeburt}` : '')).trim();
  if (!pat) return null;
  const datum = normalizeVoDatum(ausstellungsdatum);
  if (!datum) return null;

  const rawCodes = (Array.isArray(codes) ? codes : [codes])
    .filter(Boolean)
    .flatMap(c => {
      if (Array.isArray(c)) return c;
      if (typeof c === 'object' && c !== null && Array.isArray(c.heilmittel_items)) {
        return codesAusVerordnung(c);
      }
      return [c];
    });

  const normCodes = Array.from(new Set(rawCodes.map(normalizeVoCode).filter(Boolean))).sort().join('+');

  const b = normalizeBereich(bereich);
  if (b === 'physio' || b === 'ergo' || normCodes) {
    if (!normCodes) return null;
    return `${pat}|${datum}|${normCodes}`;
  }

  // Podologie / Fallback wenn keine Codes: lanr + dg
  const l = String(lanr || '').trim();
  const d = String(dg || '').trim().toUpperCase();
  return `${pat}|${datum}|${l}|${d}`;
}

let _defaultPhysioKatalog = null;

/** Für Tests oder externe Initialisierung des Katalogs ohne Hardcoding */
export function setzeDefaultPhysioKatalog(kat) {
  _defaultPhysioKatalog = kat;
}

/** ja / nein / unbekannt(null) */
export function janein(roh) {
  const s = norm(roh);
  if (!s) return null;
  if (/^(ja|j|x|1|true|yes|y|vorhanden|wahr)$/.test(s)) return true;
  if (/^(nein|n|0|false|no|fehlt|falsch|leer)$/.test(s)) return false;
  return null;
}

/** „U1 links", „u1li", „U 1 L" → 'U1 links'; sonst null */
export function leseNagel(roh) {
  const m = String(roh ?? '').trim().match(/^U\s?([1-5])\s*(links|li|l|rechts|re|r)\.?$/i);
  return m ? `U${m[1]} ${/^l/i.test(m[2]) ? 'links' : 'rechts'}` : null;
}

/** Buchstabe a/b/c aus Leitsymptomatik oder Heilmittel-Text. */
function leitBuchstabe(ls, hm, dg) {
  const l = String(ls ?? '').trim().toLowerCase().replace(/^[a-z]{2}\d?[\s\-–—:.]+/, '');
  if (/^[abc]\)?$/.test(l)) return l[0];
  if (/^[01]{4}$/.test(l)) return ['a', 'b', 'c'][l.indexOf('1')] || null;
  const h = norm(hm);
  if (h) {
    for (const [b, text] of Object.entries(POD_KATALOG[dg] || {})) if (norm(text) === h || h.includes(norm(text))) return b;
    if (/komplex/.test(h)) return 'c';
    if (/nagelspange/.test(h)) return 'a';
    if (/nagel/.test(h)) return 'b';
    if (/hornhaut/.test(h)) return 'a';
  }
  return dg === 'UI1' || dg === 'UI2' ? 'a' : null;   // UI kennt nur a)
}

/**
 * Löst eine Heilmittel-Eingabe (X-Code, 5-stellige Ziffer, Kürzel oder Freitext)
 * gegen den übergebenen Katalog auf.
 *
 * @param {string} roh
 * @param {Array} [katalog]
 * @returns {{ code: string, bezeichnung: string, treffer?: object } | null}
 */
export function loesePosition(roh, katalog = null) {
  if (!roh) return null;
  const s = String(roh).trim();
  if (!s) return null;
  const sNorm = norm(s);
  const sUpper = s.toUpperCase();
  const liste = Array.isArray(katalog) && katalog.length
    ? katalog
    : (_defaultPhysioKatalog || []);

  if (!liste.length) {
    // Falls noch kein Katalog geladen ist: formales X-Muster akzeptieren
    if (/^[X0-9][0-9]{4}$/.test(sUpper)) {
      return { code: sUpper, bezeichnung: sUpper };
    }
    return null;
  }

  // 1. Direkt Code / X-Code Match (z. B. 'X0501' oder 'X1201')
  let t = liste.find(e => {
    const c = (e.code || e.x || '').toUpperCase();
    return c === sUpper;
  });

  // 2. 5-stellige Abrechnungsnummer (z. B. '20501' -> 'X0501')
  if (!t && /^[1268]\d{4}$/.test(s)) {
    const xCode = 'X' + s.slice(1);
    t = liste.find(e => (e.code || e.x || '').toUpperCase() === xCode);
  }

  // 3. Kürzel Match (z. B. 'KG', 'MT', 'MLD45', 'MLD-45', 'KMT', 'E', 'W', 'K')
  if (!t) {
    t = liste.find(e => {
      const k = (e.kuerzel || '').toUpperCase();
      if (!k) return false;
      return k === sUpper || norm(k) === sNorm;
    });
  }

  // 4. Titel / Label Match (z. B. 'Krankengymnastik Einzel', 'Manuelle Therapie')
  if (!t) {
    t = liste.find(e => {
      const bez = norm(e.title || e.label || '');
      return bez && (bez === sNorm || bez.includes(sNorm) || sNorm.includes(bez));
    });
  }

  if (t) {
    const code = (t.code || t.x || '').toUpperCase();
    const bezeichnung = t.title || t.label || t.kuerzel || code;
    return { code, bezeichnung, treffer: t };
  }
  return null;
}

/**
 * Eine Zeile → Verordnung + Fehler/Hinweise.
 * @param {string[]} werte
 * @param {object} zu  Feld → Spaltenindex
 * @param {{ patienten: object[], vorhandeneVo: Set<string>, heute: string, bereich?: string, katalog?: Array }} k
 */
export function zeileZuVerordnung(werte, zu, k = {}) {
  const normBereich = normalizeBereich(k.bereich || 'podo');
  const w = (f) => (zu[f] != null ? String(werte[zu[f]] ?? '').trim() : '');
  const fehler = [], hinweise = [];

  // Patient — muss im Stamm sein
  let vor = w('vorname'), nach = w('nachname');
  if ((!vor || !nach) && w('vollname')) ({ vor, nach } = teileName(w('vollname')));
  const geburtsdatum = leseDatum(w('geburtsdatum'));
  const kvnrRoh = w('versichertennummer');
  const sNeu = nameGeburtSchluessel({ first_name: vor, last_name: nach, geburtsdatum });
  const treffer = sNeu ? (k.patienten || []).filter(p => nameGeburtSchluessel(p) === sNeu) : [];
  const patient = treffer.length === 1 ? treffer[0] : null;
  if (treffer.length > 1) fehler.push('Mehrere Patienten mit gleichem Namen und Geburtsdatum — bitte von Hand anlegen');
  else if (!patient) fehler.push('Patient nicht im Patientenstamm (Name + Geburtsdatum) — zuerst Patienten importieren');
  const aktenKvnr = String(patient?.versichertennummer ?? '').replace(/\s+/g, '').toUpperCase();
  if (kvnrRoh && aktenKvnr && aktenKvnr !== kvnrRoh.replace(/\s+/g, '').toUpperCase()) hinweise.push('Versichertennummer weicht von der Akte ab (Kassenwechsel?)');

  // Versicherung: Zeile, sonst Patientenakte
  const kvnr = pruefeKvnr(kvnrRoh || patient?.versichertennummer || '');
  if (!kvnr.normalisiert) fehler.push('Versichertennummer fehlt');
  else if (!kvnr.ok) hinweise.push('Versichertennummer auffällig');
  const ikRoh = w('krankenkasse_ik');
  const ik = kartenIkNormalisieren(ikRoh) || kartenIkNormalisieren(patient?.krankenkasse_ik);
  if (ikRoh && !kartenIkNormalisieren(ikRoh)) fehler.push('IK der Krankenkasse nicht 9-stellig');
  const kasse = w('krankenkasse') || patient?.krankenkasse || '';
  if (!ik && !kasse) fehler.push('Krankenkasse fehlt');
  else if (!ik) hinweise.push('Karten-IK fehlt — Abrechnung erst nach Ergänzung');
  const vsRoh = w('versichertenstatus') || patient?.versichertenstatus || '';
  if (vsRoh && !/^[1359]\d{4}$/.test(vsRoh)) hinweise.push('Versichertenstatus ungewöhnlich');

  // Arzt
  const ausstellungsdatum = leseDatum(w('ausstellungsdatum'));
  if (!ausstellungsdatum) fehler.push(w('ausstellungsdatum') ? 'Ausstellungsdatum nicht lesbar' : 'Ausstellungsdatum fehlt');
  const lanr = w('lanr').replace(/\D/g, '');
  if (!/^\d{9}$/.test(lanr) || lanr === LANR_ERSATZWERT) fehler.push('LANR fehlt oder nicht 9-stellig');
  else if (!isValidLanr(lanr)) hinweise.push('LANR-Prüfziffer stimmt nicht');
  const bsnr = w('bsnr').replace(/\D/g, '');
  if (!bsnr) hinweise.push('BSNR fehlt');
  if (zu.unterschrift != null && janein(w('unterschrift')) !== true) fehler.push('Ohne Arztstempel/Unterschrift');

  // Diagnose & Heilmittel
  let dg = null, buchstabe = null, heilmittel = null, anzahl = null;
  let items = [], ergaenzendesHeilmittel = null, ergaenzendEinheiten = null, ergaenzendPosition = null;
  let doppelbehandlung = janein(w('doppelbehandlung')) === true;
  const icd10 = w('icd10').toUpperCase() || null;
  const icd10_2 = w('icd10_2').toUpperCase() || null;
  const diagnoseText = w('diagnose_text') || null;
  if (!icd10 && !diagnoseText) hinweise.push('Ohne ICD und Diagnosetext — vor der Abrechnung ergänzen');

  let nagel = null, wagner = null;

  if (normBereich === 'podo') {
    // Podologie
    dg = normDgCode(w('diagnosegruppe'));
    if (!DG_ERLAUBT.has(dg)) fehler.push(dg ? `Diagnosegruppe „${w('diagnosegruppe')}" ist keine Podologie-Gruppe` : 'Diagnosegruppe fehlt');
    buchstabe = DG_ERLAUBT.has(dg) ? leitBuchstabe(w('leitsymptomatik'), w('heilmittel'), dg) : null;
    heilmittel = buchstabe ? POD_KATALOG[dg]?.[buchstabe] : null;
    if (DG_ERLAUBT.has(dg) && !heilmittel) fehler.push(buchstabe ? `${dg} kennt Leitsymptomatik ${buchstabe}) nicht` : 'Heilmittel/Leitsymptomatik nicht erkennbar');
    if ((dg === 'UI1' || dg === 'UI2') && icd10 && !/^L60\.0/.test(icd10)) hinweise.push('UI verlangt ICD L60.0');

    anzahl = Number.parseInt(w('anzahl'), 10);
    if (!Number.isInteger(anzahl) || anzahl < 1) fehler.push('Anzahl Einheiten fehlt');

    const nagelRoh = w('nagel');
    nagel = leseNagel(nagelRoh);
    if (nagelRoh && !nagel) hinweise.push(`Nagel „${nagelRoh}" nicht erkannt`);
    if ((dg === 'UI1' || dg === 'UI2') && !nagel) hinweise.push('Nagel fehlt (Pflicht vor der Abrechnung)');
    const wRoh = w('wagner_grad');
    wagner = /^[0-5]$/.test(wRoh) ? Number(wRoh) : null;
    if (wRoh && wagner == null) hinweise.push('Wagner-Grad nicht 0–5');
  } else {
    // Physio / Ergo
    const dgRoh = w('diagnosegruppe');
    dg = normDgCode(dgRoh);
    if (!dg) fehler.push('Diagnosegruppe fehlt');

    const rawZeilen = [
      { hm: w('heilmittel_position') || w('heilmittel'), anz: w('anzahl') },
      { hm: w('heilmittel2'), anz: w('anzahl2') },
      { hm: w('heilmittel3'), anz: w('anzahl3') },
      { hm: w('heilmittel4'), anz: w('anzahl4') },
    ];

    const vorrangigeZeilen = [];
    for (const rz of rawZeilen) {
      if (!rz.hm && !rz.anz) continue;
      const geloest = loesePosition(rz.hm, k.katalog);
      if (rz.hm && !geloest) fehler.push(`Heilmittel/Position „${rz.hm}" unbekannt`);
      const einh = Number.parseInt(rz.anz, 10);
      vorrangigeZeilen.push({
        code: geloest ? geloest.code : (rz.hm || ''),
        bezeichnung: geloest ? geloest.bezeichnung : (rz.hm || ''),
        einheiten: Number.isInteger(einh) ? einh : (rz.anz || ''),
        doppelbehandlung,
      });
    }

    const hmErg = w('ergaenzend_heilmittel');
    const anzErg = w('ergaenzend_anzahl');
    let ergZeile = null;
    if (hmErg || anzErg) {
      const geloestErg = loesePosition(hmErg, k.katalog);
      if (hmErg && !geloestErg) fehler.push(`Heilmittel/Position „${hmErg}" unbekannt`);
      const einhErg = Number.parseInt(anzErg, 10);
      ergZeile = {
        code: geloestErg ? geloestErg.code : (hmErg || ''),
        bezeichnung: geloestErg ? geloestErg.bezeichnung : (hmErg || ''),
        einheiten: Number.isInteger(einhErg) ? einhErg : (anzErg || ''),
        doppelbehandlung: false,
      };
      ergaenzendesHeilmittel = ergZeile.bezeichnung;
      ergaenzendPosition = ergZeile.code;
      ergaenzendEinheiten = Number.isInteger(einhErg) ? einhErg : null;
    }

    if (vorrangigeZeilen.length === 0) {
      fehler.push('Heilmittel/Position fehlt');
    }

    const hzCheck = pruefeHeilmittelZeilen({ bereich: normBereich, zeilen: vorrangigeZeilen, ergaenzend: ergZeile });
    fehler.push(...hzCheck.fehler);
    hinweise.push(...hzCheck.warnungen);

    items = vorrangigeZeilen.map(z => ({
      code: z.code || null,
      bezeichnung: z.bezeichnung || null,
      einheiten: Number.isInteger(z.einheiten) ? z.einheiten : (parseInt(z.einheiten, 10) || null),
      doppelbehandlung: !!z.doppelbehandlung,
    }));

    if (items.length > 0) {
      heilmittel = items[0].bezeichnung;
      anzahl = items.reduce((sum, it) => sum + (Number(it.einheiten) || 0), 0);
    }
  }

  // Frequenz: Pflichtangabe vor der Abrechnung. Fehlt sie, ist die Zeile gelb (Hinweis).
  if (!w('frequenz')) {
    hinweise.push('Frequenz fehlt — bitte vor der Abrechnung ergänzen');
  }

  // Erbracht / Abgerechnet
  const dringlich = janein(w('dringlich')) === true;
  const erbrachtRoh = Number.parseInt(w('erbracht'), 10);
  const erbracht = Number.isInteger(erbrachtRoh) && erbrachtRoh > 0 ? erbrachtRoh : 0;
  if (janein(w('abgerechnet')) === true) fehler.push('Im Altsystem schon abgerechnet — nicht übernehmen');

  const frist = ausstellungsdatum ? behandlungsbeginnFrist(ausstellungsdatum, dringlich) : null;
  const ersterTag = leseDatum(w('erster_tag'));
  if (w('erster_tag') && !ersterTag) fehler.push('Erster Behandlungstag nicht lesbar');

  if (normBereich === 'physio' || normBereich === 'ergo') {
    // Kural (gkv-302, wissensbank/SPEC-RULES.md „Übernahme offener VOs"):
    // "geleistet"/"bereits erbracht" sütunu >0 ise satır KIRMIZI
    if (erbracht > 0) {
      fehler.push('Bereits begonnene Verordnungen bitte von Hand anlegen.');
    }
    if (frist && k.heute > frist) fehler.push(`Beginnfrist am ${frist.split('-').reverse().join('.')} abgelaufen (HeilM-RL § 15)`);
  } else {
    // Podologie: Schritt 1 und Schritt 2
    if (erbracht && Number.isInteger(anzahl) && erbracht > anzahl) fehler.push(`Mehr Einheiten erbracht (${erbracht}) als verordnet (${anzahl})`);
    if (!erbracht) {
      if (frist && k.heute > frist) fehler.push(`Beginnfrist am ${frist.split('-').reverse().join('.')} abgelaufen (HeilM-RL § 15)`);
    } else {
      if (ersterTag && frist && ersterTag > frist) fehler.push(`Erster Behandlungstag nach der Beginnfrist (${frist.split('-').reverse().join('.')})`);
      if (ersterTag && ausstellungsdatum && ersterTag < ausstellungsdatum) fehler.push('Erster Behandlungstag vor dem Ausstellungsdatum');
      if (!ersterTag) hinweise.push('Ohne „Erster Behandlungstag" — die Beginnfrist prüft Praxura beim Nachtragen der Tage');
      hinweise.push(`Teilweise erbracht (${erbracht}) — Tage danach je Tag mit „Aus Altsystem übernommen" nachtragen`);
    }
  }

  const zzRoh = w('zuzahlung_alt').replace(/[^\d,.-]/g, '').replace(',', '.');
  const zuzahlungAlt = zzRoh ? Number(zzRoh) : null;
  if (zzRoh && !(zuzahlungAlt >= 0)) fehler.push('Zuzahlung (Altsystem) ist kein Betrag');
  if (erbracht && zuzahlungAlt == null && !janein(w('zuzahlung_befreit')) && normBereich === 'podo') {
    hinweise.push('Im Altsystem kassierte Zuzahlung fehlt — sonst fordert Praxura sie erneut');
  }

  // Regelsatz-Validierung (Entwurf-Erkennung: Höchstmenge, Befunde aus pruefeVerordnung)
  let regelsatz = k.regelsatz || null;
  if (!regelsatz) {
    const fallbackDb = (normBereich === 'physio')
      ? Object.entries(PHYSIO_FALLBACK_HOECHSTMENGE).map(([code, hoechstmenge]) => ({ code, hoechstmenge }))
      : (normBereich === 'podo')
        ? Object.entries(HOECHSTMENGE).map(([code, hoechstmenge]) => ({ code, hoechstmenge }))
        : [];
    regelsatz = regelnFuerBereich(normBereich, fallbackDb);
  }

  let istEntwurf = false;
  let entwurfGrund = '';

  if (regelsatz && dg && Number.isFinite(anzahl) && anzahl > 0) {
    const pruefVo = {
      bereich: normBereich === 'physio' ? 'physiotherapy' : normBereich,
      diagnosegruppe: dg,
      heilmittel: heilmittel || items[0]?.bezeichnung,
      heilmittelPosition: items[0]?.code,
      anzahl,
      frequenz: w('frequenz') || null,
      ausstellungsdatum,
      versichertennummer: kvnr.normalisiert,
      kasseIk: ik,
      arztLanr: lanr,
      arztBsnr: bsnr,
      icd: [icd10, icd10_2].filter(Boolean),
      rezeptart: 'kassen',
    };
    const res = pruefeVerordnung(pruefVo, regelsatz, { heute: k.heute });
    const warnungen = (res?.befunde || []).filter(b => b.schwere === 'warnung');
    for (const wBefund of warnungen) {
      if (wBefund.code === 'PRUEFZIFFER_LANR' && hinweise.some(h => h.includes('LANR'))) continue;
      if (wBefund.code === 'PRUEFZIFFER_KVNR' && hinweise.some(h => h.includes('Versichertennummer'))) continue;
      istEntwurf = true;
      let grund = wBefund.text;
      if (wBefund.code === 'UEBER_HOECHSTMENGE') {
        const hMax = regelsatz?.gruppen?.[dg]?.hoechstmenge || (normBereich === 'podo' ? HOECHSTMENGE[dg] : 6);
        grund = `Höchstmenge überschritten (${dg}: ${anzahl} statt max. ${hMax} Einheiten)`;
      }
      if (!entwurfGrund) entwurfGrund = grund;
      hinweise.push(`wird als Entwurf übernommen: ${grund}`);
    }
  }

  // Schon vorhanden? (Dublettenprüfung)
  const rowCodes = (normBereich === 'physio' || normBereich === 'ergo')
    ? [
        ...(Array.isArray(items) && items.length > 0 ? items.map(it => it.code) : [w('heilmittel_position') || w('heilmittel')]),
        ergaenzendPosition
      ].filter(Boolean)
    : [];

  const schluessel = voImportSchluessel({
    patientId: patient?.id,
    nameGeburt: sNeu,
    ausstellungsdatum,
    codes: rowCodes,
    lanr,
    dg,
    bereich: normBereich,
  });

  let istDublette = false;
  if (schluessel && k.vorhandeneVo && k.vorhandeneVo.has(schluessel)) {
    if (normBereich === 'physio' || normBereich === 'ergo') {
      hinweise.push('Verordnung mit gleicher Position und gleichem Datum existiert bereits (bereits vorhanden) – wird übersprungen');
      istDublette = true;
      // Übersprungene Zeile wird nicht importiert → kein „wird als Entwurf übernommen“ daneben (canli-test 03.11. P3)
      for (let i = hinweise.length - 1; i >= 0; i--) if (hinweise[i].startsWith('wird als Entwurf übernommen')) hinweise.splice(i, 1);
      istEntwurf = false; entwurfGrund = '';
    } else {
      fehler.push('Verordnung ist schon in Praxura (bereits vorhanden)');
    }
  }

  const verordnung = {
    patient, csvName: [nach, vor].filter(Boolean).join(', '), ausstellungsdatum, lanr, bsnr: bsnr || null, arztName: w('arztname') || null,
    dg, buchstabe, heilmittel, icd10, icd10_2, diagnoseText,
    anzahl: Number.isInteger(anzahl) ? anzahl : null, frequenz: w('frequenz') || null,
    hausbesuch: janein(w('hausbesuch')) === true, dringlich, erbracht, ersterTag,
    zuzahlungAlt: Number.isFinite(zuzahlungAlt) ? Math.round(zuzahlungAlt * 100) / 100 : null, zuzahlungAltAm: leseDatum(w('zuzahlung_alt_am')), zuzahlungAltBeleg: w('zuzahlung_alt_beleg') || null,
    bericht: janein(w('bericht')) === true, befreit: janein(w('zuzahlung_befreit')) === true,
    nagel, wagner, ik, kasse, kvnr: kvnr.normalisiert || null, versichertenstatus: vsRoh || null,
    altNr: w('altsystem_vo_nr') || null,
    therapieBereich: normBereich,
    heilmittel_items: items,
    heilmittel_position: items[0]?.code || null,
    doppelbehandlung,
    ergaenzendes_heilmittel: ergaenzendesHeilmittel,
    ergaenzend_position: ergaenzendPosition,
    ergaenzend_einheiten: ergaenzendEinheiten,
  };

  return { verordnung, fehler, hinweise, schluessel, istDublette, istEntwurf, entwurfGrund };
}

/** Ganze Datei prüfen. */
export function pruefeVerordnungen(text, zu, k = {}) {
  const normBereich = normalizeBereich(k.bereich || 'podo');
  const [, ...daten] = leseCsv(text);
  const gesehen = new Map();
  const zeilen = daten.map((werte, i) => {
    const z = { nr: i + 2, ...zeileZuVerordnung(werte, zu, k) };
    if (z.schluessel) {
      if (gesehen.has(z.schluessel)) {
        if (normBereich === 'physio' || normBereich === 'ergo') {
          z.hinweise.push(`doppelt in Datei (Zeile ${gesehen.get(z.schluessel)}) – wird übersprungen`);
          z.istDublette = true;
        } else {
          if (!z.fehler.length) z.fehler.push(`doppelt in Datei (Zeile ${gesehen.get(z.schluessel)})`);
        }
      } else {
        gesehen.set(z.schluessel, z.nr);
      }
    }
    return z;
  });
  return {
    zeilen,
    ok: zeilen.filter(z => !z.fehler.length && !z.istDublette).length,
    gelb: zeilen.filter(z => !z.fehler.length && (z.hinweise.length > 0 || z.istDublette)).length,
    rot: zeilen.filter(z => z.fehler.length > 0).length,
    fehlerhaft: zeilen.filter(z => z.fehler.length > 0).length,
  };
}

/** Rumpf für POST /api/rezept/confirm — über den gemeinsamen Baustein der Maske. */
export function voRumpf(v, heute) {
  const p = v.patient || {};
  const bereich = v.therapieBereich || 'podo';
  return verordnungFuerBackend({
    nutzlast: {
      patient_id: p.id,
      therapie_bereich: bereich,
      ausstellungsdatum: v.ausstellungsdatum,
      doctor_lanr: v.lanr,
      doctor_bsnr: v.bsnr,
      diagnosegruppe: v.dg,
      icd10: v.icd10,
      icd10_2: v.icd10_2,
      diagnose_freitext: v.diagnoseText,
      leitsymptomatik: v.buchstabe ? (LS_CODE[v.buchstabe] || null) : null,
      heilmittel: v.heilmittel,
      heilmittel_feld_text: v.heilmittel,
      heilmittel_position: v.heilmittel_position || null,
      heilmittel_items: v.heilmittel_items || [],
      anzahl_einheiten: v.anzahl,
      ergaenzendes_heilmittel: v.ergaenzendes_heilmittel || null,
      ergaenzend_einheiten: v.ergaenzend_einheiten || null,
      ergaenzend_position: v.ergaenzend_position || null,
      doppelbehandlung: !!v.doppelbehandlung,
      frequenz: v.frequenz,
      is_dringend: v.dringlich,
      hausbesuch: v.hausbesuch,
      zuzahlung_befreit: v.befreit,
      bericht_angefordert: v.bericht,
      unterschrift_vorhanden: true,   // ohne Unterschrift wird die Zeile vorher abgelehnt
      nagel: v.nagel,
      wagner_grad: v.wagner,
      hinweise: `Aus Altsystem übernommen am ${heute.split('-').reverse().join('.')}${v.altNr ? ` (VO-Nr. ${v.altNr})` : ''}.`
        + (v.erbracht ? ` Teilweise im Altsystem erbracht: ${v.erbracht} Einheit(en) — Tage nachtragen.` : ''),
    },
    patientFelder: {
      rzPatVorname: p.first_name || '', rzPatName: p.last_name || '',
      rzPatGeb: p.geburtsdatum || '', rzPatVersNr: v.kvnr || '', rzPatStatus: v.versichertenstatus || '',
      rzPatKasse: v.kasse || '', rzPatKasseIk: v.ik || '', rzArztName: v.arztName || '',
    },
  });
}

export const VO_VORLAGE_CSV = '﻿Nachname;Vorname;Geburtsdatum;Versichertennummer;Versichertenstatus;Krankenkasse;IK Krankenkasse;Ausstellungsdatum;LANR;BSNR;Arzt;Arztstempel/Unterschrift vorhanden;Diagnosegruppe;ICD-10;Diagnose;Leitsymptomatik;Anzahl Einheiten;Frequenz;Hausbesuch;Dringlich;Therapiebericht angefordert;Zuzahlungsbefreit;Nagel;Einheiten schon erbracht;Erster Behandlungstag;Zuzahlung bereits kassiert (EUR);Im Altsystem abgerechnet;VO-Nr\n'
  + 'Muster;Erika;01.02.1950;A123456780;10000;AOK Rheinland/Hamburg;104212505;15.10.2026;123456601;123456700;Dr. Beispiel;ja;DF;E11.74;;c;6;1x in 4-6 Wochen;nein;nein;nein;nein;;0;;;nein;4711\n';

export const VO_VORLAGE_CSV_PHYSIO = '﻿Nachname;Vorname;Geburtsdatum;Versichertennummer;Versichertenstatus;Krankenkasse;IK Krankenkasse;Ausstellungsdatum;LANR;BSNR;Arzt;Arztstempel/Unterschrift vorhanden;Diagnosegruppe;ICD-10;Diagnose;Heilmittel;Anzahl Einheiten;Heilmittel 2;Anzahl Einheiten 2;Ergänzendes Heilmittel;Ergänzende Einheiten;Frequenz;Hausbesuch;Doppelbehandlung;Dringlich;Therapiebericht angefordert;Zuzahlungsbefreit;Einheiten schon erbracht;Im Altsystem abgerechnet;VO-Nr\n'
  + 'Muster;Erika;01.02.1950;A123456780;10000;AOK Rheinland/Hamburg;104212505;15.10.2026;123456601;123456700;Dr. Beispiel;ja;WS;M54.5;;X0501;6;;;;;1-2x wtl.;nein;nein;nein;nein;nein;0;nein;4711\n';

// ── Oberfläche ──────────────────────────────────────────────────────────

const berlinHeute = () => alsBerlinDatum(new Date());

/**
 * @param {{ supabase, ownerId: string, apiBasis: string, bereich?: string, katalog?: Array, bestehende: () => object[], showToast: Function, nachImport: (anzahl:number) => Promise<void>|void }} d
 */
export function oeffneVerordnungImport(d) {
  const normBereich = normalizeBereich(d.bereich || 'podo');
  const bereichLabel = normBereich === 'physio' ? 'Physiotherapie' : (normBereich === 'ergo' ? 'Ergotherapie' : 'Podologie');
  const vorlageCsv = normBereich === 'physio' ? VO_VORLAGE_CSV_PHYSIO : VO_VORLAGE_CSV;
  const vorlageDateiname = normBereich === 'physio' ? 'praxura-verordnungen-vorlage-physio.csv' : 'praxura-verordnungen-vorlage.csv';

  document.getElementById('verordnungImportModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'verordnungImportModal';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="viTitel" style="background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:12px;max-width:820px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px 12px;">
        <h3 id="viTitel" style="margin:0;font-size:18px;">Offene Verordnungen importieren <span style="font-weight:400;color:var(--text-muted);font-size:14px;">· ${esc(bereichLabel)}</span></h3>
        <button type="button" data-pi="zu" aria-label="Schließen" style="background:none;border:none;font-size:22px;color:var(--text-muted);cursor:pointer;">✕</button>
      </div>
      <div data-pi="inhalt" style="padding:0 24px;overflow:auto;flex:1;"></div>
      <div data-pi="fuss" style="display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap;padding:16px 24px;border-top:1px solid var(--border);"></div>
    </div>`;
  document.body.appendChild(modal);

  const inhalt = modal.querySelector('[data-pi="inhalt"]');
  const fuss = modal.querySelector('[data-pi="fuss"]');
  let laeuft = false;
  const schliessen = () => { if (laeuft) return; modal.remove(); document.removeEventListener('keydown', escTaste); };
  const escTaste = (e) => { if (e.key === 'Escape') schliessen(); };
  document.addEventListener('keydown', escTaste);
  modal.querySelector('[data-pi="zu"]').addEventListener('click', schliessen);
  modal.addEventListener('click', (e) => { if (e.target === modal) schliessen(); });

  const schritt1 = () => {
    inhalt.innerHTML = `
      <p style="margin:0 0 10px;color:var(--text-muted);font-size:14px;line-height:1.5;">
        Übernommen werden Verordnungen, die Ihre bisherige Software <b>nicht abrechnet</b>.
        ${normBereich === 'podo'
          ? 'Bei angefangenen tragen Sie danach jeden schon erbrachten Tag mit „Aus Altsystem übernommen" nach (Datum + Position).'
          : 'Bitte beachten Sie: Es können nur Verordnungen übernommen werden, auf die noch keine Einheit erbracht wurde.'}
      </p>
      <p style="margin:0 0 12px;color:var(--text-muted);font-size:14px;line-height:1.5;">
        Die Patienten müssen schon in Praxura sein (zuerst <i>Patienten importieren</i>). Pro Verordnung nötig:
        Ausstellungsdatum, LANR, Diagnosegruppe, Heilmittel bzw. Position, Anzahl.
      </p>
      <label style="display:block;border:1px dashed var(--border);border-radius:8px;padding:28px;text-align:center;cursor:pointer;">
        <input type="file" accept=".csv,.txt,text/csv" data-pi="datei" style="display:none;" />
        <span style="font-weight:600;">CSV-Datei auswählen</span>
      </label>
      <p style="margin:12px 0 16px;font-size:13px;"><a href="#" data-pi="vorlage">Vorlage herunterladen (${esc(bereichLabel)})</a></p>`;
    fuss.innerHTML = `<button type="button" class="btn-ghost" data-pi="abbr" style="${BTN}">Abbrechen</button>`;
    fuss.querySelector('[data-pi="abbr"]').addEventListener('click', schliessen);
    inhalt.querySelector('[data-pi="vorlage"]').addEventListener('click', (e) => {
      e.preventDefault();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([vorlageCsv], { type: 'text/csv;charset=utf-8' }));
      a.download = vorlageDateiname;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    inhalt.querySelector('[data-pi="datei"]').addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const text = await dekodiereDateiText(f);
      const [kopf = [], ...daten] = leseCsv(text);
      if (!kopf.length || !daten.length) { d.showToast('Die Datei enthält keine Zeilen.', 'error'); return; }
      zuordnungsSchritt({
        inhalt, fuss, kopf, daten,
        felder: VO_FELDER, spalten: VO_SPALTEN,
        fehlendePflicht: (zu) => voFehlendePflicht(zu, normBereich),
        pflichtNamen: PFLICHT_PODO,
        merkPraefix: `praxura.import.vo.${normBereich}.zuordnung.`,
        hinweis: 'Fehlen Versichertennummer oder Kasse in der Datei, nimmt Praxura sie aus der Patientenakte.',
        zurueck: schritt1,
        weiter: (zu, wiederZeigen) => vorschau(text, zu, wiederZeigen),
      });
    });
  };

  const vorschau = async (text, zu, zurZuordnung) => {
    inhalt.innerHTML = '<p style="font-size:14px;color:var(--text-muted);">Vorhandene Verordnungen werden abgeglichen …</p>';
    let q = d.supabase.from('prescriptions')
      .select('patient_id, ausstellungsdatum, doctor_lanr, diagnosegruppe, heilmittel_position, ergaenzend_position, heilmittel_items, heilmittel, therapie_bereich')
      .eq('owner_id', d.ownerId);
    if (normBereich) q = q.eq('therapie_bereich', normBereich);
    const { data: vorhanden, error } = await q;
    if (error) { d.showToast('Vorhandene Verordnungen konnten nicht geladen werden.', 'error'); zurZuordnung(); return; }

    const vorhandeneVo = new Set();
    for (const r of vorhanden || []) {
      const key = voImportSchluessel({
        patientId: r.patient_id,
        ausstellungsdatum: r.ausstellungsdatum,
        codes: codesAusVerordnung(r),
        lanr: r.doctor_lanr,
        dg: r.diagnosegruppe,
        bereich: r.therapie_bereich || normBereich,
      });
      if (key) vorhandeneVo.add(key);
    }

    let regelsatz = null;
    if (d.supabase) {
      try {
        regelsatz = await regelsatzLaden(d.supabase, normBereich);
      } catch {
        // Fallback wenn Supabase-Mock in Tests/Probes kein .order() besitzt
      }
    }
    const heute = berlinHeute();
    const erg = pruefeVerordnungen(text, zu, {
      patienten: d.bestehende() || [],
      vorhandeneVo,
      heute,
      bereich: normBereich,
      katalog: d.katalog || null,
      regelsatz,
    });

    const status = (z) => {
      if (z.fehler.length) {
        return `<span style="color:var(--danger,#b42318);font-weight:600;">✕ ${esc(z.fehler.join(' · '))}</span>`;
      }
      if (z.istDublette) {
        return `<span style="color:var(--warning,#b54708);font-weight:600;">⚠ übersprungen · ${esc(z.hinweise.join(' · '))}</span>`;
      }
      if (z.istEntwurf) {
        return `<span style="color:var(--warning,#b54708);font-weight:600;">⚠ ${esc(z.hinweise.join(' · '))}</span>`;
      }
      if (z.hinweise.length) {
        return `<span style="color:var(--warning,#b54708);font-weight:600;">⚠ übernehmen · ${esc(z.hinweise.join(' · '))}</span>`;
      }
      return '<span style="color:var(--success,#027a48);font-weight:600;">✓ übernehmen</span>';
    };

    const reihen = erg.zeilen.slice(0, 200).map(z => {
      const v = z.verordnung;
      const name = v.patient ? `${v.patient.last_name}, ${v.patient.first_name}` : (v.csvName || '—');
      const farbe = z.fehler.length ? 'var(--danger,#b42318)' : ((z.hinweise.length || z.istDublette || z.istEntwurf) ? 'var(--warning,#b54708)' : 'var(--success,#027a48)');
      const hmDetails = v.heilmittel_items?.length > 1
        ? v.heilmittel_items.map(it => `${it.code || it.bezeichnung} (${it.einheiten})`).join(', ')
        : (v.heilmittel_position || v.heilmittel || '');
      return `<tr style="border-top:1px solid var(--border);border-left:3px solid ${farbe};">
        <td style="padding:6px 8px;color:var(--text-muted);">${z.nr}</td>
        <td style="padding:6px 8px;white-space:nowrap;">${esc(name)}</td>
        <td style="padding:6px 8px;white-space:nowrap;">${esc(v.ausstellungsdatum ? v.ausstellungsdatum.split('-').reverse().join('.') : '')}</td>
        <td style="padding:6px 8px;white-space:nowrap;">${esc([v.dg, hmDetails, v.anzahl && 'Σ ' + v.anzahl].filter(Boolean).join(' · '))}</td>
        <td style="padding:6px 8px;">${status(z)}</td></tr>`;
    }).join('');

    const uebernehmbar = erg.zeilen.filter(z => !z.fehler.length && !z.istDublette);

    inhalt.innerHTML = `
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;margin:0 0 12px;font-size:13px;line-height:1.4;font-weight:600;">
        <span style="color:var(--success,#027a48);white-space:nowrap;">${erg.ok} ok</span>
        <span style="color:var(--warning,#b54708);white-space:nowrap;">${erg.gelb} Hinweis</span>
        <span style="color:${erg.rot ? 'var(--danger,#b42318)' : 'var(--text-muted)'};white-space:nowrap;">${erg.rot} Fehler</span>
        <span style="color:var(--text-muted);font-weight:400;white-space:nowrap;">(${uebernehmbar.length} werden übernommen)</span>
      </div>
      <div style="margin:0 0 12px;padding:10px 14px;border-radius:8px;background:var(--bg-card-solid);border:1px solid var(--border);font-size:13px;line-height:1.5;color:var(--text-main);">
        <b>Hinweis:</b> Einwilligungen (E-Mail-Erinnerung, Arztberichte) werden nicht übernommen. Diese Funktionen sind für importierte Patienten erst nach neuer Einwilligung aktiv.
      </div>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;margin-bottom:12px;">
        <table style="width:100%;min-width:600px;border-collapse:collapse;font-size:13px;">
          <thead><tr style="text-align:left;color:var(--text-muted);"><th style="padding:6px 8px;">Zeile</th><th style="padding:6px 8px;">Patient</th><th style="padding:6px 8px;">Ausgestellt</th><th style="padding:6px 8px;">DG / Heilmittel</th><th style="padding:6px 8px;">Ergebnis</th></tr></thead>
          <tbody>${reihen}</tbody>
        </table>
      </div>
      ${erg.zeilen.length > 200 ? `<p style="font-size:13px;color:var(--text-muted);">… und ${erg.zeilen.length - 200} weitere Zeilen.</p>` : ''}
      ${erg.rot > 0 ? `<p style="margin:8px 0 14px;"><button type="button" class="btn-ghost" data-pi="fehler-csv" style="${BTN}font-size:13px;min-height:44px;">Fehlerhafte Zeilen als CSV herunterladen</button></p>` : ''}
      <label style="display:flex;gap:10px;align-items:flex-start;margin:16px 0;padding:12px;border:1px solid var(--border);border-radius:8px;font-size:13px;line-height:1.5;cursor:pointer;">
        <input type="checkbox" data-pi="bestaetigt" style="margin-top:3px;" />
        <span>Ich bestätige: Jede dieser Verordnungen trägt Arztstempel und Unterschrift. Meine bisherige Software rechnet sie <b>nicht</b> ab — abgerechnet wird nur noch über Praxura (sonst Doppelabrechnung).</span>
      </label>`;

    fuss.innerHTML = `
      <button type="button" class="btn-ghost" data-pi="zuordnung" style="${BTN}">Zuordnung ändern</button>
      <button type="button" class="btn-primary" data-pi="los" style="${BTN}opacity:.45;cursor:not-allowed;" disabled>${uebernehmbar.length} Verordnung${uebernehmbar.length === 1 ? '' : 'en'} übernehmen</button>`;

    const los = fuss.querySelector('[data-pi="los"]');
    inhalt.querySelector('[data-pi="bestaetigt"]').addEventListener('change', (e) => {
      const an = e.target.checked && uebernehmbar.length > 0;
      los.disabled = !an;
      los.style.opacity = an ? '' : '.45';
      los.style.cursor = an ? 'pointer' : 'not-allowed';
    });
    fuss.querySelector('[data-pi="zuordnung"]').addEventListener('click', zurZuordnung);
    los.addEventListener('click', () => senden(uebernehmbar, heute));

    inhalt.querySelector('[data-pi="fehler-csv"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      const roteZeilen = erg.zeilen.filter(z => z.fehler.length);
      const csvText = '﻿Zeile;Name;Ausstellungsdatum;Fehler\n' + roteZeilen.map(z => {
        const v = z.verordnung;
        const name = v.patient ? `${v.patient.last_name}, ${v.patient.first_name}` : (v.csvName || '');
        return `${z.nr};"${name.replace(/"/g, '""')}";${v.ausstellungsdatum || ''};"${z.fehler.join(' · ').replace(/"/g, '""')}"`;
      }).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csvText], { type: 'text/csv;charset=utf-8' }));
      a.download = 'abgelehnte-verordnungen.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  };

  const senden = async (zeilen, heute) => {
    laeuft = true;
    let ok = 0;
    const fehlgeschlagen = [];
    const uebersprungen = [];
    const bereitsGesendet = new Set();
    fuss.innerHTML = '';
    for (const [i, z] of zeilen.entries()) {
      inhalt.innerHTML = `<p style="font-size:15px;margin:0 0 16px;">Übernehme Verordnung ${i + 1} von ${zeilen.length} …</p>`;
      try {
        const v = z.verordnung;
        const p = v.patient;
        if (z.schluessel && bereitsGesendet.has(z.schluessel)) {
          uebersprungen.push({ nr: z.nr, grund: 'Bereits im aktuellen Durchlauf übernommen' });
          continue;
        }
        // Sicherheitsnetz: Unmittelbar vor dem Senden prüfen, ob identische VO bereits in der DB existiert
        if (d.supabase && p?.id && v.ausstellungsdatum) {
          const { data: dbCheck } = await d.supabase.from('prescriptions')
            .select('patient_id, ausstellungsdatum, doctor_lanr, diagnosegruppe, heilmittel_position, ergaenzend_position, heilmittel_items, heilmittel, therapie_bereich')
            .eq('owner_id', d.ownerId)
            .eq('patient_id', p.id)
            .eq('ausstellungsdatum', v.ausstellungsdatum);
          const schonDa = (dbCheck || []).some(r => {
            const dbKey = voImportSchluessel({
              patientId: r.patient_id,
              ausstellungsdatum: r.ausstellungsdatum,
              codes: codesAusVerordnung(r),
              lanr: r.doctor_lanr,
              dg: r.diagnosegruppe,
              bereich: r.therapie_bereich || normBereich,
            });
            return dbKey && dbKey === z.schluessel;
          });
          if (schonDa) {
            uebersprungen.push({ nr: z.nr, grund: 'Bereits in Praxura vorhanden' });
            continue;
          }
        }

        const antwort = await sendeAnServer(d.supabase, { methode: 'POST', pfad: '/rezept/confirm', rumpf: voRumpf(z.verordnung, heute), apiBasis: d.apiBasis });
        ok++;
        if (z.schluessel) bereitsGesendet.add(z.schluessel);
        const rxId = antwort?.prescription_id || antwort?.id;
        // Sitzungszeilen anlegen (wie in der Maske saveRezept) — Podologie führt kein Einheiten-Hauptbuch (dashboard.js:5226)
        const istPodo = (z.verordnung.therapieBereich || 'podo') === 'podo';
        if (!istPodo && d.supabase && rxId) {
          await gleicheSitzungenAb({
            supabase: d.supabase,
            prescriptionId: rxId,
            anzahlEinheiten: z.verordnung.anzahl || 0,
            doppelbehandlung: !!z.verordnung.doppelbehandlung,
            items: z.verordnung.heilmittel_items || [],
          });
        }
        // Im Altsystem schon kassierte Zuzahlung als Vermerk (Migration 0086) — Praxura kassiert nur den Rest.
        if (z.verordnung.zuzahlungAlt != null && antwort?.prescription_id) {
          await d.supabase.from('prescriptions').update({
            zuzahlung_altsystem_eur: z.verordnung.zuzahlungAlt,
            zuzahlung_altsystem_am: z.verordnung.zuzahlungAltAm || null,
            zuzahlung_altsystem_beleg: z.verordnung.zuzahlungAltBeleg || null,
          }).eq('id', antwort.prescription_id).eq('owner_id', d.ownerId);
        }
        // Leere Akten-Felder (KVNR, Kasse, IK, Status) aus der Zeile nachtragen
        await verordnungPatientenAbgleich({ supabase: d.supabase, showConfirmModal: async () => false }, {
          ownerId: d.ownerId, patientId: p.id, lead: p, vorname: p.first_name, nachname: p.last_name,
          versichertennummer: v.kvnr, krankenkasse: v.kasse, versichertenstatus: v.versichertenstatus,
          strasse: '', ort: '', geburtsdatum: '', krankenkasseIk: v.ik,
        }).catch(() => { /* Nachtrag ist Komfort — die VO steht */ });
      } catch (err) {
        fehlgeschlagen.push({ nr: z.nr, grund: err?.message || 'Fehler' });
      }
    }
    laeuft = false;
    if (ok) await d.nachImport(ok);
    inhalt.innerHTML = `
      <p style="margin:0 0 12px;font-size:15px;"><b>${ok}</b> Verordnung${ok === 1 ? '' : 'en'} übernommen.</p>
      ${uebersprungen.length ? `<p style="margin:0 0 8px;font-size:14px;color:var(--warning,#b54708);">${uebersprungen.length} bereits vorhanden (übersprungen): ${uebersprungen.map(u => `Zeile ${u.nr}`).join(', ')}</p>` : ''}
      ${fehlgeschlagen.length ? `<p style="margin:0 0 8px;font-size:14px;color:var(--danger,#b42318);">${fehlgeschlagen.length} nicht übernommen:</p>
        <ul style="margin:0 0 12px;padding-left:18px;font-size:13px;">${fehlgeschlagen.map(f => `<li>Zeile ${f.nr}: ${esc(f.grund)}</li>`).join('')}</ul>` : ''}
      <p style="margin:0 0 16px;font-size:13px;color:var(--text-muted);">Übernommene Verordnungen tragen den Hinweis „Aus Altsystem übernommen". Bitte vor dem ersten Termin kurz gegen das Papier prüfen.</p>`;
    fuss.innerHTML = `<button type="button" class="btn-primary" data-pi="fertig" style="${BTN}">Fertig</button>`;
    fuss.querySelector('[data-pi="fertig"]').addEventListener('click', schliessen);
  };

  schritt1();
}
