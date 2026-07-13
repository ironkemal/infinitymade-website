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
    .select('id, role, owner_id, business_name, phone, city, zip, street, house_number, email, bank_name, iban, bic, steuernummer, praxis_logo_url, invoice_footer_text')
    .eq('id', u.user.id)
    .single();
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
      .select('id, business_name, phone, city, zip, street, house_number, email, bank_name, iban, bic, steuernummer, praxis_logo_url, invoice_footer_text')
      .eq('id', tenantId)
      .single();
    if (ownerProf) return ownerProf;
  }
  return profile;
}

function renderInvoiceHtml({ praxisProfile, userEmail, row, business, patient }) {
  const strasse = [praxisProfile.street, praxisProfile.house_number].filter(Boolean).join(' ');
  const plz_ort = [praxisProfile.zip, praxisProfile.city].filter(Boolean).join(' ').trim();

  const bankverbindung = [
    praxisProfile.bank_name,
    praxisProfile.iban ? ('IBAN: ' + praxisProfile.iban) : null,
    praxisProfile.bic ? ('BIC: ' + praxisProfile.bic) : null
  ].filter(Boolean).join(' · ');

  const createdAt = row.created_at ? new Date(row.created_at) : new Date();

  return renderAusfallrechnung({
    praxis: {
      name: business?.business_name || praxisProfile.business_name || 'Praxis',
      strasse,
      plz_ort,
      telefon: business?.phone || praxisProfile.phone || '',
      steuernummer: praxisProfile.steuernummer || '',
      email: praxisProfile.email || userEmail || '',
    },
    patient,
    rechnung: {
      nummer: `AF-${String(row.rechnung_nr).padStart(4, '0')}`,
      datum: createdAt,
      faelligkeit: new Date(createdAt.getTime() + ZAHLUNGSZIEL_TAGE * 24 * 60 * 60 * 1000),
    },
    termin: {
      datum: row.leistung_datum,
      leistung: row.service_name || '',
      reason: row.reason,
    },
    amount_eur: Number(row.amount_eur),
    bankverbindung,
    hinweisText: business?.ausfall_hinweis || null,
    logoUrl: praxisProfile.praxis_logo_url || '',
    invoiceFooterText: praxisProfile.invoice_footer_text || '',
  });
}

function patientFromBooking(booking) {
  const lead = booking.leads || null;
  if (lead) {
    return {
      vorname: lead.first_name || '',
      nachname: lead.last_name || '',
      strasse: lead.street || '',
      plz: lead.plz || '',
      ort: lead.city || '',
    };
  }
  // Fallback: booking without linked patient record
  const parts = (booking.customer_name || '').trim().split(/\s+/);
  return {
    vorname: parts.slice(0, -1).join(' '),
    nachname: parts.slice(-1).join(''),
    strasse: '', plz: '', ort: '',
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

    const { bookingId, amountEur, reason, notes } = req.body || {};
    if (!bookingId) return res.status(400).json({ error: 'bookingId required' });
    const amount = Number(amountEur);
    if (!(amount > 0)) return res.status(400).json({ error: 'amountEur must be > 0' });
    if (!['no_show', 'late_cancel'].includes(reason || 'no_show')) {
      return res.status(400).json({ error: "reason must be 'no_show' or 'late_cancel'" });
    }

    // 1. Fetch booking + patient + service
    const { data: booking, error: bkErr } = await supabase
      .from('bookings')
      .select(`
        id, owner_id, user_id, business_id, lead_id, customer_name, start_time, status,
        services:service_id (title),
        leads:lead_id (id, first_name, last_name, street, plz, city)
      `)
      .eq('id', bookingId)
      .single();
    if (bkErr || !booking) return res.status(404).json({ error: 'Booking not found' });

    const bookingOwner = booking.owner_id || booking.user_id;
    if (bookingOwner !== tenantId) return res.status(403).json({ error: 'Forbidden' });

    // 2. Guard: only one open/paid invoice per booking
    const { data: existing } = await supabase
      .from('ausfallrechnungen')
      .select('id, status')
      .eq('booking_id', bookingId)
      .not('status', 'eq', 'storniert');
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Für diesen Termin existiert bereits eine Ausfallrechnung.' });
    }

    // 3. Business (for name/phone + custom hinweis) — booking's business or default
    let business = null;
    if (booking.business_id) {
      const { data: b } = await supabase
        .from('businesses')
        .select('id, business_name, phone, ausfall_hinweis')
        .eq('id', booking.business_id)
        .maybeSingle();
      business = b;
    }
    if (!business) {
      const { data: b } = await supabase
        .from('businesses')
        .select('id, business_name, phone, ausfall_hinweis')
        .eq('owner_id', tenantId)
        .eq('is_default', true)
        .maybeSingle();
      business = b;
    }

    // 4. Insert (rechnung_nr auto-assigned via DB trigger)
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
        notes: (notes || '').trim() || null,
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
      patient: patientFromBooking(booking),
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
        leads:patient_id (first_name, last_name, street, plz, city),
        bookings:booking_id (customer_name),
        businesses:business_id (id, business_name, phone, ausfall_hinweis)
      `)
      .eq('id', req.params.id)
      .single();
    if (error || !row) return res.status(404).send('Ausfallrechnung nicht gefunden');
    if (row.owner_id !== tenantId) return res.status(403).send('Kein Zugriff');

    const praxisProfile = await loadPraxisProfile(profile, tenantId);
    const patient = row.leads
      ? {
          vorname: row.leads.first_name || '',
          nachname: row.leads.last_name || '',
          strasse: row.leads.street || '',
          plz: row.leads.plz || '',
          ort: row.leads.city || '',
        }
      : patientFromBooking({ customer_name: row.bookings?.customer_name || '' });

    const html = renderInvoiceHtml({
      praxisProfile,
      userEmail: user.email,
      row,
      business: row.businesses || null,
      patient,
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
      .single();
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
