// POST /api/stripe/webhook
// Receives Stripe events. Verifies signature with STRIPE_WEBHOOK_SECRET.
// Updates profile.plan_status, trial_ends_at, current_period_end on:
//   - customer.subscription.created
//   - customer.subscription.updated
//   - customer.subscription.deleted
//   - invoice.payment_failed
//   - checkout.session.completed (initial bind)

import { adminFetch, adminAuthFetch, adminRpc, json } from '../_lib/auth.js';
import { verifyWebhook, dtaProPriceIds, stripeRequest } from '../_lib/stripe.js';

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
  return ['starter','professional','klinik','enterprise'].includes(slug) ? slug : null;
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

  const items = sub.items?.data || [];
  // First non-addon item drives interval/price. Addon items live alongside.
  const dtaProIds = dtaProPriceIds();
  const baseItem = items.find(it => !dtaProIds.includes(it.price?.id)) || items[0];
  const interval = baseItem?.price?.recurring?.interval || null;
  const priceId  = baseItem?.price?.id || null;
  const planSlug = planSlugFromMetadata(sub.metadata || {});

  // DTA-Pro addon detection (multi-item subscription).
  const dtaProItem = items.find(it => dtaProIds.includes(it.price?.id));
  const hasDtaPro  = !!dtaProItem && ['trialing', 'active', 'past_due'].includes(sub.status);

  const patch = {
    plan_status: planStatus,
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,
    billing_interval: interval,
    trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    is_active: ['trial', 'active', 'past_due'].includes(planStatus),
    has_dta_pro: hasDtaPro,
    dta_pro_subscription_item_id: hasDtaPro ? dtaProItem.id : null,
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
        const existingUserId = session.metadata?.user_id;

        if (!pendingId && !existingUserId) break;

        if (!pendingId && existingUserId) {
          // Existing authenticated user completed checkout — activate their plan
          const subscriptionId = session.subscription;
          const customerId = session.customer;
          const planSlug = session.metadata?.plan || session.metadata?.planSlug || session.metadata?.plan_slug || null;
          const interval = session.metadata?.interval || session.metadata?.billing_interval || 'month';

          if (subscriptionId) {
            let trialEnd = null;
            try {
              const { ok: subOk, data: subData } = await stripeRequest(`/subscriptions/${subscriptionId}`);
              if (subOk && subData?.trial_end) {
                trialEnd = new Date(subData.trial_end * 1000).toISOString();
              }
            } catch (e) {
              console.error('[webhook] could not retrieve subscription for trial_end:', e.message);
            }

            const patch = {
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: customerId,
              plan_status: trialEnd ? 'trial' : 'active',
              billing_interval: interval,
              is_active: true,
              trial_ends_at: trialEnd,
            };
            if (planSlug) patch.plan = planSlug;

            const { ok: patchOk, status: patchStatus, data: patchData } = await adminFetch(`/profiles?id=eq.${existingUserId}`, {
              method: 'PATCH',
              body: JSON.stringify(patch),
            });
            if (!patchOk) {
              console.error('[webhook] checkout.session.completed existing user profile update failed', patchStatus, patchData);
            } else {
              console.log('[webhook] checkout.session.completed existing user plan activated:', existingUserId, planSlug);
            }
          }
          break;
        }

        if (!pendingId) break;

        const { ok: pOk, data: pRows } = await adminFetch(`/pending_signups?id=eq.${encodeURIComponent(pendingId)}&select=email,onboarding_data`);
        if (!pOk || !pRows?.[0]) { console.error('[webhook] pending signup not found', pendingId); break; }
        const pending = pRows[0];

        // Decrypt the temp password from Vault (no longer stored as plaintext).
        const { ok: pwOk, data: pwData } = await adminRpc('pending_signup_consume', { p_pending_id: pendingId });
        const pendingPassword = typeof pwData === 'string' ? pwData : null;
        if (!pwOk || !pendingPassword) { console.error('[webhook] could not retrieve pending password', pendingId); break; }

        // 1. Create Supabase auth user
        const { ok: uOk, data: uData } = await adminAuthFetch('/admin/users', {
          method: 'POST',
          body: JSON.stringify({ email: pending.email, password: pendingPassword, email_confirm: false }),
        });
        if (!uOk) { console.error('[webhook] user creation failed', uData); break; }
        const userId = uData.id;

        const od = pending.onboarding_data || {};

        // 2. Update profile (auth trigger handle_new_user() already inserted (id, email))
        const profilePayload = {
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
          working_hours: od.working_hours || null,
          plan: od.plan || null,
          billing_interval: od.billing_interval || null,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plan_status: 'trial',
          is_active: true,
          onboarding_step: 'done',
          role: 'owner',
          bank_name: od.bank_name || null,
          iban: od.iban || null,
          bic: od.bic || null,
          steuernummer: od.steuernummer || null,
          ust_id: od.ust_id || null,
          tax_exempt_note: od.tax_exempt_note || null,
          ik_number: od.ik_number || null,
        };
        const { ok: profOk, status: profStatus, data: profData } = await adminFetch(`/profiles?id=eq.${userId}`, {
          method: 'PATCH',
          body: JSON.stringify(profilePayload),
        });
        if (!profOk) console.error('[webhook] profile patch failed', profStatus, profData);

        // 2.5 Create default business & save user preferences
        const businessPayload = {
          owner_id: userId,
          business_name: od.business_name || 'Mein Geschäft',
          sector: od.sector || null,
          street: od.street || null,
          house_number: od.house_number || null,
          zip: od.zip || null,
          city: od.city || null,
          country: od.country || 'DE',
          phone: od.phone || null,
          email: pending.email || null,
          booking_slug: od.booking_slug || null,
          is_default: true,
          ik_number: od.ik_number || null,
        };
        const { ok: bizOk, status: bizStatus, data: bizData } = await adminFetch('/businesses', {
          method: 'POST',
          body: JSON.stringify(businessPayload),
        });
        if (!bizOk) console.error('[webhook] default business creation failed', bizStatus, bizData);
        const businessId = bizData?.[0]?.id || null;

        if (businessId) {
          await adminFetch('/user_preferences', {
            method: 'POST',
            body: JSON.stringify({
              user_id: userId,
              preference_key: 'selected_business',
              preference_value: businessId,
            }),
          });
        }

        // 3. Insert services + link employee
        if (Array.isArray(od.services) && od.services.length) {
          const svcInserts = od.services.map(s => ({
            user_id: userId,
            owner_id: userId,
            business_id: businessId,
            title: s.name,
            duration_minutes: s.duration_minutes || 30,
            price: s.price_eur || null,
            is_online_meeting: false,
            code: s.code || null,
          }));
          const { data: inserted } = await adminFetch('/services', { method: 'POST', body: JSON.stringify(svcInserts) });
          if (inserted?.length) {
            const empRows = inserted.map(s => ({ employee_id: userId, service_id: s.id }));
            await adminFetch('/employee_services', { method: 'POST', body: JSON.stringify(empRows) });
            const bsInserts = od.services.map((s, i) => ({
              business_id: businessId,
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
          const whRows = od.working_hours_rows.map(r => ({
            user_id: userId,
            owner_id: userId,
            business_id: businessId,
            day_of_week: r.day_of_week,
            start_time: r.start_time || '00:00:00',
            end_time: r.end_time || '00:00:00',
            is_active: r.is_active,
          }));
          await adminFetch('/working_hours', { method: 'POST', body: JSON.stringify(whRows) });
        }



        // 6. Delete pending signup (+ its Vault secret)
        await adminRpc('pending_signup_delete', { p_pending_id: pendingId });
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
