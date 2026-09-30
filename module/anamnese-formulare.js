/**
 * anamnese-formulare.js — die Anamnese je Fachbereich als DATEN (kein DOM, kein Supabase).
 *
 * Warum es das gibt
 * ─────────────────
 * Kemal, 30.09.2026: Die Anamnese ist je Fachbereich ein eigenes Formular
 * (physio · podo · ergo · logo). Bis dahin gab es ein einziges, physio-lastiges
 * Formular (Schmerzskala, Sport, Beruf) für alle. Die Feldliste der Podologie
 * steht in `Podoloji/PRODUKT-ENTSCHEIDUNGEN.md` → „Podologie-Anamnese: eigenes
 * Formular …" (19 Eingabefelder + Unterfelder, 3 Pflichtfelder, Rozets).
 *
 * Speichermodell (Sitzung B, `anamnese`): je Fachbereich eine Zeile pro
 * Speicherung (append-only, § 630f BGB). Ortsgebundene Werte stehen in den
 * festen Spalten (Terminkarte, Druck und `/rezept/save` lesen sie), alles
 * Fachspezifische in `felder jsonb`. Die Formdefinition lebt HIER, nicht in der
 * Datenbank — `form_version` sagt, mit welcher Fassung geantwortet wurde.
 *
 * Werttypen in `felder` (Kemal-Vorgabe „gerne echte Typen"):
 *   wahl → String (Optionswert) · mehrfach → String[] · zahl/jahr → number ·
 *   datum → 'YYYY-MM-DD' · text → String. Ja/Nein/Unbekannt-Fragen sind BEWUSST
 *   Strings ('ja'|'nein'|'unbekannt'), kein boolean: „unbekannt" ist eine
 *   gültige Antwort und darf nicht wie „nicht beantwortet" (null) aussehen.
 *   Freitext zu einer Auswahl steht als `<id>_text`.
 *
 * Alle Sichtbarkeits-, Pflicht- und Rozet-Regeln sind reine Funktionen — die
 * Tests (anamnese-formulare.test.js) nageln sie fest.
 */

export const FACHBEREICHE = ['physio', 'podo', 'ergo', 'logo'];

export const FACHBEREICH_LABEL = {
  physio: 'Physiotherapie', podo: 'Podologie', ergo: 'Ergotherapie', logo: 'Logopädie',
};

/** `profiles.sector` → Fachbereich der Anamnese. Interdisziplinär/unbekannt → physio (bisheriges Formular). */
export function fachbereichAusSektor(sektor) {
  switch (sektor) {
    case 'podologie': return 'podo';
    case 'ergotherapie': return 'ergo';
    case 'logopaedie': return 'logo';
    default: return 'physio';
  }
}

export const ENTWURF_HINWEIS = 'Entwurf — fachlich noch nicht abgestimmt';

const JNU = [{ w: 'nein', l: 'nein' }, { w: 'ja', l: 'ja' }, { w: 'unbekannt', l: 'unbekannt' }];
const SEITE = [{ w: 'links', l: 'links' }, { w: 'rechts', l: 'rechts' }, { w: 'beide', l: 'beide' }];
const DIABETES_JA = ['typ1', 'typ2', 'andere'];

const istDiabetiker = (f) => DIABETES_JA.includes(f.diabetes);
const diabetesBeantwortetNichtNein = (f) => !!f.diabetes && f.diabetes !== 'nein';

// ───────────────────────────────────────────────────────────────────────────
// Podologie — Feldliste laut PRODUKT-ENTSCHEIDUNGEN.md (30.09.2026)
// ───────────────────────────────────────────────────────────────────────────

const PODO_GRUPPEN = [
  { id: 'A', titel: 'A · Diabetes' },
  { id: 'B', titel: 'B · Fuß-Risiko' },
  { id: 'C', titel: 'C · Medikamente' },
  { id: 'D', titel: 'D · Allergien & Hygiene' },
  { id: 'E', titel: 'E · Alltag' },
  { id: 'F', titel: 'F · Ärzte & Anliegen' },
];

