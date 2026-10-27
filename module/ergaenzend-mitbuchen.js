/**
 * Ergänzendes Heilmittel beim Abschließen einer Sitzung mitbuchen (27.10.2026).
 *
 * Seit 0089 rechnet der §302-Mapper das ergänzende Heilmittel je Sitzung ab, die
 * `prescription_sessions.ergaenzend_erbracht` trägt (api-backend/billing/codes/
 * physio-leistungszeilen.js). HeilM-RL § 12 Abs. 8 S. 2: eine Behandlung umfasst
 * „in der Regel" das vorrangige UND, sofern verordnet, das ergänzende Heilmittel.
 * Deshalb ist Mitbuchen der Standard — kein zusätzlicher Klick je Patient —,
 * gedeckelt auf die verordnete Menge (ergaenzend_einheiten, sonst vorrangige).
 *
 * Varsayım (Physio/PARTNER-FRAGEN.md): dass Praxen das ergänzende Heilmittel
 * fast immer am selben Termin geben. Ein Abwählen je Sitzung gibt es noch nicht.
 */

/** Rein: soll diese Sitzung das ergänzende Heilmittel tragen? */
export function ergaenzendMitbuchen({ rx, bereitsErbracht }) {
  if (!rx?.ergaenzend_position || rx.therapie_bereich === 'podo') return false;
  const max = Number(rx.ergaenzend_einheiten) || Number(rx.vorrangig_einheiten) || Number(rx.anzahl_einheiten) || 0;
  return max > 0 && bereitsErbracht < max;
}

/** Setzt den Merker an den Sitzungen dieses Termins, sofern die Menge reicht. */
export async function bucheErgaenzendMit(supabase, prescriptionId, bookingId) {
  if (!supabase || !prescriptionId || !bookingId) return;
  const { data: rx } = await supabase.from('prescriptions')
    .select('ergaenzend_position, ergaenzend_einheiten, vorrangig_einheiten, anzahl_einheiten, therapie_bereich')
    .eq('id', prescriptionId).maybeSingle();
  if (!rx?.ergaenzend_position) return;
  const { count } = await supabase.from('prescription_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('prescription_id', prescriptionId).eq('status', 'done').eq('ergaenzend_erbracht', true);
  if (!ergaenzendMitbuchen({ rx, bereitsErbracht: count || 0 })) return;
  const { error } = await supabase.from('prescription_sessions')
    .update({ ergaenzend_erbracht: true })
    .eq('prescription_id', prescriptionId).eq('booking_id', bookingId).eq('status', 'done');
  if (error) console.warn('[ergaenzend mitbuchen]', error);
}
