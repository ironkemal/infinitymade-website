// GET /api/onboarding/check-email?email=...
// Returns { exists: true/false } — used by onboarding to block duplicate registrations.
// Uses service-role to query profiles.email (avoids leaking auth internals).

import { adminFetch, json } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const email = (req.query.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: 'Ungültige E-Mail-Adresse.' });
  }

  const { ok, data } = await adminFetch(
    `/profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`
  );

  if (!ok) return json(res, 502, { error: 'Datenbankfehler' });

  return json(res, 200, { exists: Array.isArray(data) && data.length > 0 });
}
