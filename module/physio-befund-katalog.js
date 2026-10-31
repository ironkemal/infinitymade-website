/**
 * physio-befund-katalog.js — Datenkatalog fuer den physiotherapeutischen Befund.
 *
 * Reine Daten, export const, kein DOM, keine Nebeneffekte.
 * Definiert Formularversion, Regionen, Bewegungen (ROM nach Neutral-Null),
 * Kraftgruppen (MFT 0–5), Tests, Schmerzskalen (NRS) und Standardwerte.
 */

export const FORM_VERSION = 1;

export const BEFUNDARTEN = [
  { id: 'erst', label: 'Erstbefund' },
  { id: 'zwischen', label: 'Zwischenbefund' },
  { id: 'abschluss', label: 'Abschlussbefund' },
];

export const REGIONEN = [
  { id: 'HWS', label: 'HWS', seitig: false },
  { id: 'LWS', label: 'LWS', seitig: false },
  { id: 'Schulter', label: 'Schulter', seitig: true },
  { id: 'Knie', label: 'Knie', seitig: true },
  { id: 'Hüfte', label: 'Hüfte', seitig: true },
  { id: 'OSG', label: 'OSG/Fuß', seitig: true },
];

export const SEITEN = [
  { id: 'links', label: 'Links' },
  { id: 'rechts', label: 'Rechts' },
  { id: 'beidseits', label: 'Beidseits' },
];

export const NRS_ZEITEN = [
  { id: 'ruhe', label: 'Ruhe' },
  { id: 'belastung', label: 'Belastung' },
  { id: 'nacht', label: 'Nacht' },
];

export const CHARAKTER = [
  { id: 'stechend', label: 'stechend' },
  { id: 'ziehend', label: 'ziehend' },
  { id: 'brennend', label: 'brennend' },
  { id: 'dumpf', label: 'dumpf' },
  { id: 'ausstrahlend', label: 'ausstrahlend' },
];

export const INSPEKTION = [
  { id: 'schwellung', label: 'Schwellung' },
  { id: 'roetung', label: 'Rötung' },
  { id: 'narbe', label: 'Narbe' },
  { id: 'fehlhaltung', label: 'Fehlhaltung' },
  { id: 'atrophie', label: 'Atrophie' },
  { id: 'unauffaellig', label: 'unauffällig', exklusiv: true },
];

export const PALPATION = [
  { id: 'druckdolenz', label: 'Druckdolenz' },
  { id: 'hypertonus', label: 'Hypertonus' },
  { id: 'triggerpunkt', label: 'Triggerpunkt' },
  { id: 'ueberwaermung', label: 'Überwärmung' },
  { id: 'unauffaellig', label: 'unauffällig', exklusiv: true },
];

export const ROM_BEWEGUNGEN = {
  HWS: [
    { id: 'flexion', label: 'Flexion', seitig: false, richtwert: '45°' },
    { id: 'extension', label: 'Extension', seitig: false, richtwert: '45°' },
    { id: 'lateralflexion', label: 'Lateralflexion', seitig: true, richtwert: '45°' },
    { id: 'rotation', label: 'Rotation', seitig: true, richtwert: '60–80°' },
  ],
  LWS: [
    { id: 'flexion', label: 'Flexion', seitig: false, richtwert: '40–50°' },
    { id: 'extension', label: 'Extension', seitig: false, richtwert: '20–30°' },
    { id: 'lateralflexion', label: 'Lateralflexion', seitig: true, richtwert: '30–40°' },
    { id: 'rotation', label: 'Rotation', seitig: true, richtwert: '10–15°' },
  ],
  Schulter: [
    { id: 'flexion', label: 'Flexion', seitig: true, richtwert: '170–180°' },
    { id: 'extension', label: 'Extension', seitig: true, richtwert: '40–50°' },
    { id: 'abduktion', label: 'Abduktion', seitig: true, richtwert: '170–180°' },
    { id: 'adduktion', label: 'Adduktion', seitig: true, richtwert: '20–40°' },
    { id: 'aussenrotation', label: 'Aussenrotation', seitig: true, richtwert: '60–70°' },
    { id: 'innenrotation', label: 'Innenrotation', seitig: true, richtwert: '70–80°' },
  ],
  Knie: [
    { id: 'extension', label: 'Extension', seitig: true, richtwert: '0–5°' },
    { id: 'flexion', label: 'Flexion', seitig: true, richtwert: '130–140°' },
  ],
  Hüfte: [
    { id: 'flexion', label: 'Flexion', seitig: true, richtwert: '120–130°' },
    { id: 'extension', label: 'Extension', seitig: true, richtwert: '10–20°' },
    { id: 'abduktion', label: 'Abduktion', seitig: true, richtwert: '30–45°' },
    { id: 'adduktion', label: 'Adduktion', seitig: true, richtwert: '20–30°' },
    { id: 'aussenrotation', label: 'Aussenrotation', seitig: true, richtwert: '40–50°' },
    { id: 'innenrotation', label: 'Innenrotation', seitig: true, richtwert: '30–40°' },
  ],
  OSG: [
    { id: 'dorsalextension', label: 'Dorsalextension', seitig: true, richtwert: '20–30°' },
    { id: 'plantarflexion', label: 'Plantarflexion', seitig: true, richtwert: '40–50°' },
    { id: 'pronation', label: 'Pronation', seitig: true, richtwert: '15–30°' },
    { id: 'supination', label: 'Supination', seitig: true, richtwert: '30–50°' },
  ],
};
ROM_BEWEGUNGEN.Huefte = ROM_BEWEGUNGEN.Hüfte;

