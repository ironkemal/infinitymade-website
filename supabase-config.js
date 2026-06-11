// Public config loaded from server — keys never stored in source code
const _res = await fetch('/api/config').catch(() => null);
const _cfg = (_res?.ok) ? await _res.json() : {};

if (!_cfg.supabaseUrl || !_cfg.supabaseAnonKey) {
  console.error('[supabase-config] /api/config failed — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel env vars');
}

export const SUPABASE_URL = _cfg.supabaseUrl || '';
export const SUPABASE_ANON_KEY = _cfg.supabaseAnonKey || '';
