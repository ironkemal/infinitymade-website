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

    // Date-only cutoff for `date` columns (ausstellungsdatum)
    const cutoffDate = cutoffIso.slice(0, 10);

    // Elf Abfragen parallel. Die Zahlungseingänge laufen bewusst danach,
    // weil sie auf die Rezept-IDs aus Abfrage 5 eingegrenzt werden.
    const [
      belegResult,
      leadsResult,
      sessionsResult,
      abrechnungResult,
      offeneRxResult,
      noShowResult,
      mahnungenResult,
      therapeutenResult,
      ausfallResult,
      aerztePrescriptionsResult,
      aerzteVerordnungenResult,
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

      // 9. Ausfallrechnungen im Zeitraum — offen vs. bezahlt
      supabase
        .from('ausfallrechnungen')
        .select('amount_eur, status, created_at')
        .eq('owner_id', tenantId)
        .gte('created_at', cutoffIso),

      // 11. Überweisende Ärzte — Pool 1: Physio/Ergo/Logo (prescriptions)
      supabase
        .from('prescriptions')
        .select('arzt_id, patient_id, heilmittel, diagnosegruppe, ausstellungsdatum, aerzte:arzt_id(id, arzt_name, lanr, fachrichtung, telefon, email)')
        .eq('owner_id', tenantId)
        .not('arzt_id', 'is', null)
        .gte('ausstellungsdatum', cutoffDate),

      // 12. Überweisende Ärzte — Pool 2: Podologie (verordnungen)
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
    //
    // Zahlungseingänge bewusst OHNE Datumsfilter: eine Zuzahlung kann lange nach
    // Ausstellung des Rezepts eingehen. Dafür auf genau die Rezepte eingegrenzt,
    // um die es hier geht — vorher lief die Abfrage über das gesamte Kassenbuch
    // des Mandanten. Greift dort ein Zeilenlimit, fehlen Zahlungen still und die
    // betroffenen Rezepte gelten fälschlich als offen; genau das soll diese
    // Auswertung ja verhindern. In Blöcken, damit die URL nicht überläuft.
    const offeneRxIds = (offeneRxResult.data || []).map(rx => rx.id);
    const zahlungen = [];
    for (let i = 0; i < offeneRxIds.length; i += 200) {
      const block = offeneRxIds.slice(i, i + 200);
      const { data, error } = await supabase
        .from('belegliste')
        .select('prescription_id, amount_eur')
        .eq('owner_id', tenantId)
        .in('type', ['zuzahlung', 'storno'])
        .in('prescription_id', block);
      if (error) return res.status(500).json({ error: 'belegliste: ' + error.message });
      zahlungen.push(...(data || []));
    }
    const saldoByRx = saldoJeRezept(zahlungen);

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
    // Gesamtsumme aller offenen Forderungen — Zuzahlungen und Ausfallrechnungen.
    //
    // Achtung: das ist NICHT die Summe der gelben Balken. Das Diagramm zeigt nur
    // die letzten `monate` Monate, die Kachel dagegen alles Offene, auch ältere
    // Forderungen. Die Kachel absichtlich so: eine Praxis will wissen, wie viel
    // Geld insgesamt aussteht, nicht wie viel davon zufällig ins Fenster fällt.
    // Damit die Oberfläche die Lücke benennen kann statt sie zu verschweigen,
    // kommt der ausserhalb liegende Anteil separat mit.
    const offen_gesamt_summe = r2(offene_zuzahlungen_summe + offene_ausfall_summe);
    const fensterStart = monatlich.length ? monatlich[0].monat : null;
    const offen_ausserhalb_fenster = fensterStart
      ? r2(Object.entries(offenByMonth)
          .filter(([key]) => key < fensterStart)
          .reduce((s, [, betrag]) => s + betrag, 0))
      : 0;

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
      offene_zuzahlungen_summe,
      offen_gesamt_summe,
      // Anteil von offen_gesamt_summe, der älter ist als das Diagramm-Fenster und
      // deshalb in keinem gelben Balken auftaucht.
      offen_ausserhalb_fenster,
      ausfallrechnungen: {
        offen: offeneAusfall.length,
        offen_summe: offene_ausfall_summe,
        bezahlt: ausfallRows.filter(a => a.status === 'bezahlt').length,
      },
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
