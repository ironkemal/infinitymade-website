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
        const session = event.data.object;
        const pendingId = session.metadata?.pending_id;
        if (!pendingId) break;

        const { ok: pOk, data: pRows } = await adminFetch(`/pending_signups?id=eq.${encodeURIComponent(pendingId)}&select=*`);
        if (!pOk || !pRows?.[0]) { console.error('[webhook] pending signup not found', pendingId); break; }
        const pending = pRows[0];

        // 1. Create Supabase auth user
        const { ok: uOk, data: uData } = await adminAuthFetch('/admin/users', {
          method: 'POST',
          body: JSON.stringify({ email: pending.email, password: pending.password, email_confirm: true }),
        });
        if (!uOk) { console.error('[webhook] user creation failed', uData); break; }
        const userId = uData.id;

        const od = pending.onboarding_data || {};

        // 2. Insert profile
        const profilePayload = {
          id: userId,
          email: pending.email,
          business_name: od.business_name || null,
          sector: od.sector || null,
          city: od.city || null,
          language: od.language || null,
          zip: od.zip || null,
          street: od.street || null,
          house_number: od.house_number || null,
          owner_first_name: od.owner_first_name || null,
          owner_last_name: od.owner_last_name || null,
          accepts_bookings: od.accepts_bookings !== false,
          booking_slug: od.booking_slug || null,
          whatsapp_number: od.whatsapp_number || null,
          whatsapp_phone_number_id: od.whatsapp_phone_number_id || null,
          whatsapp_waba_id: od.whatsapp_waba_id || null,
          message_templates: od.message_templates || null,
          working_hours: od.working_hours || null,
          plan: od.plan || null,
          billing_interval: od.billing_interval || null,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plan_status: 'trial',
          is_active: true,
          onboarding_step: 'done',
        };
        await adminFetch('/profiles', { method: 'POST', body: JSON.stringify(profilePayload) });

        // 3. Insert services + link employee
        if (Array.isArray(od.services) && od.services.length) {
          const svcInserts = od.services.map(s => ({
            owner_id: userId,
            title: s.name,
            duration_minutes: s.duration_minutes || 30,
            price: s.price_eur || null,
            buffer_time: 0,
            is_online_meeting: false,
          }));
          const { data: inserted } = await adminFetch('/services', { method: 'POST', body: JSON.stringify(svcInserts) });
          if (inserted?.length) {
            const empRows = inserted.map(s => ({ employee_id: userId, service_id: s.id }));
            await adminFetch('/employee_services', { method: 'POST', body: JSON.stringify(empRows) });
            const bsInserts = od.services.map((s, i) => ({
              business_id: userId,
              name: s.name,
              duration_minutes: s.duration_minutes || 30,
              price_eur: s.price_eur || null,
              is_active: s.is_active !== false,
              display_order: i,
            }));
            await adminFetch('/business_services', { method: 'POST', body: JSON.stringify(bsInserts) });
          }
        }

        // 4. Insert working_hours
        if (Array.isArray(od.working_hours_rows) && od.working_hours_rows.length) {
          await adminFetch('/working_hours', { method: 'POST', body: JSON.stringify(od.working_hours_rows) });
        }

        // 5. Save WhatsApp secret if present
        if (od.whatsapp_access_token) {
          await adminFetch('/rpc/business_save_secret', {
            method: 'POST',
            body: JSON.stringify({ p_user_id: userId, p_secret_kind: 'whatsapp_access_token', p_secret_value: od.whatsapp_access_token }),
          });
        }

        // 6. Delete pending signup
        await adminFetch(`/pending_signups?id=eq.${encodeURIComponent(pendingId)}`, { method: 'DELETE' });
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
