// Auth middleware for /api/ai/* — validates Supabase JWT and resolves tenant.
//
// Tenant model: profiles.role = 'owner' OR 'employee'. For employees the
// tenant_id is profiles.owner_id; for owners it is the user's own id.
// Every audit row is keyed by tenant_id so cost/quota is owner-scoped.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export async function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || '';
    // Also accept ?token= query param for browser-redirect OAuth flows (gmail/connect, calendar/google-auth)
    const token = (hdr.startsWith('Bearer ') ? hdr.slice(7) : null) || req.query.token || null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });

    const userId = data.user.id;

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id, role, owner_id')
      .eq('id', userId)
      .single();

    if (pErr || !profile) return res.status(403).json({ error: 'Profile not found' });

    const tenantId = profile.role === 'employee' && profile.owner_id
      ? profile.owner_id
      : profile.id;

    req.auth = { userId, tenantId, role: profile.role };
    next();
  } catch (err) {
    console.error('[ai/auth]', err);
    res.status(500).json({ error: 'Auth check failed' });
  }
}
