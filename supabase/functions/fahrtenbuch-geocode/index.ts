// fahrtenbuch-geocode
// Proxies ORS /geocode/search. JWT-verified; data minimization: only address text leaves.
// GDPR: ORS_API_KEY in Supabase Vault, audit via Supabase Logs.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ORS_BASE = 'https://api.openrouteservice.org';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('ORS_API_KEY');
  if (!apiKey) return json({ error: 'ors_key_missing' }, 500);

  let body: { address?: string; country?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const address = (body.address || '').trim();
  if (!address) return json({ error: 'address_required' }, 400);
  if (address.length > 300) return json({ error: 'address_too_long' }, 400);

  const country = (body.country || 'DE').toUpperCase();

  const url = new URL(`${ORS_BASE}/geocode/search`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('text', address);
  url.searchParams.set('boundary.country', country);
  url.searchParams.set('size', '1');

  let res: Response;
  try {
    res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  } catch (e) {
    return json({ error: 'ors_network_error', detail: String(e) }, 502);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return json({ error: 'ors_error', status: res.status, detail: text.slice(0, 500) }, 502);
  }

  const data = await res.json();
  const feat = data?.features?.[0];
  if (!feat) return json({ error: 'no_results' }, 404);

  const [lng, lat] = feat.geometry?.coordinates || [];
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return json({ error: 'invalid_geometry' }, 502);
  }

  return json({
    lat,
    lng,
    label: feat.properties?.label || null,
    confidence: feat.properties?.confidence ?? null,
    country: feat.properties?.country || null,
    postalcode: feat.properties?.postalcode || null,
  });
});
