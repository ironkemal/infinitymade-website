// Modulrecht 'abrechnung' im BACKEND prüfen (Spiegel von get_my_permissions und der Datenbank-Funktion abrechnungszugriff_erlaubt, 0121).
// Das Backend arbeitet mit service_role und umgeht RLS — ohne diese Prüfung bleibt jeder Backend-Weg für jeden Angestellten offen
// (guvenlik S-65: PATCH /verordnung/:id/abrechnungsstatus; dokument-mail: POST /dokument/rechnung).
// Inhaber: immer. Mitarbeiter: nur mit dem Recht für mindestens eine der übergebenen Praxen. Fehlendes Token, keine Praxis, Abfragefehler
// oder Ausnahme: nein (fail closed). get_my_permissions wertet auth.uid() aus und braucht deshalb das JWT des Nutzers.
import { createClient } from '@supabase/supabase-js';

export function rechteAbfrage(token, businessId) {
  const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return userClient.rpc('get_my_permissions', { p_business_id: businessId });
}

/**
 * @param {{auth:{userId:string, role:string}|undefined, ownerId:string, businessIds:string[], token:string|null,
 *          rpc?:(token:string, businessId:string)=>Promise<{data:any,error:any}>}} p
 * @returns {Promise<boolean>}
 */
export async function hatAbrechnungsRecht({ auth, ownerId, businessIds, token, rpc = rechteAbfrage }) {
  if (auth?.role === 'owner' && auth.userId === ownerId) return true;
  if (auth?.role !== 'employee' || !token) return false;
  const praxen = [...new Set((businessIds || []).filter(Boolean))];
  for (const businessId of praxen) {
    try {
      const { data, error } = await rpc(token, businessId);
      if (!error && Array.isArray(data) && data.some(p => p?.module === 'abrechnung' && p.has_access === true)) return true;
    } catch { /* fail closed: nächste Praxis, am Ende nein */ }
  }
  return false;
}
