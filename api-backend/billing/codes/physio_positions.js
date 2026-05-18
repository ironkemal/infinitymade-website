// Physiotherapie Positionsnummern + Preise (Bundesvertrag §125 SGB V).
// Source: handbücher/20251201_Physiotherapie_Vertrag_125_Anlage_2_barrierefrei.pdf
// Valid from 2026-01-01. Prices bundeseinheitlich (federal uniform).
//
// IMPORTANT: PDF lists positions with leading 'X' placeholder. The first
// digit is substituted per Leistungserbringergruppe:
//   1 = Masseur (Abrechnungscode 21)
//   2 = Physiotherapeut (Abrechnungscode 22)  ← our default
//   6 = Krankenhaus (Abrechnungscode 27)
//   8 = Kurort-Vorsorge (Abrechnungscode 28)
// Code 21901 / 21904 (Geburtsvorbereitung / Rückbildung) are already numeric
// (no X) and tied to Hebammenhilfevertrag §134a SGB V.

const PHYSIO_PREFIX = '2';  // Abrechnungscode 22 → first digit 2

export const PHYSIO_POSITIONS = Object.freeze([
  // Massage (X01xx)
  { x:'X0102', label:'Unterwasserdruckstrahlmassage',      preis:33.75, zuzahlung:3.38, dauer:'15-20', kat:'Massage' },
  { x:'X0106', label:'Klassische Massagetherapie (KMT)',   preis:21.63, zuzahlung:2.16, dauer:'15-20', kat:'Massage' },
  { x:'X0107', label:'Bindegewebsmassage (BGM)',           preis:25.98, zuzahlung:2.60, dauer:'20-30', kat:'Massage' },
  { x:'X0108', label:'Segment-/Periost-/Colonmassage',     preis:21.63, zuzahlung:2.16, dauer:'15-20', kat:'Massage' },
  // Lymphdrainage (X02xx)
  { x:'X0201', label:'MLD 45 Min (Großbehandlung)',        preis:53.94, zuzahlung:5.39, dauer:'45',    kat:'Lymphdrainage' },
  { x:'X0202', label:'MLD 60 Min (Ganzbehandlung)',        preis:71.94, zuzahlung:7.19, dauer:'60',    kat:'Lymphdrainage' },
  { x:'X0204', label:'Kompressionsbandagierung',           preis:22.92, zuzahlung:2.29, dauer:null,    kat:'Lymphdrainage' },
  { x:'X0205', label:'MLD 30 Min (Teilbehandlung)',        preis:35.97, zuzahlung:3.60, dauer:'30',    kat:'Lymphdrainage' },
  // Übungsbehandlung (X03xx-X04xx)
  { x:'X0301', label:'Übungsbehandlung Einzel',            preis:13.68, zuzahlung:1.37, dauer:'10-20', kat:'Übungsbehandlung' },
  { x:'X0305', label:'Übungsbehandlung Bewegungsbad Einzel', preis:32.88, zuzahlung:3.29, dauer:'20-30', kat:'Übungsbehandlung' },
  { x:'X0306', label:'Chirogymnastik Einzel',              preis:20.43, zuzahlung:2.04, dauer:'15-20', kat:'Übungsbehandlung' },
  { x:'X0401', label:'Übungsbehandlung Gruppe (2-5)',      preis: 8.43, zuzahlung:0.84, dauer:'10-20', kat:'Übungsbehandlung', gruppe:true },
  { x:'X0402', label:'Übungsbehandlung Bewegungsbad Gruppe (2-3)', preis:24.00, zuzahlung:2.40, dauer:'20-30', kat:'Übungsbehandlung', gruppe:true },
  { x:'X0405', label:'Übungsbehandlung Bewegungsbad Gruppe (4-5)', preis:16.28, zuzahlung:1.63, dauer:'20-30', kat:'Übungsbehandlung', gruppe:true },
  // Krankengymnastik (X05xx-X06xx)
  { x:'X0501', label:'Allgemeine Krankengymnastik (KG) Einzel', preis:29.63, zuzahlung:2.96, dauer:'15-25', kat:'Krankengymnastik' },
  { x:'X0521', label:'KG Einzel telemedizinisch',          preis:29.63, zuzahlung:2.96, dauer:'15-25', kat:'Krankengymnastik', telemed:true },
  { x:'X0507', label:'KG-Gerät parallel bis 3 Patienten',  preis:55.81, zuzahlung:5.58, dauer:'60',    kat:'KG-Gerät' },
  { x:'X0601', label:'KG Gruppe (2-5)',                    preis:13.26, zuzahlung:1.33, dauer:'20-30', kat:'Krankengymnastik', gruppe:true },
  { x:'X0621', label:'KG Gruppe (2-5) telemedizinisch',    preis:13.26, zuzahlung:1.33, dauer:'20-30', kat:'Krankengymnastik', gruppe:true, telemed:true },
  // KG-Muko (X07xx)
  { x:'X0702', label:'KG-Muko Einzel',                     preis:88.94, zuzahlung:8.89, dauer:'60',    kat:'KG-Atemtherapie' },
  { x:'X0722', label:'KG-Muko Einzel telemedizinisch',     preis:88.94, zuzahlung:8.89, dauer:'60',    kat:'KG-Atemtherapie', telemed:true },
  // KG-ZNS Kinder (X07xx) — keine Zuzahlung
  { x:'X0708', label:'KG-ZNS Kinder Bobath Einzel',        preis:58.83, zuzahlung:null, dauer:'30-45', kat:'KG-ZNS-Kinder' },
  { x:'X0728', label:'KG-ZNS Kinder Bobath telemedizinisch', preis:58.83, zuzahlung:null, dauer:'30-45', kat:'KG-ZNS-Kinder', telemed:true },
  { x:'X0709', label:'KG-ZNS Kinder Vojta Einzel',         preis:58.83, zuzahlung:null, dauer:'30-45', kat:'KG-ZNS-Kinder' },
  // KG-ZNS Erwachsene (X07xx)
  { x:'X0710', label:'KG-ZNS Bobath Erwachsene Einzel',    preis:47.06, zuzahlung:4.71, dauer:'25-35', kat:'KG-ZNS' },
  { x:'X0720', label:'KG-ZNS Bobath telemedizinisch',      preis:47.06, zuzahlung:4.71, dauer:'25-35', kat:'KG-ZNS', telemed:true },
  { x:'X0711', label:'KG-ZNS Vojta Erwachsene Einzel',     preis:47.06, zuzahlung:4.71, dauer:'25-35', kat:'KG-ZNS' },
  { x:'X0712', label:'KG-ZNS PNF Einzel',                  preis:47.06, zuzahlung:4.71, dauer:'25-35', kat:'KG-ZNS' },
  // KG Gruppe cerebral Kinder (X08xx) — keine Zuzahlung
  { x:'X0805', label:'KG Gruppe cerebral Kinder (2-4)',    preis:16.57, zuzahlung:null, dauer:'20-30', kat:'KG-ZNS-Kinder', gruppe:true },
  // KG Bewegungsbad (X09xx, X10xx)
  { x:'X0902', label:'KG Bewegungsbad Einzel',             preis:33.87, zuzahlung:3.39, dauer:'20-30', kat:'Krankengymnastik' },
  { x:'X1004', label:'KG Bewegungsbad Gruppe (2-3)',       preis:24.16, zuzahlung:2.42, dauer:'20-30', kat:'Krankengymnastik', gruppe:true },
  { x:'X1005', label:'KG Bewegungsbad Gruppe (4-5)',       preis:15.97, zuzahlung:1.60, dauer:'20-30', kat:'Krankengymnastik', gruppe:true },
  // Traktion + MT (X11xx, X12xx)
  { x:'X1104', label:'Traktionsbehandlung mit Gerät',      preis: 8.63, zuzahlung:0.86, dauer:'10-20', kat:'Traktion' },
  { x:'X1201', label:'Manuelle Therapie Einzel',           preis:35.59, zuzahlung:3.56, dauer:'15-25', kat:'Manuelle Therapie' },
  { x:'X1221', label:'Manuelle Therapie telemedizinisch',  preis:35.59, zuzahlung:3.56, dauer:'15-25', kat:'Manuelle Therapie', telemed:true },
  // Elektrotherapie (X13xx)
  { x:'X1302', label:'Elektrotherapie Einzel',             preis: 8.43, zuzahlung:0.84, dauer:'10-20', kat:'Elektrotherapie' },
  { x:'X1303', label:'Elektrostimulation bei Paresen',     preis:18.70, zuzahlung:1.87, dauer:'5-10',  kat:'Elektrotherapie' },
  { x:'X1310', label:'Hydroelektrisches Teilbad (Zwei-/Vierzellenbad)', preis:14.48, zuzahlung:1.45, dauer:'10-20', kat:'Elektrotherapie' },
  { x:'X1312', label:'Hydroelektrisches Vollbad (Stangerbad)', preis:27.61, zuzahlung:2.76, dauer:'10-20', kat:'Elektrotherapie' },
  // Wärmetherapie / Kältetherapie (X15xx)
  { x:'X1501', label:'Warmpackung',                        preis:16.16, zuzahlung:1.62, dauer:'20-30', kat:'Wärmetherapie' },
  { x:'X1517', label:'Wärmetherapie Heißluft',             preis: 7.43, zuzahlung:0.74, dauer:'10-20', kat:'Wärmetherapie' },
  { x:'X1530', label:'Heiße Rolle',                        preis:13.47, zuzahlung:1.35, dauer:'10-15', kat:'Wärmetherapie' },
  { x:'X1531', label:'Ultraschall-Wärmetherapie',          preis:14.66, zuzahlung:1.47, dauer:'10-20', kat:'Wärmetherapie' },
  { x:'X1532', label:'Peloid-Vollbad',                     preis:55.39, zuzahlung:5.54, dauer:'15-45', kat:'Wärmetherapie' },
  { x:'X1533', label:'Peloid-Teilbad',                     preis:42.84, zuzahlung:4.28, dauer:'15-45', kat:'Wärmetherapie' },
  { x:'X1534', label:'Kältetherapie',                      preis:11.95, zuzahlung:1.20, dauer:'5-10',  kat:'Kältetherapie' },
  // Bäder (X17xx)
  { x:'X1714', label:'Kohlensäurebad',                     preis:27.72, zuzahlung:2.77, dauer:'10-20', kat:'Bäder' },
  { x:'X1732', label:'CO2-Trockenbad Voll-/Dreiviertel-/Halbbad', preis:26.30, zuzahlung:2.63, dauer:'10-20', kat:'Bäder' },
  { x:'X1733', label:'CO2-Trockenbad Teilbad',             preis:26.30, zuzahlung:2.63, dauer:'45-60', kat:'Bäder' },
  // Inhalation (X18xx)
  { x:'X1801', label:'Inhalationstherapie',                preis:12.34, zuzahlung:1.23, dauer:'5-30',  kat:'Inhalation' },
  // Bericht (X1906)
  { x:'X1906', label:'Physiotherapeutischer Bericht (auf Anforderung)', preis:67.69, zuzahlung:null, dauer:null, kat:'Bericht' },
  // Standardisierte Heilmittelkombination D1 (X20xx)
  { x:'X2001', label:'D1 Standardisierte Heilmittelkombination', preis:70.45, zuzahlung:7.05, dauer:'60', kat:'Standard-HM-Kombination' },
  // Übermittlungsgebühr (X9701)
  { x:'X9701', label:'Übermittlungsgebühr Bericht',        preis: 1.40, zuzahlung:null, dauer:null,    kat:'Verwaltung' },
  // Hausbesuchspauschalen (X99xx) — separate Zuschlag, nicht kombinierbar
  { x:'X9922', label:'Hausbesuch Kurzzeit-/Verhinderungs-/Tagespflege', preis:22.78, zuzahlung:2.28, dauer:null, kat:'Hausbesuch', hausbesuch:true },
  { x:'X9950', label:'Hausbesuch inkl. Wegegeld (Einsatzpauschale)',    preis:22.78, zuzahlung:2.28, dauer:null, kat:'Hausbesuch', hausbesuch:true },
  { x:'X9951', label:'Hausbesuch soziale Einrichtung inkl. Wegegeld',   preis:13.09, zuzahlung:1.31, dauer:null, kat:'Hausbesuch', hausbesuch:true },
  // Hebammenhilfe-bezogene Positionen (already numeric, no X)
  { x:'21901', label:'Geburtsvorbereitung Gruppe',         preis:11.40, zuzahlung:null, dauer:'60', kat:'Hebamme', gruppe:true, no_prefix_substitution:true },
  { x:'21904', label:'Rückbildungsgymnastik Gruppe',       preis:11.40, zuzahlung:null, dauer:'60', kat:'Hebamme', gruppe:true, no_prefix_substitution:true },
]);

