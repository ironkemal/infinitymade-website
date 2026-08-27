// Ausfallgebühr (no-show / late-cancel fee) HTTP routes.
//
// POST  /api/billing/ausfall/create      — create Ausfallrechnung for a booking, returns print HTML
// GET   /api/billing/ausfall/list        — all Ausfallrechnungen of the tenant
// GET   /api/billing/ausfall/:id/print   — re-render an existing invoice
// PATCH /api/billing/ausfall/:id/status  — offen → bezahlt | storniert | abgeschrieben
//
// Ausfallhonorar is a private Schadensersatz invoice to the patient (never the
// Krankenkasse), umsatzsteuerfrei. Per-business config lives on businesses.ausfall_*.

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { renderAusfallrechnung } from '../pdf/ausfallrechnung.template.js';
import { pruefeAusfallFrist, uebersteuerungsNotiz } from '../ausfall/frist.js';
import { standortFuerName, standortFuerZuordnung } from '../ausfall/standort.js';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ZAHLUNGSZIEL_TAGE = 14;

async function resolveAuth(req, res) {
  const token = req.headers.authorization?.slice(7);
  if (!token) { res.status(401).json({ error: 'Missing bearer token' }); return null; }

  const { data: u, error: uErr } = await supabase.auth.getUser(token);
  if (uErr || !u?.user) { res.status(401).json({ error: 'Invalid token' }); return null; }

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, role, owner_id, business_name, phone, city, zip, plz, street, house_number, email, bank_name, iban, bic, steuernummer, praxis_logo_url, invoice_footer_text, ausfall_hinweis')
    .eq('id', u.user.id)
    .maybeSingle();
  if (pErr || !profile) { res.status(403).json({ error: 'Profile not found' }); return null; }

  const tenantId = profile.role === 'employee' && profile.owner_id
    ? profile.owner_id
    : profile.id;

  return { user: u.user, profile, tenantId };
}

// Praxis details always come from the owner profile (employee may be logged in)
async function loadPraxisProfile(profile, tenantId) {
  if (profile.role === 'employee' && profile.owner_id) {
    const { data: ownerProf } = await supabase
      .from('profiles')
      .select('id, business_name, phone, city, zip, plz, street, house_number, email, bank_name, iban, bic, steuernummer, praxis_logo_url, invoice_footer_text, ausfall_hinweis')
      .eq('id', tenantId)
      .maybeSingle();
    if (ownerProf) return ownerProf;
  }
  return profile;
}

// `standort` ist NICHT dasselbe wie `business`:
//   business  — der Datensatz für Hinweistext und Zuordnung (immer vorhanden)
//   standort  — nur gesetzt, wenn der Name wirklich vom Standort kommen soll
//
// Der Praxisname auf der Rechnung gehört dem Inhaberprofil: dort ändert ihn die
// Praxis in den Einstellungen (Owner-Ebene, siehe CLAUDE.md „Owner seviyesindeki
// ayarlar profiles'a yazılır"). Vorher gewann immer `businesses.business_name`.
// Bei einer Einzelpraxis ist das der beim Onboarding angelegte Eintrag — er
// wandert beim Umbenennen nicht mit, und die Ausfallrechnung trug deshalb noch
// den alten Ladennamen (Beta-2, 12.08.2026). Nur bei mehreren Standorten ist der
// Standortname die richtige Antwort; das entscheidet der Aufrufer.
function renderInvoiceHtml({ praxisProfile, userEmail, row, business, standort = null, patient, vorlage }) {
  const strasse = [praxisProfile.street, praxisProfile.house_number].filter(Boolean).join(' ');
  const plz_ort = [praxisProfile.zip || praxisProfile.plz, praxisProfile.city].filter(Boolean).join(' ').trim();

  const bankverbindung = [
    praxisProfile.bank_name,
    praxisProfile.iban ? ('IBAN: ' + praxisProfile.iban) : null,
    praxisProfile.bic ? ('BIC: ' + praxisProfile.bic) : null
  ].filter(Boolean).join(' · ');

  const createdAt = row.created_at ? new Date(row.created_at) : new Date();

  const targetZahlungsziel = (vorlage?.zahlungsziel_tage && Number(vorlage.zahlungsziel_tage) > 0)
    ? Number(vorlage.zahlungsziel_tage)
    : ZAHLUNGSZIEL_TAGE;

  return renderAusfallrechnung({
    praxis: {
      name: standort?.business_name || praxisProfile.business_name || 'Praxis',
      strasse,
      plz_ort,
      telefon: standort?.phone || praxisProfile.phone || '',
      steuernummer: praxisProfile.steuernummer || '',
      email: praxisProfile.email || userEmail || '',
    },
    patient,
    rechnung: {
      nummer: `AF-${String(row.rechnung_nr).padStart(4, '0')}`,
      datum: createdAt,
      faelligkeit: new Date(createdAt.getTime() + targetZahlungsziel * 24 * 60 * 60 * 1000),
    },
    termin: {
      datum: row.leistung_datum,
      leistung: row.service_name || '',
      reason: row.reason,
    },
    amount_eur: Number(row.amount_eur),
    bankverbindung,
    hinweisText: praxisProfile?.ausfall_hinweis || business?.ausfall_hinweis || null,
    logoUrl: praxisProfile.praxis_logo_url || '',
    invoiceFooterText: praxisProfile.invoice_footer_text || '',
    vorlage: vorlage || {},
  });
}

