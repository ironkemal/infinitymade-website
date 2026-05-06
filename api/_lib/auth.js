// Shared helpers for Vercel API functions
// Verifies Supabase JWT and exposes admin REST helpers using service role.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) console.warn('[auth] SUPABASE_URL is not set');
if (!SERVICE_ROLE_KEY) console.warn('[auth] SUPABASE_SERVICE_ROLE_KEY is not set');

/**
 * Validate a Supabase user JWT from the Authorization header.
 * Returns { user, error }.
 */
export async function getAuthedUser(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Missing Authorization header' };
  }
  const token = authHeader.slice(7);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return { user: null, error: 'Invalid token' };
  const user = await res.json();
  return { user, error: null };
}

/**
 * Service-role REST helper. Bypasses RLS — use with care.
 */
export async function adminFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Call a Postgres function via PostgREST RPC with service role.
 */
export async function adminRpc(fn, body) {
  const { ok, data, status } = await adminFetch(`/rpc/${fn}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { ok, data, status };
}

/**
 * Get decrypted secret for a business via Vault helper.
 * kind: 'cal_api_key' | 'whatsapp_access_token'
 */
export async function getBusinessSecret(userId, kind) {
  const { ok, data } = await adminRpc('business_get_secret', {
    p_user_id: userId,
    p_secret_kind: kind,
  });
  if (!ok) return null;
  return typeof data === 'string' ? data : data?.[0] || null;
}

/**
 * JSON response shortcut.
 */
export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
