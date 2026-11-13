// Erlaubte Auswahlwerte der Rezept-Bestätigungsmaske.
//
// Diese Listen sind die "Wahrheit", gegen die der OCR-Freitext gemappt wird
// (Task ai/tasks/rezept-normalize.js). Der Arzt schreibt "2x wtl." — gespeichert
// werden muss der Katalogwert "2x pro Woche", sonst greifen Serienplanung und
// §302-Abrechnung nicht.
//
// ACHTUNG — FREQUENZ_OPTIONEN muss identisch zu FREQUENZ_OPTIONS in dashboard.js
// bleiben (dort füllen dieselben Labels die <select>-Optionen). Ändert sich eine
// Liste, muss die andere mitgezogen werden.

export const FREQUENZ_OPTIONEN = Object.freeze([
  '1x pro Woche', '2x pro Woche', '3x pro Woche', '4x pro Woche', '5x pro Woche',
  '1–2x pro Woche', '1–3x pro Woche', '2–3x pro Woche', '3–4x pro Woche', '4–5x pro Woche',
  'Täglich', '2x täglich',
  '1x alle 2 Wochen', '1x alle 3 Wochen', '1x alle 4 Wochen', '1x alle 6 Wochen', '1x alle 8 Wochen',
]);

// Offizielle Diagnosegruppen nach HeilM-RL Zweiter Teil (Fassung 15.05.2025, iK 05.08.2025,
// Z. 2434–5233) in leerzeichenfreier §-302-DTA-Schreibweise (44 Gruppen über alle 5 Fachbereiche).
export const DIAGNOSEGRUPPEN = Object.freeze([
  // Physiotherapie (13)
  'WS', 'EX', 'CS', 'ZN', 'PN', 'AT', 'GE', 'LY', 'SO1', 'SO2', 'SO3', 'SO4', 'SO5',
  // Podologie (5)
  'DF', 'NF', 'QF', 'UI1', 'UI2',
  // Stimm-, Sprech-, Sprach- und Schlucktherapie / Logopädie (14)
  'ST1', 'ST2', 'ST3', 'ST4', 'SP1', 'SP2', 'SP3', 'SP4', 'SP5', 'SP6', 'RE1', 'RE2', 'SF', 'SC',
  // Ergotherapie (10)
  'SB1', 'SB2', 'SB3', 'EN1', 'EN2', 'EN3', 'PS1', 'PS2', 'PS3', 'PS4',
  // Ernährungstherapie (2)
  'SAS', 'CF',
]);
