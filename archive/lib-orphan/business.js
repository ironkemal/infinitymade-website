/**
 * Praxura — Business Context Helper
 * ======================================
 * Multi-business desteği için aktif işletme yönetimi.
 *
 * - Aktif business localStorage + user_preferences'ta tutulur
 * - Owner birden fazla işletme yönetebilir (Paket 3)
 * - Employee çalıştığı işletmelerin listesini alır
 *
 * Usage:
 *   import { getActiveBusiness, listMyBusinesses, setActiveBusiness } from './lib/business.js';
 */

import { getSupabase } from './supabase.js';

const STORAGE_KEY = 'infinitymade.active_business';
const PREF_KEY = 'selected_business';

let _cache = null;

/**
 * Aktif business'ı döndürür (cache, localStorage, prefs sırası).
 * Yoksa default business'ı fetch eder ve set eder.
 */
export async function getActiveBusiness() {
  if (_cache) return _cache;

  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  let businessId = null;

  try {
    businessId = localStorage.getItem(STORAGE_KEY) || null;
  } catch { /* SSR or storage blocked */ }

  if (!businessId) {
    const { data: pref } = await sb
      .from('user_preferences')
      .select('preference_value')
      .eq('user_id', user.id)
      .eq('preference_key', PREF_KEY)
      .maybeSingle();
    businessId = pref?.preference_value || null;
  }

  if (!businessId) {
    const { data } = await sb.rpc('get_default_business', { p_user: user.id });
    businessId = data || null;
  }

  if (!businessId) return null;

  const { data: biz } = await sb
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .maybeSingle();

  _cache = biz || null;
  if (biz) {
    try { localStorage.setItem(STORAGE_KEY, biz.id); } catch {}
  }
  return _cache;
}

/**
 * Aktif business'ı değiştirir. Hem localStorage hem user_preferences'a yazar.
 */
export async function setActiveBusiness(businessId) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: biz, error } = await sb
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();
  if (error) throw error;

  _cache = biz;
  try { localStorage.setItem(STORAGE_KEY, businessId); } catch {}

  await sb.from('user_preferences').upsert({
    user_id: user.id,
    preference_key: PREF_KEY,
    preference_value: businessId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,preference_key' });

  return biz;
}

/**
 * Alle Unternehmen, auf die der Nutzer Zugang hat.
 * RLS filtert automatisch (Owner sieht eigene Businesses, Employee die des verknüpften Owners).
 */
export async function listMyBusinesses() {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('businesses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('business_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Cache temizle (logout, business CRUD sonrası).
 */
export function clearBusinessCache() {
  _cache = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

/**
 * Geçici yardımcı: bir tabloya yapılan query'ye otomatik business_id filter ekler.
 * Owner-id query'lerinden migrate ederken kullan.
 */
export async function withBusinessFilter(queryBuilder) {
  const biz = await getActiveBusiness();
  if (!biz) return queryBuilder;
  return queryBuilder.eq('business_id', biz.id);
}
