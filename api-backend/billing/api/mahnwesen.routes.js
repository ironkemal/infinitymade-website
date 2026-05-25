// Mahnwesen (dunning) HTTP routes.
//
// GET  /api/billing/mahnwesen/offene        — prescriptions eligible for dunning
// POST /api/billing/mahnwesen/create        — create + render a Mahnung letter (HTML)
// PATCH /api/billing/mahnwesen/:id/status   — mark mahnung bezahlt / abgeschrieben

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { renderMahnung } from '../pdf/mahnung.template.js';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---------- shared auth helper ----------

async function resolveAuth(req, res) {
  const token = req.query.token || req.headers.authorization?.slice(7);
  if (!token) { res.status(401).json({ error: 'Missing bearer token' }); return null; }

  const { data: u, error: uErr } = await supabase.auth.getUser(token);
  if (uErr || !u?.user) { res.status(401).json({ error: 'Invalid token' }); return null; }

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, role, owner_id, business_name, phone, city, zip, street, house_number, ik_number, email')
    .eq('id', u.user.id)
    .single();
  if (pErr || !profile) { res.status(403).json({ error: 'Profile not found' }); return null; }

  const tenantId = profile.role === 'employee' && profile.owner_id
    ? profile.owner_id
    : profile.id;

  return { user: u.user, profile, tenantId };
}

// ---------- neue_faelligkeit helper ----------

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const LEVEL_DAYS = { 1: 14, 2: 10, 3: 7 };

