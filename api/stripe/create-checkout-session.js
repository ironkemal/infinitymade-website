// POST /api/stripe/create-checkout-session
// Body: { planSlug: 'starter'|'professional'|'klinik', interval: 'month'|'year' }
// Auth: Bearer <supabase_user_jwt>
// Returns: { url } (Stripe Checkout URL)

import { getAuthedUser, adminFetch, json } from '../_lib/auth.js';
import { stripeRequest, priceIdFor } from '../_lib/stripe.js';

const PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'https://infinitymade.de';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { user, error: authErr } = await getAuthedUser(req);
  if (!user) return json(res, 401, { error: authErr });

  const { planSlug, interval } = req.body || {};
  if (!['starter', 'professional', 'klinik'].includes(planSlug)) {
    return json(res, 400, { error: 'Invalid planSlug' });
  }
  if (!['month', 'year'].includes(interval)) {
    return json(res, 400, { error: 'Invalid interval' });
  }

  const priceId = priceIdFor(planSlug, interval);
  if (!priceId) return json(res, 500, { error: `Price ID not configured for ${planSlug}/${interval}` });

  // Load profile to get / set Stripe customer
  const { ok: pOk, data: profileRows } = await adminFetch(
    `/profiles?id=eq.${user.id}&select=business_name,stripe_customer_id,plan_status`
  );
  if (!pOk || !profileRows?.[0]) return json(res, 404, { error: 'Profile not found' });

  let customerId = profileRows[0].stripe_customer_id;

  // Create Stripe customer if missing
  if (!customerId) {
    const { ok, data } = await stripeRequest('/customers', {
      method: 'POST',
      body: {
        email: user.email,
        name: profileRows[0].business_name || user.email,
        metadata: { supabase_user_id: user.id },
      },
      idempotencyKey: `cust_${user.id}`,
    });
    if (!ok) return json(res, 502, { error: 'Stripe customer creation failed', details: data });
    customerId = data.id;
    await adminFetch(`/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ stripe_customer_id: customerId }),
    });
  }

  // Create Checkout Session with 14-day trial
  const { ok, data } = await stripeRequest('/checkout/sessions', {
    method: 'POST',
    body: {
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { supabase_user_id: user.id, plan_slug: planSlug, interval },
      },
      success_url: `${PUBLIC_URL}/dashboard.html?welcome=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_URL}/onboarding.html?step=plan&canceled=1`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      automatic_tax: { enabled: false },
      metadata: { supabase_user_id: user.id, plan_slug: planSlug, interval },
    },
    idempotencyKey: `checkout_${user.id}_${planSlug}_${interval}_${Date.now()}`,
  });

  if (!ok) return json(res, 502, { error: 'Checkout session failed', details: data });

  return json(res, 200, { url: data.url, sessionId: data.id });
}
