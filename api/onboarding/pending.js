// POST /api/onboarding/pending
// Stores onboarding data in pending_signups table before Stripe checkout.
// Body: { email, password, onboarding_data: object }
// Returns: { pending_id }

import { adminFetch, json } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { email, password, onboarding_data } = req.body || {};
  if (!email || !password) {
    return json(res, 400, { error: 'E-Mail und Passwort sind erforderlich.' });
  }
  if (!onboarding_data || typeof onboarding_data !== 'object') {
    return json(res, 400, { error: 'onboarding_data fehlt.' });
  }

  // Remove any existing stale pending signup for this email
  await adminFetch(`/pending_signups?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });

  const { ok, data, status } = await adminFetch('/pending_signups', {
    method: 'POST',
    body: JSON.stringify({ email, password, onboarding_data }),
  });

  if (!ok) {
    return json(res, 502, { error: 'Speichern fehlgeschlagen', details: data });
  }

  return json(res, 200, { pending_id: data[0]?.id });
}