// ============================================================================
// GET /api/billing/mahnwesen/offene
// Returns prescriptions with unpaid Zuzahlung eligible for dunning.
// ============================================================================
router.get('/mahnwesen/offene', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { tenantId } = auth;

    // 1. Fetch prescriptions with unpaid Zuzahlung that have been billed
    const { data: rxRows, error: rxErr } = await supabase
      .from('prescriptions')
      .select(`
        id, owner_id, patient_id, zuzahlung_eur, zuzahlung_befreit,
        abrechnung_id, ausstellungsdatum,
        leads:patient_id (first_name, last_name, versichertennummer, street, plz, city)
      `)
      .eq('owner_id', tenantId)
      .gt('zuzahlung_eur', 0)
      .eq('zuzahlung_befreit', false)
      .not('abrechnung_id', 'is', null);

    if (rxErr) return res.status(500).json({ error: rxErr.message });
    if (!rxRows || rxRows.length === 0) return res.json([]);

    const rxIds = rxRows.map(r => r.id);

    // 2. Find prescriptions already paid via belegliste (type='zuzahlung')
    const { data: paidEntries } = await supabase
      .from('belegliste')
      .select('prescription_id')
      .eq('owner_id', tenantId)
      .eq('type', 'zuzahlung')
      .in('prescription_id', rxIds);

    const paidRxIds = new Set((paidEntries || []).map(e => e.prescription_id).filter(Boolean));

    // 3. Fetch latest mahnung per prescription
    const { data: mahnungen } = await supabase
      .from('mahnungen')
      .select('prescription_id, level, status, sent_at')
      .eq('owner_id', tenantId)
      .in('prescription_id', rxIds)
      .order('created_at', { ascending: false });

    // Build a map: prescription_id → latest mahnung
    const latestMahnung = new Map();
    for (const m of (mahnungen || [])) {
      if (!latestMahnung.has(m.prescription_id)) {
        latestMahnung.set(m.prescription_id, {
          level: m.level,
          status: m.status,
          sent_at: m.sent_at,
        });
      }
    }

    // 4. Build response — exclude paid prescriptions
    const result = rxRows
      .filter(rx => !paidRxIds.has(rx.id))
      .map(rx => ({
        id: rx.id,
        patient: {
          first_name: rx.leads?.first_name || '',
          last_name:  rx.leads?.last_name  || '',
        },
        zuzahlung_eur:    rx.zuzahlung_eur,
        abrechnung_id:    rx.abrechnung_id,
        ausstellungsdatum: rx.ausstellungsdatum,
        latest_mahnung:   latestMahnung.get(rx.id) || null,
      }));

    return res.json(result);
  } catch (e) {
    console.error('[mahnwesen/offene]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ============================================================================
// POST /api/billing/mahnwesen/create
// Body: { prescriptionId, level }
// Returns text/html Mahnung letter for browser printing.
// ============================================================================
router.post('/mahnwesen/create', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { user, profile, tenantId } = auth;

    const { prescriptionId, level } = req.body || {};
    if (!prescriptionId) return res.status(400).json({ error: 'prescriptionId required' });
    const lvl = parseInt(level, 10);
    if (![1, 2, 3].includes(lvl)) return res.status(400).json({ error: 'level must be 1, 2 or 3' });

    // 1. Fetch prescription + patient
    const { data: rx, error: rxErr } = await supabase
      .from('prescriptions')
      .select(`
        id, owner_id, patient_id, zuzahlung_eur, zuzahlung_befreit,
        abrechnung_id, ausstellungsdatum,
        leads:patient_id (first_name, last_name, street, plz, city, versichertennummer)
      `)
      .eq('id', prescriptionId)
      .single();

    if (rxErr || !rx) return res.status(404).json({ error: 'Prescription not found' });
    if (rx.owner_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });
    if (!rx.abrechnung_id) return res.status(400).json({ error: 'Prescription not yet billed' });
    if (rx.zuzahlung_befreit || !(rx.zuzahlung_eur > 0)) {
      return res.status(400).json({ error: 'No unpaid Zuzahlung on this prescription' });
    }

    // 2. Fetch owner profile for praxis details (may differ from logged-in employee)
    let praxisProfile = profile;
    if (profile.role === 'employee' && profile.owner_id) {
      const { data: ownerProf } = await supabase
        .from('profiles')
        .select('id, business_name, phone, city, zip, street, house_number, ik_number, email')
        .eq('id', profile.owner_id)
        .single();
      if (ownerProf) praxisProfile = ownerProf;
    }

    // 3. Compute neue_faelligkeit
    const now = new Date();
    const daysToAdd = LEVEL_DAYS[lvl] ?? 14;
    const neue_faelligkeit = addDays(now, daysToAdd);

    // Derive original_faelligkeit: ausstellungsdatum + 14 days (standard Zahlungsziel)
    const original_faelligkeit = rx.ausstellungsdatum
      ? addDays(new Date(rx.ausstellungsdatum), 14)
      : now;

    // original_rechnung_nr: use prescription id slice (same as Zuzahlungsrechnung template)
    const original_rechnung_nr = `ZU-${rx.id.slice(0, 8).toUpperCase()}`;

    // 4. Insert into mahnungen (mahnung_nr auto-assigned via DB trigger → insert null/0)
    const { data: mahnungRow, error: insErr } = await supabase
      .from('mahnungen')
      .insert({
        owner_id:           tenantId,
        prescription_id:    rx.id,
        patient_id:         rx.patient_id,
        level:              lvl,
        amount_eur:         rx.zuzahlung_eur,
        original_faelligkeit: original_faelligkeit.toISOString(),
        neue_faelligkeit:   neue_faelligkeit.toISOString(),
        sent_at:            now.toISOString(),
        status:             'offen',
      })
      .select('id, mahnung_nr')
      .single();

    if (insErr) return res.status(500).json({ error: 'mahnungen insert failed: ' + insErr.message });

    // 5. Render HTML letter
    const strasse = [praxisProfile.street, praxisProfile.house_number].filter(Boolean).join(' ');
    const plz_ort = [praxisProfile.zip, praxisProfile.city].filter(Boolean).join(' ').trim();

    const html = renderMahnung({
      praxis: {
        name:     praxisProfile.business_name || 'Praxis für Physiotherapie',
        strasse,
        plz_ort,
        telefon:  praxisProfile.phone || '',
        email:    praxisProfile.email || user.email || '',
        ik:       praxisProfile.ik_number || '',
      },
      patient: {
        vorname:  rx.leads?.first_name || '',
        nachname: rx.leads?.last_name  || '',
        strasse:  rx.leads?.street     || '',
        plz:      rx.leads?.plz        || '',
        ort:      rx.leads?.city       || '',
      },
      level:                  lvl,
      mahnung_nr:             mahnungRow.mahnung_nr ?? 0,
      amount_eur:             rx.zuzahlung_eur,
      original_rechnung_nr,
      original_faelligkeit,
      neue_faelligkeit,
      bankverbindung:         '', // owner fills this in their profile/settings — not stored yet
      datum:                  now,
    });

    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    console.error('[mahnwesen/create]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ============================================================================
// PATCH /api/billing/mahnwesen/:id/status
// Body: { status } — 'bezahlt' | 'abgeschrieben'
// ============================================================================
router.patch('/mahnwesen/:id/status', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { tenantId } = auth;

    const { status } = req.body || {};
    if (!['bezahlt', 'abgeschrieben'].includes(status)) {
      return res.status(400).json({ error: "status must be 'bezahlt' or 'abgeschrieben'" });
    }

    // Verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from('mahnungen')
      .select('id, owner_id')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Mahnung not found' });
    if (existing.owner_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });

    const { error: upErr } = await supabase
      .from('mahnungen')
      .update({ status })
      .eq('id', req.params.id);

    if (upErr) return res.status(500).json({ error: upErr.message });

    return res.json({ ok: true });
  } catch (e) {
    console.error('[mahnwesen/status]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

export default router;