/**
 * Resolve template position (e.g. 'X0501') → concrete EDIFACT code for the
 * given Abrechnungscode (e.g. '22' → '20501').
 */
export function resolvePositionsnummer(templateOrCode, abrechnungscode = '22') {
  const prefixMap = { '21': '1', '22': '2', '27': '6', '28': '8' };
  const prefix = prefixMap[abrechnungscode];
  if (!prefix) throw new Error(`Unknown Heilmittel-Abrechnungscode for prefix substitution: ${abrechnungscode}`);

  // Already numeric (Hebammen-Positionen) → return as-is.
  if (/^\d+$/.test(templateOrCode)) return templateOrCode;
  // Template starts with X
  if (/^X\d{4}$/.test(templateOrCode)) return prefix + templateOrCode.slice(1);
  // Already resolved
  if (/^\d{5}$/.test(templateOrCode)) return templateOrCode;
  throw new Error(`Unrecognized Positionsnummer format: "${templateOrCode}"`);
}

/**
 * Find a position by template code (X0501) OR resolved code (20501).
 * Returns the entry plus the resolved positionsnummer for the given Abrechnungscode.
 */
export function findPosition(code, abrechnungscode = '22') {
  // Try template match first
  let entry = PHYSIO_POSITIONS.find(p => p.x === code);
  if (!entry) {
    // Try resolved: strip prefix digit, prepend X
    if (/^\d{5}$/.test(code)) {
      const template = 'X' + code.slice(1);
      entry = PHYSIO_POSITIONS.find(p => p.x === template);
    }
  }
  if (!entry) return null;
  return {
    ...entry,
    positionsnummer: resolvePositionsnummer(entry.x, abrechnungscode),
  };
}

