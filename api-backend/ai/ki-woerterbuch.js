// Tenant Name Dictionary Loader (M4.1 / M4.3 / K4 safety).
//
// DSGVO Art. 32 + DSFA R3:
// Loads patient, employee, and doctor names for a specific tenant into RAM.
// Used exclusively during request lifetime to mask tenant-specific names.
//
// Guarantees:
// - Exact minimal columns queried: leads (first_name, last_name, title),
//   profiles (owner_first_name, owner_last_name), aerzte (arzt_name, praxis_name).
// - Strict tenant filter (owner_id === auth.tenantId, id === auth.tenantId).
// - Role verification (owner or employee only).
// - Fail-closed: MUST complete successfully or block. No fallback to empty list on error.
// - Finite bounds check: if results reach range limit indicating truncation, blocks with KI_WOERTERBUCH_FEHLER.
// - RAM-only lifecycle per request, zero persistence.

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STOP_WORDS = new Set([
  'herr', 'herrn', 'frau', 'fräulein', 'dr', 'med', 'prof', 'dres', 'arzt',
  'praxis', 'zentrum', 'gmbh', 'und', 'von', 'zu', 'im', 'in', 'am', 'der', 'die', 'das'
]);

function createDictError(message, status = 503, code = 'KI_WOERTERBUCH_FEHLER') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/**
 * Loads the tenant dictionary for PII masking from Supabase.
 *
 * @param {Object} supabase Supabase client instance
 * @param {{role: string, userId: string, tenantId: string}} auth Auth context
 * @returns {Promise<string[]>} List of names and terms for this tenant
 */
export async function loadTenantDictionary(supabase, auth) {
  if (!auth || typeof auth !== 'object') {
    throw createDictError('Auth-Kontext fehlt', 401, 'KI_AUTH_REQUIRED');
  }

  const { role, userId, tenantId } = auth;
  if (!tenantId || !RE_UUID.test(tenantId) || !userId) {
    throw createDictError('Ungültiger Auth-Kontext oder Mandanten-ID', 401, 'KI_AUTH_REQUIRED');
  }

  if (role !== 'owner' && role !== 'employee') {
    throw createDictError('Ungültige Rolle für Wörterbuchzugriff', 403, 'KI_AUTH_REQUIRED');
  }

  if (!supabase || typeof supabase.from !== 'function') {
    throw createDictError('Supabase-Client fehlt oder ist ungültig', 503);
  }

  const dictionarySet = new Set();

  function addTerm(term) {
    if (!term || typeof term !== 'string') return;
    const clean = term.trim();
    if (clean.length < 2) return;
    dictionarySet.add(clean);

    // Also add parts if they are distinct words >= 3 chars
    const parts = clean.split(/[\s\-_/.,;:!?()]+/).map(p => p.trim());
    for (const p of parts) {
      if (p.length >= 3 && !STOP_WORDS.has(p.toLowerCase())) {
        dictionarySet.add(p);
      }
    }
  }

  async function readAll(table, columns, filterKey, maxRows) {
    const rows = [];
    const pageSize = 500;
    for (let from = 0; from < maxRows; from += pageSize) {
      let result;
      try { result = await supabase.from(table).select(columns).eq(filterKey, tenantId).range(from, from + pageSize - 1); } catch { throw createDictError('Wörterbuchabfrage fehlgeschlagen'); }
      if (result.error || !Array.isArray(result.data) || result.data.length > pageSize) throw createDictError('Wörterbuchabfrage fehlgeschlagen');
      rows.push(...result.data);
      if (result.data.length < pageSize) return rows;
    }
    throw createDictError('Unvollständiges Wörterbuch blockiert');
  }
  const leads = await readAll('leads', 'first_name, last_name, title', 'owner_id', 20_000);

  for (const l of leads) {
    if (l.first_name) addTerm(l.first_name);
    if (l.last_name) addTerm(l.last_name);
    if (l.title) addTerm(l.title);
    if (l.first_name && l.last_name) addTerm(`${l.first_name} ${l.last_name}`);
  }

  // 2. Profiles (Owner and Employees) — minimal columns
  const PROFILES_LIMIT = 500;
  const { data: ownerProfile, error: ownerErr } = await supabase
    .from('profiles')
    .select('owner_first_name, owner_last_name')
    .eq('id', tenantId)
    .single();

  if (ownerErr) {
    throw createDictError('Fehler beim Laden des Inhaberprofils', 503);
  }
  if (!ownerProfile) {
    throw createDictError('Inhaberprofil fehlt; unvollständiges Wörterbuch blockiert', 503);
  }

  if (ownerProfile.owner_first_name) addTerm(ownerProfile.owner_first_name);
  if (ownerProfile.owner_last_name) addTerm(ownerProfile.owner_last_name);
  if (ownerProfile.owner_first_name && ownerProfile.owner_last_name) {
    addTerm(`${ownerProfile.owner_first_name} ${ownerProfile.owner_last_name}`);
  }

  const employees = await readAll('profiles', 'owner_first_name, owner_last_name', 'owner_id', 5000);

  for (const emp of employees) {
    if (emp.owner_first_name) addTerm(emp.owner_first_name);
    if (emp.owner_last_name) addTerm(emp.owner_last_name);
    if (emp.owner_first_name && emp.owner_last_name) {
      addTerm(`${emp.owner_first_name} ${emp.owner_last_name}`);
    }
  }

  // 3. Doctors & Practices (aerzte) — minimal columns, strictly filtered by owner_id
  const aerzte = await readAll('aerzte', 'arzt_name, praxis_name', 'owner_id', 5000);

  for (const doc of aerzte) {
    if (doc.arzt_name) addTerm(doc.arzt_name);
    if (doc.praxis_name) addTerm(doc.praxis_name);
  }

  return Array.from(dictionarySet);
}
