// Praxis-Kennung der oeffentlichen Seiten -> owner_id.
//
// Warum: es gab zwei Linkschemata — booking.html?u=<slug> und
// booking-request.html?business=<owner_id> (Reform-Sprint S4). Beide Seiten
// akzeptieren jetzt beide Parameter; diese Datei ist die eine Aufloesung.
// Nutzt nur die vorhandenen anon-lesbaren Quellen (profiles_public, businesses,
// RPC find_owner_id_by_code) — kein neuer Endpunkt.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** „kemal" oder „https://praxura.de/booking.html?u=kemal" -> „kemal". */
export function slugAusKennung(s) {
  let slug = String(s || '').trim();
  const i = slug.toLowerCase().indexOf('booking.html?u=');
  if (i >= 0) slug = slug.slice(i + 'booking.html?u='.length).split(/[?#&]/)[0];
  return slug;
}

/** Was steht im Link? owner_id (`business`) hat Vorrang vor Slug/Code (`u`, `c`). */
export function kennungAusSuche(search) {
  const p = new URLSearchParams(search || '');
  const business = (p.get('business') || '').trim();
  // canli-test P2 30.09: kein UUID → ungültiger Link, statt den Assistenten ins Leere zu öffnen.
  if (business) return UUID.test(business) ? { ownerId: business, kennung: null } : { ownerId: null, kennung: null };
  const kennung = slugAusKennung(p.get('u') || p.get('c') || '');
  return { ownerId: null, kennung: kennung || null };
}

/**
 * Volle Aufloesung: { ownerId, employeeId, businessId, businessName } oder null.
 * employeeId: Link zeigt auf einen Mitarbeiter-Account; businessId/businessName: Link
 * ist der Slug eines Standorts (businesses). `sb` = supabase-js-Client (anon).
 */
export async function ladeKennung(sb, search) {
  const { ownerId, kennung } = kennungAusSuche(search);
  if (ownerId) return { ownerId, employeeId: null, businessId: null, businessName: null };
  if (!kennung) return null;
  if (!/^[\w.-]+$/.test(kennung)) return null; // geht in einen PostgREST-Filter
  const spalten = 'id,role,owner_id';
  const ausProfil = p => (p ? {
    ownerId: p.role === 'employee' && p.owner_id ? p.owner_id : p.id,
    employeeId: p.role === 'employee' && p.owner_id ? p.id : null,
    businessId: null, businessName: null,
  } : null);

  if (UUID.test(kennung)) {
    const { data } = await sb.from('profiles_public').select(spalten).eq('id', kennung).maybeSingle();
    return ausProfil(data);
  }
  if (kennung.toUpperCase().startsWith('INF-')) {
    const { data: id } = await sb.rpc('find_owner_id_by_code', { p_code: kennung.toUpperCase() });
    return id ? { ownerId: id, employeeId: null, businessId: null, businessName: null } : null;
  }
  const filter = `booking_slug.eq.${kennung},booking_slug.ilike.%booking.html?u=${kennung}`;
  const { data: prof } = await sb.from('profiles_public').select(spalten).or(filter).maybeSingle();
  if (prof) return ausProfil(prof);
  const { data: biz } = await sb.from('businesses').select('id,owner_id,business_name').or(filter).maybeSingle();
  return biz?.owner_id
    ? { ownerId: biz.owner_id, employeeId: null, businessId: biz.id, businessName: biz.business_name || null }
    : null;
}

/** owner_id zur Kennung, oder null. `sb` = supabase-js-Client (anon). */
export async function ladeOwnerId(sb, search) {
  return (await ladeKennung(sb, search))?.ownerId || null;
}
