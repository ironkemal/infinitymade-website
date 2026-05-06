// POST /api/whatsapp/send-test
// Auth: Bearer <supabase_user_jwt>
// Body: { to } — phone number to send the welcome test message to
// Sends the user's configured "greeting" template via Cloud API.

import { getAuthedUser, adminFetch, getBusinessSecret, json } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { user, error: authErr } = await getAuthedUser(req);
  if (!user) return json(res, 401, { error: authErr });
  const userId = user.id;

  const { to } = req.body || {};
  if (!to) return json(res, 400, { error: 'to required' });

  const { ok: pOk, data: profileRows } = await adminFetch(
    `/profiles?id=eq.${userId}&select=whatsapp_phone_number_id,message_templates,business_name`
  );
  if (!pOk || !profileRows?.[0]) return json(res, 404, { error: 'Profile not found' });
  const { whatsapp_phone_number_id, message_templates, business_name } = profileRows[0];
  if (!whatsapp_phone_number_id) return json(res, 400, { error: 'Phone Number ID not configured' });

  const accessToken = await getBusinessSecret(userId, 'whatsapp_access_token');
  if (!accessToken) return json(res, 400, { error: 'WhatsApp access token not configured' });

  const greeting = (message_templates?.greeting || `Hallo! Test von ${business_name || 'InfinityMade'}.`)
    .replace('{{name}}', 'Tester')
    .replace('{{business}}', business_name || 'InfinityMade');

  const r = await fetch(
    `https://graph.facebook.com/v17.0/${encodeURIComponent(whatsapp_phone_number_id)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: String(to).replace(/[^\d]/g, ''),
        type: 'text',
        text: { body: greeting },
      }),
    }
  );

  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!r.ok) {
    return json(res, 200, {
      ok: false,
      error: `Meta rejected message (HTTP ${r.status})`,
      detail: data,
    });
  }

  return json(res, 200, { ok: true, messageId: data?.messages?.[0]?.id, data });
}
