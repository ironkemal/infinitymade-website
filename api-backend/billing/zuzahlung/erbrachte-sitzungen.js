// Erbrachte Sitzungen einer Verordnung — EINE Quelle für die Druckwege
// Zuzahlungsrechnung (ZU) und RZG-Quittung.
//
// Seit 04.09.2026 gibt es einen Verordnungstopf (`prescriptions`), aber zwei
// Sitzungsmodelle: Physio/Ergo/Logo zählen `prescription_sessions` (status
// 'done'), Podologie zählt `podologie_behandlungen` (nicht storniert) mit
// mehreren HPNR je Behandlung. Bis 10.10.2026 lasen beide Druckwege nur
// `prescription_sessions` — in der Podologie blieb die ZU deshalb immer
// „Vorschau" mit 0,00 € (canli-test T31, 10.10.2026).
//
// Podologie wird genau so flach gemacht wie im §302-Podo-Mapper
// (abrechnung.routes.js, mapVerordnungToDtaShape: Behandlung × hpnr_codes),
// damit die ZU dieselbe Zuzahlung zeigt, die die Kasse absetzt.

import { physioLeistungszeilen } from '../codes/physio-leistungszeilen.js';

/**
 * @typedef {{
 *   id: string,
 *   therapie_bereich?: string | null,
 *   prescription_sessions?: Array<{
 *     id: string,
 *     status?: string | null,
 *     done_at?: string | null,
 *     ergaenzend_erbracht?: boolean | null,
 *     heilmittel_index?: number | null,
 *     bookings?: { hausbesuch?: boolean | null } | null,
 *   }> | null,
 *   heilmittel_position?: string | null,
 *   ergaenzend_position?: string | null,
 *   ergaenzend_einheiten?: number | string | null,
 *   vorrangig_einheiten?: number | string | null,
 *   anzahl_einheiten?: number | string | null,
 *   doppelbehandlung?: boolean | null,
 *   hausbesuch?: boolean | null,
 *   hausbesuch_ort?: string | null,
 *   heilmittel_items?: Array<{ code?: string | null, position?: string | null, bezeichnung?: string | null, einheiten?: number | string | null, doppelbehandlung?: boolean | null }> | null,
 * }} ErbrachteSitzungenRx
 */

/**
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, rx: ErbrachteSitzungenRx, tenantId: string }} args
 *   rx: Zeile aus `prescriptions` inkl. `prescription_sessions(id, status, done_at)`
 * @returns {Promise<{ podo: boolean, sitzungen: Array<{ id: string, done_at: string|null, code: string, art?: 'vorrangig'|'ergaenzend'|'hausbesuch' }> }>}
 *   chronologisch sortiert; `id` ist je Zeile eindeutig (Podologie: `<behandlung>:<hpnr>`)
 */
export async function ladeErbrachteSitzungen({ supabase, rx, tenantId }) {
  if (rx?.therapie_bereich === 'podo') {
    const { data, error } = await supabase
      .from('podologie_behandlungen')
      .select('id, behandlungsdatum, hpnr_codes')
      .is('storniert_am', null)
      .eq('owner_id', tenantId)
      .eq('verordnung_id', rx.id)
      .order('behandlungsdatum', { ascending: true });
    if (error) throw error;
    return { podo: true, sitzungen: flacheBehandlungen(data) };
  }
  // Physio/Ergo/Logo: dieselben Zeilen wie der §302-Mapper (ergänzend, Hausbesuch,
  // Doppelbehandlung) — billing/codes/physio-leistungszeilen.js. Anzahl 2 wird hier
  // zu zwei Zeilen, weil die Druckwege je Zeile einen Einzelpreis rechnen.
  const erbrachtSortiert = (rx?.prescription_sessions || [])
    .filter(s => s.status === 'done')
    .sort((a, b) => (a.done_at || '').localeCompare(b.done_at || ''));
  /** @type {Array<{ id: string, done_at: string|null, code: string, art: 'vorrangig'|'ergaenzend'|'hausbesuch' }>} */
  const sitzungen = [];
  for (const z of physioLeistungszeilen(rx, erbrachtSortiert)) {
    for (let i = 0; i < z.anzahl; i++) {
      sitzungen.push({ id: i ? `${z.id}:${i + 1}` : z.id, done_at: z.done_at, code: z.code, art: z.art });
    }
  }
  return { podo: false, sitzungen };
}

/**
 * Behandlung × hpnr_codes → eine Zeile je Position (rein, ohne DB).
 * @param {Array<{ id: string, behandlungsdatum?: string | null, hpnr_codes?: Array<string | number> | null }> | null | undefined} behandlungen
 * @returns {Array<{ id: string, done_at: string|null, code: string }>}
 */
export function flacheBehandlungen(behandlungen) {
  /** @type {Array<{ id: string, done_at: string|null, code: string }>} */
  const zeilen = [];
  for (const b of behandlungen || []) {
    /** @type {Map<string, number>} */
    const gesehen = new Map(); // 78610 darf 2× je Tag — id bleibt trotzdem eindeutig
    for (const hpnr of (b.hpnr_codes || [])) {
      const code = String(hpnr).trim();
      if (!code) continue;
      const n = (gesehen.get(code) || 0) + 1;
      gesehen.set(code, n);
      zeilen.push({ id: `${b.id}:${code}${n > 1 ? `:${n}` : ''}`, done_at: b.behandlungsdatum || null, code });
    }
  }
  return zeilen.sort((a, b) => (a.done_at || '').localeCompare(b.done_at || ''));
}
