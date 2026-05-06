// POST /api/whatsapp/subscribe-webhook
// Auth: Bearer <supabase_user_jwt>
// Subscribes our app to the user's WABA (so that messages are forwarded
// to our shared n8n webhook). The webhook URL itself is configured in
// Meta App Dashboard → Webhooks. This call only attaches the WABA.

import { getAuthedUser, adminFetch, getBusinessSecret, json } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { user, error: authErr } = await getAuthedUser(req);
  if (!user) return json(res, 401, { error: authErr });
  const userId = user.id;

  const { ok: pOk, data: profileRows } = await adminFetch(
    `/profiles?id=eq.${userId}&select=whatsapp_waba_id`
  );
  if (!pOk || !profileRows?.[0]) return json(res, 404, { error: 'Profile not found' });
  const wabaId = profileRows[0].whatsapp_waba_id;
  if (!wabaId) return json(res, 400, { error: 'WABA ID not configured' });

  const accessToken = await getBusinessSecret(userId, 'whatsapp_access_token');
  if (!accessToken) return json(res, 400, { error: 'WhatsApp access token not configured' });

  // POST /<waba_id>/subscribed_apps subscribes the calling app to this WABA.
  const r = await fetch(
    `https://graph.facebook.com/v17.0/${encodeURIComponent(wabaId)}/subscribed_apps`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!r.ok) {
    return json(res, 200, {
      ok: false,
      error: `Meta rejected subscribe (HTTP ${r.status})`,
      detail: data,
    });
  }

  return json(res, 200, { ok: true, data });
}
