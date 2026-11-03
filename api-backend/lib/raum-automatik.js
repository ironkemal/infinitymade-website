/** API-Eingaben bleiben begrenzt; die DB prüft zusätzlich Mandant und Standort. */
export function raumLeistungenFelder(ids) {
  if (ids === undefined) return { ok: true, felder: {} };
  if (!Array.isArray(ids) || ids.length > 30 || ids.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    return { ok: false, error: 'Für die Raumzuordnung sind höchstens 30 gültige Leistungen erlaubt.' };
  }
  return { ok: true, felder: { raum_service_ids: [...new Set(ids)] } };
}

export function raumBuchungsFehler(error) {
  if (error?.code === 'P0001' && String(error.message).startsWith('Kein freier Raum mit der benötigten Ausstattung')) {
    return 'Kein freier Raum mit der benötigten Ausstattung am Terminstandort verfügbar. Bitte Zeit oder Raumwahl prüfen.';
  }
  return null;
}

/** Öffentliche Bestätigung: nur Name des bereits zugeordneten Mandantenraums. */
export async function raumNameFuerBuchung(supabase, booking, ownerId) {
  if (!booking?.room_id || !ownerId) return null;
  try {
    let query = supabase.from('rooms').select('name').eq('id', booking.room_id).eq('owner_id', ownerId);
    query = booking.business_id == null ? query.is('business_id', null) : query.eq('business_id', booking.business_id);
    const { data, error } = await query.maybeSingle();
    return error ? null : data?.name || null;
  } catch { return null; } // Der Termin ist schon gebucht; Lesefehler darf keinen Fehlversuch vortäuschen.
}
