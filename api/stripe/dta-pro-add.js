// POST /api/stripe/dta-pro-add
// Body: { interval: 'month'|'year' }   (defaults to 'month')
// Auth: Bearer Supabase access_token (the user's own session)
//
// Adds the DTA-Pro addon (+29 €/mo or +290 €/yr) as a new subscription item
// on the caller's existing Stripe subscription. The Stripe webhook flips
// profiles.has_dta_pro = true once the update propagates.

import { getAuthedUser, adminFetch, json } from '../_lib/auth.js';
import { stripeRequest, priceIdFor } from '../_lib/stripe.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { user, error: authErr } = await getAuthedUser(req);
  if (authErr || !user?.id) return json(res, 401, { error: authErr || 'Unauthorized' });

  const interval = (req.body?.interval === 'year') ? 'year' : 'month';
  const priceId  = priceIdFor('dta_pro', interval);
  if (!priceId) return json(res, 500, { error: `DTA-Pro price not configured (${interval})` });

  // Load profile → must have an active Stripe subscription.
  const { ok: pOk, data: pRows } = await adminFetch(
    `/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,stripe_subscription_id,has_dta_pro,plan_status,sector`
  );
  if (!pOk || !pRows?.[0]) return json(res, 404, { error: 'Profile not found' });
  const profile = pRows[0];

  if (!['physiotherapy', 'praxis'].includes(profile.sector)) {
    return json(res, 403, { error: 'DTA-Pro nur für Physio/Praxis verfügbar.' });
  }
  if (!profile.stripe_subscription_id) {
    return json(res, 412, { error: 'Kein aktives Abonnement. Bitte zuerst einen Basis-Plan wählen.' });
  }
  if (profile.has_dta_pro) {
    return json(res, 200, { ok: true, alreadyActive: true });
  }

  // Add subscription_item. Prorate immediately so the user pays only for the
  // remaining cycle.
  const idempotencyKey = `dta_pro_add_${profile.stripe_subscription_id}_${interval}`;
  const { ok, status, data } = await stripeRequest('/subscription_items', {
    method: 'POST',
    body: {
      subscription: profile.stripe_subscription_id,
      price: priceId,
      quantity: 1,
      proration_behavior: 'create_prorations',
      metadata: { addon: 'dta_pro', user_id: user.id },
    },
    idempotencyKey,
  });

  if (!ok) {
    console.error('[dta-pro/add] stripe error', status, data);
    return json(res, 502, { error: 'Stripe subscription_item creation failed', details: data });
  }

  // Optimistically reflect in DB; webhook will reconcile.
  await adminFetch(`/profiles?id=eq.${encodeURIComponent(user.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      has_dta_pro: true,
      dta_pro_subscription_item_id: data.id,
    }),
  });

  return json(res, 200, {
    ok: true,
    subscriptionItemId: data.id,
    priceId,
    interval,
  });
}