function patientFromBooking(booking) {
  const lead = booking.leads || null;
  if (lead) {
    let geburtsdatum = lead.geburtsdatum || null;
    if (!geburtsdatum && lead.metadata) {
      if (typeof lead.metadata === 'object') {
        geburtsdatum = lead.metadata.geburtsdatum || null;
      } else if (typeof lead.metadata === 'string') {
        try {
          geburtsdatum = JSON.parse(lead.metadata).geburtsdatum || null;
        } catch (_) {}
      }
    }
    return {
      vorname: lead.first_name || '',
      nachname: lead.last_name || '',
      strasse: lead.street || '',
      plz: lead.plz || '',
      ort: lead.city || '',
      geburtsdatum,
    };
  }
  // Fallback: booking without linked patient record
  const parts = (booking.customer_name || '').trim().split(/\s+/);
  return {
    vorname: parts.slice(0, -1).join(' '),
    nachname: parts.slice(-1).join(''),
    strasse: '', plz: '', ort: '',
    geburtsdatum: null,
  };
}

// ============================================================================
// POST /api/billing/ausfall/create
// Body: { bookingId, amountEur, reason ('no_show'|'late_cancel'), notes? }
// Returns text/html invoice for browser printing.
// ============================================================================
router.post('/ausfall/create', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { user, profile, tenantId } = auth;

    const { bookingId, amountEur, reason, notes, override } = req.body || {};
    if (!bookingId) return res.status(400).json({ error: 'bookingId required' });
    const amount = Number(amountEur);
    if (!(amount > 0)) return res.status(400).json({ error: 'amountEur must be > 0' });
    if (!['no_show', 'late_cancel'].includes(reason || 'no_show')) {
      return res.status(400).json({ error: "reason must be 'no_show' or 'late_cancel'" });
    }

    // Ausfallgebühr-Einstellungen des Praxisinhabers (Owner-Ebene, nicht pro
    // Standort — siehe migration 20260725000000_ausfall_settings_on_profiles).
    const { data: ausfallCfg } = await supabase
      .from('profiles')
      .select('ausfall_enabled, ausfall_cutoff_hours')
      .eq('id', tenantId)
      .maybeSingle();

    // Fetch owner's default 'rechnung_ausfall' template
    const { data: vorlage } = await supabase
      .from('document_vorlagen')
      .select('content_json')
      .eq('owner_id', tenantId)
      .eq('vorlage_type', 'rechnung_ausfall')
      .eq('is_default', true)
      .maybeSingle();
    const vorlageJson = vorlage?.content_json || {};

    // 1. Fetch booking + patient + service
    const { data: booking, error: bkErr } = await supabase
      .from('bookings')
      .select(`
        id, owner_id, user_id, business_id, lead_id, customer_name, start_time, status,
        services:service_id (title),
        leads:lead_id (id, first_name, last_name, street, plz, city, geburtsdatum, metadata, ausfallvereinbarung_am)
      `)
      .eq('id', bookingId)
      .maybeSingle();
    if (bkErr || !booking) return res.status(404).json({ error: 'Booking not found' });

    const bookingOwner = booking.owner_id || booking.user_id;
    if (bookingOwner !== tenantId) return res.status(403).json({ error: 'Forbidden' });

    // 1b. Darf für diesen Termin überhaupt abgerechnet werden? (Lücke L1)
    // Bis hierher lief die Prüfung nur im Browser — direkt abgesetzte Aufrufe
    // kamen an ihr vorbei. `override: true` erlaubt der Praxis das bewusste
    // Übersteuern; der Grund wird dann in notes protokolliert.
    const fristPruefung = pruefeAusfallFrist({
      enabled:      ausfallCfg?.ausfall_enabled,
      reason:       reason || 'no_show',
      cutoffHours:  ausfallCfg?.ausfall_cutoff_hours ?? 24,
      terminStart:  booking.start_time,
      override:     override === true,
    });
    if (!fristPruefung.erlaubt) {
      return res.status(422).json({
        error: fristPruefung.meldung,
        grund: fristPruefung.grund,
        uebersteuerbar: fristPruefung.grund !== 'ausfallgebuehr_deaktiviert',
      });
    }

    // 2. Guard: only one open/paid invoice per booking
    const { data: existing } = await supabase
      .from('ausfallrechnungen')
      .select('id, status')
      .eq('booking_id', bookingId)
      .not('status', 'eq', 'storniert');
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Für diesen Termin existiert bereits eine Ausfallrechnung.' });
    }

    // 3. Standorte des Inhabers — in EINER Abfrage, weil zwei Dinge daraus
    //    folgen: welcher Datensatz gilt (Hinweistext, Zuordnung) und ob der
    //    Standortname überhaupt zählt. Siehe Kommentar an renderInvoiceHtml.
    const { data: alleStandorte } = await supabase
      .from('businesses')
      .select('id, business_name, phone, ausfall_hinweis, is_default')
      .eq('owner_id', tenantId);
    const standorte = alleStandorte || [];
    const business = standortFuerZuordnung(standorte, booking.business_id);
    const standortName = standortFuerName(standorte, booking.business_id);

    // 4. Insert (rechnung_nr auto-assigned via DB trigger)
    // Übersteuerung und fehlende Ausfallvereinbarung werden in notes festgehalten,
    // damit später nachvollziehbar bleibt, auf welcher Grundlage abgerechnet wurde.
    const notizen = [
      (notes || '').trim() || null,
      uebersteuerungsNotiz(fristPruefung),
      booking.leads && !booking.leads.ausfallvereinbarung_am
        ? 'Hinweis: keine unterschriebene Ausfallvereinbarung hinterlegt.'
        : null,
    ].filter(Boolean);

    const { data: row, error: insErr } = await supabase
      .from('ausfallrechnungen')
      .insert({
        owner_id: tenantId,
        business_id: business?.id || booking.business_id || null,
        booking_id: booking.id,
        patient_id: booking.lead_id || null,
        reason: reason || 'no_show',
        amount_eur: amount,
        leistung_datum: booking.start_time,
        service_name: booking.services?.title || null,
        notes: notizen.length ? notizen.join(' · ') : null,
        created_by: user.id,
        status: 'offen',
      })
      .select('*')
      .single();
    if (insErr) return res.status(500).json({ error: 'insert failed: ' + insErr.message });

    // 5. Render
    const praxisProfile = await loadPraxisProfile(profile, tenantId);
    const html = renderInvoiceHtml({
      praxisProfile,
      userEmail: user.email,
      row,
      business,
      standort: standortName,
      patient: patientFromBooking(booking),
      vorlage: vorlageJson,
    });

    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    console.error('[ausfall/create]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ============================================================================
// GET /api/billing/ausfall/list
// ============================================================================
router.get('/ausfall/list', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { tenantId } = auth;

    const { data: rows, error } = await supabase
      .from('ausfallrechnungen')
      .select(`
        id, rechnung_nr, reason, amount_eur, leistung_datum, service_name,
        status, notes, created_at, bezahlt_at, booking_id,
        leads:patient_id (first_name, last_name),
        bookings:booking_id (customer_name)
      `)
      .eq('owner_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: error.message });

    return res.json((rows || []).map(r => ({
      id: r.id,
      rechnung_nr: r.rechnung_nr,
      nummer: `AF-${String(r.rechnung_nr).padStart(4, '0')}`,
      reason: r.reason,
      amount_eur: r.amount_eur,
      leistung_datum: r.leistung_datum,
      service_name: r.service_name,
      status: r.status,
      created_at: r.created_at,
      bezahlt_at: r.bezahlt_at,
      patient_name: r.leads
        ? `${r.leads.first_name || ''} ${r.leads.last_name || ''}`.trim()
        : (r.bookings?.customer_name || '—'),
    })));
  } catch (e) {
    console.error('[ausfall/list]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ============================================================================
// GET /api/billing/ausfall/:id/print — re-render existing invoice
// ============================================================================
router.get('/ausfall/:id/print', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { user, profile, tenantId } = auth;

    const { data: row, error } = await supabase
      .from('ausfallrechnungen')
      .select(`
        *,
        leads:patient_id (first_name, last_name, street, plz, city, geburtsdatum, metadata),
        bookings:booking_id (customer_name),
        businesses:business_id (id, business_name, phone, ausfall_hinweis)
      `)
      .eq('id', req.params.id)
      .maybeSingle();
    if (error || !row) return res.status(404).send('Ausfallrechnung nicht gefunden');
    if (row.owner_id !== tenantId) return res.status(403).send('Kein Zugriff');

    // Fetch owner's default 'rechnung_ausfall' template
    const { data: vorlage } = await supabase
      .from('document_vorlagen')
      .select('content_json')
      .eq('owner_id', tenantId)
      .eq('vorlage_type', 'rechnung_ausfall')
      .eq('is_default', true)
      .maybeSingle();
    const vorlageJson = vorlage?.content_json || {};

    const praxisProfile = await loadPraxisProfile(profile, tenantId);
    
    let geburtsdatum = null;
    if (row.leads) {
      geburtsdatum = row.leads.geburtsdatum || null;
      if (!geburtsdatum && row.leads.metadata) {
        if (typeof row.leads.metadata === 'object') {
          geburtsdatum = row.leads.metadata.geburtsdatum || null;
        } else if (typeof row.leads.metadata === 'string') {
          try {
            geburtsdatum = JSON.parse(row.leads.metadata).geburtsdatum || null;
          } catch (_) {}
        }
      }
    }

    const patient = row.leads
      ? {
          vorname: row.leads.first_name || '',
          nachname: row.leads.last_name || '',
          strasse: row.leads.street || '',
          plz: row.leads.plz || '',
          ort: row.leads.city || '',
          geburtsdatum,
        }
      : patientFromBooking({ customer_name: row.bookings?.customer_name || '' });

    // Gleiche Regel wie beim Erstellen: der Standortname zählt nur bei mehreren
    // Standorten. Beim Nachdrucken einer alten Rechnung erscheint damit der
    // heutige Praxisname — die Rechnung wird ohnehin bei jedem Aufruf neu
    // gerendert, es gibt keinen eingefrorenen Beleg (GoBD-Frage dazu offen,
    // siehe Ops-Dashboard).
    const { data: alleStandorte } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', tenantId);
    // row.businesses ist der Join über row.business_id — die Entscheidung
    // braucht nur noch zu wissen, ob es mehrere Standorte gibt.
    const standortName = standortFuerName(alleStandorte || [], row.business_id)
      ? (row.businesses || null)
      : null;

    const html = renderInvoiceHtml({
      praxisProfile,
      userEmail: user.email,
      row,
      business: row.businesses || null,
      standort: standortName,
      patient,
      vorlage: vorlageJson,
    });

    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    console.error('[ausfall/print]', e);
    return res.status(500).send('Server-Fehler: ' + e.message);
  }
});

// ============================================================================
// PATCH /api/billing/ausfall/:id/status
// Body: { status } — 'bezahlt' | 'storniert' | 'abgeschrieben'
// On 'bezahlt': GoBD Belegliste entry (type 'ausfall').
// ============================================================================
router.patch('/ausfall/:id/status', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;

    const { status } = req.body || {};
    if (!['bezahlt', 'storniert', 'abgeschrieben'].includes(status)) {
      return res.status(400).json({ error: "status must be 'bezahlt', 'storniert' or 'abgeschrieben'" });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('ausfallrechnungen')
      .select('id, owner_id, status, amount_eur, patient_id, rechnung_nr, leads:patient_id (first_name, last_name), bookings:booking_id (customer_name)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Ausfallrechnung not found' });
    if (existing.owner_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });
    // Paid invoices are locked — the Belegliste entry already exists (GoBD)
    if (existing.status === 'bezahlt') {
      return res.status(409).json({ error: 'Bereits als bezahlt gebucht — nicht mehr änderbar.' });
    }

    const update = { status };
    if (status === 'bezahlt') update.bezahlt_at = new Date().toISOString();

    const { error: upErr } = await supabase
      .from('ausfallrechnungen')
      .update(update)
      .eq('id', req.params.id);
    if (upErr) return res.status(500).json({ error: upErr.message });

    if (status === 'bezahlt') {
      const patientName = existing.leads
        ? `${existing.leads.first_name || ''} ${existing.leads.last_name || ''}`.trim()
        : (existing.bookings?.customer_name || '');
      const { error: blErr } = await supabase.from('belegliste').insert({
        owner_id: tenantId,
        type: 'ausfall',
        amount_eur: Number(existing.amount_eur),
        patient_id: existing.patient_id,
        reference_text: `Ausfallhonorar erhalten (AF-${String(existing.rechnung_nr).padStart(4, '0')})${patientName ? ': ' + patientName : ''}`,
        created_by: user.id,
      });
      if (blErr) console.error('[ausfall/status] belegliste insert failed:', blErr.message);
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('[ausfall/status]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

export default router;