const PODO_FELDER = [
  // A — Diabetes
  {
    id: 'diabetes', gruppe: 'A', typ: 'wahl', label: 'Diabetes mellitus', pflicht: true, spalte: 'vorerkrankungen',
    optionen: [{ w: 'nein', l: 'nein' }, { w: 'typ1', l: 'Typ 1' }, { w: 'typ2', l: 'Typ 2' }, { w: 'andere', l: 'andere Form' }],
    spaltenText: (w, f, feld) => (w === 'nein' ? '' : `Diabetes ${optionLabel(feld, w)}`),
  },
  { id: 'diabetes_seit', gruppe: 'A', typ: 'jahr', label: 'Diabetes seit (Jahr)', sichtbarWenn: istDiabetiker },
  {
    id: 'diabetes_therapie', gruppe: 'A', typ: 'mehrfach', label: 'Therapie', sichtbarWenn: istDiabetiker,
    optionen: [{ w: 'diaet', l: 'Diät' }, { w: 'tabletten', l: 'Tabletten' }, { w: 'insulin', l: 'Insulin' }, { w: 'glp1', l: 'GLP-1 (Spritze)' }],
  },
  { id: 'hba1c_wert', gruppe: 'A', typ: 'zahl', label: 'HbA1c', einheit: '%', min: 3, max: 20, schritt: 0.1, sichtbarWenn: istDiabetiker, mitPodologin: true },
  { id: 'hba1c_datum', gruppe: 'A', typ: 'datum', label: 'HbA1c gemessen am', sichtbarWenn: istDiabetiker, mitPodologin: true },

  // B — Fuß-Risiko: immer sichtbar, Pflicht nur bei Diabetes ≠ nein („unbekannt" zählt als Antwort)
  {
    id: 'neuropathie', gruppe: 'B', typ: 'wahl', label: 'Neuropathie bekannt', optionen: JNU, kurz: 'Neuropathie',
    pflichtWenn: diabetesBeantwortetNichtNein, spalte: 'vorerkrankungen', mitPodologin: true,
  },
  {
    id: 'pavk', gruppe: 'B', typ: 'wahl', label: 'pAVK / Durchblutungsstörung', optionen: JNU, kurz: 'pAVK',
    pflichtWenn: diabetesBeantwortetNichtNein, spalte: 'vorerkrankungen', mitPodologin: true,
  },
  {
    id: 'ulkus', gruppe: 'B', typ: 'wahl', label: 'Früheres Fußulkus', optionen: JNU, kurz: 'früheres Fußulkus',
    pflichtWenn: diabetesBeantwortetNichtNein, spalte: 'vorerkrankungen', mitPodologin: true,
  },
  { id: 'ulkus_seite', gruppe: 'B', typ: 'wahl', label: 'Ulkus — Seite', optionen: SEITE, sichtbarWenn: (f) => f.ulkus === 'ja', unter: true },
  {
    id: 'amputation', gruppe: 'B', typ: 'wahl', label: 'Amputation', optionen: JNU, kurz: 'Amputation',
    pflichtWenn: diabetesBeantwortetNichtNein, spalte: 'vorerkrankungen',
  },
  { id: 'amputation_seite', gruppe: 'B', typ: 'wahl', label: 'Amputation — Seite', optionen: SEITE, sichtbarWenn: (f) => f.amputation === 'ja', unter: true },
  { id: 'amputation_hoehe', gruppe: 'B', typ: 'text', label: 'Amputation — Höhe', sichtbarWenn: (f) => f.amputation === 'ja', unter: true, platzhalter: 'z. B. Zehe, Vorfuß, Unterschenkel' },
  {
    id: 'niere', gruppe: 'B', typ: 'wahl', label: 'Niereninsuffizienz / Dialyse', pflichtWenn: diabetesBeantwortetNichtNein, spalte: 'vorerkrankungen',
    optionen: [{ w: 'nein', l: 'nein' }, { w: 'insuffizienz', l: 'Niereninsuffizienz (ohne Dialyse)' }, { w: 'dialyse', l: 'Dialyse' }, { w: 'unbekannt', l: 'unbekannt' }],
    spaltenText: (w, f, feld) => (w === 'insuffizienz' || w === 'dialyse' ? optionLabel(feld, w) : ''),
  },
  {
    id: 'dialysetage', gruppe: 'B', typ: 'mehrfach', label: 'Dialysetage', sichtbarWenn: (f) => f.niere === 'dialyse', unter: true,
    optionen: [{ w: 'mo', l: 'Mo' }, { w: 'di', l: 'Di' }, { w: 'mi', l: 'Mi' }, { w: 'do', l: 'Do' }, { w: 'fr', l: 'Fr' }, { w: 'sa', l: 'Sa' }],
  },

  // C — Medikamente
  {
    id: 'gerinnung', gruppe: 'C', typ: 'mehrfach', label: 'Gerinnungshemmung', pflicht: true, exklusiv: 'nein', spalte: 'medikamente', kurz: 'Gerinnungshemmung',
    optionen: [
      { w: 'nein', l: 'nein' }, { w: 'ass', l: 'ASS / Clopidogrel' }, { w: 'phenprocoumon', l: 'Phenprocoumon (Marcumar)' },
      { w: 'doak', l: 'DOAK (z. B. Xarelto, Eliquis)' }, { w: 'heparin', l: 'Heparin (Spritze)' },
    ],
    hinweis: 'Bitte das Präparat nennen — der Name ist meist einfacher als „Blutverdünner ja/nein".',
  },
  {
    id: 'weitere_medikamente', gruppe: 'C', typ: 'mehrfach', label: 'Weitere relevante Medikamente', exklusiv: 'keine', text: true, spalte: 'medikamente',
    optionen: [{ w: 'kortison', l: 'Kortison' }, { w: 'immunsuppressiva', l: 'Immunsuppressiva' }, { w: 'chemotherapie', l: 'Chemotherapie' }, { w: 'keine', l: 'keine' }],
  },

  // D — Allergien & Hygiene
  {
    id: 'allergien', gruppe: 'D', typ: 'mehrfach', label: 'Allergien', pflicht: true, exklusiv: 'keine', text: true, spalte: 'allergien', leerText: 'keine Allergien',
    optionen: [
      { w: 'keine', l: 'keine' }, { w: 'latex', l: 'Latex' }, { w: 'desinfektionsmittel', l: 'Desinfektionsmittel' }, { w: 'pflaster', l: 'Pflaster-Kleber' },
      { w: 'lokalanaesthetika', l: 'Lokalanästhetika' }, { w: 'metall', l: 'Metall / Nickel' }, { w: 'salicylsaeure', l: 'Salicylsäure' },
    ],
  },
  {
    // legal-de 30.09.2026: keine Einzeldiagnosen (HIV/Hepatitis) als Auswahl — Art. 9 DSGVO, und der
    // Patient soll nicht am Tablet ein Testergebnis „gestehen". Nur Praxis, nie im Kiosk.
    id: 'infektion', gruppe: 'D', typ: 'wahl', label: 'Übertragbare Infektion', nurPraxis: true, mitPodologin: true,
    optionen: [
      { w: 'nein', l: 'nein' }, { w: 'mrsa', l: 'multiresistenter Erreger (z. B. MRSA)' },
      { w: 'andere', l: 'andere übertragbare Infektion' }, { w: 'unbekannt', l: 'weiß nicht / lieber persönlich besprechen' },
    ],
  },

  // E — Alltag
  {
    id: 'einschraenkungen', gruppe: 'E', typ: 'mehrfach', label: 'Einschränkungen bei Selbstpflege / Mobilität', exklusiv: 'keine', mitPodologin: true,
    optionen: [
      { w: 'keine', l: 'keine' }, { w: 'sehen', l: 'Sehen' }, { w: 'buecken', l: 'Bücken / Fuß erreichen' },
      { w: 'gehhilfe', l: 'Gehhilfe' }, { w: 'rollstuhl', l: 'Rollstuhl' }, { w: 'pflegedienst', l: 'Pflegedienst' },
    ],
  },
  {
    id: 'rauchen', gruppe: 'E', typ: 'wahl', label: 'Rauchen', spalte: 'raucher', spalteTyp: 'bool',
    optionen: [{ w: 'nein', l: 'nein' }, { w: 'ja', l: 'ja' }, { w: 'frueher', l: 'früher' }],
  },

  // F — Ärzte & Anliegen
  { id: 'hausarzt', gruppe: 'F', typ: 'arzt', label: 'Hausarzt', spalten: ['arzt_name', 'arzt_nummer'] },
  { id: 'diabetologe', gruppe: 'F', typ: 'text', label: 'Diabetologe / Fußambulanz', sichtbarWenn: diabetesBeantwortetNichtNein },
  { id: 'anliegen', gruppe: 'F', typ: 'text', label: 'Anliegen des Patienten', spalte: 'hauptbeschwerde', platzhalter: 'ein Satz genügt' },
  { id: 'bemerkungen', gruppe: 'F', typ: 'langtext', label: 'Bemerkungen', spalte: 'notizen' },
];

