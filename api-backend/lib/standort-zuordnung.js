/**
 * standort-zuordnung.js — darf dieser Mitarbeiter an diesem Standort einchecken? (Box-Test 22.11.2026)
 *
 * Warum: POST /api/attendance/check-in prüfte nur „Standort gehört dem Inhaber“, nicht die Zuordnung.
 * Gleiche Regel wie module/standort-zuordnung.js (Frontend): zugeordnet → ja; ohne jede Zuordnung →
 * nur der Standard-Standort; Lesefehler → nein (fail closed).
 */

/**
 * @param {any} sb  service_role-Client
 * @param {{ employeeId: string, business: { id: string, is_default?: boolean|null } }} o
 * @returns {Promise<boolean>}
 */
export async function mitarbeiterDarfStandort(sb, { employeeId, business }) {
  const { data, error } = await sb.from('employee_business_assignments').select('business_id').eq('employee_id', employeeId);
  if (error) return false;
  const ids = (data || []).map((/** @type {any} */ z) => z.business_id);
  if (!ids.length) return business.is_default === true;
  return ids.includes(business.id);
}
