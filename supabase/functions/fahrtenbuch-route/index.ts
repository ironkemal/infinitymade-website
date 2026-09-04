// fahrtenbuch-route
// Proxies ORS /v2/directions/driving-car. JWT-verified; only coordinates leave (no PII).

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

type Coord = [number, number]; // [lng, lat]

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

  let body: { origin?: Coord; dest?: Coord };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!isCoord(body.origin) || !isCoord(body.dest)) {
    return json({ error: 'invalid_coordinates', hint: 'origin/dest must be [lng,lat] within valid range' }, 400);
  }

  const url = `${ORS_BASE}/v2/directions/driving-car`;
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
        coordinates: [body.origin, body.dest],
        units: 'km',
        instructions: false,
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
  const summary = data?.routes?.[0]?.summary;
  if (!summary) return json({ error: 'no_route' }, 404);

  const distance_km = Number(summary.distance ?? 0); // already km because units=km
  const duration_sec = Number(summary.duration ?? 0);
  const duration_min = Math.round(duration_sec / 60);

  return json({
    distance_km: Math.round(distance_km * 100) / 100,
    duration_min,
  });
});
