import { getCanonicalOwnerId, validateTherapist } from './public-guards.js';

export { getCanonicalOwnerId, validateTherapist };

/**
 * Validiert eine Dienstleistung für authentifizierte Dashboard-Endpunkte.
 *
 * Im Gegensatz zu validateService() aus public-guards.js:
 * - is_internal === true ist ERLAUBT (interne Praxis-Leistungen können im Dashboard gebucht werden)
 * - Prüft kanonische Eigentümerschaft: service.owner_id ?? service.user_id
 * - Gibt { ok: true, service: row, canonicalOwnerId } zurück
 */
export async function validateAuthenticatedService(supabase, serviceId, expectedTenantId = null) {
  if (!serviceId) return { ok: false, status: 400, error: 'Service not found' };
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: 'Interner Serverfehler' };
  if (!data) return { ok: false, status: 400, error: 'Service not found' };

  const canonicalOwnerId = getCanonicalOwnerId(data);
  if (!canonicalOwnerId || (expectedTenantId && canonicalOwnerId !== expectedTenantId)) {
    return { ok: false, status: 400, error: 'Service not found' };
  }

  return { ok: true, service: data, canonicalOwnerId };
}

/**
 * Validiert den Therapeuten einer BEREITS BESTEHENDEN Buchung (z.B. für PATCH).
 *
 * Prüft strikt die Mandantenzugehörigkeit (data.id === canonicalOwnerId || data.owner_id === canonicalOwnerId).
 * Fremde Therapeuten (auch inaktive) werden strikt abgewiesen.
 * Eigene, inzwischen inaktive Mitarbeiter sind ERLAUBT, damit historische Buchungen
 * storniert (cancelled) oder abgeschlossen (completed) werden können.
 */
export async function validateExistingBookingTherapist(supabase, therapistId, canonicalOwnerId) {
  if (!therapistId) return { ok: true };
  const { data, error } = await supabase
    .from('profiles')
    .select('id, owner_id, is_active')
    .eq('id', therapistId)
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: 'Interner Serverfehler' };
  if (!data) return { ok: false, status: 400, error: 'Ungültiger Therapeut' };

  if (data.id !== canonicalOwnerId && data.owner_id !== canonicalOwnerId) {
    return { ok: false, status: 400, error: 'Ungültiger Therapeut' };
  }
  return { ok: true, profile: data };
}
