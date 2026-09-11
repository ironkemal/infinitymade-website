// Public config loaded from server — keys never stored in source code
const _res = await fetch('/api/config').catch(() => null);
const _cfg = (_res?.ok) ? await _res.json() : {};

if (!_cfg.supabaseUrl || !_cfg.supabaseAnonKey) {
  console.error('[supabase-config] /api/config failed — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel env vars');
}

export const SUPABASE_URL = _cfg.supabaseUrl || '';
export const SUPABASE_ANON_KEY = _cfg.supabaseAnonKey || '';

// Backend-Adresse, einzige Quelle (O-01, 11.09.2026 — vorher 25 Stellen mit
// fest eingetragenem https://n8n.infinitymade.de/api, in der Kundenbox waere
// das die Cloud-VPS gewesen statt der eigenen Box, G1-Verstoss). SaaS bekommt
// von api/config.js weiterhin den absoluten Wert; die Box liefert '/api'
// (relativ, siehe api-backend/server.js). Fällt /api/config ganz aus, bleibt
// das heutige SaaS-Verhalten unverändert.
export const API_BASE = _cfg.apiBase || 'https://n8n.infinitymade.de/api';
