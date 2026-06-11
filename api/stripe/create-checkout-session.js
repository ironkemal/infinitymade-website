// POST /api/stripe/create-checkout-session
// Two flows:
//   1. Authenticated existing user: Authorization: Bearer <jwt>  (no pending_id)
//   2. New user after pending signup:  body.pending_id  (no Authorization header)
// Returns: { url } (Stripe Checkout URL)

import { getAuthedUser, adminFetch, json } from '../_lib/auth.js';
import { stripeRequest, priceIdFor } from '../_lib/stripe.js';

const PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'https://app.praxura.de';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { pending_id, planSlug, interval, consents, reactivate } = req.body || {};

  if (!['starter', 'professional', 'klinik', 'enterprise'].includes(planSlug)) {
    return json(res, 400, { error: 'Invalid planSlug' });
  }
  if (!['month', 'year'].includes(interval)) {
    return json(res, 400, { error: 'Invalid interval' });
  }

  const priceId = priceIdFor(planSlug, interval);
  if (!priceId) return json(res, 500, { error: `Price ID not configured for ${planSlug}/${interval}` });

  const lineItems = [{ price: priceId, quantity: 1 }];

  // ── Flow 1: Authenticated existing user ──────────────────────────────────
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const { user, error: authError } = await getAuthedUser(req);
    if (authError || !user?.id) return json(res, 401, { error: 'Ungültiger Token.' });

    const userId = user.id;

    // Load profile to get email + existing stripe_customer_id
    const { ok: pOk, data: profileRows } = await adminFetch(
      `/profiles?id=eq.${encodeURIComponent(userId)}&select=email,stripe_customer_id`
    );
    if (!pOk || !profileRows?.[0]) return json(res, 404, { error: 'Profil nicht gefunden.' });
    const profile = profileRows[0];

    let customerId = profile.stripe_customer_id || null;

    if (!customerId) {
      // Create a new Stripe customer for this user
      const email = profile.email || user.email;
      const { ok: cOk, data: cData } = await stripeRequest('/customers', {
        method: 'POST',
        body: {
          email,
          metadata: { user_id: userId },
        },
        idempotencyKey: `cust_user_${userId}`,
      });
      if (!cOk) return json(res, 502, { error: 'Stripe customer creation failed', details: cData });
      customerId = cData.id;

      // Persist stripe_customer_id to profile
      await adminFetch(`/profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ stripe_customer_id: customerId }),
      });
    }

    // Create Checkout Session — no trial on reactivation
    const { ok, data } = await stripeRequest('/checkout/sessions', {
      method: 'POST',
      body: {
        mode: 'subscription',
        customer: customerId,
        line_items: lineItems,
        subscription_data: {
          ...(reactivate ? {} : { trial_period_days: 14 }),
          metadata: { user_id: userId, plan_slug: planSlug, interval },
        },
        success_url: `${PUBLIC_URL}/dashboard.html?welcome=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${PUBLIC_URL}/dashboard.html`,
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        automatic_tax: { enabled: false },
        metadata: { user_id: userId, plan_slug: planSlug, interval },
      },
      idempotencyKey: `checkout_user_${userId}_${planSlug}_${interval}`,
    });

    if (!ok) return json(res, 502, { error: 'Checkout session failed', details: data });
    return json(res, 200, { url: data.url, sessionId: data.id });
  }

  // ── Flow 2: New user via pending signup ──────────────────────────────────
  if (!pending_id) return json(res, 400, { error: 'pending_id fehlt.' });

  // Load pending signup
  const { ok: pOk, data: pendingRows } = await adminFetch(
    `/pending_signups?id=eq.${encodeURIComponent(pending_id)}&select=*`
  );
  if (!pOk || !pendingRows?.[0]) return json(res, 404, { error: 'Pending signup not found' });
  const pending = pendingRows[0];

  // Create Stripe customer
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
  const customerId = cData.id;

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
      success_url: `${PUBLIC_URL}/onboarding-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_URL}/onboarding.html?step=plan&canceled=1`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      automatic_tax: { enabled: false },
      metadata: { pending_id, plan_slug: planSlug, interval },
    },
    idempotencyKey: `checkout_pending_${pending_id}_${planSlug}_${interval}`,
  });

  if (!ok) return json(res, 502, { error: 'Checkout session failed', details: data });

  // Store checkout session id in pending signup for webhook lookup
  await adminFetch(`/pending_signups?id=eq.${encodeURIComponent(pending_id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ stripe_checkout_session_id: data.id }),
  });

  return json(res, 200, { url: data.url, sessionId: data.id });
}