// ───────────────────────────────────────────────────────────────────────────
// Ergo / Logo — ENTWÜRFE (Vertikal-Reihenfolge: erst Podologie, Feinschliff später)
// ───────────────────────────────────────────────────────────────────────────

const KERN_GRUPPEN = [
  { id: 'A', titel: 'A · Anliegen' },
  { id: 'B', titel: 'B · Gesundheit' },
  { id: 'S', titel: 'C · Fachspezifisch' },
  { id: 'F', titel: 'D · Ärzte & Bemerkungen' },
];

const kern = () => [
  { id: 'hauptanliegen', gruppe: 'A', typ: 'langtext', label: 'Hauptanliegen', spalte: 'hauptbeschwerde' },
  { id: 'vorerkrankungen', gruppe: 'B', typ: 'langtext', label: 'Vorerkrankungen', spalte: 'vorerkrankungen' },
  { id: 'medikamente', gruppe: 'B', typ: 'langtext', label: 'Medikamente', spalte: 'medikamente' },
  { id: 'allergien', gruppe: 'B', typ: 'text', label: 'Allergien', spalte: 'allergien', platzhalter: 'z. B. keine / Latex / …' },
  { id: 'einschraenkungen', gruppe: 'B', typ: 'langtext', label: 'Körperliche Einschränkungen' },
];
const kernAerzte = () => [
  { id: 'hausarzt', gruppe: 'F', typ: 'arzt', label: 'Hausarzt', spalten: ['arzt_name', 'arzt_nummer'] },
  { id: 'bemerkungen', gruppe: 'F', typ: 'langtext', label: 'Bemerkungen', spalte: 'notizen' },
];

