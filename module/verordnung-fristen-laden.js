/**
 * module/verordnung-fristen-laden.js — Gemeinsamer, paginierter Lader für offene
 * Verordnungen (Dashboard-Rezept-KPI, Dashboard-Handlungsbedarf und Überblick).
 *
 * Warum ein gemeinsamer Lader (F-01 / Zusatz 9.2a):
 * - Bisher filterten Dashboard-Handlungsbedarf und Überblick fälschlich auf
 *   `rejected` (existiert in `prescriptions.status` nicht), ließen `cancelled`
 *   durch und brachen bei `.limit(150)` ohne Pagination ab.
 * - `#physioRezKpi` lud eigene Felder ohne `ausstellungsdatum`/`is_dringend`.
 * - Hier läuft eine einheitliche Keyset-Pagination über `id ASC` (Seitengröße 200),
 *   damit auch Praxen mit >150 bzw. >200 offenen Verordnungen exakte Zähler sehen.
 */

export const RX_FRISTEN_SELECT_VOLL =
  'id,patient_id,ausstellungsdatum,behandlungsbeginn,status,abrechnung_status,is_dringend,heilmittel,diagnosegruppe,therapie_bereich,bericht_angefordert,bericht_status,anzahl_einheiten,frequenz,vorrangig_einheiten,ergaenzend_einheiten,leads!patient_id(id,first_name,last_name,phone,handy)';

export const RX_FRISTEN_SELECT_KPI =
  'id,patient_id,ausstellungsdatum,behandlungsbeginn,status,abrechnung_status,is_dringend,heilmittel,diagnosegruppe,therapie_bereich';

/**
 * Lädt alle offenen Verordnungen eines Inhabers seitenweise per stabiler ID-Keyset-Pagination.
 *
 * @param {any} supabase
 * @param {{
 *   ownerId: string,
 *   select?: string,
 *   bizScope?: ((q: any, cat: string) => any) | null,
 *   seitenGroesse?: number,
 *   maxSeiten?: number,
 * }} opts
 * @returns {Promise<{ data: Array<Record<string, any>>, error: any, abgebrochen?: boolean }>}
 */
export async function ladeOffeneVerordnungenPaginiert(
  supabase,
  { ownerId, select = RX_FRISTEN_SELECT_VOLL, bizScope = null, seitenGroesse = 200, maxSeiten = 25 } = {}
) {
  if (!supabase || !ownerId) return { data: [], error: null };
  const rows = [];
  let cursor = null;

  for (let seite = 0; seite < maxSeiten; seite++) {
    let q = supabase
      .from('prescriptions')
      .select(select)
      .eq('owner_id', ownerId)
      .not('status', 'in', '(completed,billed,cancelled)')
      .order('id', { ascending: true })
      .limit(seitenGroesse);
    if (typeof bizScope === 'function') q = bizScope(q, 'patients');
    if (cursor !== null) q = q.gt('id', cursor);

    const { data, error } = await q;
    if (error) return { data: rows, error };
    if (!Array.isArray(data) || data.length === 0) break;

    const letzter = data[data.length - 1]?.id ?? null;
    if (letzter === null || (cursor !== null && String(letzter) <= String(cursor))) {
      rows.push(...data);
      return { data: rows, error: null, abgebrochen: true };
    }
    rows.push(...data);
    cursor = letzter;
    if (data.length < seitenGroesse) break;
  }

  return { data: rows, error: null };
}
