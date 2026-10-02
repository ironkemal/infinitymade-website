// DSGVO Art. 17 Recht auf Loeschung — Fall B (SaaS-Kontoloeschung).
//
// Rechtliche Vorgaben (compliance/LEGAL_DECISIONS.md 2026-10-02 §4, K1.4):
//   1. Stripe zuerst kuendigen (Customer bleibt fuer eigene Buchhaltung).
//   2. Prescriptions klassifizieren: behandelt -> Sperrbestand, unbehandelt -> loeschen.
//   3. Sperrbestand in aufbewahrung_sperre festschreiben.
//   4. Loeschbare Tabellen bereinigen (Kinder vor Eltern).
//   5. leads ohne Bezug loeschen, mit Bezug auf Minimalsatz reduzieren.
//   6. businesses / aerzte nur loeschen wenn kein Sperrbestand existiert.
//   7. Storage bereinigen (behaltene Dokumente ausnehmen, avatars leeren).
//   8. Auth-Konten sperren statt loeschen (guvenlik S-40: CASCADE wuerde Sperrbestand toeten).
//   9. profiles anonymisieren (plan_status='deleted', ik_number bleibt).
//  10. Ehrliche Rueckmeldung: geloescht | teilweise_geloescht | fehler.

import { KATEGORIEN, BUCKETS, LEAD_BEZUEGE } from './klassifikation.js';
import { jahresendePlus } from '../lib/berlin-tag.js';

/**
 * Erzeugt den deutschen Antworttext fuer Fall B mit Frist-Bullets je Kategorie.
 *
 * @param {Array<{ kategorie: string, label: string, grundlage: string, gesperrt_bis: string }>} gesperrt
 * @returns {string}
 */
export function antworttextFallB(gesperrt = []) {
  if (!gesperrt || gesperrt.length === 0) {
    return 'Ihr Konto wurde gelöscht. Es verbleiben keine aufbewahrungspflichtigen Unterlagen.';
  }

  const bullets = gesperrt.map(({ label, grundlage, gesperrt_bis }) => {
    let datumFormatted = gesperrt_bis;
    if (typeof gesperrt_bis === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(gesperrt_bis)) {
      const [y, m, d] = gesperrt_bis.split('-');
      datumFormatted = `${d}.${m}.${y}`;
    }
    return `• ${label} (${grundlage}) – gesperrt bis frühestens ${datumFormatted}`;
  }).join('\n');

  return (
    'Ihr Konto wurde gelöscht – mit einer Ausnahme: Für die folgenden Unterlagen bestehen für Ihre Praxis ' +
    'gesetzliche Aufbewahrungspflichten. Wir verwahren sie in Ihrem Auftrag gesperrt (kein Zugriff, keine weitere ' +
    'Verarbeitung) und löschen sie nach Fristablauf automatisch:\n' +
    bullets + '\n' +
    'Eine vollständige Kopie dieser Unterlagen wurde Ihnen vor der Löschung zum Abruf bereitgestellt. Auf Anforderung ' +
    '(z. B. bei einer Betriebsprüfung) stellen wir sie erneut bereit oder löschen sie nach Herausgabe vollständig.'
  );
}

/**
 * Fuehrt die vollstaendige SaaS-Kontoloeschung nach Fall B durch.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} params
 * @param {string} params.ownerId
 * @param {string} [params.ownerEmail]
 * @param {string} params.vorgangId
 * @param {string} [params.stripeKey]
 * @returns {Promise<{ status: 'geloescht'|'teilweise_geloescht'|'fehler', gesperrt: Array<object>, unerwartet: string[], log: Array<object>, stripe_fehler?: boolean }>}
 */
