/**
 * verordnung-regelsatz-cache.js — ein Regelsatz je Fachbereich, einmal geladen.
 *
 * Warum es das gibt
 * ─────────────────
 * Bis 05.09.2026 lag dieser Cache privat in `verordnung-pruefen-knopf.js` — er
 * durfte dort bleiben, solange nur EIN Aufrufer den Prüfmotor nutzte (der
 * Knopf in der Eingabemaske). Mit Ops-Kart #269 (Verordnungen mit „Bitte
 * prüfen"-Befunden farblich markieren) kam ein zweiter Aufrufer dazu:
 * `module/verordnung-uebersicht.js` prüft jetzt auch GESPEICHERTE Verordnungen
 * für die Listen/Karten. Zwei private Caches auf denselben Daten wären zwei
 * Quellen der Wahrheit — genau die Kopie, vor der `fonksiyon-ustasi` warnt.
 * Deshalb einmal hierher gezogen, beide Aufrufer importieren jetzt von hier.
 *
 * Die Tabelle `diagnosegruppen` ist Stammdaten — sie ändert sich, wenn eine
 * neue Richtlinie kommt, nicht während einer Sitzung. Ein Fehlschlag wird
 * NICHT verschluckt: ohne Regeln gibt es kein Urteil, `null` sagt das offen.
 */

import { bereichSchluessel, regelnFuerBereich } from './verordnung-regeln.js?v=20260903';

const _cache = new Map();

/**
 * @param {object} supabase
 * @param {string} bereich  roher Wert (z. B. 'podo', 'physio', 'Podologie') —
 *   wird über `bereichSchluessel()` normalisiert, bevor er als Cache-Key dient.
 * @returns {Promise<{bereich:string, profil:object|null, gruppen:object, luecken:string[]}|null>}
 */
export async function regelsatzLaden(supabase, bereich) {
  const key = bereichSchluessel(bereich);
  if (_cache.has(key)) return _cache.get(key);

  const { data, error } = await supabase
    .from('diagnosegruppen')
    .select('code, label, hoechstmenge, untergruppen, icd_accept, icd_exclude, icd_accept_unsicher, icd_enforcement')
    .eq('aktiv', true)
    .eq('bereich', key)
    .order('sort');

  if (error) {
    console.warn('[verordnung-regelsatz-cache]', error.message);
    return null;   // kein Regelsatz → der Aufrufer meldet das offen
  }
  const satz = regelnFuerBereich(key, data || []);
  _cache.set(key, satz);
  return satz;
}
