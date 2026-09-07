// ============================================================================
// Rezept-Felder — Positionsnummer + Kostenträger-IK auflösen
//
// Zwei kleine Auflösungen, die bis 07.09.2026 nur in `POST /api/rezept/confirm`
// im Routen-Rumpf standen (server.js, keine eigene Funktion — daher unsichtbar
// für `funktionen/INDEX.json`). Ops #289 brauchte dieselbe Auflösung ein
// zweites Mal für `PATCH /api/rezept/:id` (ÄNDERN, Rest der
// Schreibweg-Zusammenlegung). Zwei Kopien hätten eine dritte Regel für
// dieselben zwei Spalten geschaffen — `schreibeVerordnung()` (Update-Zweig,
// vor #289) schrieb sie roh, der Server löst sie auf. Kopie statt Extraktion
// hätte die Abweichung nur lautlos vermehrt.
//
// Reine Umsetzung — kein Netz (ausser der Kostenträger-Suche, die braucht den
// aufrufenden Supabase-Client), keine Route-spezifische Logik. Beide Routen
// rufen dieselben zwei Funktionen, unverändert im Verhalten übernommen aus
// `/rezept/confirm` (server.js, Stand vor #289).
// ============================================================================

import { defaultPositionForHeilmittel, resolvePositionsnummer } from '../billing/codes/physio_positions.js';

/**
 * Heilmittel-Position auflösen. Bevorzugt eine vom Frontend mitgegebene
 * Positionsnummer (Katalogsuche-Treffer, z.B. "X0501"); ohne die wird aus dem
 * Heilmittel-Kurzcode (z.B. "KG") geraten.
 *
 * Kein Wurf bei unbekanntem Format: eine nicht auflösbare, aber vom Frontend
 * explizit gesetzte Position wird unverändert übernommen (der Therapeut hat
 * etwas eingetragen — das wegzuwerfen wäre falscher als es roh stehen zu
 * lassen). Nur der Rate-Zweig (ohne explizite Angabe) darf leer bleiben.
 *
 * @param {{heilmittel_position?: string, heilmittel?: string}} rezept
 * @returns {?string}
 */
export function heilmittelPositionAufloesen(rezept) {
  if (rezept?.heilmittel_position) {
    try { return resolvePositionsnummer(rezept.heilmittel_position, '22'); }
    catch (_e) { return rezept.heilmittel_position; }
  }
  const posTemplate = defaultPositionForHeilmittel(rezept?.heilmittel);
  if (!posTemplate) return null;
  try { return resolvePositionsnummer(posTemplate, '22'); }
  catch (_e) { return null; }
}

/**
 * Kostenträger-IK auflösen. Ein vom Frontend mitgegebenes IK (Datalist-Treffer
 * in `module/krankenkasse-suche.js`) gewinnt immer — der Wille des
 * Therapeuten schlägt die unscharfe Namenssuche. Nur ohne IK wird über den
 * Kassennamen in `kostentraeger` gesucht.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{kostentraeger_ik?: string, krankenkasse?: string}} patient
 * @returns {Promise<?string>}
 */
export async function kostentraegerIkAufloesen(supabase, patient) {
  if (patient?.kostentraeger_ik) return patient.kostentraeger_ik;
  if (!patient?.krankenkasse) return null;
  const { data: kkMatch } = await supabase
    .from('kostentraeger')
    .select('ik')
    .ilike('name', `%${patient.krankenkasse.trim()}%`)
    .eq('active', true)
    .limit(1)
    .maybeSingle();
  return kkMatch?.ik || null;
}
