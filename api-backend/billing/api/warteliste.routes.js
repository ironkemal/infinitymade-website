// Warteliste (waiting list) HTTP routes.
//
// GET    /api/warteliste          — list all 'waiting' entries (with lead name join)
// POST   /api/warteliste          — add a new waiting-list entry
// PATCH  /api/warteliste/:id      — update status (matched | cancelled)
// DELETE /api/warteliste/:id      — remove an entry
// POST   /api/warteliste/match    — find suitable waiting-list candidates for a freed booking slot

import express from 'express';
import { validateLead } from '../../booking/public-guards.js';
import { getCanonicalOwnerId, validateAuthenticatedService } from '../../booking/auth-guards.js';
import { createClient } from '@supabase/supabase-js';
import { wartelisteZeitfensterGueltig } from '../../booking/warteliste-zeitfenster.js';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---------- shared auth helper ----------

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

  // Employees operate under their owner's tenant
  const tenantId = profile.role === 'employee' && profile.owner_id
    ? profile.owner_id
    : profile.id;

  return { user: u.user, profile, tenantId };
}

// Never hydrate service-role joins: historical rows can contain foreign references.
async function hydrateTenantLinks(entries, tenantId, includeServices = false) {
  const leadIds = [...new Set(entries.map(entry => entry.lead_id).filter(Boolean))];
  const serviceIds = includeServices
    ? [...new Set(entries.map(entry => entry.service_id).filter(Boolean))] : [];
  const leads = new Map();
  const services = new Map();
  // Begrenzte IN-Listen halten auch große Wartelisten unter HTTP-URL-Limits.
  for (let offset = 0; offset < leadIds.length; offset += 100) {
    const { data, error } = await supabase.from('leads')
      .select('id, first_name, last_name, phone, email')
      .eq('owner_id', tenantId).in('id', leadIds.slice(offset, offset + 100));
    if (error) throw error;
    for (const { id, ...contact } of data || []) leads.set(id, contact);
  }
  for (let offset = 0; offset < serviceIds.length; offset += 100) {
    const ids = serviceIds.slice(offset, offset + 100);
    // Canonical ownership is owner_id ?? user_id, including legacy services.
    const owned = await supabase.from('services').select('id, title, duration_minutes')
      .eq('owner_id', tenantId).in('id', ids);
    if (owned.error) throw owned.error;
    const legacy = await supabase.from('services').select('id, title, duration_minutes')
      .is('owner_id', null).eq('user_id', tenantId).in('id', ids);
    if (legacy.error) throw legacy.error;
    for (const { id, ...service } of [...(owned.data || []), ...(legacy.data || [])]) {
      services.set(id, service);
    }
  }
  return entries.map(entry => ({
    ...entry,
    leads: leads.get(entry.lead_id) || null,
    ...(includeServices ? { services: services.get(entry.service_id) || null } : {}),
  }));
}

