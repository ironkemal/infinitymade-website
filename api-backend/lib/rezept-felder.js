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
import { berlinHeute, istStichtag } from './berlin-tag.js';

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
 * Alle Kostenträger-Abfragen dieser Datei mit denselben Filtern wie die View
 * `kostentraeger_auswahl` (db/SCHEMA.sql): echter Datensatz, aktiv, GKV, nicht
 * abgelaufen, bereits gültig (valid_from, Berliner Datum). Ohne das löste der Server auf einen Satz auf, den die Auswahl im
 * Kassenfeld gar nicht anbietet (Testsatz, private Kasse, abgelaufene IK).
 * `heute` = Stichtag (YYYY-MM-DD, Standard Berliner Tag; O-139 — dieselbe
 * Stichtag-Regel wie ladeAnnahmestelle).
 */
function kostentraegerAbfrage(supabase, heute = berlinHeute()) {
  return supabase
    .from('kostentraeger')
    .select('ik, abrechnender_kt_ik')
    .eq('datensatz_status', 'echt')
    .eq('active', true)
    .eq('payer_type', 'gkv')
    .or(`valid_to.is.null,valid_to.gte.${heute}`)
    // gkv-302 30.09.2026: noch nicht gültige Sätze (valid_from in der Zukunft)
    // sind ebenfalls keine Auswahl. Zwei .or() = UND (PostgREST).
    .or(`valid_from.is.null,valid_from.lte.${heute}`);
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
async function kostentraegerEndzieleAufloesen(supabase, treffer, stichtag) {
  let ziele = new Set(treffer.map(t => t.abrechnender_kt_ik || t.ik));
  for (let sprung = 0; sprung <= MAX_VERWEIS_SPRUENGE; sprung++) {
    const { data: zeilen, error } = await kostentraegerAbfrage(supabase, stichtag)
      .in('ik', [...ziele]);
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
 * Karten-IK normalisieren: 9 Ziffern oder `null`.
 *
 * Die Karten-IK ist die „IK der Krankenkasse von der KV-Karte bzw. der
 * ärztlichen Verordnung" (Anlage 1 TP5 V21 §5.5.2/§5.5.3.1, Mussfeld) und wird
 * in `prescriptions.krankenkasse_ik` gespeichert (CHECK: genau 9 Ziffern, kein
 * FK). Leerraum und Trennzeichen werden entfernt; was danach keine 9 Ziffern
 * sind, ist KEINE Karten-IK (`null`) — nichts wird aufgefüllt oder geraten.
 *
 * @param {unknown} roh
 * @returns {?string}
 */
export function kartenIkNormalisieren(roh) {
  const ziffern = String(roh ?? '').replace(/\D/g, '');
  return /^\d{9}$/.test(ziffern) ? ziffern : null;
}

/**
 * Kostenträger-IK auflösen — IMMER aus der Karten-IK abgeleitet.
 *
 * Zwei getrennte Felder (gkv-302, 30.09.2026): `patient.krankenkasse_ik` ist
 * die Karten-IK, `kostentraeger_ik` die IK des Kostenträgers, an den abgerechnet
 * wird (Kostenträgerdatei: `COALESCE(abrechnender_kt_ik, ik)`, Ketten werden
 * bis zum Endpunkt verfolgt). Ein vom Client mitgegebenes `kostentraeger_ik`
 * wird bewusst NICHT mehr übernommen — bis 30.09.2026 stand dort bei
 * Ersatzkassen die Karten-IK und ging als falscher Kostenträger in die Datei.
 *
 * Mit gültiger Karten-IK: Kostenträger-Zeile `kostentraeger.ik = Karten-IK`
 * (aktiv) suchen und auf den Endpunkt zurückführen; nicht gefunden oder
 * Kette bricht → `null` (kein Raten, das Rezept bleibt „Kostenträger fehlt").
 *
 * Ohne (gültige) Karten-IK: nur noch als Sichtbarkeitshilfe der Verordnungsliste
 * über den Kassennamen — eindeutig oder gar nicht (Ops #301, Konsey 21.09.2026:
 * 28 von 94 Namen mehrdeutig; das frühere `limit(1)` nahm einen zufälligen
 * Satz). Diese IK ersetzt die Karten-IK NIE: der DTA-Bau lehnt eine Verordnung
 * ohne Karten-IK ab (billing/dta/builder.js).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{krankenkasse_ik?: string, krankenkasse?: string}} patient
 * @param {{stichtag?: string}} [opts]  YYYY-MM-DD; Standard: Berliner Tag
 * @returns {Promise<?string>}
 */
export async function kostentraegerIkAufloesen(supabase, patient, { stichtag } = {}) {
  const heute = stichtag ?? berlinHeute();
  if (!istStichtag(heute)) return null; // kein Raten bei kaputtem Stichtag
  const kartenIk = kartenIkNormalisieren(patient?.krankenkasse_ik);
  if (kartenIk) {
    const { data: zeile, error } = await kostentraegerAbfrage(supabase, heute)
      .eq('ik', kartenIk)
      .maybeSingle();
    if (error || !zeile) return null;
    const ziele = await kostentraegerEndzieleAufloesen(supabase, [zeile], heute);
    return ziele?.size === 1 ? [...ziele][0] : null;
  }
  const name = String(patient?.krankenkasse ?? '').trim();
  if (!name) return null;
  const { data: treffer, error } = await kostentraegerAbfrage(supabase, heute)
    .ilike('name', `%${name}%`);
  if (error || !treffer?.length) return null;
  const ziele = await kostentraegerEndzieleAufloesen(supabase, treffer, heute);
  return ziele?.size === 1 ? [...ziele][0] : null;
}
