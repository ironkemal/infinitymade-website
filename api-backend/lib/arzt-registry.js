// ============================================================================
// Ärzte-Register — zentrale Auflösung "diesen Arzt kenne ich schon / kenne ich nicht"
//
// Jeder Weg, auf dem eine Verordnung ins System kommt, geht hier durch:
//   * KI-Rezeptscan            -> /api/rezept/confirm
//   * manuelle Rezepterfassung -> /api/arzt/resolve   (Dashboard)
//   * Podologie-Verordnung     -> /api/arzt/resolve   (Dashboard)
//   * Ärzte-Verwaltung         -> /api/arzt/resolve   (Dashboard, quelle=manuell)
//
// Identität
// ---------
// Schlüssel ist die **LANR** (Lebenslange Arztnummer). Sie ist an die Person
// gebunden und überlebt Heirat (Namensänderung) wie Praxiswechsel (Adresse,
// BSNR, Telefon ändern sich, die LANR nicht). Deshalb:
//
//   LANR gleich  -> derselbe Arzt, auch bei anderem Namen. Name/Adresse/BSNR
//                   werden aktualisiert (der neuere Beleg gewinnt).
//   keine LANR   -> Rückfall auf den normalisierten Namen. Schwächer, aber
//                   besser als bei jeder Verordnung einen Doppelten anzulegen.
//
// Anreicherung statt Überschreiben: leere Felder werden gefüllt, gefüllte
// Felder bleiben stehen — ausser den beweglichen Stammdaten bei LANR-Treffer.
// So sammelt die Praxis über die Zeit ein vollständiges Arztverzeichnis, ohne
// dass ein schlecht gescanntes Rezept gute Daten zerstört.
// ============================================================================

/** Normalisiert einen Arztnamen für den Namensvergleich (Fallback ohne LANR). */
export function normalizeArztName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** LANR/BSNR: nur Ziffern, exakt 9 Stellen. Alles andere gilt als "nicht vorhanden". */
function cleanNummer(v) {
  const digits = String(v || '').replace(/\D/g, '');
  return /^\d{9}$/.test(digits) ? digits : null;
}

function clean(v) {
  const s = String(v ?? '').trim();
  return s || null;
}

/**
 * Findet den Arzt oder legt ihn an. Reichert vorhandene Datensätze an.
 *
 * @param {object}  supabase  Service-Role-Client
 * @param {string}  ownerId   Mandant (profiles.owner_id-Wurzel)
 * @param {object}  input     { name, lanr, bsnr, adresse, telefon, fax, email,
 *                              fachrichtung, praxis_name, notizen }
 * @param {object} [opts]     { businessId, quelle }
 * @returns {Promise<{id: string|null, created: boolean, enriched: string[], matchedBy: 'lanr'|'name'|null}>}
 */
export async function resolveOrCreateArzt(supabase, ownerId, input = {}, opts = {}) {
  const empty = { id: null, created: false, enriched: [], matchedBy: null };
  if (!ownerId) return empty;

  const lanr = cleanNummer(input.lanr);
  const name = normalizeArztName(input.name);

  // Ohne irgendeinen Anker lässt sich kein Arzt führen.
  if (!lanr && !name) return empty;

  const incoming = {
    arzt_name:    name || null,
    lanr,
    bsnr:         cleanNummer(input.bsnr),
    adresse:      clean(input.adresse),
    telefon:      clean(input.telefon),
    fax:          clean(input.fax),
    email:        clean(input.email),
    fachrichtung: clean(input.fachrichtung),
    praxis_name:  clean(input.praxis_name),
    notizen:      clean(input.notizen)
  };

  // ---- 1. Treffer suchen: erst LANR, dann Name --------------------------
  let existing = null;
  let matchedBy = null;

  if (lanr) {
    const { data } = await supabase
      .from('aerzte')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('lanr', lanr)
      .maybeSingle();
    if (data) { existing = data; matchedBy = 'lanr'; }
  }

  if (!existing && name) {
    // Nur Datensätze ohne LANR über den Namen greifen. Ein Datensatz MIT LANR
    // ist bereits eindeutig identifiziert — ein Namenstreffer darauf wäre
    // Zufall (zwei Ärzte gleichen Namens sind real).
    const { data } = await supabase
      .from('aerzte')
      .select('*')
      .eq('owner_id', ownerId)
      .is('lanr', null)
      .ilike('arzt_name', name)
      .maybeSingle();
    if (data) { existing = data; matchedBy = 'name'; }
  }

  // ---- 2. Vorhandenen Datensatz anreichern ------------------------------
  if (existing) {
    const patch = {};

    // Bewegliche Stammdaten: bei LANR-Treffer gewinnt der neuere Beleg.
    // Der Arzt hat geheiratet oder ist umgezogen — genau dafür ist die LANR da.
    const mutable = ['arzt_name', 'bsnr', 'adresse', 'telefon', 'fax', 'praxis_name'];
    // Alles Übrige wird nur ergänzt, nie ersetzt.
    const fillOnly = ['email', 'fachrichtung', 'notizen'];

    for (const key of mutable) {
      const val = incoming[key];
      if (!val) continue;
      if (matchedBy === 'lanr') {
        if (existing[key] !== val) patch[key] = val;
      } else if (!existing[key]) {
        patch[key] = val;
      }
    }
    for (const key of fillOnly) {
      if (incoming[key] && !existing[key]) patch[key] = incoming[key];
    }
    // Namenstreffer, der jetzt eine LANR mitbringt: Identität nachtragen.
    if (!existing.lanr && lanr) patch.lanr = lanr;

    if (Object.keys(patch).length) {
      const { error } = await supabase.from('aerzte').update(patch).eq('id', existing.id);
      if (error) {
        console.error('[arzt-registry] Anreicherung fehlgeschlagen', error.message);
        return { id: existing.id, created: false, enriched: [], matchedBy };
      }
    }
    return { id: existing.id, created: false, enriched: Object.keys(patch), matchedBy };
  }

  // ---- 3. Neu anlegen ---------------------------------------------------
  const row = { owner_id: ownerId, ...incoming };
  // arzt_name ist NOT NULL. Ohne gelesenen Namen einen sprechenden Platzhalter
  // aus der LANR bilden, damit der Datensatz auffindbar und korrigierbar bleibt.
  if (!row.arzt_name) row.arzt_name = `Unbekannt (LANR ${lanr})`;
  if (opts.businessId) row.business_id = opts.businessId;
  if (opts.quelle) row.quelle = opts.quelle;

  const { data: created, error } = await supabase
    .from('aerzte')
    .insert(row)
    .select('id')
    .single();

  if (!error && created) {
    return { id: created.id, created: true, enriched: [], matchedBy: null };
  }

  // 23505 = unique_violation. Zwei parallele Rezepte desselben Arztes: der
  // andere Request war schneller. Treffer erneut lesen statt zu scheitern.
  if (error?.code === '23505') {
    let q = supabase.from('aerzte').select('id').eq('owner_id', ownerId);
    q = lanr ? q.eq('lanr', lanr) : q.is('lanr', null).ilike('arzt_name', row.arzt_name);
    const { data: raced } = await q.maybeSingle();
    if (raced) return { id: raced.id, created: false, enriched: [], matchedBy: lanr ? 'lanr' : 'name' };
  }

  console.error('[arzt-registry] Anlegen fehlgeschlagen', error?.message);
  return empty;
}
