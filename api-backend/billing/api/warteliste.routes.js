// Warteliste (waiting list) HTTP routes.
//
// GET    /api/warteliste          — list all 'waiting' entries (with lead name join)
// POST   /api/warteliste          — add a new waiting-list entry
// PATCH  /api/warteliste/:id      — update status (matched | cancelled)
// DELETE /api/warteliste/:id      — remove an entry
// POST   /api/warteliste/match    — find suitable waiting-list candidates for a freed booking slot

import express from 'express';
import { createClient } from '@supabase/supabase-js';

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
        created_at, updated_at,
        leads:lead_id (first_name, last_name, phone, email),
        services:service_id (title, duration_minutes)
      `)
      .eq('owner_id', tenantId)
      .eq('status', statusFilter)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
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
// Removes a waiting-list entry. Only the owning tenant may delete.
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { tenantId } = auth;

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
        notes, priority, created_at,
        leads:lead_id (first_name, last_name, phone, email)
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
      candidates: matched,
      total: matched.length,
    });
  } catch (e) {
    console.error('[warteliste/match]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

export default router;
