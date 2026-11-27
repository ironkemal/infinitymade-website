// Praxura Cockpit — Client für /api/cockpit/* (SaaS-Backend)
import { COCKPIT_API_URL } from './config.js?v=20261127a';
import { sb } from './app.js?v=20261127a';

export function currentMonthUtc() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Ruft einen Cockpit-Endpunkt mit aktuellem Ops-Supabase-Bearer-Token auf.
 * Liefert immer ein strukturiertes Ergebnis `{ ok, offline, status?, reason?, data? }`.
 */
export async function cockpitFetch(path, { method = 'GET', query = {} } = {}) {
  const base = String(COCKPIT_API_URL || '').trim().replace(/\/+$/, '');
  if (!base) {
    return { ok: false, offline: true, reason: 'NOT_CONFIGURED' };
  }

  let accessToken = '';
  try {
    const { data } = await sb.auth.getSession();
    accessToken = data?.session?.access_token || '';
  } catch {
    return { ok: false, offline: true, reason: 'NO_SESSION' };
  }
  if (!accessToken) {
    return { ok: false, offline: true, reason: 'NO_SESSION' };
  }

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      params.set(k, String(v));
    }
  }
  const qs = params.toString();
  const url = `${base}${path}${qs ? `?${qs}` : ''}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: globalThis.AbortSignal?.timeout ? AbortSignal.timeout(12000) : undefined,
    });

    let body = null;
    try { body = await res.json(); } catch { body = null; }

    if (!res.ok) {
      return {
        ok: false,
        offline: res.status >= 500,
        status: res.status,
        reason: body?.error || res.statusText || `HTTP_${res.status}`,
        data: body,
      };
    }

    return { ok: true, offline: false, status: res.status, data: body };
  } catch (err) {
    return {
      ok: false,
      offline: true,
      reason: err?.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR',
      error: err?.message || String(err),
    };
  }
}

export function getOverview(month = currentMonthUtc()) {
  return cockpitFetch('/api/cockpit/overview', { query: { month } });
}

export function getCustomers(month = currentMonthUtc()) {
  return cockpitFetch('/api/cockpit/customers', { query: { month } });
}

export function getKiUsage(month = currentMonthUtc(), tenantId = '') {
  return cockpitFetch('/api/cockpit/ki-usage', { query: { month, tenantId } });
}
