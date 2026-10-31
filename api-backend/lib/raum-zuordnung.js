// Raum für Serientermine (Physio/PILOT-PLAN.md M1). Der Raum bestimmt den Standort des Termins:
// ohne business_id leitet die Datenbank den Standort aus der Mitarbeiterzuordnung ab, meist den
// Standard-Standort, und der Trigger bookings_room_mandant würde einen Raum an Standort B abweisen.
//
// Nur authentifizierte Wege rufen das. Die öffentliche Buchung kennt keinen Raum.

export async function raumFelderFuerTermin(supabase, roomId, ownerId) {
  if (!roomId) return { ok: true, felder: {} };
  const { data, error } = await supabase
    .from('rooms')
    .select('id,business_id')
    .eq('id', roomId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error || !data) return { ok: false };
  return {
    ok: true,
    felder: data.business_id ? { room_id: data.id, business_id: data.business_id } : { room_id: data.id },
  };
}
