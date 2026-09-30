// Ein gemeinsamer anon-Supabase-Client fuer die oeffentliche Terminanfrage.
//
// Warum: booking-request.js und das Inline-Modul in booking-request.html legten je
// einen eigenen createClient an -> Konsolenwarnung „Multiple GoTrueClient instances
// detected" (canli-test P3, 30.09.2026). Beide holen ihn jetzt hier ab.
// Nur anon-Key, kein Login; kein DOM.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase-config.js?v=20260701';
import { createClient } from '../vendor/supabase-js.js?v=20260813';

let _client = null;

export async function getPublicClient() {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _client;
}
