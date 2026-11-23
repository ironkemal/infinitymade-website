/**
 * anwesenheit-status.js — „verspätet“ nach eigener Regelarbeitszeit statt fest ab 09:00.
 *
 * Warum (legal-de, Box-Test 22.11.2026): server.js setzte jeden Check-in nach 09:00 Berlin auf 'late'.
 * Für jemanden mit Dienstbeginn 10:00 oder 13:00 ist das falsch und landet als Unpünktlichkeit im
 * Arbeitszeitnachweis. Jetzt: 'late' nur, wenn der Check-in nach dem Beginn des eigenen aktiven
 * working_hours-Fensters an diesem Wochentag liegt (Fallback: Inhaberzeiten, wie bei der Terminprüfung,
 * `arbeitsfenster` in booking/termin-pruefung.js). Ohne Fenster an dem Tag → nie 'late'.
 */
import { arbeitsfenster } from '../booking/termin-pruefung.js';
import { berlinLocal } from '../booking/status.js';

/**
 * @param {{ zeiten: Array<{user_id?:string,day_of_week?:number,is_active?:boolean,start_time:string,end_time:string}>,
 *           empId: string, ownerId: string, jetzt?: Date }} o
 * @returns {'late'|'present'}
 */
export function anwesenheitStatus({ zeiten, empId, ownerId, jetzt = new Date() }) {
  const lokal = berlinLocal(jetzt);
  if (!lokal) return 'present';
  const tag = lokal.slice(0, 10);
  const uhrzeit = lokal.slice(11, 16);
  const wochentag = new Date(tag + 'T12:00:00Z').getUTCDay();
  const fenster = arbeitsfenster({ zeiten: Array.isArray(zeiten) ? zeiten : [], ownerId }, empId, wochentag, undefined);
  if (!fenster.length) return 'present';
  const beginn = fenster.map((f) => String(f.start_time).slice(0, 5)).sort()[0];
  return uhrzeit > beginn ? 'late' : 'present';
}
