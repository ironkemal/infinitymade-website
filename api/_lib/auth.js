// Shared helpers for Vercel API functions
// Verifies Supabase JWT and exposes admin REST helpers using service role.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_ANON_KEY) {
  console.error('[auth] SUPABASE_ANON_KEY is not set');
}
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) console.warn('[auth] SUPABASE_URL is not set');
if (!SERVICE_ROLE_KEY) console.warn('[auth] SUPABASE_SERVICE_ROLE_KEY is not set');

/**
 * @typedef {import('node:http').IncomingMessage & { body?: any, query?: Record<string, any> }} VercelRequest
 * @typedef {import('node:http').ServerResponse & { status: (code: number) => VercelResponse, json: (data: any) => void }} VercelResponse
 */

/**
 * Validate a Supabase user JWT from the Authorization header.
 * Returns { user, error }.
 * @param {VercelRequest} req
 */
export async function getAuthedUser(req) {
  const rawAuth = req.headers.authorization || req.headers.Authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Missing Authorization header' };
  }
  const token = authHeader.slice(7);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: /** @type {HeadersInit} */ ({
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    }),
  });
  if (!res.ok) return { user: null, error: 'Invalid token' };
  const user = await res.json();
  return { user, error: null };
}

/**
 * Service-role REST helper. Bypasses RLS — use with care.
 * @param {string} path
 * @param {RequestInit} [options]
 */
export async function adminFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: /** @type {HeadersInit} */ ({
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    }),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Call a Postgres function via PostgREST RPC with service role.
 * @param {string} fn
 * @param {unknown} body
 */
export async function adminRpc(fn, body) {
  const { ok, data, status } = await adminFetch(`/rpc/${fn}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { ok, data, status };
}

/**
 * Service-role fetch for Supabase Auth Admin endpoints (e.g. /auth/v1/admin/users).
 * @param {string} path
 * @param {RequestInit} [options]
 */
export async function adminAuthFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...options,
    headers: /** @type {HeadersInit} */ ({
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Returns true if the given user.id exists in public.admin_users.
 * Uses service-role to bypass RLS — call only after getAuthedUser.
 * @param {string | null | undefined} userId
 */
export async function isAdmin(userId) {
  if (!userId) return false;
  const { ok, data } = await adminFetch(`/admin_users?select=user_id&user_id=eq.${userId}&limit=1`);
  return ok && Array.isArray(data) && data.length > 0;
}

/**
 * JSON response shortcut.
 * @param {VercelResponse} res
 * @param {number} status
 * @param {unknown} body
 */
export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