export const KRAFT_GRUPPEN = {
  HWS: [
    { id: 'flexoren', label: 'Flexoren', seitig: false },
    { id: 'extensoren', label: 'Extensoren', seitig: false },
  ],
  LWS: [
    { id: 'rumpfflexoren', label: 'Rumpfflexoren', seitig: false },
    { id: 'rumpfextensoren', label: 'Rumpfextensoren', seitig: false },
  ],
  Schulter: [
    { id: 'flexion', label: 'Flexion', seitig: true },
    { id: 'abduktion', label: 'Abduktion', seitig: true },
    { id: 'aussenrotation', label: 'Aussenrotation', seitig: true },
    { id: 'innenrotation', label: 'Innenrotation', seitig: true },
  ],
  Knie: [
    { id: 'extension', label: 'Extension', seitig: true },
    { id: 'flexion', label: 'Flexion', seitig: true },
  ],
  Hüfte: [
    { id: 'flexion', label: 'Flexion', seitig: true },
    { id: 'abduktion', label: 'Abduktion', seitig: true },
    { id: 'extension', label: 'Extension', seitig: true },
  ],
  OSG: [
    { id: 'dorsalextension', label: 'Dorsalextension', seitig: true },
    { id: 'plantarflexion', label: 'Plantarflexion', seitig: true },
  ],
};
KRAFT_GRUPPEN.Huefte = KRAFT_GRUPPEN.Hüfte;

export const TESTS = {
  HWS: [
    { id: 'spurling', label: 'Spurling', seitig: true },
    { id: 'distraktion', label: 'Distraktion', seitig: false },
    { id: 'ultt1', label: 'ULTT1', seitig: true },
    { id: 'foramen_kompression', label: 'Foramen-Kompression', seitig: true },
    { id: 'rotation_flexion', label: 'Rotation in Flexion', seitig: true },
  ],
  LWS: [
    { id: 'lasegue', label: 'Lasègue', seitig: true },
    { id: 'slump', label: 'Slump', seitig: true },
    { id: 'femoralis_dehnung', label: 'Femoralis-Dehnung', seitig: true },
    { id: 'fersen_zehengang', label: 'Fersen-/Zehengang', seitig: false },
    { id: 'kemp', label: 'Kemp', seitig: true },
  ],
  Schulter: [
    { id: 'hawkins_kennedy', label: 'Hawkins-Kennedy', seitig: true },
    { id: 'neer', label: 'Neer', seitig: true },
    { id: 'jobe_empty_can', label: 'Jobe/Empty Can', seitig: true },
    { id: 'painful_arc', label: 'Painful Arc', seitig: true },
    { id: 'lift_off_belly_press', label: 'Lift-off/Belly-Press', seitig: true },
  ],
  Knie: [
    { id: 'lachman', label: 'Lachman', seitig: true },
    { id: 'schublade_vorn', label: 'Schublade vorn', seitig: true },
    { id: 'mcmurray', label: 'McMurray', seitig: true },
    { id: 'thessaly', label: 'Thessaly', seitig: true },
    { id: 'varus_valgusstress', label: 'Varus-/Valgusstress', seitig: true },
  ],
  Hüfte: [
    { id: 'fadir', label: 'FADIR', seitig: true },
    { id: 'faber_patrick', label: 'FABER/Patrick', seitig: true },
    { id: 'thomas', label: 'Thomas', seitig: true },
    { id: 'trendelenburg', label: 'Trendelenburg', seitig: true },
    { id: 'log_roll', label: 'Log-Roll', seitig: true },
  ],
  OSG: [
    { id: 'schublade_vorn_osg', label: 'Schublade vorn OSG', seitig: true },
    { id: 'talar_tilt', label: 'Talar-Tilt', seitig: true },
    { id: 'thompson', label: 'Thompson', seitig: true },
    { id: 'squeeze', label: 'Squeeze', seitig: true },
    { id: 'kleiger', label: 'Kleiger', seitig: true },
  ],
};
TESTS.Huefte = TESTS.Hüfte;

