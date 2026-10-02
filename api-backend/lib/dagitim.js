// Box oder SaaS? EIN Signal: SUPABASE_PUBLIC_URL ist nur in der Box gesetzt (onprem, O-16/O-145).
export function istKutu() { return !!process.env.SUPABASE_PUBLIC_URL; }

// Plan, mit dem der Box-Inhaber geboren wird (KHS K-2, onprem O-147, 02.10.2026).
// Vorher entstand er mit den Spaltendefaults starter/pending — das §302-Menue
// blieb in der Box unsichtbar. Richtung: jedes Paket bekommt Abrechnung; Paket/
// Preis wird spaeter festgelegt und haengt dann an der Lizenz — dann aendert
// sich NUR diese Zeile. Geschrieben ausschliesslich per service_role
// (setup/router.js), der profiles-Sperrtrigger aus 0053 laesst das durch.
export const KUTU_OWNER_PLAN = Object.freeze({ plan: 'professional', plan_status: 'active' });

// Basisadresse der Oberflaeche fuer Links, die der Server baut (Mails,
// OAuth-Redirects) — KHS K2.8, onprem O-150. Box: SITE_URL (compose reicht es
// an `api` durch). SaaS: keine der beiden Variablen gesetzt → wie bisher
// app.praxura.de. ⛔ Bewusst NICHT aus Origin/Host der Anfrage: ein Mail-Link
// aus einem Kopfzeilenwert waere per Host-Header-Injection vergiftbar.
export function appBaseUrl() {
  const roh = (process.env.SITE_URL || process.env.APP_BASE_URL || '').trim();
  return (roh || 'https://app.praxura.de').replace(/\/+$/, '');
}
