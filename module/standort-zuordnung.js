/**
 * standort-zuordnung.js — welche Standorte ein Mitarbeiter sieht (Box-Test 22.11.2026, Nebenbefund).
 *
 * Warum: attendance.js zeigte Mitarbeitern ALLE Standorte der Praxis, der Standort-Umschalter in
 * dashboard.js nur die zugeordneten. Eine Regel für beide Stellen, damit sie nicht wieder auseinanderlaufen:
 * - Inhaber: alle Standorte.
 * - Mitarbeiter: nur Standorte aus employee_business_assignments.
 * - Ohne Zuordnung oder bei Lesefehler: nur der Standard-Standort — nie alle.
 * Gegenstück auf dem Server: api-backend/lib/standort-zuordnung.js (Check-in).
 */

/**
 * @template {{ id: string, is_default?: boolean|null }} B
 * @param {B[]} alle  Standorte des Inhabers
 * @param {{ rolle?: string|null, zugeordneteIds?: Iterable<string>|null, fehler?: boolean }} o
 * @returns {B[]}
 */
export function sichtbareStandorte(alle, { rolle, zugeordneteIds = null, fehler = false }) {
  const liste = Array.isArray(alle) ? alle : [];
  if (rolle === 'owner' || !liste.length) return liste;
  const nurStandard = () => liste.filter((b) => b.is_default).slice(0, 1);
  if (fehler) return nurStandard();
  const ids = new Set(zugeordneteIds || []);
  const treffer = liste.filter((b) => ids.has(b.id));
  return treffer.length ? treffer : nurStandard();
}

/**
 * Liest die Zuordnungen und wendet sichtbareStandorte an.
 * @template {{ id: string, is_default?: boolean|null }} B
 * @param {any} supabase @param {string} userId @param {string|null|undefined} rolle @param {B[]} alle
 * @returns {Promise<B[]>}
 */
export async function standorteFuerNutzer(supabase, userId, rolle, alle) {
  if (rolle === 'owner' || !Array.isArray(alle) || !alle.length) return sichtbareStandorte(alle, { rolle });
  const { data, error } = await supabase.from('employee_business_assignments').select('business_id').eq('employee_id', userId);
  if (error) console.warn('[standort-zuordnung] Zuordnungen nicht lesbar — nur Standard-Standort', error);
  return sichtbareStandorte(alle, { rolle, fehler: !!error, zugeordneteIds: (data || []).map((/** @type {any} */ z) => z.business_id) });
}
