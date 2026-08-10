// Statistik / Analytics HTTP routes.
//
// GET /api/billing/statistik   — aggregated KPI stats for the authenticated tenant

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { istZuzahlungBezahlt, saldoJeRezept } from '../zuzahlung/bezahlt.js';

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

    // Run all 10 queries in parallel
    const [
      belegResult,
      leadsResult,
      sessionsResult,
      abrechnungResult,
      offeneRxResult,
      noShowResult,
      mahnungenResult,
      therapeutenResult,
      zahlungenResult,
      ausfallResult,
    ] = await Promise.all([
      // 1. Kassenbuch im Zeitraum. `type` wird mitgelesen, weil die Grafik
      //    Forderungen (Zuzahlung + Ausfall) gegen Offenes stellt — ein
      //    Barverkauf gehört nicht in diesen Vergleich, wohl aber in den
      //    Gesamtumsatz.
      supabase
        .from('belegliste')
        .select('created_at, amount_eur, type')
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

      // 5. Rezepte mit Zuzahlungspflicht. Ob sie offen sind, entscheidet der
      //    Kassenbuch-Saldo (Abfrage 9) — nicht abrechnung_id. Der frühere
      //    Filter `abrechnung_id IS NULL` bedeutete "noch nicht bei der Kasse
      //    eingereicht" und hatte mit der Patientenzahlung nichts zu tun.
      supabase
        .from('prescriptions')
        .select('id, zuzahlung_eur, ausstellungsdatum, zuzahlung_kassiert_am')
        .eq('owner_id', tenantId)
        .gt('zuzahlung_eur', 0)
        .eq('zuzahlung_befreit', false),

      // 6. No-show sessions in the period
      supabase
        .from('prescription_sessions')
        .select('id, prescriptions!inner(owner_id)')
        .eq('prescriptions.owner_id', tenantId)
        .eq('status', 'no_show')
        .gte('created_at', cutoffIso),

      // 7. Mahnung conversion
      //    sent_at statt created_at: die Tabelle mahnungen hat kein created_at
      //    (database_v28_mahnwesen.sql). Die Abfrage lief bisher in einen Fehler
      //    und die Mahnungs-Kennzahlen standen deshalb immer auf 0.
      supabase
        .from('mahnungen')
        .select('id, status, sent_at')
        .eq('owner_id', tenantId)
        .gte('sent_at', cutoffIso),

      // 8. Therapist session counts from bookings
      //    start_time statt start_date: bookings hat kein start_date. Auch diese
      //    Abfrage schlug fehl, die Therapeutenliste blieb immer leer.
      supabase
        .from('bookings')
        .select('employee_id, profiles:employee_id(first_name, last_name)')
        .eq('owner_id', tenantId)
        .gte('start_time', cutoffIso)
        // 'cancelled' mit zwei l — so steht es in bookings_status_check und in
        // jeder anderen Abfrage. Mit 'canceled' traf die Bedingung nie, seit der
        // start_time-Fix die Abfrage ueberhaupt durchlaesst zaehlten stornierte
        // Termine als geleistete Sitzungen mit.
        .neq('status', 'cancelled'),

      // 9. Zahlungseingänge je Rezept — bewusst OHNE Datumsfilter: eine
      //    Zuzahlung kann lange nach Ausstellung des Rezepts eingehen. Stornos
      //    sind negativ gespeichert und rechnen sich damit von selbst gegen.
      supabase
        .from('belegliste')
        .select('prescription_id, amount_eur')
        .eq('owner_id', tenantId)
        .in('type', ['zuzahlung', 'storno'])
        .not('prescription_id', 'is', null),

      // 10. Ausfallrechnungen im Zeitraum — offen vs. bezahlt
      supabase
        .from('ausfallrechnungen')
        .select('amount_eur, status, created_at')
        .eq('owner_id', tenantId)
        .gte('created_at', cutoffIso),
    ]);

    // Check for fatal errors
    if (belegResult.error) return res.status(500).json({ error: 'belegliste: ' + belegResult.error.message });
    if (leadsResult.error) return res.status(500).json({ error: 'leads: ' + leadsResult.error.message });
    if (abrechnungResult.error) return res.status(500).json({ error: 'abrechnung: ' + abrechnungResult.error.message });
    if (offeneRxResult.error) return res.status(500).json({ error: 'prescriptions: ' + offeneRxResult.error.message });
    // Sessions query may fail if table doesn't exist yet — treat as empty
    const sessionRows = sessionsResult.error ? [] : (sessionsResult.data || []);

    const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

    // ── 1a. Einnahmen je Monat aus dem Kassenbuch ───────────────────────────
    // Stornos liegen mit negativem Betrag in der Tabelle (siehe
    // billing/belegliste/helper.js), die Summe rechnet sie also von selbst raus.
    //
    // Zwei getrennte Reihen:
    //   umsatz  = alles (auch Barverkäufe) — die bisherige Bedeutung, unverändert
    //   bezahlt = nur Forderungen (Zuzahlung, Ausfall, deren Stornos) — das ist
    //             die Reihe, die im Diagramm gegen "offen" gestellt wird.
    //             Ein Barverkauf hat mit offenen Forderungen nichts zu tun und
    //             würde den Vergleich verfälschen.
    const FORDERUNGS_TYPEN = new Set(['zuzahlung', 'ausfall', 'storno']);
    const umsatzByMonth = {};
    const bezahltByMonth = {};
    for (const b of (belegResult.data || [])) {
      const key = b.created_at.slice(0, 7); // "2026-04"
      const betrag = Number(b.amount_eur || 0);
      umsatzByMonth[key] = (umsatzByMonth[key] || 0) + betrag;
      if (FORDERUNGS_TYPEN.has(b.type)) {
        bezahltByMonth[key] = (bezahltByMonth[key] || 0) + betrag;
      }
    }

    // ── 1b. Offen je Monat ───────────────────────────────────────────────────
    // Regel steht in zuzahlung/bezahlt.js — dieselbe wie im Mahnwesen.
    if (zahlungenResult.error) {
      return res.status(500).json({ error: 'belegliste: ' + zahlungenResult.error.message });
    }
    const saldoByRx = saldoJeRezept(zahlungenResult.data);

    const offeneRx = (offeneRxResult.data || []).filter(rx => !istZuzahlungBezahlt({
      zuzahlungEur: rx.zuzahlung_eur,
      kassiertAm: rx.zuzahlung_kassiert_am,
      saldo: saldoByRx.get(rx.id) || 0,
    }));

    const offenByMonth = {};
    for (const rx of offeneRx) {
      if (!rx.ausstellungsdatum) continue; // ohne Datum keinem Monat zuzuordnen
      const key = String(rx.ausstellungsdatum).slice(0, 7);
      offenByMonth[key] = (offenByMonth[key] || 0) + Number(rx.zuzahlung_eur || 0);
    }
    // Unbezahlte Ausfallrechnungen zählen ebenfalls als offener Betrag.
    const ausfallRows = ausfallResult.error ? [] : (ausfallResult.data || []);
    for (const a of ausfallRows) {
      if (a.status !== 'offen') continue;
      const key = a.created_at.slice(0, 7);
      offenByMonth[key] = (offenByMonth[key] || 0) + Number(a.amount_eur || 0);
    }

    const monatlich = [];
    for (let i = monate - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1); // avoid month-overflow edge cases
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      monatlich.push({
        monat: key,
        umsatz: r2(umsatzByMonth[key]),    // alle Belegarten — Bedeutung wie bisher
        bezahlt: r2(bezahltByMonth[key]),  // nur Forderungen, gehört zu `offen`
        offen: r2(offenByMonth[key]),
      });
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

    // ── 5. Offene Zuzahlungen ────────────────────────────────────────────────
    // Rückwärtskompatibel: offene_zuzahlungen bleibt eine Anzahl. Die Summe
    // kommt zusätzlich, weil "17 offene Rezepte" ohne Betrag wenig aussagt.
    const offene_zuzahlungen = offeneRx.length;
    const offene_zuzahlungen_summe = r2(offeneRx.reduce((s, rx) => s + Number(rx.zuzahlung_eur || 0), 0));
    const offeneAusfall = ausfallRows.filter(a => a.status === 'offen');
    const offene_ausfall_summe = r2(offeneAusfall.reduce((s, a) => s + Number(a.amount_eur || 0), 0));
    // Gesamtsumme, damit die Kachel denselben Wert zeigt wie die gelben Balken
    // im Diagramm — dort sind Ausfallrechnungen ebenfalls enthalten.
    const offen_gesamt_summe = r2(offene_zuzahlungen_summe + offene_ausfall_summe);

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
      offene_zuzahlungen_summe,
      offen_gesamt_summe,
      ausfallrechnungen: {
        offen: offeneAusfall.length,
        offen_summe: offene_ausfall_summe,
        bezahlt: ausfallRows.filter(a => a.status === 'bezahlt').length,
      },
      no_show: { count: noShowCount, rate: noShowRate },
      mahnungen: { gesamt: mahnGesamt, bezahlt: mahnBezahlt, offen: mahnOffen },
      therapeuten,
    });
  } catch (e) {
    console.error('[billing/statistik]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

export default router;
