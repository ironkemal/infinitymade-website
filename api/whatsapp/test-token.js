// POST /api/whatsapp/test-token
// Body: { accessToken, phoneNumberId }
// Returns: { ok, displayName, qualityRating } or { ok:false, error }
//
// Validates a Meta WhatsApp Cloud API token by calling Graph API
// /v17.0/{phoneNumberId}.

import { json } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { accessToken, phoneNumberId } = req.body || {};
  if (!accessToken) return json(res, 400, { error: 'accessToken required' });
  if (!phoneNumberId) return json(res, 400, { error: 'phoneNumberId required' });

  try {
    const r = await fetch(
      `https://graph.facebook.com/v17.0/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!r.ok) {
      const text = await r.text();
      return json(res, 200, {
        ok: false,
        error: `Meta API rejected (HTTP ${r.status})`,
        detail: text.slice(0, 200),
      });
    }
    const data = await r.json();
    return json(res, 200, {
      ok: true,
      displayName: data.verified_name,
      phoneNumber: data.display_phone_number,
      qualityRating: data.quality_rating,
    });
  } catch (err) {
    return json(res, 500, { ok: false, error: err.message });
  }
}
