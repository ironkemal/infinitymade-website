// POST /api/stripe/webhook
// Receives Stripe events. Verifies signature with STRIPE_WEBHOOK_SECRET.
// Updates profile.plan_status, trial_ends_at, current_period_end on:
//   - customer.subscription.created
//   - customer.subscription.updated
//   - customer.subscription.deleted
//   - invoice.payment_failed
//   - checkout.session.completed (initial bind)

import { adminFetch, adminAuthFetch, json } from '../_lib/auth.js';
import { verifyWebhook } from '../_lib/stripe.js';

const SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Vercel needs the raw body for HMAC verification — disable default JSON parsing
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function planSlugFromMetadata(meta) {
  const slug = meta?.plan_slug;
  return ['starter','professional','klinik'].includes(slug) ? slug : null;
}

async function updateProfileBySubscription(sub, overrides = {}) {
  // Lookup profile by stripe_subscription_id (set during checkout.session.completed)
  const { ok: fOk, data: profiles } = await adminFetch(`/profiles?stripe_subscription_id=eq.${sub.id}&select=id`);
  let userId = null;
  if (fOk && profiles?.[0]) {
    userId = profiles[0].id;
  }
  // Fallback: lookup by pending_id -> email -> profile
  if (!userId) {
    const pendingId = sub.metadata?.pending_id;
    if (pendingId) {
      const { ok: pOk, data: pRows } = await adminFetch(`/pending_signups?id=eq.${encodeURIComponent(pendingId)}&select=email`);
      if (pOk && pRows?.[0]) {
        const { ok: uOk, data: uRows } = await adminFetch(`/profiles?email=eq.${encodeURIComponent(pRows[0].email)}&select=id`);
        if (uOk && uRows?.[0]) userId = uRows[0].id;
      }
    }
  }
  if (!userId) return { skipped: 'no profile found for subscription' };

  const status = sub.status; // trialing | active | past_due | canceled | incomplete | unpaid
  const planStatus =
    status === 'trialing' ? 'trial' :
    status === 'active' ? 'active' :
    status === 'past_due' ? 'past_due' :
    status === 'canceled' ? 'canceled' :
    'pending';

  const interval = sub.items?.data?.[0]?.price?.recurring?.interval || null;
  const priceId = sub.items?.data?.[0]?.price?.id || null;
  const planSlug = planSlugFromMetadata(sub.metadata || {});

  const patch = {
    plan_status: planStatus,
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    billing_interval: interval,
    trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    is_active: ['trial', 'active', 'past_due'].includes(planStatus),
    ...overrides,
  };
  if (planSlug) patch.plan = planSlug;

  const { ok, status: httpStatus, data } = await adminFetch(`/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return { ok, httpStatus, data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let event;
  try {
    const raw = await readRawBody(req);
    const sigHeader = req.headers['stripe-signature'];
    event = verifyWebhook(raw, sigHeader, SECRET);
  } catch (err) {
    console.error('[stripe webhook] verify failed:', err.message);
    return json(res, 400, { error: 'Webhook verification failed', message: err.message });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // Bind subscription_id back to user immediately (faster than waiting for sub.created)
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        if (userId && session.subscription) {
          await adminFetch(`/profiles?id=eq.${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              stripe_subscription_id: session.subscription,
              stripe_customer_id: session.customer,
            }),
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await updateProfileBySubscription(event.data.object);
        break;
      }

      case 'customer.subscription.deleted': {
        await updateProfileBySubscription(event.data.object, {
          plan_status: 'canceled',
          is_active: false,
        });
        break;
      }

      case 'invoice.payment_failed': {
        // Stripe will move sub to past_due then canceled — handled in subscription.updated
        // We just log here.
        console.warn('[stripe webhook] payment failed for invoice', event.data.object.id);
        break;
      }

      default:
        // Ignore other events
        break;
    }
    return json(res, 200, { received: true, type: event.type });
  } catch (err) {
    console.error('[stripe webhook] handler error:', err);
    return json(res, 500, { error: 'Handler error', message: err.message });
  }
}
