// Therapeuten-Auslastung: Termine je bookings.user_id, ohne interne Leistungen.
// Profile separat laden: user_id verweist auf auth.users, nicht auf profiles.
export async function loadTherapeutenStatistik(supabase, tenantId, cutoffIso) {
  const counts = new Map();
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, user_id, services(is_internal)')
      .eq('owner_id', tenantId)
      .gte('start_time', cutoffIso)
      .neq('status', 'cancelled')
      .order('id')
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error('therapeuten/bookings: ' + error.message);

    const rows = data || [];
    for (const booking of rows) {
      // Blocker und andere interne Leistungen sind keine Patiententermine.
      if (booking.services?.is_internal === true) continue;
      counts.set(booking.user_id, (counts.get(booking.user_id) || 0) + 1);
    }
    if (rows.length < pageSize) break;
  }

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!top.length) return [];

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, owner_first_name, owner_last_name, business_name')
    .in('id', top.map(([id]) => id))
    .or(`id.eq.${tenantId},owner_id.eq.${tenantId}`);
  if (error) throw new Error('therapeuten/profiles: ' + error.message);

  const names = new Map((profiles || []).map(p => [
    p.id,
    `${p.owner_first_name || ''} ${p.owner_last_name || ''}`.trim()
      || p.business_name || 'Nicht zugeordnet',
  ]));
  return top.map(([id, count]) => ({ name: names.get(id) || 'Nicht zugeordnet', count }));
}
