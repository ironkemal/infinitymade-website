// DSGVO Art. 15 Datenauskunft — Erstellung des Export-Payloads.
//
// Liest fuer Inhaber alle exportierbaren Tabellen (owner_id/user_id = userId).
// Liest fuer Mitarbeiter STRENG NUR Tabellen mit mitarbeiterFilter (user_id/employee_id = userId),
// um einen unbefugten Abzug des Praxis-Mandanten zu verhindern (guvenlik).

import { TABELLEN, KATEGORIEN } from './klassifikation.js';

const PAGE_SIZE = 1000;

/**
 * Liest eine Tabelle seitenweise in 1000er-Bloecken.
 */
async function ladeTabelle(supabase, table, select, filterCol, filterVal) {
  let from = 0;
  let mitId = true;
  const allRows = [];

  while (true) {
    let query = supabase.from(table).select(select);
    query = query.eq(filterCol, filterVal);
    // Feste Reihenfolge, sonst überspringt/doppelt .range() Zeilen ab 1000. Tabellen ohne
    // `id` (zusammengesetzte Schlüssel) laufen ohne Sortierung — dort bleibt es bei < 1000.
    if (mitId && typeof query.order === 'function') query = query.order('id', { ascending: true });

    if (typeof query.range === 'function') {
      query = query.range(from, from + PAGE_SIZE - 1);
    }

    const { data: rows, error } = await query;
    if (error && mitId && /\bid\b.*does not exist|column .*\.id/i.test(error.message || '')) {
      mitId = false;
      continue;
    }
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    allRows.push(...rows);
    if (rows.length < PAGE_SIZE || typeof query.range !== 'function') break;
    from += PAGE_SIZE;
  }

  // data_access_log: Zeitspalte occurred_at -> created_at vereinheitlichen
  if (table === 'data_access_log') {
    return allRows.map(r => ({
      created_at: r.created_at || r.occurred_at || null,
      action: r.action || null,
      resource: r.resource || null,
      method: r.method || null,
    }));
  }

  return allRows;
}

/**
 * Erstellt den vollstaendigen DSGVO Art. 15 Auskunfts-Export.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.tenantId
 * @param {string} params.role 'owner' | 'employee'
 * @param {object} [params.authUser] Supabase Auth User Metadaten
 * @param {boolean} [params.istKutu] Box-Modus (SaaS-Tabellen ueberspringen)
 * @returns {Promise<object>} Export-Payload
 */
export async function exportErstellen(supabase, { userId, tenantId, role, authUser, istKutu = false }) {
  const data = {};
  const errors = {};

  const istMitarbeiter = role === 'employee';

  for (const t of TABELLEN) {
    // In der Box SaaS-eigene Tabellen ueberspringen
    if (istKutu && t.nurSaas) continue;

    let filterCol = null;
    let filterVal = userId;

    if (istMitarbeiter) {
      // Mitarbeiter duerfen nur eigene Zeilen exportieren
      if (!t.mitarbeiterFilter) continue;
      filterCol = t.mitarbeiterFilter;
    } else {
      // Inhaber: alle Tabellen mit export-Konfiguration
      if (!t.export) continue;
      filterCol = t.export.filter;
    }

    const select = t.export?.select || '*';

    try {
      const rows = await ladeTabelle(supabase, t.table, select, filterCol, filterVal);
      data[t.table] = rows || [];
    } catch (err) {
      errors[t.table] = err.message || `status ${err.status || 500}`;
      console.error(`[dsgvo-export] Auskunft unvollstaendig: ${t.table} (${filterCol}) ->`, err.message || err);
    }
  }

  // Gesperrten Bestand aus aufbewahrung_sperre lesen
  // Sperrvermerk gehört zur Praxis, nicht zur Mitarbeiterin (guvenlik: kein Praxis-Abzug).
  let gesperrt = [];
  if (!istMitarbeiter) try {
    const { data: sperrRows, error: sErr } = await supabase
      .from('aufbewahrung_sperre')
      .select('*')
      .eq('owner_id', tenantId);

    if (sErr) {
      console.error('[dsgvo-export] aufbewahrung_sperre Fehler:', sErr.message);
      errors.aufbewahrung_sperre = 'nicht lesbar';
    } else if (sperrRows) {
      gesperrt = sperrRows.map(r => ({
        kategorie: r.kategorie,
        label: KATEGORIEN[r.kategorie]?.label || r.kategorie,
        grundlage: r.grundlage || KATEGORIEN[r.kategorie]?.grundlage,
        gesperrt_am: r.gesperrt_am,
        gesperrt_bis: r.gesperrt_bis,
        patient_id: r.patient_id,
        vorgang_id: r.vorgang_id,
      }));
    }
  } catch (err) {
    console.error('[dsgvo-export] aufbewahrung_sperre Exception:', err.message || err);
  }

  const auth_meta = authUser ? {
    id: authUser.id,
    email: authUser.email,
    created_at: authUser.created_at,
    last_sign_in_at: authUser.last_sign_in_at,
    email_confirmed_at: authUser.email_confirmed_at,
    user_metadata: authUser.user_metadata || null,
  } : null;

  const payload = {
    generated_at: new Date().toISOString(),
    user_id: userId,
    legal_basis: 'DSGVO Art. 15 (Recht auf Auskunft)',
    note: 'Vollständige Kopie der zu Ihrer Person gespeicherten Daten. Bei Fragen: support@praxura.de',
    auth: auth_meta,
    data,
    errors_per_table: Object.keys(errors).length > 0 ? errors : undefined,
    gesperrt,
  };

  return payload;
}