export async function kontoLoeschen(supabase, { ownerId, ownerEmail, vorgangId, stripeKey }) {
  const log = [];
  const unerwartet = [];
  const gesperrt = [];

  // ── 1. Stripe zuerst ────────────────────────────────────────────────────────
  // profiles lesen: stripe_subscription_id pruefen
  let stripeSubId = null;
  try {
    const { data: prof, error: pErr } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', ownerId)
      .maybeSingle();

    if (pErr) throw pErr;
    stripeSubId = prof?.stripe_subscription_id || null;
  } catch (err) {
    // Ohne Abo-Kenntnis kein Löschen — sonst läuft ein Abo eines gelöschten Kontos weiter.
    console.error('[dsgvo-loeschen] Stripe Profil-Lookup fehlgeschlagen — Abbruch vor jeder Loeschung:', err.message);
    return { status: 'fehler', gesperrt: [], unerwartet: ['profiles:stripe'], log: [{ step: 'stripe:profile_lookup', ok: false }] };
  }

  if (stripeSubId) {
    if (!stripeKey) {
      console.error('[dsgvo-loeschen] STRIPE_SECRET_KEY fehlt — Abbruch vor jeder Loeschung');
      return {
        status: 'fehler',
        stripe_fehler: true,
        gesperrt: [],
        unerwartet: ['stripe'],
        log: [{ step: 'stripe:cancel_subscription', ok: false, error: 'STRIPE_SECRET_KEY fehlt' }],
      };
    }

    try {
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(stripeSubId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${stripeKey}` },
      });

      if (!res.ok && res.status !== 404) {
        console.error(`[dsgvo-loeschen] Stripe Kuendigung fehlgeschlagen: HTTP ${res.status}`);
        return {
          status: 'fehler',
          stripe_fehler: true,
          gesperrt: [],
          unerwartet: ['stripe'],
          log: [{ step: 'stripe:cancel_subscription', ok: false, status: res.status }],
        };
      }
      log.push({ step: 'stripe:cancel_subscription', ok: true, status: res.status });
    } catch (err) {
      console.error('[dsgvo-loeschen] Stripe Netzfehler:', err.message);
      return {
        status: 'fehler',
        stripe_fehler: true,
        gesperrt: [],
        unerwartet: ['stripe'],
        log: [{ step: 'stripe:cancel_subscription', ok: false, error: err.message }],
      };
    }
    // Stripe Customer wird bewusst NICHT geloescht (unsere eigenen Belege nach § 147 AO, legal-de Punkt 7).
  }

  // ── 2. Behandelt-Regel fuer prescriptions (db-ustasi) ───────────────────────
  // VO ist behandelt wenn belegnummer, abrechnung_id oder abrechnung_status gesetzt ist,
  // oder Relationen auf Behandlungen/Sitzungen/Rechnungen existieren.
  const behandelteVoIds = new Set();
  const unbehandelteVoIds = new Set();

  try {
    const { data: vos, error: voErr } = await supabase
      .from('prescriptions')
      .select('id, belegnummer, abrechnung_id, abrechnung_status, zuzahlung_kassiert_am, zuzahlung_kassiert_eur, status')
      .eq('owner_id', ownerId);

    if (voErr) throw voErr;

    const kandidaten = [];
    for (const vo of vos || []) {
      // Kassierte Zuzahlung = Beleg; in_therapy/completed/billed = Behandlung begonnen/abgerechnet.
      if (vo.belegnummer || vo.abrechnung_id || vo.abrechnung_status
        || vo.zuzahlung_kassiert_am || Number(vo.zuzahlung_kassiert_eur || 0) > 0
        || ['in_therapy', 'completed', 'billed'].includes(vo.status)) {
        behandelteVoIds.add(vo.id);
      } else {
        kandidaten.push(vo.id);
      }
    }

    if (kandidaten.length > 0) {
      // Hilfsfunktion: Pruefe Relation auf Vorhandensein
      async function pruefeRelation(tabelle, spalte, filterExtra = null) {
        try {
          let q = supabase.from(tabelle).select(spalte).in(spalte, kandidaten);
          if (filterExtra) {
            for (const [k, v] of Object.entries(filterExtra)) q = q.eq(k, v);
          }
          const { data: rows, error } = await q;
          // supabase-js wirft nicht, es liefert { error } — ein Fehler darf NIE zu
          // „unbehandelt → löschen" führen. Fail-closed: alle Kandidaten gelten als behandelt.
          if (error) throw error;
          if (rows) {
            for (const r of rows) {
              const val = r[spalte];
              if (val) behandelteVoIds.add(val);
            }
          }
        } catch (e) {
          console.error(`[dsgvo-loeschen] Fehler beim Behandelt-Check (${tabelle}) — alle Kandidaten bleiben:`, e.message);
          for (const id of kandidaten) behandelteVoIds.add(id);
        }
      }

      await pruefeRelation('prescription_sessions', 'prescription_id', { status: 'done' });
      await pruefeRelation('podologie_behandlungen', 'verordnung_id');
      await pruefeRelation('bookings', 'verordnung_id', { status: 'completed' });
      await pruefeRelation('invoices', 'prescription_id');
      await pruefeRelation('invoices', 'verordnung_id');
      await pruefeRelation('abrechnung_zeile', 'prescription_id');
      await pruefeRelation('belegliste', 'prescription_id');
      await pruefeRelation('zuzahlung_korrekturen', 'prescription_id');
      await pruefeRelation('zuzahlung_korrekturen', 'verordnung_id');
      await pruefeRelation('messreihen', 'prescription_id');
      // Diese hängen per CASCADE/SET NULL an der VO (FKs live 02.10.2026) — ohne sie verlöre
      // ein Delete eine Mahnung (Geschäftsbrief, CASCADE!) bzw. den Belegbezug.
      await pruefeRelation('mahnungen', 'prescription_id');
      await pruefeRelation('zaa_fehler', 'prescription_id');
      await pruefeRelation('zuzahlung_guthaben', 'quelle_prescription_id');
      await pruefeRelation('zuzahlung_guthaben', 'quelle_verordnung_id');

      for (const id of kandidaten) {
        if (!behandelteVoIds.has(id)) {
          unbehandelteVoIds.add(id);
        }
      }
    }
    log.push({ step: 'prescriptions:classify', ok: true, behandelt: behandelteVoIds.size, unbehandelt: unbehandelteVoIds.size });
  } catch (err) {
    // Ohne Klassifikation weder Sperre noch Löschung entscheidbar → Abbruch, nichts gelöscht.
    console.error('[dsgvo-loeschen] VO-Klassifikation fehlgeschlagen — Abbruch vor jeder Loeschung:', err.message);
    return { status: 'fehler', gesperrt: [], unerwartet: ['prescriptions:classify'], log };
  }

  // ── 3. Sperrbestand ermitteln & aufbewahrung_sperre schreiben ────────────────
  // Fristen je Kategorie berechnen und Sperre eintragen
  const fristKategorien = ['behandlung', 'einwilligung', 'beleg', 'grundaufzeichnung', 'geschaeftsbrief'];
  const KATEGORIE_TABELLEN = {
    behandlung: ['podologie_behandlungen', 'anamnese', 'pat_fussbefund', 'messreihen', 'patient_notes', 'ueberweisungen'],
    einwilligung: ['patient_consents'],
    beleg: ['invoices', 'ausfallrechnungen', 'abrechnung', 'abrechnung_zeile', 'abrechnung_uebermittlung', 'zuzahlung_befreiung'],
    grundaufzeichnung: ['rechnung_zahlungen', 'abrechnung_zahlung', 'belegliste', 'zuzahlung_korrekturen', 'zuzahlung_guthaben', 'booking_status_korrekturen', 'fahrten', 'fahrten_aenderungen', 'vehicles'],
    geschaeftsbrief: ['mahnungen'],
  };
  // Fail-closed: ein Zählfehler zählt als „Zeilen vorhanden". Lieber eine Sperre zu viel
  // als ein gelöschtes businesses (CASCADE auf Rechnungen/Abrechnungen/Verordnungen).
  async function hatZeilenIn(tbl) {
    const { count, error } = await supabase.from(tbl).select('*', { count: 'exact', head: true }).eq('owner_id', ownerId);
    if (error) {
      console.error(`[dsgvo-loeschen] Zählung ${tbl} fehlgeschlagen — gilt als vorhanden:`, error.message);
      return true;
    }
    return (count || 0) > 0;
  }
  // Steuert Schritt 6 (services/aerzte/businesses). Bewusst NICHT aus `gesperrt` abgeleitet:
  // scheitert der Upsert einer Sperre, existieren die Unterlagen trotzdem.
  let sperrbestandVorhanden = false;

  for (const kat of fristKategorien) {
    let hatZeilen = kat === 'behandlung' && behandelteVoIds.size > 0;
    for (const tbl of KATEGORIE_TABELLEN[kat]) {
      if (hatZeilen) break;
      hatZeilen = await hatZeilenIn(tbl);
    }
    if (hatZeilen) sperrbestandVorhanden = true;

    if (hatZeilen) {
      const jahre = KATEGORIEN[kat].jahre;
      const gesperrt_bis = jahresendePlus(jahre);
      const grundlage = KATEGORIEN[kat].grundlage;
      const label = KATEGORIEN[kat].label;

      try {
        const { error: spErr } = await supabase
          .from('aufbewahrung_sperre')
          .upsert({
            owner_id: ownerId,
            patient_id: null,
            kategorie: kat,
            gesperrt_bis,
            grundlage,
            vorgang_id: vorgangId,
          }, { onConflict: 'owner_id,patient_id,kategorie' });

        if (spErr) throw spErr;

        gesperrt.push({
          kategorie: kat,
          label,
          grundlage,
          gesperrt_bis,
        });
      } catch (err) {
        console.error(`[dsgvo-loeschen] aufbewahrung_sperre Eintrag fuer ${kat} fehlgeschlagen:`, err.message);
        unerwartet.push(`aufbewahrung_sperre:${kat}`);
      }
    }
  }
  log.push({ step: 'sperre:persist', ok: true, gesperrt });

  // ── 4. Loeschen der Kategorie 'loeschen' (Kinder vor Eltern) ─────────────────

  // 4a. Unbehandelte Rezepte: zuerst Dokumente, dann Rezepte (CASCADE nimmt sessions/validations)
  if (unbehandelteVoIds.size > 0) {
    const unbIds = Array.from(unbehandelteVoIds);
    try {
      await supabase.from('prescription_documents').delete().in('prescription_id', unbIds);
      const { error: voDelErr } = await supabase.from('prescriptions').delete().in('id', unbIds);
      if (voDelErr) throw voDelErr;
      log.push({ step: 'delete:prescriptions:unbehandelt', ok: true, anzahl: unbIds.length });
    } catch (err) {
      console.error('[dsgvo-loeschen] Loeschen unbehandelter Rezepte fehlgeschlagen:', err.message);
      unerwartet.push('prescriptions:unbehandelt');
      log.push({ step: 'delete:prescriptions:unbehandelt', ok: false, error: err.message });
    }
  }

  // 4b. bookings. FKs live (02.10.2026): fahrten.booking_id und booking_status_korrekturen
  //     CASCADE, ausfallrechnungen/pat_fussbefund/prescription_sessions SET NULL, Kinder per
  //     group_parent_id CASCADE. Ein Termin mit Bezug zum Sperrbestand bleibt deshalb stehen
  //     (er ist Teil der Dokumentation); gelöscht wird nur, was nirgends hängt. booking_leistungen
  //     der gelöschten Termine räumt CASCADE ab, die der bleibenden bleiben (welche Leistung).
  //     Scheitert eine Bezugsabfrage: KEIN Termin wird gelöscht.
  try {
    const geschuetzt = new Set();
    const bezug = async (tbl, select = 'booking_id', filter = 'owner_id') => {
      const { data, error } = await supabase.from(tbl).select(select)
        .eq(filter, ownerId).not('booking_id', 'is', null);
      if (error) throw new Error(`${tbl}: ${error.message}`);
      for (const r of data || []) geschuetzt.add(r.booking_id);
    };
    await bezug('booking_status_korrekturen');
    await bezug('fahrten');
    await bezug('ausfallrechnungen');
    await bezug('pat_fussbefund');
    await bezug('prescription_sessions', 'booking_id,prescriptions!inner(owner_id)', 'prescriptions.owner_id');

    const { data: termine, error: tErr } = await supabase
      .from('bookings').select('id, group_parent_id, verordnung_id').eq('owner_id', ownerId);
    if (tErr) throw new Error(`bookings: ${tErr.message}`);
    for (const t of termine || []) {
      if (t.verordnung_id && behandelteVoIds.has(t.verordnung_id)) geschuetzt.add(t.id);
    }
    // Eltern geschützter Kinder schützen, sonst nimmt CASCADE das Kind mit.
    let gewachsen = true;
    while (gewachsen) {
      gewachsen = false;
      for (const t of termine || []) {
        if (geschuetzt.has(t.id) && t.group_parent_id && !geschuetzt.has(t.group_parent_id)) {
          geschuetzt.add(t.group_parent_id);
          gewachsen = true;
        }
      }
    }
    const zuLoeschen = (termine || []).map(t => t.id).filter(id => !geschuetzt.has(id));
    for (let i = 0; i < zuLoeschen.length; i += 200) {
      const { error: bErr } = await supabase.from('bookings').delete().in('id', zuLoeschen.slice(i, i + 200));
      if (bErr) throw new Error(`bookings delete: ${bErr.message}`);
    }
    log.push({ step: 'delete:bookings', ok: true, geloescht: zuLoeschen.length, geschuetzt: geschuetzt.size });
  } catch (err) {
    console.error('[dsgvo-loeschen] Loeschen von bookings fehlgeschlagen:', err.message);
    unerwartet.push('bookings');
    log.push({ step: 'delete:bookings', ok: false });
  }

  // 4c. Tabellen ohne owner_id ueber bekannte Beziehungen aufraeumen
  try {
    const { data: empRows, error: empErr } = await supabase.from('profiles').select('id').eq('owner_id', ownerId);
    if (empErr) throw new Error(`profiles: ${empErr.message}`);
    const empIds = (empRows || []).map(e => e.id);

    const { data: bizRows, error: bizErr } = await supabase.from('businesses').select('id').eq('owner_id', ownerId);
    if (bizErr) throw new Error(`businesses: ${bizErr.message}`);
    const bizIds = (bizRows || []).map(b => b.id);

    const pruefe = ({ error }, was) => { if (error) throw new Error(`${was}: ${error.message}`); };
    if (empIds.length > 0) {
      pruefe(await supabase.from('employee_services').delete().in('employee_id', empIds), 'employee_services');
      pruefe(await supabase.from('employee_business_assignments').delete().in('employee_id', empIds), 'employee_business_assignments');
      pruefe(await supabase.from('employee_scope_overrides').delete().in('employee_id', empIds), 'employee_scope_overrides');
    }
    if (bizIds.length > 0) {
      const grp = await supabase.from('employee_groups').select('id').in('business_id', bizIds);
      pruefe(grp, 'employee_groups select');
      const grpIds = (grp.data || []).map(g => g.id);
      if (grpIds.length > 0) {
        pruefe(await supabase.from('group_scopes').delete().in('group_id', grpIds), 'group_scopes');
      }
      pruefe(await supabase.from('employee_groups').delete().in('business_id', bizIds), 'employee_groups');
    }
    log.push({ step: 'delete:employee_relations', ok: true });
  } catch (err) {
    console.error('[dsgvo-loeschen] Aufraeumen der Mitarbeiter-/Standortrelationen fehlgeschlagen:', err.message);
    unerwartet.push('employee_relations');
    log.push({ step: 'delete:employee_relations', ok: false, error: err.message });
  }

  // 4d. pending_signups mit RPC leeren
  if (ownerEmail) {
    try {
      const { data: pendings, error: psErr } = await supabase
        .from('pending_signups')
        .select('id')
        .eq('email', ownerEmail);
      if (psErr) throw psErr;

      for (const p of pendings || []) {
        const { error: rpcErr } = await supabase.rpc('pending_signup_delete', { p_pending_id: p.id });
        if (rpcErr) throw rpcErr;
      }
      log.push({ step: 'delete:pending_signups', ok: true });
    } catch (err) {
      console.error('[dsgvo-loeschen] pending_signups RPC fehlgeschlagen:', err.message);
      unerwartet.push('pending_signups');
      log.push({ step: 'delete:pending_signups', ok: false, error: err.message });
    }
  }

  // 4e. Weitere Standard-Loeschtabellen
  const einfacheLoeschTabellen = [
    { table: 'kiosk_pins', filter: 'user_id' },
    { table: 'chatbot_usage', filter: 'owner_id' },
    { table: 'feedbacks', filter: 'user_id' },
    { table: 'ai_audit_log', filter: 'tenant_id' },
    { table: 'warteliste', filter: 'owner_id' },
    { table: 'booking_requests', filter: 'owner_id' },
    { table: 'patients', filter: 'owner_id' },
    { table: 'referral_drafts', filter: 'owner_id' },
    { table: 'time_offs', filter: 'owner_id' },
    { table: 'breaks', filter: 'user_id' },
    { table: 'working_hours', filter: 'owner_id' },
    { table: 'custom_days', filter: 'owner_id' },
    { table: 'calendar_integrations', filter: 'user_id' },
    { table: 'document_vorlagen', filter: 'owner_id' },
    { table: 'data_sharing_settings', filter: 'owner_id' },
    { table: 'attendance', filter: 'owner_id' },
    { table: 'therapist_certificates', filter: 'owner_id' },
    { table: 'terapeut_zertifikat', filter: 'owner_id' },
    { table: 'betriebsart_empfaenger', filter: 'owner_id' },
    { table: 'user_preferences', filter: 'user_id' },
    { table: 'email_logs', filter: 'owner_id' },
    { table: 'b2b_contacts', filter: 'owner_id' },
    { table: 'scraper_data', filter: 'owner_id' },
  ];

  for (const { table, filter } of einfacheLoeschTabellen) {
    try {
      const { error: dErr } = await supabase.from(table).delete().eq(filter, ownerId);
      if (dErr && dErr.code !== 'PGRST116') {
        throw dErr;
      }
      log.push({ step: `delete:${table}`, ok: true });
    } catch (err) {
      console.error(`[dsgvo-loeschen] Loeschen von ${table} fehlgeschlagen:`, err.message);
      unerwartet.push(table);
      log.push({ step: `delete:${table}`, ok: false, error: err.message });
    }
  }

  // ── 5. leads (Patientenstamm) ───────────────────────────────────────────────
  // Ohne jeden Bezug loeschen; mit verbliebenem Bezug minimieren (reine Personenmerkmale NULLen)
  try {
    const { data: leadRows, error: lErr } = await supabase
      .from('leads')
      .select('id')
      .eq('owner_id', ownerId);

    if (lErr) throw lErr;

    for (const lead of leadRows || []) {
      let hatBezug = false;

      for (const [tbl, col] of LEAD_BEZUEGE) {
        const { count, error: cErr } = await supabase
          .from(tbl)
          .select('*', { count: 'exact', head: true })
          .eq(col, lead.id);
        // Fail-closed: Zählfehler = Bezug. Ein gelöschter Lead nähme per CASCADE
        // patient_notes, messreihen, pat_fussbefund, zuzahlung_* mit.
        if (cErr || (count || 0) > 0) {
          hatBezug = true;
          break;
        }
      }

      if (!hatBezug) {
        const { error: ldErr } = await supabase.from('leads').delete().eq('id', lead.id);
        if (ldErr) {
          console.error('[dsgvo-loeschen] Loeschen von ungebundenem Lead fehlgeschlagen:', lead.id, ldErr.message);
          unerwartet.push('leads');
        }
      } else {
        // Minimierung: Kontaktdaten und Trackingfelder entfernen, Beleg-Identitaet behalten
        const { error: lmErr } = await supabase.from('leads').update({
          phone: null,
          phone_normalized: null,
          handy: null,
          handy_normalized: null,
          email: null,
          website: null,
          google_url: null,
          notes: null,
          besondere_wuensche: null,
          metadata: {},
          categories: null,
          category_name: null,
          location: null,
          lat: null,
          lng: null,
          distance_km: null,
          duration_min: null,
          route_calculated_at: null,
          total_score: null,
          reviews_count: null,
          hausbesuch: null,
        }).eq('id', lead.id);

        if (lmErr) {
          console.error('[dsgvo-loeschen] Minimierung von Lead fehlgeschlagen:', lead.id, lmErr.message);
          unerwartet.push('leads');
        }
      }
    }
    log.push({ step: 'leads:process', ok: true });
  } catch (err) {
    console.error('[dsgvo-loeschen] Verarbeitung von leads fehlgeschlagen:', err.message);
    unerwartet.push('leads');
    log.push({ step: 'leads:process', ok: false, error: err.message });
  }

  // ── 6. businesses / aerzte ──────────────────────────────────────────────────
  // Nur loeschen, wenn kein Sperrbestand existiert (sonst blockiert CASCADE auf Unterlagen)
  // services gehört dazu: bleibende Termine/booking_leistungen zeigen darauf (NO ACTION/RESTRICT).
  if (!sperrbestandVorhanden && unerwartet.length === 0) {
    try {
      for (const tbl of ['services', 'aerzte', 'businesses']) {
        const { error: dErr } = await supabase.from(tbl).delete().eq('owner_id', ownerId);
        if (dErr) throw new Error(`${tbl}: ${dErr.message}`);
      }
      log.push({ step: 'delete:businesses_and_aerzte', ok: true });
    } catch (err) {
      console.error('[dsgvo-loeschen] Loeschen von businesses/aerzte fehlgeschlagen:', err.message);
      unerwartet.push('businesses');
      log.push({ step: 'delete:businesses_and_aerzte', ok: false, error: err.message });
    }
  }

  // ── 7. Storage bereinigen ───────────────────────────────────────────────────
  await bereinigeStorage(supabase, ownerId, unerwartet, log);

  // ── 8. Konten sperren statt loeschen (guvenlik S-40) ─────────────────────────
  // Auth-User-DELETE wuerde per CASCADE den gesetzlichen Sperrbestand vernichten!
  try {
    const { data: empList, error: elErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('owner_id', ownerId);
    // Owner wird trotzdem gebannt; fehlende Mitarbeiterliste ist ein hörbarer Rest.
    if (elErr) {
      console.error('[dsgvo-loeschen] Mitarbeiterliste fuer Bann fehlgeschlagen:', elErr.message);
      unerwartet.push('auth:mitarbeiterliste');
    }

    const alleNutzerIds = [ownerId, ...(empList || []).map(e => e.id)];

    for (const uid of alleNutzerIds) {
      if (supabase.auth?.admin?.updateUserById) {
        const { error: banErr } = await supabase.auth.admin.updateUserById(uid, {
          ban_duration: '876000h', // 100 Jahre Bann
          email: `geloescht+${uid}@invalid.praxura`,
          app_metadata: { einrichtung_hash: null, einrichtung_bis: null },
        });
        if (banErr) {
          console.error(`[dsgvo-loeschen] Auth-Bann fehlgeschlagen fuer User ${uid}:`, banErr.message);
          unerwartet.push('auth:ban');
        }
      }

      // Aktive Sitzungen beenden (Token-Revocation)
      // Restfenster bei Fehler: ausgegebene Access-Tokens bis Ablauf — requireAuth weist
      // plan_status='deleted' (Owner) bzw. is_active=false (Mitarbeiter) trotzdem ab.
      const { error: sErr } = await supabase.rpc('auth_sitzungen_beenden', { p_user: uid });
      if (sErr) console.error(`[dsgvo-loeschen] Sitzungsbeendigung fehlgeschlagen fuer ${uid}:`, sErr.message);
    }
    // Kommentar: Bann sperrt auch OAuth-Login (Google-Identitäten). NIE auth.admin.deleteUser aufrufen.
    log.push({ step: 'auth:ban_accounts', ok: true, anzahl: alleNutzerIds.length });
  } catch (err) {
    console.error('[dsgvo-loeschen] Kontensperrung fehlgeschlagen:', err.message);
    unerwartet.push('auth:ban');
    log.push({ step: 'auth:ban_accounts', ok: false, error: err.message });
  }

  // ── 9. profiles anonymisieren ───────────────────────────────────────────────
  try {
    // Inhaber-Profil anonymisieren: ik_number BLEIBT fuer die GoBD-Zuordnung des Sperrbestands
    const { error: opErr } = await supabase.from('profiles').update({
      business_name: '[gelöscht]',
      owner_first_name: '[gelöscht]',
      owner_last_name: '[gelöscht]',
      street: null,
      house_number: null,
      zip: null,
      city: null,
      phone: null,
      avatar_url: null,
      praxis_logo_url: null,
      booking_slug: null,
      iban: null,
      bic: null,
      bank_name: null,
      steuernummer: null,
      b2b_gmail_refresh_token: null,
      email: null,
      whatsapp_number: null,
      b2b_from_email: null,
      b2b_sender_name: null,
      clinic_lat: null,
      clinic_lng: null,
      deletion_scheduled_at: null,
      plan_status: 'deleted',
      is_active: false,
    }).eq('id', ownerId);

    if (opErr) throw opErr;

    // Mitarbeiterprofile deaktivieren (Namen bleiben wegen Behandlungsnachweis § 630f Abs. 1 BGB erhalten)
    const { error: maErr } = await supabase.from('profiles').update({
      phone: null,
      email: null,
      avatar_url: null,
      is_active: false,
    }).eq('owner_id', ownerId);
    if (maErr) throw maErr;

    log.push({ step: 'profiles:anonymize', ok: true });
  } catch (err) {
    console.error('[dsgvo-loeschen] Profil-Anonymisierung fehlgeschlagen:', err.message);
    unerwartet.push('profiles');
    log.push({ step: 'profiles:anonymize', ok: false, error: err.message });
  }

  // ── 10. Status bestimmen ───────────────────────────────────────────────────
  let status = 'geloescht';
  if (unerwartet.length > 0) {
    status = 'fehler';
  } else if (gesperrt.length > 0) {
    status = 'teilweise_geloescht';
  }

  return {
    status,
    gesperrt,
    unerwartet,
    log,
  };
}

/**
 * Raeumt Storage-Objekte fuer einen geloeschten Mandanten auf.
 */
async function bereinigeStorage(supabase, ownerId, unerwartet, log) {
  for (const b of BUCKETS) {
    try {
      const behaltenePfade = new Set();

      for (const [tabelle, spalte] of b.pfadQuellen) {
        const { data: rows, error: qErr } = await supabase
          .from(tabelle)
          .select(spalte)
          .eq('owner_id', ownerId)
          .not(spalte, 'is', null);
        // Unvollständige Behalten-Liste = im Zweifel liegen lassen (guvenlik S-32).
        if (qErr) throw new Error(`${tabelle}.${spalte}: ${qErr.message}`);
        for (const r of rows || []) {
          if (r[spalte]) behaltenePfade.add(r[spalte]);
        }
      }

      if (supabase.storage?.from) {
        const bucketClient = supabase.storage.from(b.bucket);
        const zuLoeschendeDateien = [];

        async function listRekursiv(prefix) {
          const { data: items, error } = await bucketClient.list(prefix, { limit: 1000 });
          if (error) throw new Error(`list ${prefix}: ${error.message}`);
          if (!items) return;

          for (const item of items) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            if (item.id === null) {
              await listRekursiv(itemPath);
            } else {
              if (b.bucket === 'avatars' || !behaltenePfade.has(itemPath)) {
                zuLoeschendeDateien.push(itemPath);
              }
            }
          }
        }

        await listRekursiv(ownerId);

        for (let i = 0; i < zuLoeschendeDateien.length; i += 100) {
          const chunk = zuLoeschendeDateien.slice(i, i + 100);
          const { error: delErr } = await bucketClient.remove(chunk);
          if (delErr) {
            console.error(`[dsgvo-loeschen] Storage-Loeschfehler in ${b.bucket}:`, delErr.message);
            unerwartet.push(`storage:${b.bucket}`);
          }
        }
        log.push({ step: `storage:${b.bucket}`, ok: true, geloescht: zuLoeschendeDateien.length });
      }
    } catch (err) {
      console.error(`[dsgvo-loeschen] Storage-Bereinigung in ${b.bucket} fehlgeschlagen:`, err.message);
      unerwartet.push(`storage:${b.bucket}`);
      log.push({ step: `storage:${b.bucket}`, ok: false, error: err.message });
    }
  }
}