const ERGO_FELDER = [
  ...kern(),
  {
    id: 'adl', gruppe: 'S', typ: 'mehrfach', label: 'Alltagsaktivitäten (ADL) mit Einschränkung', exklusiv: 'keine',
    optionen: [
      { w: 'keine', l: 'keine' }, { w: 'waschen', l: 'Waschen / Körperpflege' }, { w: 'anziehen', l: 'An- / Ausziehen' }, { w: 'essen', l: 'Essen / Trinken' },
      { w: 'toilette', l: 'Toilette' }, { w: 'mobilitaet', l: 'Transfer / Mobilität' }, { w: 'haushalt', l: 'Haushalt / Einkaufen' }, { w: 'arbeit', l: 'Beruf / Freizeit' },
    ],
  },
  {
    id: 'hilfsmittel', gruppe: 'S', typ: 'mehrfach', label: 'Hilfsmittel', exklusiv: 'keine', text: true,
    optionen: [
      { w: 'keine', l: 'keine' }, { w: 'rollator', l: 'Rollator / Gehstock' }, { w: 'rollstuhl', l: 'Rollstuhl' },
      { w: 'greifhilfe', l: 'Greif- / Anziehhilfe' }, { w: 'orthese', l: 'Orthese / Schiene' },
    ],
  },
  {
    id: 'kognition', gruppe: 'S', typ: 'wahl', label: 'Kognition / Orientierung',
    optionen: [{ w: 'unauffaellig', l: 'unauffällig' }, { w: 'leicht', l: 'leicht eingeschränkt' }, { w: 'deutlich', l: 'deutlich eingeschränkt' }, { w: 'unbekannt', l: 'unbekannt' }],
  },
  ...kernAerzte(),
];

const LOGO_FELDER = [
  ...kern(),
  {
    id: 'bereiche', gruppe: 'S', typ: 'mehrfach', label: 'Beschwerden betreffen', exklusiv: 'keine',
    optionen: [{ w: 'keine', l: 'keine' }, { w: 'sprache', l: 'Sprache' }, { w: 'sprechen', l: 'Sprechen' }, { w: 'stimme', l: 'Stimme' }, { w: 'schlucken', l: 'Schlucken' }],
  },
  {
    id: 'hoerstatus', gruppe: 'S', typ: 'wahl', label: 'Hörstatus',
    optionen: [{ w: 'unauffaellig', l: 'unauffällig' }, { w: 'eingeschraenkt', l: 'eingeschränkt' }, { w: 'unbekannt', l: 'unbekannt' }],
  },
  { id: 'hoergeraet', gruppe: 'S', typ: 'wahl', label: 'Hörgerät', optionen: [{ w: 'nein', l: 'nein' }, { w: 'ja', l: 'ja' }] },
  { id: 'muttersprache', gruppe: 'S', typ: 'text', label: 'Muttersprache', platzhalter: 'z. B. Deutsch' },
  ...kernAerzte(),
];

// ───────────────────────────────────────────────────────────────────────────
// Physio — das bisherige Formular. Es wird weiter aus dem festen Markup in
// dashboard.html gezeichnet (Verhalten unverändert); diese Definition dient
// nur dem Lesen (Akte, Druck): alle Werte stehen in den festen Spalten.
// ───────────────────────────────────────────────────────────────────────────

const PHYSIO_FELDER = [
  ['hauptbeschwerde', 'Hauptbeschwerde'], ['beschwerde_seit', 'Beschwerde seit'], ['beschwerde_verlauf', 'Verlauf'],
  ['schmerz_skala', 'Schmerz-Skala (0–10)', 'zahl'], ['schmerz_art', 'Schmerzart'], ['vorerkrankungen', 'Vorerkrankungen'],
  ['operationen', 'Operationen'], ['medikamente', 'Medikamente'], ['allergien', 'Allergien'], ['beruf', 'Beruf'],
  ['sport', 'Sport / Bewegung'], ['raucher', 'Raucher', 'bool'], ['diagnose', 'Diagnose'], ['arzt_name', 'Arzt'],
  ['arzt_nummer', 'Arzt-Nummer'], ['rezept_sitzungen', 'Rezept-Sitzungen', 'zahl'], ['hausbesuch', 'Hausbesuch', 'bool'],
  ['besondere_wuensche', 'Besondere Wünsche'], ['notizen', 'Notizen'],
].map(([id, label, typ]) => ({ id, label, typ: typ || 'text', spalte: id, nurSpalte: true, gruppe: 'P' }));

export const FORMULARE = {
  physio: { fachbereich: 'physio', version: 1, titel: 'Anamnese Physiotherapie', entwurf: false, gruppen: [{ id: 'P', titel: 'Anamnese' }], felder: PHYSIO_FELDER },
  podo: { fachbereich: 'podo', version: 1, titel: 'Anamnese Podologie', entwurf: false, gruppen: PODO_GRUPPEN, felder: PODO_FELDER },
  ergo: { fachbereich: 'ergo', version: 1, titel: 'Anamnese Ergotherapie', entwurf: true, gruppen: KERN_GRUPPEN, felder: ERGO_FELDER },
  logo: { fachbereich: 'logo', version: 1, titel: 'Anamnese Logopädie', entwurf: true, gruppen: KERN_GRUPPEN, felder: LOGO_FELDER },
};

export function formular(fachbereich) {
  return FORMULARE[fachbereich] || FORMULARE.physio;
}

// ───────────────────────────────────────────────────────────────────────────
// Regeln
// ───────────────────────────────────────────────────────────────────────────

