// POST /api/stripe/create-checkout-session
// Body: { pending_id, planSlug: 'starter'|'professional'|'klinik'|'enterprise', interval: 'month'|'year' }
// Returns: { url } (Stripe Checkout URL)

import { adminFetch, json } from '../_lib/auth.js';
import { stripeRequest, priceIdFor } from '../_lib/stripe.js';

const PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'https://infinitymade.de';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { pending_id, planSlug, interval, dtaPro } = req.body || {};
  if (!pending_id) return json(res, 400, { error: 'pending_id fehlt.' });
  if (!['starter', 'professional', 'klinik', 'enterprise'].includes(planSlug)) {
    return json(res, 400, { error: 'Invalid planSlug' });
  }
  if (!['month', 'year'].includes(interval)) {
    return json(res, 400, { error: 'Invalid interval' });
  }

  const priceId = priceIdFor(planSlug, interval);
  if (!priceId) return json(res, 500, { error: `Price ID not configured for ${planSlug}/${interval}` });

  // Optional DTA-Pro addon — adds a second line_item on the same subscription.
  // Webhook detects DTA-Pro price ID in sub.items[] and flips profiles.has_dta_pro.
  const lineItems = [{ price: priceId, quantity: 1 }];
  if (dtaPro) {
    const dtaProPrice = priceIdFor('dta_pro', interval);
    if (!dtaProPrice) {
      return json(res, 500, { error: `DTA-Pro price not configured (${interval})` });
    }
    lineItems.push({ price: dtaProPrice, quantity: 1 });
  }

  // Load pending signup
  const { ok: pOk, data: pendingRows } = await adminFetch(
    `/pending_signups?id=eq.${encodeURIComponent(pending_id)}&select=*`
  );
  if (!pOk || !pendingRows?.[0]) return json(res, 404, { error: 'Pending signup not found' });
  const pending = pendingRows[0];

  // Create Stripe customer if missing
  let customerId = null;
  const { ok: cOk, data: cData } = await stripeRequest('/customers', {
    method: 'POST',
    body: {
      email: pending.email,
      name: pending.onboarding_data?.business_name || pending.email,
      metadata: { pending_id },
    },
    idempotencyKey: `cust_pending_${pending_id}`,
  });
  if (!cOk) return json(res, 502, { error: 'Stripe customer creation failed', details: cData });
  customerId = cData.id;

  // Create Checkout Session with 14-day trial
  const { ok, data } = await stripeRequest('/checkout/sessions', {
    method: 'POST',
    body: {
      mode: 'subscription',
      customer: customerId,
      line_items: lineItems,
      subscription_data: {
        trial_period_days: 14,
        metadata: { pending_id, plan_slug: planSlug, interval },
      },
      success_url: `${PUBLIC_URL}/dashboard.html?welcome=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_URL}/onboarding.html?step=plan&canceled=1`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      automatic_tax: { enabled: false },
      metadata: { pending_id, plan_slug: planSlug, interval },
    },
    idempotencyKey: `checkout_pending_${pending_id}_${planSlug}_${interval}_${Date.now()}`,
  });

  if (!ok) return json(res, 502, { error: 'Checkout session failed', details: data });

  // Store checkout session id in pending signup for webhook lookup
  await adminFetch(`/pending_signups?id=eq.${encodeURIComponent(pending_id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ stripe_checkout_session_id: data.id }),
  });

  return json(res, 200, { url: data.url, sessionId: data.id });
}
