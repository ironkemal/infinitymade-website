// POST /api/stripe/dta-pro-remove
// Auth: Bearer Supabase access_token (the user's own session)
//
// Removes the DTA-Pro subscription item from the caller's Stripe subscription
// (DELETE /v1/subscription_items/:id, prorate refund of unused portion).
// Webhook flips profiles.has_dta_pro = false once Stripe propagates.

import { getAuthedUser, adminFetch, json } from '../_lib/auth.js';
import { stripeRequest } from '../_lib/stripe.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { user, error: authErr } = await getAuthedUser(req);
  if (authErr || !user?.id) return json(res, 401, { error: authErr || 'Unauthorized' });

  const { ok: pOk, data: pRows } = await adminFetch(
    `/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,has_dta_pro,dta_pro_subscription_item_id`
  );
  if (!pOk || !pRows?.[0]) return json(res, 404, { error: 'Profile not found' });
  const profile = pRows[0];

  if (!profile.has_dta_pro || !profile.dta_pro_subscription_item_id) {
    return json(res, 200, { ok: true, alreadyInactive: true });
  }

  const itemId = profile.dta_pro_subscription_item_id;
  const { ok, status, data } = await stripeRequest(
    `/subscription_items/${encodeURIComponent(itemId)}`,
    {
      method: 'DELETE',
      body: { proration_behavior: 'create_prorations' },
      idempotencyKey: `dta_pro_remove_${itemId}`,
    }
  );

  if (!ok) {
    console.error('[dta-pro/remove] stripe error', status, data);
    return json(res, 502, { error: 'Stripe subscription_item deletion failed', details: data });
  }

  await adminFetch(`/profiles?id=eq.${encodeURIComponent(user.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      has_dta_pro: false,
      dta_pro_subscription_item_id: null,
    }),
  });

  return json(res, 200, { ok: true, removed: itemId });
}
