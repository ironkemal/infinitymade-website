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

// Diagnosegruppen laut Heilmittelkatalog (identisch zur dgDatalist in dashboard.html).
export const DIAGNOSEGRUPPEN = Object.freeze([
  'WS1', 'WS2', 'WS3', 'WS4', 'WS5', 'WS6',
  'EX1', 'EX2', 'EX3a', 'EX3b',
  'AT1', 'AT2',
  'EN1', 'EN2', 'EN3', 'EN4',
  'LY1', 'LY2', 'LY3',
  'ST1', 'ST2', 'ST3', 'ST4', 'ST5', 'ST6', 'ST7', 'ST8', 'ST9',
  'RE1', 'RE2', 'RE3', 'RE4',
  'SC1', 'SC2',
  'SP1', 'SP2', 'SP3', 'SP4',
  'SN1', 'SN2',
  'SD1', 'SD2',
  'PS1', 'PS2', 'PS3',
  'NE1', 'NE2', 'NE3',
  'B3', 'B4', 'B5',
  'EB1', 'EB2', 'EB3',
]);
