// Der HMAC-Link wird vom Aufrufer geprüft. Erst die Termine absagen, danach die
// Anfrage quittieren: ein fehlgeschlagener Termin-Update darf kein Erfolg sein.
export async function cancelRequestBookings(supabase, request) {
  const ids = [...new Set([request.booking_id, ...(Array.isArray(request.booking_ids) ? request.booking_ids : [])].filter(Boolean))];
  if (ids.length) {
    const { data, error } = await supabase.from('bookings')
      .update({ status: 'cancelled' })
      .in('id', ids).eq('owner_id', request.owner_id)
      .select('id');
    if (error) throw error;
    if (data?.length !== ids.length) throw new Error('Nicht alle Termine konnten abgesagt werden.');
  }
  const { error } = await supabase.from('booking_requests')
    .update({ status: 'cancelled' }).eq('id', request.id).eq('owner_id', request.owner_id);
  if (error) throw error;
}