// ============================================================================
// GET /api/warteliste
// Returns all 'waiting' entries for the authenticated tenant, joined with the
// lead's name for display purposes.
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { tenantId } = auth;

    const statusFilter = req.query.status || 'waiting';

    const { data, error } = await supabase
      .from('warteliste')
      .select(`
        id, owner_id, lead_id, service_id,
        preferred_days, preferred_time_from, preferred_time_to,
        notes, priority, status, matched_booking_id, notified_at,
        created_at, updated_at
      `)
      .eq('owner_id', tenantId)
      .eq('status', statusFilter)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(await hydrateTenantLinks(data || [], tenantId, true));
  } catch (e) {
    console.error('[warteliste/GET]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ============================================================================
// POST /api/warteliste
// Body: { lead_id?, service_id?, preferred_days?, preferred_time_from?,
//         preferred_time_to?, notes?, priority? }
// Creates a new waiting-list entry with status 'waiting'.
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { tenantId } = auth;

    const {
      lead_id,
      service_id,
      preferred_days,
      preferred_time_from,
      preferred_time_to,
      notes,
      priority,
    } = req.body || {};

    if (!wartelisteZeitfensterGueltig(preferred_time_from, preferred_time_to)) {
      return res.status(400).json({ error: 'Ungültiges Zeitfenster. Die Endzeit muss nach der Startzeit liegen.' });
    }

    for (const [field, value] of [['lead_id', lead_id], ['service_id', service_id]]) {
      if (value == null || value === '') continue;
      if (typeof value !== 'string') return res.status(400).json({ error: `Ungültige Referenz: ${field}` });
      const result = field === 'lead_id'
        ? await validateLead(supabase, value, tenantId)
        : await validateAuthenticatedService(supabase, value, tenantId);
      if (!result.ok) return res.status(result.status).json({ error: result.error });
    }

    const payload = {
      owner_id: tenantId,
      lead_id: lead_id || null,
      service_id: service_id || null,
      preferred_days: Array.isArray(preferred_days) ? preferred_days : [],
      preferred_time_from: preferred_time_from || null,
      preferred_time_to: preferred_time_to || null,
      notes: notes || null,
      priority: Number(priority) || 1,
      status: 'waiting',
    };

    const { data, error } = await supabase
      .from('warteliste')
      .insert(payload)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  } catch (e) {
    console.error('[warteliste/POST]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ============================================================================
// PATCH /api/warteliste/:id
// Body: { status, matched_booking_id? }
// Allowed status transitions: waiting → matched | cancelled
// ============================================================================
router.patch('/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { tenantId } = auth;

    const { status, matched_booking_id, notes, priority } = req.body || {};

    const allowedStatuses = ['waiting', 'matched', 'cancelled'];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowedStatuses.join(', ')}` });
    }

    // Verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from('warteliste')
      .select('id, owner_id')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Warteliste entry not found' });
    if (existing.owner_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });

    if (matched_booking_id != null) {
      if (typeof matched_booking_id !== 'string' || !matched_booking_id) {
        return res.status(400).json({ error: 'Ungültige Buchung' });
      }
      const { data: booking, error: bookingError } = await supabase.from('bookings')
        .select('id, owner_id, user_id').eq('id', matched_booking_id).maybeSingle();
      if (bookingError) return res.status(500).json({ error: 'Interner Serverfehler' });
      if (!booking || getCanonicalOwnerId(booking) !== tenantId) return res.status(400).json({ error: 'Ungültige Buchung' });
    }

    const updates = {};
    if (status !== undefined)              updates.status              = status;
    if (matched_booking_id !== undefined)  updates.matched_booking_id  = matched_booking_id;
    if (notes !== undefined)               updates.notes               = notes;
    if (priority !== undefined)            updates.priority             = Number(priority);

    if (status === 'matched') {
      updates.notified_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('warteliste')
      .update(updates)
      .eq('owner_id', tenantId)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch (e) {
    console.error('[warteliste/PATCH]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ============================================================================
// DELETE /api/warteliste/:id
// Removes a waiting-list entry. Only the OWNER may delete — not the team.
//
// 17.09.2026 (Ops-Karte #253): das Team hat auf `warteliste` seit Migration
// 0022 SELECT/INSERT/UPDATE, aber bewusst KEIN DELETE (Art. 5 Abs. 1 lit. d —
// ein fremder Wunsch soll nicht unbemerkt verschwinden; storniert wird über
// `status = 'cancelled'`). Diese Route läuft mit dem service_role-Schlüssel
// und sieht RLS gar nicht: `resolveAuth` löst einen Angestellten auf den
// Mandanten seines Inhabers auf, `tenantId` hätte also gepasst und die Zeile
// wäre gelöscht worden — die RLS-Entscheidung wäre hier durchgefallen.
// Deshalb steht die Rollenprüfung im Code. Siehe compliance/LEGAL_DECISIONS.md,
// Eintrag vom 17.09.2026.
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { tenantId, profile } = auth;

    if (profile.role !== 'owner') {
      return res.status(403).json({ error: 'Nur der Inhaber darf Wartelisten-Einträge löschen. Zum Stornieren status=cancelled verwenden.' });
    }

    // Verify ownership before delete
    const { data: existing, error: fetchErr } = await supabase
      .from('warteliste')
      .select('id, owner_id')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Warteliste entry not found' });
    if (existing.owner_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });

    const { error } = await supabase
      .from('warteliste')
      .delete()
      .eq('owner_id', tenantId)
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[warteliste/DELETE]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ============================================================================
// POST /api/warteliste/match
// Body: { booking_id } — a newly freed/cancelled booking
//
// Finds all 'waiting' warteliste entries for the same tenant that match:
//   1. service_id matches the cancelled booking's service_id (if provided)
//   2. The cancelled booking's weekday is included in preferred_days (if set)
//   3. The cancelled booking's time falls within preferred_time_from/to (if set)
//
// Returns a ranked list of candidates (ordered by priority DESC, created_at ASC).
// Does NOT automatically update status — caller decides which candidate to notify.
// ============================================================================
router.post('/match', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { tenantId } = auth;

    const { booking_id } = req.body || {};
    if (!booking_id) return res.status(400).json({ error: 'booking_id is required' });

    // 1. Fetch the freed booking
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('id, owner_id, service_id, start_time, end_time')
      .eq('id', booking_id)
      .single();

    if (bErr || !booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.owner_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });

    // 2. Determine weekday abbreviation (Berlin time, German short names)
    const bookingDate = new Date(booking.start_time);
    const WEEKDAY_MAP = { Mon: 'Mo', Tue: 'Di', Wed: 'Mi', Thu: 'Do', Fri: 'Fr', Sat: 'Sa', Sun: 'So' };
    const engDay = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      weekday: 'short',
    }).format(bookingDate);
    const germanDay = WEEKDAY_MAP[engDay] || engDay;

    // Time of day in "HH:MM" (Berlin)
    const bookingTimeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(bookingDate);
    const bookingTimeStr = `${bookingTimeParts.find(p => p.type === 'hour').value}:${bookingTimeParts.find(p => p.type === 'minute').value}`;

    // 3. Fetch all 'waiting' entries for this tenant
    const { data: candidates, error: cErr } = await supabase
      .from('warteliste')
      .select(`
        id, lead_id, service_id, preferred_days,
        preferred_time_from, preferred_time_to,
        notes, priority, created_at
      `)
      .eq('owner_id', tenantId)
      .eq('status', 'waiting')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (cErr) return res.status(500).json({ error: cErr.message });

    // 4. Filter candidates
    function timeStrToMins(t) {
      if (!t) return null;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    }

    const bookingMins = timeStrToMins(bookingTimeStr);

    const matched = (candidates || []).filter(entry => {
      // Service match: if the entry specifies a service, it must match
      if (entry.service_id && booking.service_id && entry.service_id !== booking.service_id) {
        return false;
      }

      // Preferred days match: if the entry has preferences, the booking day must be included
      if (Array.isArray(entry.preferred_days) && entry.preferred_days.length > 0) {
        if (!entry.preferred_days.includes(germanDay)) {
          return false;
        }
      }

      // Preferred time window match
      if (entry.preferred_time_from || entry.preferred_time_to) {
        const fromMins = timeStrToMins(entry.preferred_time_from);
        const toMins   = timeStrToMins(entry.preferred_time_to);
        if (fromMins !== null && bookingMins < fromMins) return false;
        if (toMins   !== null && bookingMins > toMins)   return false;
      }

      return true;
    });

    return res.json({
      booking: {
        id: booking.id,
        service_id: booking.service_id,
        start_time: booking.start_time,
        weekday: germanDay,
        time: bookingTimeStr,
      },
      candidates: await hydrateTenantLinks(matched, tenantId),
      total: matched.length,
    });
  } catch (e) {
    console.error('[warteliste/match]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

export default router;
