// POST /api/admin/recover-checkout
//
// Manual recovery tool for Stripe checkout sessions whose webhook never fired
// (e.g. the webhook URL was pointing to the wrong domain).
//
// Body: { "session_id": "cs_test_...", "admin_secret": "..." }
//
// Steps:
//   1. Verify admin_secret matches ADMIN_RECOVERY_SECRET env var
//   2. Fetch the Stripe checkout session (with line_items expanded)
//   3. Assert payment_status === 'paid' && status === 'complete'
//   4. Extract pending_id from session.metadata
//   5. Check pending_signup still exists — skip if already processed
//   6. Check auth.users — skip if user already created, then clean up pending row
//   7. Run the exact same account-creation logic as webhook.js checkout.session.completed
//   8. Return { ok: true, userId, email }

import { adminFetch, adminAuthFetch, adminRpc, json } from '../_lib/auth.js';
import { stripeRequest } from '../_lib/stripe.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  // --- 0. Guard: ADMIN_RECOVERY_SECRET must be configured ---
  const ADMIN_RECOVERY_SECRET = process.env.ADMIN_RECOVERY_SECRET;
  if (!ADMIN_RECOVERY_SECRET) {
    console.error('[recover-checkout] ADMIN_RECOVERY_SECRET env var is not set');
    return json(res, 500, { error: 'Recovery endpoint is not configured' });
  }

  // --- 1. Parse + authenticate request ---
  let body;
  try {
    // Vercel parses JSON bodies by default (no bodyParser: false needed here)
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  const { session_id, admin_secret } = body || {};

  if (!admin_secret || admin_secret !== ADMIN_RECOVERY_SECRET) {
    return json(res, 401, { error: 'Unauthorized' });
  }

  if (!session_id || typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
    return json(res, 400, { error: 'Invalid session_id — must be a Stripe checkout session ID (cs_...)' });
  }

  try {
    // --- 2. Fetch Stripe checkout session ---
    const { ok: sessOk, data: session } = await stripeRequest(
      `/checkout/sessions/${session_id}?expand[]=line_items`
    );
    if (!sessOk || !session) {
      return json(res, 400, { error: 'Could not retrieve Stripe session', session_id });
    }

    // --- 3. Verify the session completed ---
    // Trial subscriptions have payment_status='no_payment_required', not 'paid'
    if (session.status !== 'complete' || session.payment_status === 'unpaid') {
      return json(res, 400, {
        error: 'Session is not complete',
        payment_status: session.payment_status,
        status: session.status,
      });
    }

    // --- 4. Extract pending_id from metadata ---
    const pendingId = session.metadata?.pending_id;
    if (!pendingId) {
      return json(res, 400, {
        error: 'Session has no pending_id in metadata — this may be an existing-user checkout, not a new signup',
        metadata: session.metadata,
      });
    }

    // --- 5. Check pending_signup still exists ---
    const { ok: pOk, data: pRows } = await adminFetch(
      `/pending_signups?id=eq.${encodeURIComponent(pendingId)}&select=email,onboarding_data`
    );
    if (!pOk || !pRows?.[0]) {
      console.log('[recover-checkout] pending signup not found — already processed', pendingId);
      return json(res, 200, { skipped: 'already processed', pending_id: pendingId });
    }
    const pending = pRows[0];

    // --- 6. Check if auth user already exists for this email ---
    const emailEncoded = encodeURIComponent(pending.email);
    const { ok: usersOk, data: usersData } = await adminAuthFetch(
      `/admin/users?email=${emailEncoded}`
    );
    if (usersOk && usersData?.users?.length > 0) {
      console.log('[recover-checkout] auth user already exists for', pending.email, '— cleaning up pending row');
      // Clean up the orphaned pending_signup row so we don't retry again
      await adminRpc('pending_signup_delete', { p_pending_id: pendingId });
      return json(res, 200, {
        skipped: 'user already exists',
        email: pending.email,
        user_id: usersData.users[0].id,
      });
    }

    // --- 7. Run the exact account-creation logic from webhook.js ---

    // 7a. Decrypt the temp password from Vault
    const { ok: pwOk, data: pwData } = await adminRpc('pending_signup_consume', { p_pending_id: pendingId });
    const pendingPassword = typeof pwData === 'string' ? pwData : null;
    if (!pwOk || !pendingPassword) {
      console.error('[recover-checkout] could not retrieve pending password', pendingId, pwData);
      return json(res, 500, { error: 'Could not retrieve pending signup password from Vault', pending_id: pendingId });
    }

    // 7b. Create Supabase auth user
    const { ok: uOk, data: uData } = await adminAuthFetch('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email: pending.email, password: pendingPassword, email_confirm: false }),
    });
    if (!uOk) {
      console.error('[recover-checkout] user creation failed', uData);
      return json(res, 500, { error: 'Failed to create auth user', detail: uData });
    }
    const userId = uData.id;

    // Send email confirmation (admin API doesn't auto-send)
    const { ok: emailOk, status: emailStatus, data: emailData } = await adminAuthFetch('/admin/generate_link', {
      method: 'POST',
      body: JSON.stringify({
        type: 'signup',
        email: pending.email,
        options: { redirectTo: 'https://app.praxura.de/login.html?verified=1' },
      }),
    });
    if (!emailOk) console.error('[recover-checkout] confirmation email failed', emailStatus, emailData);

    const od = pending.onboarding_data || {};

    // 7c. Update profile (auth trigger handle_new_user() already inserted (id, email))
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
    if (!profOk) console.error('[recover-checkout] profile patch failed', profStatus, profData);

    // 7d. Create default business & save user preferences
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
    if (!bizOk) console.error('[recover-checkout] default business creation failed', bizStatus, bizData);
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

    // 7e. Insert services + link employee
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

    // 7f. Insert working_hours
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

    // 7g. Delete pending signup (+ its Vault secret)
    await adminRpc('pending_signup_delete', { p_pending_id: pendingId });

    console.log('[recover-checkout] successfully recovered session', session_id, '→ userId', userId, 'email', pending.email);
    return json(res, 200, { ok: true, userId, email: pending.email });

  } catch (err) {
    console.error('[recover-checkout] unexpected error:', err);
    return json(res, 500, { error: 'Unexpected error', message: err.message });
  }
}
