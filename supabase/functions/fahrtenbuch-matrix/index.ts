// fahrtenbuch-matrix
// Proxies ORS /v2/matrix/driving-car for chained Hausbesuch route planning.
// JWT-verified; only coordinates leave (no PII).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ORS_BASE = 'https://api.openrouteservice.org';
const MAX_LOCATIONS = 25; // ORS free tier limit

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

type Coord = [number, number];

function isCoord(v: unknown): v is Coord {
  return (
    Array.isArray(v) && v.length === 2 &&
    typeof v[0] === 'number' && typeof v[1] === 'number' &&
    v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('ORS_API_KEY');
  if (!apiKey) return json({ error: 'ors_key_missing' }, 500);

  let body: { locations?: Coord[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const locs = body.locations;
  if (!Array.isArray(locs) || locs.length < 2) {
    return json({ error: 'min_two_locations' }, 400);
  }
  if (locs.length > MAX_LOCATIONS) {
    return json({ error: 'too_many_locations', max: MAX_LOCATIONS }, 400);
  }
  if (!locs.every(isCoord)) {
    return json({ error: 'invalid_coordinates' }, 400);
  }

  const url = `${ORS_BASE}/v2/matrix/driving-car`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        locations: locs,
        metrics: ['distance', 'duration'],
        units: 'km',
      }),
    });
  } catch (e) {
    return json({ error: 'ors_network_error', detail: String(e) }, 502);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return json({ error: 'ors_error', status: res.status, detail: text.slice(0, 500) }, 502);
  }

  const data = await res.json();
  // ORS returns durations (sec) and distances (km when units=km)
  return json({
    distances_km: data?.distances ?? null,
    durations_sec: data?.durations ?? null,
  });
});