/** Ist das Feld bei diesem Antwortstand überhaupt sichtbar? (`nurPraxis` regelt der Aufrufer über `kiosk`.) */
export function istSichtbar(feld, felder = {}, { kiosk = false } = {}) {
  if (kiosk && feld.nurPraxis) return false;
  return typeof feld.sichtbarWenn === 'function' ? !!feld.sichtbarWenn(felder) : true;
}

export function sichtbareFelder(def, felder = {}, opt = {}) {
  return def.felder.filter((f) => istSichtbar(f, felder, opt));
}

export function istPflicht(feld, felder = {}) {
  if (feld.pflicht) return true;
  return typeof feld.pflichtWenn === 'function' ? !!feld.pflichtWenn(felder) : false;
}

export function optionLabel(feld, wert) {
  const o = (feld.optionen || []).find((x) => x.w === wert);
  return o ? o.l : String(wert ?? '');
}

/** Leer = nicht beantwortet. „nein" / „keine" / „unbekannt" sind Antworten. */
export function leerWert(wert) {
  if (wert === null || wert === undefined) return true;
  if (typeof wert === 'string') return wert.trim() === '';
  if (Array.isArray(wert)) return wert.length === 0;
  return false;
}

function feldBeantwortet(feld, felder) {
  const w = felder[feld.id];
  if (feld.typ === 'mehrfach' && feld.text) {
    return !leerWert(w) || !leerWert(felder[`${feld.id}_text`]);
  }
  return !leerWert(w);
}

/**
 * Pflichtprüfung. Nur sichtbare Felder zählen; `nurPraxis`-Felder im Kiosk nie.
 * @returns {{id:string,label:string,meldung:string}[]}
 */
export function validiere(def, felder = {}, opt = {}) {
  const fehler = [];
  for (const f of def.felder) {
    if (!istSichtbar(f, felder, opt) || !istPflicht(f, felder)) continue;
    if (!feldBeantwortet(f, felder)) fehler.push({ id: f.id, label: f.label, meldung: `Bitte beantworten: ${f.label}` });
  }
  return fehler;
}

