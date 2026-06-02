// POST /api/stripe/portal-session
// Auth: Bearer <supabase_user_jwt>
// Returns: { url } to Stripe Customer Portal (manage card, cancel, invoices)

import { getAuthedUser, adminFetch, json } from '../_lib/auth.js';
import { stripeRequest } from '../_lib/stripe.js';

const PUBLIC_URL = process.env.NEXT_PUBLIC_URL || 'https://app.praxura.de';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { user, error: authErr } = await getAuthedUser(req);
  if (!user) return json(res, 401, { error: authErr });

  const { ok: pOk, data: profileRows } = await adminFetch(
    `/profiles?id=eq.${user.id}&select=stripe_customer_id`
  );
  if (!pOk || !profileRows?.[0]?.stripe_customer_id) {
    return json(res, 400, { error: 'No Stripe customer for this user. Subscribe first.' });
  }

  const { ok, data } = await stripeRequest('/billing_portal/sessions', {
    method: 'POST',
    body: {
      customer: profileRows[0].stripe_customer_id,
      return_url: `${PUBLIC_URL}/dashboard.html?tab=settings`,
    },
  });
  if (!ok) return json(res, 502, { error: 'Portal session failed', details: data });

  return json(res, 200, { url: data.url });
}
