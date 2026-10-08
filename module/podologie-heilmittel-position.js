/**
 * podologie-heilmittel-position.js — Eindeutige Positionsnummern-Zuordnung für Podologie.
 *
 * Warum es das gibt
 * ─────────────────
 * Im Heilmittelkatalog Podologie heißen die verordneten Heilmittel a) Hornhautabtragung,
 * b) Nagelbearbeitung und c) Podologische Komplexbehandlung (HeilM-RL § 27a Abs. 4).
 * Die tatsächlichen Abrechnungspositionen der Leistungsbeschreibung (Anlage 1a i. d. F. 17.06.2024)
 * lauten dagegen:
 *   - 78010: Podologische Behandlung (klein) — umfasst alle Leistungen bis zu 20 Minuten
 *            sowie Hornhautabtragung (Z. 198) oder Nagelbearbeitung (Z. 280) einzeln.
 *   - 78020: Podologische Behandlung (groß) — Podologische Komplexbehandlung bei mehr als
 *            20 Minuten Therapiezeit (Z. 170-171, 361).
 *
 * Eine unspezifische Verordnung von „Podologische Komplexbehandlung“ ohne Dauer
 * oder ohne Auszeichnung „groß“ / „klein“ darf NICHT automatisch auf 78020 geraten
 * werden (Z-13, Ops #302), sondern muss null zurückgeben, damit der Therapeut
 * die zutreffende Dauer/Position in der Maske festlegt.
 *
 * Reines Modul ohne Browser-/DOM-Abhängigkeiten — wird im Frontend und im Backend importiert.
 * Identisch mit api-backend/lib/podologie-heilmittel-position.js; erzeugte Kopie
 * für den separaten API-Docker-Context, Sync-Test verhindert Drift.
 */

'use strict';

// 78010: Podologische Behandlung (klein)
const POSITION_78010_TEXTE = new Set([
  'hornhautabtragung',
  'hornhautabtragung (einzeln)',
  'hornhautabtragung einzeln',
  'nagelbearbeitung',
  'nagelbearbeitung (einzeln)',
  'nagelbearbeitung einzeln',
  'podologische behandlung (klein)',
  'podologische behandlung klein',
  'pod. beh. kl.',
  'pod. beh. kl',
  'pod. beh. klein',
  'podologische behandlung klein (bis 20 min)',
  'podologische behandlung (klein) bis 20 min',
  'podologische behandlung (klein) bis 20 min.',
  'podologische behandlung (klein) bis 20 minuten',
]);

// 78020: Podologische Behandlung (groß)
const POSITION_78020_TEXTE = new Set([
  'podologische behandlung (groß)',
  'podologische behandlung (gross)',
  'podologische behandlung groß',
  'podologische behandlung gross',
  'pod. beh. gr.',
  'pod. beh. gr',
  'pod. beh. groß',
  'pod. beh. gross',
  'podologische komplexbehandlung (groß)',
  'podologische komplexbehandlung (gross)',
  'podologische komplexbehandlung groß',
  'podologische komplexbehandlung gross',
  'podologische behandlung (groß) über 20 min',
  'podologische behandlung (groß) über 20 min.',
  'podologische behandlung (groß) über 20 minuten',
  'podologische behandlung (groß) mehr als 20 minuten',
  'podologische komplexbehandlung (groß) über 20 min',
  'podologische komplexbehandlung (groß) über 20 minuten',
]);

/**
 * Normalisiert den Freitext und liefert die Positionsnummer '78010' oder '78020',
 * oder null falls nicht eindeutig oder unbekannt.
 *
 * @param {string|null|undefined} text
 * @returns {'78010'|'78020'|null}
 */
export function podologiePositionFuerText(text) {
  if (!text) return null;
  const norm = String(text)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (!norm) return null;

  if (POSITION_78010_TEXTE.has(norm)) return '78010';
  if (POSITION_78020_TEXTE.has(norm)) return '78020';

  return null;
}