function zuZahl(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Rohantworten aus dem Formular (Strings) → getypte `felder` + abgeleitete Spalten.
 * Unsichtbare Felder fallen weg (sonst bliebe ein „Ulkus Seite: links" stehen, nachdem
 * „Ulkus: nein" gewählt wurde). Exklusive Optionen bereinigen (nur „keine" bleibt, wenn gewählt).
 *
 * @param {object} def
 * @param {object} roh  { [feldId]: string | string[] | {name,telefon} }, `<id>_text` für Freitext
 * @returns {{felder:object, spalten:object}}
 */
export function antwortAusForm(def, roh = {}, opt = {}) {
  const felder = {};
  // Zwei Durchläufe: Sichtbarkeit hängt von anderen Antworten ab (Diabetes → Therapie).
  const vorlaeufig = {};
  for (const f of def.felder) {
    if (f.typ === 'arzt') continue;
    const w = roh[f.id];
    if (f.typ === 'mehrfach') vorlaeufig[f.id] = Array.isArray(w) ? w.filter(Boolean) : [];
    else if (f.typ === 'zahl' || f.typ === 'jahr') vorlaeufig[f.id] = zuZahl(w);
    else vorlaeufig[f.id] = typeof w === 'string' ? w.trim() : w;
  }
  const spalten = {};
  for (const f of def.felder) {
    if (!istSichtbar(f, vorlaeufig, opt)) continue;
    if (f.typ === 'arzt') {
      const a = roh[f.id] || {};
      const [nameSp, telSp] = f.spalten;
      spalten[nameSp] = (a.name || '').trim() || null;
      spalten[telSp] = (a.telefon || '').trim() || null;
      continue;
    }
    let w = vorlaeufig[f.id];
    if (f.typ === 'mehrfach' && f.exklusiv && w.includes(f.exklusiv)) w = [f.exklusiv];
    if (f.typ === 'zahl' || f.typ === 'jahr') {
      if (w === null) continue;
      if (f.min != null && w < f.min) continue;
      if (f.max != null && w > f.max) continue;
    }
    if (!leerWert(w)) felder[f.id] = w;
    if (f.typ === 'mehrfach' && f.text) {
      const t = typeof roh[`${f.id}_text`] === 'string' ? roh[`${f.id}_text`].trim() : '';
      if (t) felder[`${f.id}_text`] = t;
    }
  }
  Object.assign(spalten, spaltenAusFelder(def, felder));
  return { felder, spalten };
}

function spaltenTeil(feld, felder) {
  const w = felder[feld.id];
  const text = felder[`${feld.id}_text`];
  if (leerWert(w) && leerWert(text)) return '';
  if (feld.spaltenText) return feld.spaltenText(w, felder, feld) || '';
  switch (feld.typ) {
    case 'wahl': {
      if (['nein', 'keine', 'unbekannt'].includes(w)) return '';
      if (w === 'ja') return feld.kurz || feld.label;
      return `${feld.kurz || feld.label}: ${optionLabel(feld, w)}`;
    }
    case 'mehrfach': {
      const labels = (Array.isArray(w) ? w : []).filter((x) => x !== feld.exklusiv).map((x) => optionLabel(feld, x));
      if (text) labels.push(text);
      if (!labels.length) return (Array.isArray(w) && w.includes(feld.exklusiv) && feld.leerText) || '';
      return `${feld.kurz ? feld.kurz + ': ' : ''}${labels.join(', ')}`;
    }
    case 'text': case 'langtext': return String(w ?? '');
    default: return '';
  }
}

/**
 * Feste Spalten, die Terminkarte / Druck / `/rezept/save` weiter lesen.
 * Mehrere Felder können in dieselbe Textspalte laufen (Gerinnung + weitere → `medikamente`).
 */
export function spaltenAusFelder(def, felder = {}) {
  const teile = {};
  const out = {};
  for (const f of def.felder) {
    if (!f.spalte || f.nurSpalte || f.typ === 'arzt') continue;
    if (!istSichtbar(f, felder)) continue;
    if (f.spalteTyp === 'bool') { if (!leerWert(felder[f.id])) out[f.spalte] = felder[f.id] === 'ja'; continue; }
    const t = spaltenTeil(f, felder);
    if (t) (teile[f.spalte] ||= []).push(t);
  }
  for (const [sp, arr] of Object.entries(teile)) out[sp] = arr.join('; ');
  return out;
}

/** Wert eines Feldes für die Anzeige — aus `felder`, bei Spalten-Formularen (physio) aus der Zeile. */
export function anzeigeWert(feld, row = {}) {
  const felder = row.felder || {};
  if (feld.typ === 'arzt') {
    const [n, t] = feld.spalten;
    return [row[n], row[t]].filter(Boolean).join(' · ');
  }
  if (feld.nurSpalte) {
    const w = row[feld.spalte];
    if (feld.typ === 'bool') return w == null ? '' : (w ? 'Ja' : 'Nein');
    return w == null ? '' : String(w);
  }
  const w = felder[feld.id];
  const text = felder[`${feld.id}_text`];
  const teile = [];
  switch (feld.typ) {
    case 'wahl': if (!leerWert(w)) teile.push(optionLabel(feld, w)); break;
    case 'mehrfach': if (Array.isArray(w)) w.forEach((x) => teile.push(optionLabel(feld, x))); break;
    case 'zahl': if (w != null) teile.push(String(w).replace('.', ',') + (feld.einheit ? ` ${feld.einheit}` : '')); break;
    case 'datum': if (w) teile.push(String(w).split('-').reverse().join('.')); break;
    default: if (!leerWert(w)) teile.push(String(w));
  }
  if (text) teile.push(text);
  return teile.join(', ');
}

/**
 * Lesbare Zeilen einer gespeicherten Anamnese, in Formularreihenfolge.
 * Pflichtfelder ohne Antwort erscheinen als „—", sonstige leere entfallen.
 * @returns {{id:string,label:string,text:string,gruppe:string}[]}
 */
export function anzeigeZeilen(def, row = {}) {
  const felder = row.felder || {};
  const out = [];
  for (const f of def.felder) {
    if (!f.nurSpalte && !istSichtbar(f, felder)) continue;
    const text = anzeigeWert(f, row);
    if (!text && !(f.pflicht && !f.nurSpalte)) continue;
    out.push({ id: f.id, label: f.label, text: text || '—', gruppe: f.gruppe });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// Speichern: INSERT-Nutzlast und „unverändert bestätigen"
// ───────────────────────────────────────────────────────────────────────────

/**
 * Nutzlast für `INSERT INTO anamnese`. `version`, `ist_aktuell` und `geprueft_*`
 * stehen bewusst NICHT drin — sie vergibt der Trigger (`anamnese_versionieren`).
 */
export function baueInsert({ def, ownerId, patientId, aufnahmedatum, felder, spalten, quelle, userId }) {
  return {
    ...spalten,
    owner_id: ownerId,
    patient_id: patientId,
    aufnahmedatum: aufnahmedatum || null,
    fachbereich: def.fachbereich,
    felder: felder || {},
    form_version: def.version,
    quelle: quelle === 'kiosk' ? 'kiosk' : 'praxis',
    created_by: userId || null,
  };
}

const KOPIE_WEGLASSEN = ['id', 'created_at', 'updated_at', 'updated_by', 'version', 'ist_aktuell', 'geprueft_am', 'geprueft_von', 'uebernommen_von', 'quelle'];

/**
 * „Anamnese unverändert bestätigen" (Folgeverordnung): Kopie des gültigen Standes als
 * neue Version. Kein UPDATE — die Zeile ist § 630f-fest. `uebernommen_von` hält die Herkunft.
 */
export function bestaetigungsKopie(row, { userId, heute } = {}) {
  if (!row?.id) return null;
  const kopie = {};
  for (const [k, v] of Object.entries(row)) if (!KOPIE_WEGLASSEN.includes(k)) kopie[k] = v;
  return {
    ...kopie,
    aufnahmedatum: heute || kopie.aufnahmedatum || null,
    quelle: 'praxis',
    uebernommen_von: row.id,
    created_by: userId || null,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Rozets (Podologie) — Farben laut podoloji-Tabelle 30.09.2026
// ───────────────────────────────────────────────────────────────────────────

/** Höchstens so viele Rozets werden einzeln gezeigt; der Rest wird „+n". */
export const ROZET_MAX = 3;

const ROT = 'rot';
const ORANGE = 'orange';

/**
 * Warnzeichen aus den `felder` einer PODO-Anamnese, nach Schwere sortiert (rot vor orange).
 * Nur die gültige Podo-Fassung darf hierhin — nie `befund.risiken` (Konsey/db-ustasi 30.09.).
 * Infektion erscheint ausschließlich als neutrales „Hygiene" (Diagnose gehört nicht auf den Bildschirm).
 *
 * @returns {{key:string,label:string,stufe:'rot'|'orange'}[]}
 */
export function rozetsAusFelder(felder = {}) {
  const rot = [];
  const orange = [];
  const g = Array.isArray(felder.gerinnung) ? felder.gerinnung : [];
  if (g.some((x) => ['phenprocoumon', 'doak', 'heparin'].includes(x))) rot.push({ key: 'gerinnung', label: 'Gerinnungshemmung', stufe: ROT });
  else if (g.includes('ass')) orange.push({ key: 'gerinnung_ass', label: 'ASS / Clopidogrel', stufe: ORANGE });

  const a = Array.isArray(felder.allergien) ? felder.allergien : [];
  const aRot = [['latex', 'Latex'], ['desinfektionsmittel', 'Desinfektionsmittel'], ['pflaster', 'Pflaster'], ['metall', 'Metall / Nickel']]
    .filter(([w]) => a.includes(w)).map(([, l]) => l);
  if (aRot.length) rot.push({ key: 'allergie', label: `Allergie: ${aRot.join(', ')}`, stufe: ROT });
  // Nicht in der podoloji-Tabelle, aber fachlich naheliegend (Anästhesie / Hornhautabtrag): orange.
  const aOr = [['lokalanaesthetika', 'Lokalanästhetika'], ['salicylsaeure', 'Salicylsäure']].filter(([w]) => a.includes(w)).map(([, l]) => l);
  if (aOr.length) orange.push({ key: 'allergie_weitere', label: `Allergie: ${aOr.join(', ')}`, stufe: ORANGE });

  if (felder.ulkus === 'ja') rot.push({ key: 'ulkus', label: 'Z. n. Ulkus', stufe: ROT });
  if (felder.amputation === 'ja') rot.push({ key: 'amputation', label: 'Amputation', stufe: ROT });
  if (felder.niere === 'dialyse') rot.push({ key: 'dialyse', label: 'Dialyse', stufe: ROT });
  if (felder.pavk === 'ja') rot.push({ key: 'pavk', label: 'pAVK', stufe: ROT });

  if (felder.neuropathie === 'ja') orange.push({ key: 'neuropathie', label: 'Neuropathie', stufe: ORANGE });
  const w = Array.isArray(felder.weitere_medikamente) ? felder.weitere_medikamente : [];
  if (w.some((x) => ['kortison', 'immunsuppressiva', 'chemotherapie'].includes(x))) orange.push({ key: 'immun', label: 'Immunsuppression / Kortison', stufe: ORANGE });
  if (['mrsa', 'andere'].includes(felder.infektion)) orange.push({ key: 'hygiene', label: 'Hygiene', stufe: ORANGE });
  return [...rot, ...orange];
}

/** Die ersten `max` Rozets, der Rest als Zahl. */
export function begrenzeRozets(liste, max = ROZET_MAX) {
  return { sichtbar: liste.slice(0, max), mehr: Math.max(0, liste.length - max) };
}

/**
 * Engmaschige Hinweisregel (kein Block): Verordnung mit Diagnosegruppe DF, aber die Anamnese sagt
 * „Diabetes: nein" oder lässt es leer. `row` = gültige Podo-Anamnese oder null (dann gibt es
 * stattdessen die „Anamnese fehlt"-Notiz — kein zweiter Hinweis).
 */
export const DIABETES_KONFLIKT_NOTIZ = 'Die Verordnung hat die Diagnosegruppe DF (diabetisches Fußsyndrom), die Anamnese nennt aber keinen Diabetes. Bitte prüfen.';
export function konsistenzHinweis({ dgWurzel, row }) {
  if (dgWurzel !== 'DF' || !row) return '';
  const d = row.felder?.diabetes;
  return (!d || d === 'nein') ? DIABETES_KONFLIKT_NOTIZ : '';
}

// ───────────────────────────────────────────────────────────────────────────
// Übergang: Fußbefund ⇄ Anamnese (Risiko-Block wird Nur-Lese-Anzeige)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Kopie der Dauerrisiken für `pat_fussbefund.befund.risiken`. Die vier alten Schlüssel bleiben
 * (Listenanzeige, alte Leser), dazu die Herkunft. Der Befund bleibt ein vollständiger Schnappschuss.
 * Ohne Anamnese → `null` (Aufrufer lässt die alten Schlüssel weg).
 */
export function risikoKopie(row) {
  if (!row?.id) return null;
  const f = row.felder || {};
  const nichtNein = (arr, neg) => Array.isArray(arr) && arr.some((x) => x !== neg);
  return {
    diabetes: DIABETES_JA.includes(f.diabetes),
    allergien: nichtNein(f.allergien, 'keine') || !leerWert(f.allergien_text),
    infektionskrankheiten: ['mrsa', 'andere'].includes(f.infektion),
    gerinnungshemmer: nichtNein(f.gerinnung, 'nein'),
    anamnese_id: row.id,
    anamnese_version: row.version ?? null,
  };
}

/**
 * Vorschläge aus einem ALTEN Fußbefund (`befund.risiken`) für die neue Podo-Anamnese.
 * Nie still übernommen: jede Zeile trägt `text`; nur eindeutig abbildbare Antworten haben `wert`
 * (dann „Übernehmen"-Knopf). „ja" lässt Typ/Präparat offen — dort bleibt es beim Hinweis.
 *
 * @returns {Record<string,{text:string, wert?:string|string[]}>}
 */
export function vorschlaegeAusRisiken(risiken) {
  const out = {};
  if (!risiken || typeof risiken !== 'object') return out;
  const bool = (k) => (typeof risiken[k] === 'boolean' ? risiken[k] : null);
  const d = bool('diabetes'); const g = bool('gerinnungshemmer'); const a = bool('allergien'); const i = bool('infektionskrankheiten');
  if (d === false) out.diabetes = { text: 'Diabetes: nein', wert: 'nein' };
  else if (d === true) out.diabetes = { text: 'Diabetes: ja — Typ bitte wählen' };
  if (g === false) out.gerinnung = { text: 'Gerinnungshemmer: nein', wert: ['nein'] };
  else if (g === true) out.gerinnung = { text: 'Gerinnungshemmer: ja — Präparat bitte wählen' };
  if (a === false) out.allergien = { text: 'Allergien: keine', wert: ['keine'] };
  else if (a === true) out.allergien = { text: 'Allergien: ja — bitte angeben' };
  if (i === false) out.infektion = { text: 'Infektionskrankheit: nein', wert: 'nein' };
  else if (i === true) out.infektion = { text: 'Infektionskrankheit: ja — bitte einordnen' };
  return out;
}

/** Kiosk-Hinweis zu Feldern, die die Podologin sonst mit dem Patienten klärt. */
export function kioskHinweis(feld) {
  if (!feld.mitPodologin) return '';
  const hatWeissNicht = feld.typ === 'wahl' && (feld.optionen || []).some((o) => o.w === 'unbekannt');
  return hatWeissNicht
    ? 'Wenn Sie unsicher sind, wählen Sie „weiß nicht" — wir besprechen das gemeinsam.'
    : 'Wenn Sie unsicher sind, lassen Sie das Feld frei — wir besprechen das gemeinsam.';
}

/** Im Kiosk heißt „unbekannt" für den Patienten „weiß nicht". */
export function kioskOptionLabel(feld, opt, kiosk) {
  if (kiosk && opt.w === 'unbekannt' && feld.mitPodologin) return 'weiß nicht';
  return opt.l;
}

// ───────────────────────────────────────────────────────────────────────────
// Fußbefund-Risikoblock (Nur-Lese-Anzeige aus der Anamnese)
// ───────────────────────────────────────────────────────────────────────────

/** Diese Felder zeigt der Risikoblock des Fußbefunds (Kern der alten vier Checkboxen + die Fuß-Risiken). */
export const RISIKO_FELDER = ['diabetes', 'neuropathie', 'pavk', 'ulkus', 'amputation', 'niere', 'gerinnung', 'allergien', 'infektion'];

/** Beantwortete Risikofelder der gültigen Podo-Anamnese als Zeilen. Leere/`null` → []. */
export function risikoZeilen(row) {
  if (!row) return [];
  return anzeigeZeilen(FORMULARE.podo, row)
    .filter((z) => RISIKO_FELDER.includes(z.id) && z.text !== '—')
    .map(({ label, text }) => ({ label, text }));
}

/**
 * Hinweis zu einem GEÖFFNETEN Befund, dessen gespeicherte Kopie vom aktuellen Anamnese-Stand abweicht
 * (Befund = Schnappschuss, wird nie umgeschrieben — nur erklärt). Leer, wenn nichts zu sagen ist.
 */
export function befundRisikoHinweis(befundRisiken, aktuelleRow) {
  if (!befundRisiken || typeof befundRisiken !== 'object' || !Object.keys(befundRisiken).length) return '';
  if (befundRisiken.anamnese_id) {
    if (aktuelleRow && aktuelleRow.id !== befundRisiken.anamnese_id) {
      return `Dieser Befund trägt den Stand der Anamnese Version ${befundRisiken.anamnese_version ?? '?'} — inzwischen gibt es Version ${aktuelleRow.version ?? '?'}.`;
    }
    return '';
  }
  const alt = [['diabetes', 'Diabetes'], ['allergien', 'Allergien'], ['infektionskrankheiten', 'Infektionskrankheiten'], ['gerinnungshemmer', 'Gerinnungshemmer']]
    .filter(([k]) => befundRisiken[k] === true).map(([, l]) => l);
  return alt.length ? `Im Befund (vor der Anamnese-Umstellung) angekreuzt: ${alt.join(', ')}.` : '';
}
