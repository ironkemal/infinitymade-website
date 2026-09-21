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

/** Höchstzahl der Verweis-Sprünge `abrechnender_kt_ik` → `abrechnender_kt_ik` → … */
const MAX_VERWEIS_SPRUENGE = 3;

/**
 * Jeden Treffer auf den Kostenträger zurückführen, an den er abrechnet. Ein
 * Treffer mit `abrechnender_kt_ik` verweist (VKG-Verknüpfungsart 01, Anhang 3
 * zu Anlage 1 TP5 § 5.1) auf einen anderen Satz; ohne Verweis ist er selbst der
 * Kostenträger. In der echten Datei stehen auch Ketten
 * (`109531476 → 104229606 → 103501080`), deshalb wird bis zum Endpunkt
 * gefolgt — und nicht nur einen Schritt weit.
 *
 * Bricht eine Bedingung, kommt `null` zurück (kein Raten): Abfragefehler, ein
 * Ziel, das nicht (mehr) aktiv in `kostentraeger` steht, oder eine Kette, die
 * nach `MAX_VERWEIS_SPRUENGE` nicht endet (Schleife).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<{ik: string, abrechnender_kt_ik?: ?string}>} treffer
 * @returns {Promise<?Set<string>>}
 */
async function kostentraegerEndzieleAufloesen(supabase, treffer) {
  let ziele = new Set(treffer.map(t => t.abrechnender_kt_ik || t.ik));
  for (let sprung = 0; sprung <= MAX_VERWEIS_SPRUENGE; sprung++) {
    const { data: zeilen, error } = await supabase
      .from('kostentraeger')
      .select('ik, abrechnender_kt_ik')
      .in('ik', [...ziele])
      .eq('active', true);
    if (error) return null;
    const bekannt = new Map((zeilen || []).map(z => [z.ik, z.abrechnender_kt_ik || z.ik]));
    if ([...ziele].some(ik => !bekannt.has(ik))) return null;
    const weiter = new Set([...ziele].map(ik => bekannt.get(ik)));
    if ([...ziele].every(ik => bekannt.get(ik) === ik)) return ziele;
    ziele = weiter;
  }
  return null;
}

/**
 * Kostenträger-IK auflösen. Ein vom Frontend mitgegebenes IK (Datalist-Treffer
 * in `module/krankenkasse-suche.js`) gewinnt immer — der Wille des
 * Therapeuten schlägt die unscharfe Namenssuche. Nur ohne IK wird über den
 * Kassennamen in `kostentraeger` gesucht.
 *
 * Eindeutig oder gar nicht (Ops #301, Konsey 21.09.2026): Die Namenssuche ist
 * ein `ilike` auf `kostentraeger.name` (dem NAM-Segment der Kostenträgerdatei)
 * und trifft oft mehrere Sätze — gemessen gegen die 94 Namen der Kassenliste:
 * 28 mehrdeutig, 8 genau ein Treffer, 58 keiner. Das frühere `limit(1)` ohne
 * `order` nahm bei Mehrdeutigkeit einen zufälligen Satz; im DTA steht dann
 * still die IK einer Regionalstelle oder Karten-IK als „IK des Kostenträgers"
 * (Dateiabweisung, §302). Jetzt werden ALLE Treffer auf ihren Kostenträger
 * zurückgeführt; genau ein Kostenträger → dessen IK, sonst `null`. `null`
 * heißt: das Rezept bleibt sichtbar „Kostenträger fehlt" und wird nicht mit
 * einer geratenen IK abgerechnet.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{kostentraeger_ik?: string, krankenkasse?: string}} patient
 * @returns {Promise<?string>}
 */
export async function kostentraegerIkAufloesen(supabase, patient) {
  if (patient?.kostentraeger_ik) return patient.kostentraeger_ik;
  const name = String(patient?.krankenkasse ?? '').trim();
  if (!name) return null;
  const { data: treffer, error } = await supabase
    .from('kostentraeger')
    .select('ik, abrechnender_kt_ik')
    .ilike('name', `%${name}%`)
    .eq('active', true);
  if (error || !treffer?.length) return null;
  const ziele = await kostentraegerEndzieleAufloesen(supabase, treffer);
  return ziele?.size === 1 ? [...ziele][0] : null;
}
