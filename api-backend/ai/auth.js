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

// ?token= nur dort, wo der Browser per window.location weitergeleitet wird und
// keinen Authorization-Header setzen kann (OAuth-Start). Überall sonst würde ein
// Token in der URL in Logs, Verlauf und Referer landen (guvenlik S-38, 02.10.2026).
// Die zwei Rechnungs-GETs in billing/api/abrechnung.routes.js prüfen selbst.
const QUERY_TOKEN_PFADE = new Set(['/api/gmail/connect', '/api/calendar/google-auth']);

export function queryTokenErlaubt(req) {
  return req.method === 'GET' && QUERY_TOKEN_PFADE.has(req.path);
}

export async function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || '';
    let token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token && req.query?.token && queryTokenErlaubt(req)) {
      token = String(req.query.token);  // Referrer-Policy: no-referrer setzt server.js global
    }
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
