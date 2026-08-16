/**
 * geschlecht.js — Kodierung des Patientengeschlechts, Serverseite.
 *
 * Spiegel von `module/geschlecht.js` im Frontend. Zwei Dateien für dieselbe
 * Regel ist nicht schön, aber unvermeidbar: `api-backend/` wird als eigenes
 * Docker-Image gebaut und hat eine ausdrückliche COPY-Liste (siehe Dockerfile)
 * — es kann nichts oberhalb seines Verzeichnisses importieren. Wer hier etwas
 * ändert, ändert es dort mit.
 *
 * Warum es das gibt: `leads.geschlecht` trägt
 *
 *     CHECK (geschlecht = ANY (ARRAY['m', 'f', 'd']))
 *
 * Die Rezept-OCR lieferte aber „w" für weiblich — deutsch gedacht, vom
 * Constraint abgelehnt. Ergebnis: im KI-Rezept-Ablauf liess sich keine
 * Patientin anlegen, der INSERT scheiterte am CHECK. Der Prompt fragt jetzt
 * nach „f", und hier wird zusätzlich normalisiert — ein Sprachmodell hält
 * sich nicht garantiert an das vorgegebene Alphabet, und ein falsch geratener
 * Buchstabe darf nicht die ganze Patientenanlage kippen.
 */

const ALIASE = {
  m: 'm', maennlich: 'm', 'männlich': 'm', mann: 'm', male: 'm', herr: 'm', '1': 'm',
  f: 'f', w: 'f', weiblich: 'f', frau: 'f', female: 'f', '2': 'f',
  d: 'd', divers: 'd', x: 'd', other: 'd', anderes: 'd', '3': 'd',
};

/**
 * Beliebiger Eingabewert → `'m' | 'f' | 'd' | null`.
 *
 * `null` ist ein gültiges Ergebnis („keine Angabe") und darf so in die
 * Datenbank. Unbekanntes wird zu `null` und nicht durchgereicht: lieber keine
 * Angabe als ein Wert, der den INSERT sprengt.
 *
 * Jeder Schreibpfad auf `leads.geschlecht` muss hier durch.
 */
export function normalisiereGeschlecht(wert) {
  if (wert == null) return null;
  const k = String(wert).trim().toLowerCase();
  if (!k) return null;
  return ALIASE[k] || null;
}
