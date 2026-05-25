// Statistik / Analytics HTTP routes.
//
// GET /api/billing/statistik   — aggregated KPI stats for the authenticated tenant

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---------- shared auth helper (same pattern as mahnwesen.routes.js) ----------

async function resolveAuth(req, res) {
  const token = req.query.token || req.headers.authorization?.slice(7);
  if (!token) { res.status(401).json({ error: 'Missing bearer token' }); return null; }

  const { data: u, error: uErr } = await supabase.auth.getUser(token);
  if (uErr || !u?.user) { res.status(401).json({ error: 'Invalid token' }); return null; }

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, role, owner_id')
    .eq('id', u.user.id)
    .single();
  if (pErr || !profile) { res.status(403).json({ error: 'Profile not found' }); return null; }

  const tenantId = profile.role === 'employee' && profile.owner_id
    ? profile.owner_id
    : profile.id;

  return { user: u.user, profile, tenantId };
}

// ============================================================================
// GET /api/billing/statistik
// Query params:
//   monate — number of months to look back (default 6, max 12)
// ============================================================================
router.get('/statistik', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { tenantId } = auth;

    // Clamp monate: 1..12, default 6
    const monate = Math.min(12, Math.max(1, parseInt(req.query.monate, 10) || 6));

    // Cutoff date: now minus N months (JS-native, no raw SQL needed)
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - monate);
    const cutoffIso = cutoff.toISOString();

    // Start of current month (UTC midnight)
    const nowForMonth = new Date();
    const startOfThisMonth = new Date(Date.UTC(nowForMonth.getUTCFullYear(), nowForMonth.getUTCMonth(), 1)).toISOString();

    // Start of last month
    const startOfLastMonth = new Date(Date.UTC(nowForMonth.getUTCFullYear(), nowForMonth.getUTCMonth() - 1, 1)).toISOString();

    // Run all 5 queries in parallel
    const [
      belegResult,
      leadsResult,
      sessionsResult,
      abrechnungResult,
      offeneRxResult,
    ] = await Promise.all([
      // 1. Monthly revenue from belegliste
      supabase
        .from('belegliste')
        .select('created_at, amount_eur')
        .eq('owner_id', tenantId)
        .gte('created_at', cutoffIso),

      // 2. Patient stats from leads
      supabase
        .from('leads')
        .select('id, created_at', { count: 'exact' })
        .eq('owner_id', tenantId),

      // 3. Session stats — sessions done this month + last month
      supabase
        .from('prescription_sessions')
        .select('done_at, status, prescriptions!inner(owner_id)')
        .eq('prescriptions.owner_id', tenantId)
        .eq('status', 'done')
        .gte('done_at', startOfLastMonth),

      // 4. Abrechnung stats
      supabase
        .from('abrechnung')
        .select('id, status, total_eur, created_at')
        .eq('owner_id', tenantId)
        .gte('created_at', cutoffIso),

      // 5. Open prescriptions with unpaid Zuzahlung
      supabase
        .from('prescriptions')
        .select('id', { count: 'exact' })
        .eq('owner_id', tenantId)
        .gt('zuzahlung_eur', 0)
        .eq('zuzahlung_befreit', false)
        .is('abrechnung_id', null),
    ]);

    // Check for fatal errors
    if (belegResult.error) return res.status(500).json({ error: 'belegliste: ' + belegResult.error.message });
    if (leadsResult.error) return res.status(500).json({ error: 'leads: ' + leadsResult.error.message });
    if (abrechnungResult.error) return res.status(500).json({ error: 'abrechnung: ' + abrechnungResult.error.message });
    if (offeneRxResult.error) return res.status(500).json({ error: 'prescriptions: ' + offeneRxResult.error.message });
    // Sessions query may fail if table doesn't exist yet — treat as empty
    const sessionRows = sessionsResult.error ? [] : (sessionsResult.data || []);

    // ── 1. Aggregate monthly revenue in JS ──────────────────────────────────
    const byMonth = {};
    for (const b of (belegResult.data || [])) {
      const key = b.created_at.slice(0, 7); // "2026-04"
      byMonth[key] = (byMonth[key] || 0) + Number(b.amount_eur || 0);
    }

    const monatlich = [];
    for (let i = monate - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1); // avoid month-overflow edge cases
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      monatlich.push({ monat: key, umsatz: Math.round((byMonth[key] || 0) * 100) / 100 });
    }

    // ── 2. Patient stats ─────────────────────────────────────────────────────
    const allLeads = leadsResult.data || [];
    const gesamt = leadsResult.count ?? allLeads.length;
    const neu_diesen_monat = allLeads.filter(l => l.created_at >= startOfThisMonth).length;

    // ── 3. Session stats ─────────────────────────────────────────────────────
    const sitzungen_diesen_monat = sessionRows.filter(s => s.done_at >= startOfThisMonth).length;
    const sitzungen_letzten_monat = sessionRows.filter(
      s => s.done_at >= startOfLastMonth && s.done_at < startOfThisMonth
    ).length;

    // ── 4. Abrechnung stats ──────────────────────────────────────────────────
    const abrRows = abrechnungResult.data || [];
    const abr_gesamt = abrRows.length;
    const abr_akzeptiert = abrRows.filter(a => a.status === 'accepted').length;
    const abr_abgelehnt = abrRows.filter(a => a.status === 'rejected').length;
    const summe_akzeptiert = abrRows
      .filter(a => a.status === 'accepted')
      .reduce((sum, a) => sum + Number(a.total_eur || 0), 0);

    // ── 5. Open prescriptions ────────────────────────────────────────────────
    const offene_zuzahlungen = offeneRxResult.count ?? (offeneRxResult.data || []).length;

    return res.json({
      monatlich,
      patienten: {
        gesamt,
        neu_diesen_monat,
      },
      sitzungen: {
        diesen_monat: sitzungen_diesen_monat,
        letzten_monat: sitzungen_letzten_monat,
      },
      abrechnung: {
        gesamt: abr_gesamt,
        akzeptiert: abr_akzeptiert,
        abgelehnt: abr_abgelehnt,
        summe_akzeptiert: Math.round(summe_akzeptiert * 100) / 100,
      },
      offene_zuzahlungen,
    });
  } catch (e) {
    console.error('[billing/statistik]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

export default router;
