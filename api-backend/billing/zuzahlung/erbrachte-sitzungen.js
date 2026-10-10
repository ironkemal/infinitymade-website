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

/**
 * @param {{ supabase: any, rx: any, tenantId: string }} args
 *   rx: Zeile aus `prescriptions` inkl. `prescription_sessions(id, status, done_at)`
 * @returns {Promise<{ podo: boolean, sitzungen: Array<{ id: string, done_at: string|null, code: string }> }>}
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
  const code = rx?.heilmittel_position || '';
  const sitzungen = (rx?.prescription_sessions || [])
    .filter(s => s.status === 'done')
    .map(s => ({ id: s.id, done_at: s.done_at || null, code }))
    .sort((a, b) => (a.done_at || '').localeCompare(b.done_at || ''));
  return { podo: false, sitzungen };
}

/** Behandlung × hpnr_codes → eine Zeile je Position (rein, ohne DB). */
export function flacheBehandlungen(behandlungen) {
  const zeilen = [];
  for (const b of behandlungen || []) {
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
