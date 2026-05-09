import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { google } from 'googleapis';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URL) {
  console.error('FATAL: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: {
    transport: WebSocket
  }
});

// Google OAuth — factory: returns a NEW client per request to avoid token leak across concurrent users.
// The previous module-level singleton was a P0 race-condition: setCredentials() mutated shared state.
function newOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URL
  );
}

// Helpers
const BUSINESS_TZ = 'Europe/Berlin'; // All working_hours and date inputs are interpreted in this timezone

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minsToTime(m) {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${h}:${mm}`;
}

// Returns Berlin offset (in minutes east of UTC) for a given UTC instant.
// e.g. summer = 120 (CEST = UTC+2), winter = 60 (CET = UTC+1).
function berlinOffsetMin(utcDate) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, timeZoneName: 'shortOffset' })
    .formatToParts(utcDate).find(p => p.type === 'timeZoneName').value; // "GMT+2"
  const m = part.match(/GMT([+-]?\d+)(?::(\d+))?/);
  if (!m) return 60;
  const h = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  return h * 60 + Math.sign(h || 1) * mm;
}

// Convert a UTC Date to minutes-since-midnight in Berlin local time (0..1439).
function utcToBerlinMinutes(utcDate) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(utcDate);
  const h = +parts.find(p => p.type === 'hour').value;
  const m = +parts.find(p => p.type === 'minute').value;
  return h * 60 + m;
}

// Day-of-week (0=Sun..6=Sat) for a Berlin calendar date string "YYYY-MM-DD".
function berlinDayOfWeek(dateStr) {
  const probe = new Date(`${dateStr}T12:00:00Z`); // noon UTC = afternoon Berlin, safe from DST edges
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, weekday: 'short' }).format(probe);
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(wd);
}

// Returns UTC ISO bounds (start/end) covering the full Berlin calendar day "YYYY-MM-DD".
function berlinDayBoundsUTC(dateStr) {
  const noonUTC = new Date(`${dateStr}T12:00:00Z`);
  const offsetMin = berlinOffsetMin(noonUTC);
  const startMs = new Date(`${dateStr}T00:00:00Z`).getTime() - offsetMin * 60000;
  const endMs = startMs + 24 * 60 * 60 * 1000 - 1;
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

// Convert a Berlin local "YYYY-MM-DD HH:MM" pair to a UTC Date.
function berlinLocalToUTC(dateStr, timeStr) {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const offsetMin = berlinOffsetMin(probe);
  const naiveMs = new Date(`${dateStr}T${timeStr}:00Z`).getTime();
  return new Date(naiveMs - offsetMin * 60000);
}

// --- ROUTES ---

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 1. Google OAuth Routes
app.get('/api/calendar/google-auth', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const url = newOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ],
    state: userId
  });

  res.redirect(url);
});

app.get('/api/calendar/google-callback', async (req, res) => {
  const { code, state: userId } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });
  
  try {
    const { tokens } = await newOAuthClient().getToken(code);
    
    // Save tokens to Supabase calendar_integrations
    const { error } = await supabase
      .from('calendar_integrations')
      .upsert({
        user_id: userId,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, provider' });
      
    if (error) throw error;
    
    // Redirect back to dashboard calendar tab
    res.redirect('https://infinitymade.de/dashboard.html#calendar?success=google_connected');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('https://infinitymade.de/dashboard.html#calendar?error=google_failed');
  }
});

// 2. Booking Routes (Get Slots & Create)
app.post('/api/booking/get-slots', async (req, res) => {
  const { userId, date, duration } = req.body; // date: YYYY-MM-DD
  if (!userId || !date || !duration) return res.status(400).json({ error: 'Missing params' });

  try {
    const dayOfWeek = berlinDayOfWeek(date);
    const { start: dayStart, end: dayEnd } = berlinDayBoundsUTC(date);

    // 1. Get Working Hours (HH:MM strings stored in Berlin local time)
    const { data: wh } = await supabase
      .from('working_hours')
      .select('*')
      .eq('user_id', userId)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (!wh || !wh.is_active) {
      return res.json({ slots: [] });
    }

    const startMinutes = timeToMins(wh.start_time);
    const endMinutes = timeToMins(wh.end_time);

    // 2. Get existing bookings for this date (Supabase stores TIMESTAMPTZ as UTC)
    const { data: bookings } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('user_id', userId)
      .eq('status', 'confirmed')
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd);

    const bookedIntervals = (bookings || []).map(b => ({
      start: utcToBerlinMinutes(new Date(b.start_time)),
      end: utcToBerlinMinutes(new Date(b.end_time))
    }));

    // 2.5 Get Time Offs (Beurlaubt) for this employee
    const { data: timeOffs } = await supabase
      .from('time_offs')
      .select('start_date, end_date')
      .eq('employee_id', userId)
      .lte('start_date', dayEnd)
      .gte('end_date', dayStart);

    if (timeOffs) {
      const dayStartMs = new Date(dayStart).getTime();
      const dayEndMs = new Date(dayEnd).getTime();
      timeOffs.forEach(t => {
        const tStartMs = Math.max(new Date(t.start_date).getTime(), dayStartMs);
        const tEndMs = Math.min(new Date(t.end_date).getTime(), dayEndMs);
        bookedIntervals.push({
          start: utcToBerlinMinutes(new Date(tStartMs)),
          end: utcToBerlinMinutes(new Date(tEndMs))
        });
      });
    }

    // 3. Get Google Calendar Busy slots
    const { data: integ } = await supabase
      .from('calendar_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single();

    if (integ && integ.access_token) {
      const auth = newOAuthClient();
      auth.setCredentials({ access_token: integ.access_token, refresh_token: integ.refresh_token });
      const calendar = google.calendar({ version: 'v3', auth });

      try {
        const freeBusyRes = await calendar.freebusy.query({
          requestBody: {
            timeMin: dayStart,
            timeMax: dayEnd,
            timeZone: BUSINESS_TZ,
            items: [{ id: 'primary' }]
          }
        });
        const busy = freeBusyRes.data.calendars.primary.busy || [];
        busy.forEach(b => {
          bookedIntervals.push({
            start: utcToBerlinMinutes(new Date(b.start)),
            end: utcToBerlinMinutes(new Date(b.end))
          });
        });
      } catch (err) {
        console.error('Google API error, tokens might be expired', err.message);
      }
    }

    // 4. Generate available slots
    const slots = [];
    let currentMins = startMinutes;
    while (currentMins + duration <= endMinutes) {
      const slotEnd = currentMins + duration;
      
      const hasOverlap = bookedIntervals.some(b => {
        return currentMins < b.end && slotEnd > b.start;
      });

      if (!hasOverlap) {
        slots.push(minsToTime(currentMins));
      }
      currentMins += duration; // can also step by 15 or 30 mins
    }

    res.json({ slots });
  } catch (error) {
    console.error('get-slots error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/booking/create', async (req, res) => {
  const { userId, serviceId, date, time, customerName, customerEmail, customerPhone } = req.body;
  
  try {
    const { data: service } = await supabase.from('services').select('*').eq('id', serviceId).single();
    if (!service) return res.status(400).json({ error: 'Service not found' });

    // date+time arrive as Berlin local — convert to UTC for storage
    const start_time = berlinLocalToUTC(date, time);
    const end_time = new Date(start_time.getTime() + service.duration_minutes * 60000);

    // Save Booking FIRST — exclusion constraint (no_overlapping_bookings) atomically rejects
    // double-bookings. Doing this before any external side-effects (Google Meet) avoids
    // orphaned calendar events when two clients race for the same slot.
    const owner_id = req.body.ownerId || userId; // solopreneur fallback

    const { data: booking, error: dbErr } = await supabase.from('bookings').insert({
      user_id: userId,
      owner_id: owner_id,
      service_id: serviceId,
      start_time: start_time.toISOString(),
      end_time: end_time.toISOString(),
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      status: 'confirmed'
    }).select().single();

    if (dbErr) {
      if (dbErr.code === '23P01') {
        return res.status(409).json({ error: 'Dieser Termin wurde gerade von jemand anderem gebucht. Bitte wählen Sie einen anderen Slot.' });
      }
      throw dbErr;
    }

    // Google Meet — only after booking exists. Failures here don't roll back the booking;
    // we just return without a meeting link and log for ops.
    let meetingLink = null;
    const { data: integ } = await supabase.from('calendar_integrations').select('*').eq('user_id', userId).eq('provider', 'google').single();

    if (service.is_online_meeting && integ && integ.access_token) {
      const auth = newOAuthClient();
      auth.setCredentials({ access_token: integ.access_token, refresh_token: integ.refresh_token });
      const calendar = google.calendar({ version: 'v3', auth });

      try {
        const eventRes = await calendar.events.insert({
          calendarId: 'primary',
          conferenceDataVersion: 1,
          requestBody: {
            summary: `${service.title} - ${customerName}`,
            description: `Kunde: ${customerName}\nE-Mail: ${customerEmail}\nTel: ${customerPhone}`,
            start: { dateTime: start_time.toISOString(), timeZone: BUSINESS_TZ },
            end: { dateTime: end_time.toISOString(), timeZone: BUSINESS_TZ },
            conferenceData: {
              createRequest: { requestId: `meet-${booking.id}`, conferenceSolutionKey: { type: 'hangoutsMeet' } }
            }
          }
        });
        meetingLink = eventRes.data.hangoutLink || null;
        if (meetingLink) {
          await supabase.from('bookings').update({ meeting_link: meetingLink }).eq('id', booking.id);
          booking.meeting_link = meetingLink;
        }
      } catch (err) {
        console.error('Google Calendar event creation failed', err.message);
      }
    }

    // Trigger n8n webhook
    const n8nWebhook = process.env.N8N_WEBHOOK_URL;
    if (n8nWebhook) {
      await fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          providerId: userId,
          customerName,
          customerEmail,
          customerPhone,
          serviceTitle: service.title,
          time: start_time.toISOString(),
          meetingLink
        })
      }).catch(e => console.error('n8n webhook failed', e.message));
    }

    res.json({ success: true, booking });
  } catch (err) {
    console.error('Booking create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Verify Company Code (Bypass RLS)
app.post('/api/verify-code', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_code', code.toUpperCase())
      .eq('role', 'owner')
      .single();
      
    if (error || !data) {
      return res.status(404).json({ error: 'Ungültiger Code' });
    }
    
    res.json({ ownerId: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Team Members (Bypasses RLS)
app.get('/api/team', async (req, res) => {
  try {
    const { owner_id } = req.query;
    if (!owner_id) return res.status(400).json({ error: 'owner_id is required' });

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, business_name, role')
      .or(`id.eq.${owner_id},owner_id.eq.${owner_id}`);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Manual Booking (From Admin Panel)
app.post('/api/booking/manual-create', async (req, res) => {
  try {
    const { ownerId, employeeId, title, start_time, end_time, customerName, customerPhone } = req.body;
    
    const { data, error } = await supabase.from('bookings').insert({
      owner_id: ownerId,
      user_id: employeeId,
      customer_name: customerName,
      customer_phone: customerPhone,
      start_time: start_time,
      end_time: end_time,
      customer_email: 'manual@booking.com',
      status: 'confirmed'
    }).select().single();

    if (error) {
      if (error.code === '23P01') {
        return res.status(409).json({ error: 'Slot bereits belegt — bitte einen anderen Zeitpunkt wählen.' });
      }
      throw error;
    }
    res.json({ success: true, booking: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Calendar API running on port ${PORT}`);
});