export const TEST_ERGEBNISSE = [
  { id: 'plus', symbol: '+', label: 'positiv' },
  { id: 'minus', symbol: '−', label: 'negativ' },
  { id: 'nicht', symbol: '', label: 'nicht getestet', standard: true },
];

export const ADL = [
  { id: 'gehen', label: 'Gehen' },
  { id: 'treppe', label: 'Treppe' },
  { id: 'heben', label: 'Heben' },
  { id: 'sitzen', label: 'Sitzen' },
  { id: 'schlaf', label: 'Schlaf' },
  { id: 'arbeit', label: 'Arbeit' },
  { id: 'sport', label: 'Sport' },
  { id: 'ueberkopf', label: 'Überkopf' },
];

export const ZIEL_VORSCHLAEGE = {
  HWS: [
    'Schmerzfreie Kopfrotation im Alltag (z. B. Schulterblick)',
    'Reduktion ausstrahlender Schmerzen in Schulter/Arm',
    'Verbesserung der Haltung und Spannungsfreiheit am Arbeitsplatz',
    'Wiedererlangung schmerzfreier HWS-Beweglichkeit',
  ],
  LWS: [
    'Schmerzfreies langes Sitzen im Beruf und Alltag',
    'Schmerzfreies Bücken, Aufrichten und Heben',
    'Beschwerdefreie Gehstrecke erweitern',
    'Stabilisierung der Rumpfmuskulatur zur Schmerzprävention',
  ],
  Schulter: [
    'Schmerzfrei Überkopf greifen',
    'Schmerzfreies Liegen und Schlafen auf der betroffenen Seite',
    'Wiederaufnahme sportlicher Aktivitäten / Überkopfarbeit',
    'Volle aktive Abduktion und Außenrotation ohne Ausweichbewegung',
  ],
  Knie: [
    'Schmerzfreies Treppensteigen auf- und abwärts',
    'Volle Kniestreckung und freie Beugung im Alltag',
    'Flüssiges und sicheres Gehen ohne Entlastungshinken',
    'Wiederaufnahme von Gehen, Wandern oder Sport',
  ],
  Hüfte: [
    'Schmerzfreies Gehen über längere Gehstrecken (> 1 km)',
    'Schmerzfreies Aufstehen aus tiefen Sitzen und Auto',
    'Verbesserte Gelenkbeweglichkeit beim Schuhe-/Sockenanziehen',
    'Sichere und schmerzfreie Einbeinstand-Stabilität',
  ],
  OSG: [
    'Sicheres, schmerzfreies Abrollen beim Gehen',
    'Schwellungsfreies und stabiles Gehen auf unebenem Grund',
    'Schmerzfreies Treppabgehen',
    'Wiederaufnahme von Ausdauer- und Ballsportarten',
  ],
};
ZIEL_VORSCHLAEGE.Huefte = ZIEL_VORSCHLAEGE.Hüfte;

export const MASSNAHMEN = [
  { id: 'mt', label: 'Manuelle Therapie (MT)' },
  { id: 'mobilisation', label: 'Mobilisation' },
  { id: 'kraeftigung', label: 'Kräftigung' },
  { id: 'eigenuebungen', label: 'Eigenübungen' },
  { id: 'waerme_kaelte', label: 'Wärme/Kälte' },
];

export const VERLAUF = [
  { id: 'besser', label: 'besser' },
  { id: 'gleich', label: 'gleich' },
  { id: 'schlechter', label: 'schlechter' },
];

export const ZIEL_ERREICHT = [
  { id: 'ja', label: 'ja' },
  { id: 'teilweise', label: 'teilweise' },
  { id: 'nein', label: 'nein' },
];
