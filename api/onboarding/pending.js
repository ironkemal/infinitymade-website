// POST /api/onboarding/pending
// Stores onboarding data in pending_signups table before Stripe checkout.
// Body: { email, password, onboarding_data: object }
// Returns: { pending_id }

import { adminFetch, adminRpc, json } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { email, password, onboarding_data } = req.body || {};
  if (!email || !password) {
    return json(res, 400, { error: 'E-Mail und Passwort sind erforderlich.' });
  }
  if (!onboarding_data || typeof onboarding_data !== 'object') {
    return json(res, 400, { error: 'onboarding_data fehlt.' });
  }

  // Store onboarding data + encrypt the temp password in Vault (no plaintext at rest).
  // The RPC also purges any prior pending signup (+ its vault secret) for this email.
  const { ok, data } = await adminRpc('pending_signup_store', {
    p_email: email,
    p_onboarding: onboarding_data,
    p_password: password,
  });

  const pendingId = typeof data === 'string' ? data : null;
  if (!ok || !pendingId) {
    return json(res, 502, { error: 'Speichern fehlgeschlagen', details: data });
  }

  // DSGVO Art. 28 / TTDSG: log AGB + AVV consent with IP + timestamp (audit trail).
  // Pre-signup: user_id is null, linked later via pending_id when account is created.
  const consents = onboarding_data?.consents;
  if (pendingId && consents?.agb_accepted && consents?.avv_accepted) {
    const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim()
              || req.headers['x-real-ip'] || null;
    const ua = (req.headers['user-agent'] || '').toString().slice(0, 500);
    const rows = ['agb', 'avv'].map(type => ({
      pending_id: pendingId,
      consent_type: type,
      version: (type === 'agb' ? consents.agb_version : consents.avv_version) || '2026-05-23',
      ip_address: ip,
      user_agent: ua,
      accepted_at: consents.accepted_at || new Date().toISOString(),
    }));
    await adminFetch('/consent_log', {
      method: 'POST',
      body: JSON.stringify(rows),
    });
  }

  return json(res, 200, { pending_id: pendingId });
}
