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
  const token = req.headers.authorization?.slice(7);
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

    // Date-only cutoff for `date` columns (ausstellungsdatum)
    const cutoffDate = cutoffIso.slice(0, 10);

    // Run all 8 queries in parallel
    const [
      belegResult,
      leadsResult,
      sessionsResult,
      abrechnungResult,
      offeneRxResult,
      noShowResult,
      mahnungenResult,
      therapeutenResult,
      aerztePrescriptionsResult,
      aerzteVerordnungenResult,
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

      // 6. No-show sessions in the period
      supabase
        .from('prescription_sessions')
        .select('id, prescriptions!inner(owner_id)')
        .eq('prescriptions.owner_id', tenantId)
        .eq('status', 'no_show')
        .gte('created_at', cutoffIso),

      // 7. Mahnung conversion
      supabase
        .from('mahnungen')
        .select('id, status, created_at')
        .eq('owner_id', tenantId)
        .gte('created_at', cutoffIso),

      // 8. Therapist session counts from bookings
      supabase
        .from('bookings')
        .select('employee_id, profiles:employee_id(first_name, last_name)')
        .eq('owner_id', tenantId)
        .gte('start_date', cutoffIso)
        .neq('status', 'canceled'),

      // 9. Überweisende Ärzte — Pool 1: Physio/Ergo/Logo (prescriptions)
      supabase
        .from('prescriptions')
        .select('arzt_id, patient_id, heilmittel, diagnosegruppe, ausstellungsdatum, aerzte:arzt_id(id, arzt_name, lanr, fachrichtung, telefon, email)')
        .eq('owner_id', tenantId)
        .not('arzt_id', 'is', null)
        .gte('ausstellungsdatum', cutoffDate),

      // 10. Überweisende Ärzte — Pool 2: Podologie (verordnungen)
      supabase
        .from('verordnungen')
        .select('arzt_id, lead_id, patient_name, heilmittel_items, diagnosegruppe, ausstellungsdatum, aerzte:arzt_id(id, arzt_name, lanr, fachrichtung, telefon, email)')
        .eq('owner_id', tenantId)
        .not('arzt_id', 'is', null)
        .gte('ausstellungsdatum', cutoffDate),
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

    // ── 6. No-show rate ───────────────────────────────────────────────────────
    const noShowRows = noShowResult.error ? [] : (noShowResult.data || []);
    const noShowCount = noShowRows.length;
    // Total sessions (done + no_show) for the same period
    const { count: totalSessionsPeriod } = await supabase
      .from('prescription_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('prescriptions.owner_id', tenantId) // Note: may not work with head:true + join, so use noShow+done
      .in('status', ['done', 'no_show'])
      .gte('created_at', cutoffIso);
    const totalForRate = (totalSessionsPeriod || 0) + noShowCount;
    const noShowRate = totalForRate > 0 ? Math.round((noShowCount / totalForRate) * 100) : 0;

    // ── 7. Mahnung conversion ─────────────────────────────────────────────────
    const mahnRows = mahnungenResult.error ? [] : (mahnungenResult.data || []);
    const mahnGesamt = mahnRows.length;
    const mahnBezahlt = mahnRows.filter(m => m.status === 'bezahlt').length;
    const mahnOffen = mahnRows.filter(m => !['bezahlt', 'abgeschrieben'].includes(m.status)).length;

    // ── 8. Therapist efficiency ───────────────────────────────────────────────
    const buchRows = therapeutenResult.error ? [] : (therapeutenResult.data || []);
    const thMap = {};
    for (const b of buchRows) {
      const id = b.employee_id || '__unassigned__';
      const p = b.profiles;
      const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Nicht zugeordnet';
      if (!thMap[id]) thMap[id] = { name, count: 0 };
      thMap[id].count++;
    }
    const therapeuten = Object.values(thMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ── 9. Überweisende Ärzte ─────────────────────────────────────────────────
    // Beide Datenpools zusammenführen: prescriptions (Physio/Ergo/Logo) und
    // verordnungen (Podologie). Die Tabellen bleiben getrennt — hier wird nur
    // für die Auswertung addiert.
    const arztMap = {};

    /** Zählt eine Verordnung auf das Konto ihres Arztes. */
    function erfasseVerordnung({ arzt, arztId, patientKey, heilmittel, diagnosegruppe, datum }) {
      if (!arztId) return;
      if (!arztMap[arztId]) {
        arztMap[arztId] = {
          id:            arztId,
          name:          arzt?.arzt_name || 'Unbekannt',
          lanr:          arzt?.lanr || null,
          fachrichtung:  arzt?.fachrichtung || null,
          telefon:       arzt?.telefon || null,
          email:         arzt?.email || null,
          verordnungen:  0,
          _patienten:    new Set(),
          _heilmittel:   {},
          _diagnosen:    {},
          letzte_verordnung: null
        };
      }
      const e = arztMap[arztId];
      e.verordnungen++;
      if (patientKey) e._patienten.add(patientKey);
      for (const hm of [].concat(heilmittel || [])) {
        if (hm) e._heilmittel[hm] = (e._heilmittel[hm] || 0) + 1;
      }
      if (diagnosegruppe) e._diagnosen[diagnosegruppe] = (e._diagnosen[diagnosegruppe] || 0) + 1;
      if (datum && (!e.letzte_verordnung || datum > e.letzte_verordnung)) e.letzte_verordnung = datum;
    }

    for (const rx of (aerztePrescriptionsResult?.error ? [] : (aerztePrescriptionsResult?.data || []))) {
      erfasseVerordnung({
        arzt:           rx.aerzte,
        arztId:         rx.arzt_id,
        patientKey:     rx.patient_id,
        heilmittel:     rx.heilmittel,
        diagnosegruppe: rx.diagnosegruppe,
        datum:          rx.ausstellungsdatum
      });
    }

    for (const v of (aerzteVerordnungenResult?.error ? [] : (aerzteVerordnungenResult?.data || []))) {
      // Podologie führt mehrere Heilmittel je Verordnung als JSON-Liste.
      const items = Array.isArray(v.heilmittel_items) ? v.heilmittel_items : [];
      erfasseVerordnung({
        arzt:           v.aerzte,
        arztId:         v.arzt_id,
        patientKey:     v.lead_id || (v.patient_name ? `name:${v.patient_name}` : null),
        heilmittel:     items.map(i => i?.bezeichnung || i?.code).filter(Boolean),
        diagnosegruppe: v.diagnosegruppe,
        datum:          v.ausstellungsdatum
      });
    }

    const top = (obj, n = 3) => Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([wert, anzahl]) => ({ wert, anzahl }));

    const aerzte = Object.values(arztMap)
      .map(e => ({
        id:                e.id,
        name:              e.name,
        lanr:              e.lanr,
        fachrichtung:      e.fachrichtung,
        telefon:           e.telefon,
        email:             e.email,
        patienten:         e._patienten.size,
        verordnungen:      e.verordnungen,
        letzte_verordnung: e.letzte_verordnung,
        top_heilmittel:    top(e._heilmittel),
        top_diagnosen:     top(e._diagnosen)
      }))
      // Nach überwiesenen Patienten sortieren — das ist die Frage, die der
      // Inhaber stellt: wer schickt uns die meisten Patienten?
      .sort((a, b) => b.patienten - a.patienten || b.verordnungen - a.verordnungen);

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
      no_show: { count: noShowCount, rate: noShowRate },
      mahnungen: { gesamt: mahnGesamt, bezahlt: mahnBezahlt, offen: mahnOffen },
      therapeuten,
      aerzte,
    });
  } catch (e) {
    console.error('[billing/statistik]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

export default router;