/** Total number of positions defined (incl. Hausbesuch + Hebamme). */
export const PHYSIO_POSITION_COUNT = PHYSIO_POSITIONS.length;

// Default Heilmittel-code → template position. Best-effort guess used when the
// OCR'd Rezept names only the short Heilmittel code (e.g. "KG") and the
// therapist hasn't picked an explicit Positionsnummer yet.
//
// Therapists can override this on the Abrechnung screen before submitting.
const HEILMITTEL_DEFAULTS = Object.freeze({
  KG:        'X0501',  // Allgemeine Krankengymnastik Einzel
  'KG-ZNS':  'X0710',  // KG-ZNS Bobath Erwachsene Einzel
  'KG-MUKO': 'X0702',
  MT:        'X1201',  // Manuelle Therapie Einzel
  MLD:       'X0205',  // MLD 30 Min (most common)
  'MLD-30':  'X0205',
  'MLD-45':  'X0201',
  'MLD-60':  'X0202',
  KMT:       'X0106',  // Klassische Massagetherapie
  BGM:       'X0107',  // Bindegewebsmassage
  ÜB:        'X0301',  // Übungsbehandlung Einzel
  UB:        'X0301',
  E:         'X1302',  // Elektrotherapie
  W:         'X1501',  // Warmpackung
  K:         'X1534',  // Kältetherapie
  D1:        'X2001',
});

/**
 * Best-effort map from OCR'd Heilmittel free-text → template position (X-form).
 * Returns null if no guess.
 */
export function defaultPositionForHeilmittel(heilmittelText) {
  if (!heilmittelText) return null;
  const norm = String(heilmittelText).trim().toUpperCase();
  if (HEILMITTEL_DEFAULTS[norm]) return HEILMITTEL_DEFAULTS[norm];
  // strip whitespace/dashes and try again
  const compact = norm.replace(/[\s_-]+/g, '');
  for (const [k, v] of Object.entries(HEILMITTEL_DEFAULTS)) {
    if (k.replace(/[\s_-]+/g, '') === compact) return v;
  }
  // first-word fallback (e.g. "KG am Gerät" → KG)
  const first = norm.split(/[\s,/]+/)[0];
  return HEILMITTEL_DEFAULTS[first] || null;
}
