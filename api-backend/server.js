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

// Request logger — used to debug what the n8n bot is actually sending.
app.use((req, _res, next) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} body=${JSON.stringify(req.body)}`);
  }
  next();
});

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

app.get('/api/gmail/connect', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const url = newOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    scope: ['email', 'profile', 'openid', 'https://www.googleapis.com/auth/gmail.send'],
    state: JSON.stringify({ userId, type: 'gmail' })
  });

  res.redirect(url);
});

app.get('/api/calendar/google-callback', async (req, res) => {
  const { code, state: rawState } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  let userId, flowType;
  try {
    const parsed = JSON.parse(rawState);
    userId   = parsed.userId;
    flowType = parsed.type || 'calendar';
  } catch {
    userId   = rawState;
    flowType = 'calendar';
  }

  try {
    const { tokens } = await newOAuthClient().getToken(code);

    if (flowType === 'gmail') {
      const uRes  = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: 'Bearer ' + tokens.access_token }
      });
      const uinfo = await uRes.json();
      if (!uinfo.email) throw new Error('No email from Google');

      const { error } = await supabase.from('profiles')
        .update({
          b2b_from_email: uinfo.email,
          b2b_gmail_refresh_token: tokens.refresh_token || null
        })
        .eq('id', userId);
      if (error) throw error;

      const emailEnc = encodeURIComponent(uinfo.email);
      return res.redirect(`https://infinitymade.de/dashboard.html?gmail_ok=1&gmail_email=${emailEnc}#b2b`);
    }

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
    
    res.redirect('https://infinitymade.de/dashboard.html#calendar?success=google_connected');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('https://infinitymade.de/dashboard.html#calendar?error=google_failed');
  }
});

app.post('/api/gmail/send', async (req, res) => {
  const { userId, to_email, to_name, subject, body, sender_name } = req.body;
  if (!userId || !to_email || !subject || !body) return res.status(400).json({ error: 'Missing params' });

  try {
    const { data: profile, error: pErr } = await supabase
      .from('profiles').select('b2b_gmail_refresh_token, b2b_from_email').eq('id', userId).single();
    if (pErr || !profile) throw new Error('Profile not found');
    if (!profile.b2b_gmail_refresh_token) throw new Error('No Gmail token — please reconnect Gmail in B2B setup');

    const oauth = newOAuthClient();
    oauth.setCredentials({ refresh_token: profile.b2b_gmail_refresh_token });
    const { credentials } = await oauth.refreshAccessToken();

    const fromLabel = sender_name ? `${sender_name} <${profile.b2b_from_email}>` : profile.b2b_from_email;
    const toLabel   = to_name ? `${to_name} <${to_email}>` : to_email;
    const rawEmail  = [
      `From: ${fromLabel}`,
      `To: ${toLabel}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(body).toString('base64')
    ].join('\r\n');
    const encoded = Buffer.from(rawEmail).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + credentials.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: encoded })
    });
    const gmailJson = await gmailRes.json();
    if (!gmailRes.ok) throw new Error(gmailJson.error?.message || 'Gmail API error');

    res.json({ success: true, messageId: gmailJson.id });
  } catch (e) {
    console.error('[gmail/send]', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/apify/search', async (req, res) => {
  const { query, limit, userId } = req.body;
  if (!query || !userId) return res.status(400).json({ error: 'Missing params' });
  const safeLimit = Math.min(parseInt(limit)||20, 50);
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(500).json({ error: 'Apify not configured' });
  try {
    const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
    const { count: weekCount } = await supabase.from('b2b_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId).eq('source', 'apify').gte('created_at', weekAgo);
    const WEEKLY_LIMIT = 100;
    if ((weekCount||0) >= WEEKLY_LIMIT)
      return res.status(429).json({ success: false, error: `Wöchentliches Limit von ${WEEKLY_LIMIT} erreicht (Reset in 7 Tagen)` });
    const allowed = Math.min(safeLimit, WEEKLY_LIMIT - (weekCount||0));
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${token}&timeout=120&memory=512`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchStringsArray: [query], maxCrawledPlacesPerSearch: allowed, language: 'de', includeHistogram: false, includeImages: false }) }
    );
    if (!apifyRes.ok) throw new Error('Apify HTTP ' + apifyRes.status);
    const items = await apifyRes.json();
    const contacts = (items||[]).map(p => ({
      owner_id: userId,
      company_name: p.title||p.name||'—',
      contact_name: null,
      phone: p.phone||p.phoneNumber||null,
      email: p.email||null,
      website: p.website||null,
      status: 'prospect',
      source: 'apify',
      notes: [
        p.categoryName ? `Branche: ${p.categoryName}` : null,
        p.address?.street ? `Adresse: ${p.address.street}, ${p.address.city||''}` : null,
        p.totalScore ? `Bewertung: ${p.totalScore} ⭐ (${p.reviewsCount||0} Rezensionen)` : null,
        p.url ? `Google Maps: ${p.url}` : null
      ].filter(Boolean).join('\n')||null
    }));
    if (contacts.length > 0) await supabase.from('b2b_contacts').insert(contacts);
    res.json({ success: true, count: contacts.length, remaining: WEEKLY_LIMIT - (weekCount||0) - contacts.length });
  } catch(e) {
    console.error('[apify/search]', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 2. Booking Routes (Get Slots & Create)
app.post('/api/booking/get-slots', async (req, res) => {
  const { userId, date, duration } = req.body; // date: YYYY-MM-DD
  if (!userId || !date || !duration) return res.status(400).json({ error: 'Missing params' });

  try {
    const dayOfWeek = berlinDayOfWeek(date);
    const { start: dayStart, end: dayEnd } = berlinDayBoundsUTC(date);

    // Reject past dates entirely
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE', { timeZone: BUSINESS_TZ });
    if (date < todayStr) return res.json({ slots: [] });

    // For today, compute current Berlin minute for filtering below
    let nowBerlinMinutes = null;
    if (date === todayStr) {
      nowBerlinMinutes = utcToBerlinMinutes(now);
    }

    // 1. Resolve owner_id
    let ownerId = userId;
    const { data: profile } = await supabase
      .from('profiles')
      .select('owner_id')
      .eq('id', userId)
      .single();
    if (profile?.owner_id) ownerId = profile.owner_id;

    // 1.5 Check custom_days (shop-wide closed/holiday/special)
    const { data: customDay } = await supabase
      .from('custom_days')
      .select('type,start_time,end_time')
      .eq('owner_id', ownerId)
      .eq('date', date)
      .maybeSingle();

    if (customDay && (customDay.type === 'closed' || customDay.type === 'holiday') && !customDay.start_time && !customDay.end_time) {
      return res.json({ slots: [] });
    }

    // 2. Get Working Hours — employee first, fallback to owner
    let wh = (await supabase
      .from('working_hours')
      .select('*')
      .eq('user_id', userId)
      .eq('day_of_week', dayOfWeek)
      .single()).data;

    if (!wh || !wh.is_active) {
      if (profile?.owner_id) {
        wh = (await supabase
          .from('working_hours')
          .select('*')
          .eq('user_id', profile.owner_id)
          .eq('day_of_week', dayOfWeek)
          .single()).data;
      }
    }

    if (customDay && customDay.type === 'special' && customDay.start_time && customDay.end_time) {
      wh = { start_time: customDay.start_time, end_time: customDay.end_time, is_active: true };
    }

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

    if (customDay && (customDay.type === 'closed' || customDay.type === 'holiday') && customDay.start_time && customDay.end_time) {
      bookedIntervals.push({
        start: timeToMins(customDay.start_time),
        end: timeToMins(customDay.end_time)
      });
    }

    // 2.6 Get Breaks/Pauses for this employee
    const { data: breaksData } = await supabase
      .from('breaks')
      .select('start_time, end_time')
      .eq('user_id', userId)
      .eq('day_of_week', dayOfWeek);

    (breaksData || []).forEach(b => {
      bookedIntervals.push({
        start: timeToMins(b.start_time),
        end: timeToMins(b.end_time)
      });
    });

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
    const buffer = parseInt(req.body.buffer) || 0;
    const step   = parseInt(req.body.step)   || 30;
    const totalBlock = parseInt(duration) + buffer;
    const slots = [];
    let currentMins = startMinutes;
    while (currentMins + totalBlock <= endMinutes) {
      const slotEnd = currentMins + totalBlock;
      const hasOverlap = bookedIntervals.some(b => currentMins < b.end && slotEnd > b.start);
      // Skip slots in the past (today only) + enforce 30-min lead time
      const tooSoon = nowBerlinMinutes !== null && (currentMins + totalBlock) <= nowBerlinMinutes + 30;
      if (!hasOverlap && !tooSoon) slots.push(minsToTime(currentMins));
      currentMins += step;
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
    // Reject past dates and enforce minimum 30-min lead time
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE', { timeZone: BUSINESS_TZ });
    if (date < todayStr) return res.status(400).json({ error: 'Termine in der Vergangenheit können nicht gebucht werden.' });
    if (date === todayStr) {
      const nowMins = utcToBerlinMinutes(now);
      const slotMins = timeToMins(time);
      if (slotMins <= nowMins + 30) return res.status(400).json({ error: 'Bitte wählen Sie einen Termin mindestens 30 Minuten in der Zukunft.' });
    }

    const { data: service } = await supabase.from('services').select('*').eq('id', serviceId).single();
    if (!service) return res.status(400).json({ error: 'Service not found' });

    // date+time arrive as Berlin local — convert to UTC for storage
    const start_time = berlinLocalToUTC(date, time);
    const end_time = new Date(start_time.getTime() + service.duration_minutes * 60000);

    // Save Booking FIRST — exclusion constraint (no_overlapping_bookings) atomically rejects
    // double-bookings. Doing this before any external side-effects (Google Meet) avoids
    // orphaned calendar events when two clients race for the same slot.
    const owner_id = (req.body.ownerId != null) ? req.body.ownerId : userId; // solopreneur fallback

    const { data: booking, error: dbErr } = await supabase.from('bookings').insert({
      user_id: userId,
      owner_id: owner_id,
      service_id: serviceId,
      start_time: start_time.toISOString(),
      end_time: end_time.toISOString(),
      customer_name: customerName,
      customer_email: customerEmail || `wa${(customerPhone || 'anon').replace(/\D/g, '')}@whatsapp.local`,
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

    // Resolve actual owner_id for lead (employee -> owner)
    let resolvedOwnerId = owner_id;
    if (!req.body.ownerId) {
      const { data: empProfile } = await supabase.from('profiles').select('owner_id').eq('id', userId).maybeSingle();
      resolvedOwnerId = empProfile?.owner_id || userId;
    }

    // Upsert lead into leads table
    try {
      const normPhone = customerPhone ? customerPhone.replace(/\D/g, '') : null;
      const email = (customerEmail || '').trim().toLowerCase();

      console.log('[lead upsert]', { resolvedOwnerId, email, normPhone, customerName });

      if (email) {
        const { data: existing } = await supabase
          .from('leads')
          .select('*')
          .eq('owner_id', resolvedOwnerId)
          .eq('email', email)
          .limit(1)
          .maybeSingle();

        if (existing) {
          const updates = {};
          if (customerName && !existing.title) updates.title = customerName;
          if (customerPhone && !existing.phone) { updates.phone = customerPhone; updates.phone_normalized = normPhone; }
          if (existing.status !== 'booked') updates.status = 'booked';
          if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date().toISOString();
            await supabase.from('leads').update(updates).eq('id', existing.id);
            console.log('[lead upsert] updated existing by email:', existing.id);
          } else {
            console.log('[lead upsert] existing lead found, no changes needed:', existing.id);
          }
        } else {
          const nameParts = customerName ? customerName.split(/\s+/) : [];
          const { data: newLead, error: leadInsertErr } = await supabase.from('leads').insert({
            owner_id: resolvedOwnerId,
            title: customerName || null,
            email: email,
            phone: customerPhone || null,
            phone_normalized: normPhone,
            first_name: nameParts[0] || null,
            last_name: nameParts.slice(1).join(' ') || null,
            status: 'booked'
          }).select().single();
          if (leadInsertErr) throw leadInsertErr;
          console.log('[lead upsert] inserted new lead:', newLead?.id);
        }
      } else if (normPhone) {
        const { data: existing } = await supabase
          .from('leads')
          .select('*')
          .eq('owner_id', resolvedOwnerId)
          .eq('phone_normalized', normPhone)
          .limit(1)
          .maybeSingle();

        if (existing) {
          const updates = {};
          if (customerName && !existing.title) updates.title = customerName;
          if (existing.status !== 'booked') updates.status = 'booked';
          if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date().toISOString();
            await supabase.from('leads').update(updates).eq('id', existing.id);
            console.log('[lead upsert] updated existing by phone:', existing.id);
          } else {
            console.log('[lead upsert] existing lead found by phone, no changes:', existing.id);
          }
        } else {
          const nameParts = customerName ? customerName.split(/\s+/) : [];
          const { data: newLead, error: leadInsertErr } = await supabase.from('leads').insert({
            owner_id: resolvedOwnerId,
            title: customerName || null,
            phone: customerPhone,
            phone_normalized: normPhone,
            first_name: nameParts[0] || null,
            last_name: nameParts.slice(1).join(' ') || null,
            status: 'booked'
          }).select().single();
          if (leadInsertErr) throw leadInsertErr;
          console.log('[lead upsert] inserted new lead by phone:', newLead?.id);
        }
      } else {
        console.log('[lead upsert] skipped — no email or phone provided');
      }
    } catch (leadErr) {
      console.error('Lead upsert failed:', leadErr.message, leadErr);
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
      .select('id, email, business_name, role, booking_slug, avatar_url, anrede')
      .or(`id.eq.${owner_id},owner_id.eq.${owner_id}`);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/booking/batch-create', async (req, res) => {
  const { userId, ownerId, serviceId, startDate, time, recurrence, weekdays, count, customerName, customerPhone, notes, duration } = req.body;

  if (!userId || !ownerId || !startDate || !time || !count || count < 1 || count > 52) {
    return res.status(400).json({ error: 'Missing or invalid params' });
  }

  // Trust the duration sent from the frontend (the user picked it from the
  // service's active durations). Only fall back to the service's stored
  // duration if the frontend didn't send one.
  let dur = parseInt(duration, 10);
  if (!dur || dur <= 0) {
    if (serviceId) {
      const { data: svc } = await supabase
        .from('services')
        .select('duration_minutes, price_config')
        .eq('id', serviceId)
        .single();
      if (svc) {
        if (svc.duration_minutes && svc.duration_minutes > 0) {
          dur = svc.duration_minutes;
        } else if (svc.price_config && svc.price_config.durations) {
          const active = Object.entries(svc.price_config.durations)
            .filter(([_, v]) => v && v.active)
            .map(([k]) => parseInt(k, 10))
            .filter(n => n > 0)
            .sort((a, b) => a - b);
          if (active.length) dur = active[0];
        }
      }
    }
  }
  if (!dur || dur <= 0) dur = 30; // last-resort default
  console.log('[batch-create] dur=', dur, 'count=', count, 'serviceId=', serviceId);

  const created = [];
  const conflicts = [];

  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().substring(0, 10);
  }

  const targetDates = [];

  if (recurrence === 'daily') {
    for (let i = 0; i < count; i++) {
      targetDates.push(addDays(startDate, i));
    }
  } else {
    const wdSet = new Set((weekdays || []).map(Number));
    const startWd = berlinDayOfWeek(startDate);
    if (!wdSet.has(startWd)) wdSet.add(startWd);
    const step = recurrence === 'biweekly' ? 14 : 7;

    const first = new Date(startDate + 'T12:00:00Z');
    let current = addDays(startDate, -first.getUTCDay());

    while (targetDates.length < count) {
      wdSet.forEach(d => {
        if (targetDates.length >= count) return;
        const candidate = addDays(current, d);
        if (berlinDayOfWeek(candidate) === d) targetDates.push(candidate);
      });
      current = addDays(current, step);
    }
  }

  for (const dateStr of targetDates.slice(0, count)) {
    try {
      const start_time = berlinLocalToUTC(dateStr, time);
      const end_time = new Date(start_time.getTime() + dur * 60000);

      const { data: booking, error: dbErr } = await supabase.from('bookings').insert({
        user_id: userId,
        owner_id: ownerId,
        service_id: serviceId || null,
        start_time: start_time.toISOString(),
        end_time: end_time.toISOString(),
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        customer_email: 'manual@booking.com',
        notes: notes || null,
        hausbesuch: req.body.hausbesuch || false,
        status: 'confirmed'
      }).select().single();

      if (dbErr) {
        if (dbErr.code === '23P01') {
          conflicts.push({ date: dateStr, reason: 'Slot bereits belegt' });
        } else {
          conflicts.push({ date: dateStr, reason: dbErr.message });
        }
      } else {
        created.push({ id: booking.id, date: dateStr, start_time: booking.start_time });
      }
    } catch (err) {
      conflicts.push({ date: dateStr, reason: err.message });
    }
  }

  res.json({ created, conflicts, count: created.length });
});

// 5b. AI Series Scheduler — enumerate candidate slots, send to n8n+OpenAI for ranking
app.post('/api/booking/ai-suggest-series', async (req, res) => {
  try {
    const {
      ownerId, serviceId, customerId, employeeId,
      count = 8, recurrence = 'weekly',
      preferredTime, preferences = {}
    } = req.body;
    if (!ownerId || !serviceId || !count) {
      return res.status(400).json({ error: 'ownerId, serviceId, count required' });
    }

    // 1) Resolve service + duration
    const { data: svc } = await supabase.from('services')
      .select('id,title,duration_minutes,price_config').eq('id', serviceId).single();
    if (!svc) return res.status(400).json({ error: 'Service not found' });
    let dur = svc.duration_minutes;
    if (!dur && svc.price_config?.durations) {
      const active = Object.entries(svc.price_config.durations)
        .filter(([_, v]) => v && v.active).map(([k]) => parseInt(k)).filter(n => n > 0).sort((a, b) => a - b);
      if (active.length) dur = active[0];
    }
    if (!dur || dur <= 0) dur = 30;

    // 2) Resolve owner profile (sector) + customer
    const [{ data: ownerProfile }, { data: customer }] = await Promise.all([
      supabase.from('profiles').select('sector,business_name').eq('id', ownerId).single(),
      customerId ? supabase.from('leads').select('id,first_name,last_name,title,phone,metadata').eq('id', customerId).single() : Promise.resolve({ data: null })
    ]);
    const sector = ownerProfile?.sector || 'unknown';

    // 3) Resolve eligible employees offered the service
    const { data: empSvc } = await supabase.from('employee_services')
      .select('employee_id').eq('service_id', serviceId);
    let allowedIds = (empSvc || []).map(e => e.employee_id);
    // If service has no explicit employee assignments, allow the whole team
    if (allowedIds.length === 0) {
      const { data: team } = await supabase.from('profiles').select('id').or(`id.eq.${ownerId},owner_id.eq.${ownerId}`);
      allowedIds = (team || []).map(t => t.id);
    }
    if (preferences.sameEmployee === 'always' && employeeId) {
      allowedIds = [employeeId];
    } else if (employeeId && !allowedIds.includes(employeeId)) {
      allowedIds.push(employeeId);
    }
    if (allowedIds.length === 0) return res.json({ candidates: [], selected: [], report: 'Keine Mitarbeiter verfügbar.' });

    const { data: employees } = await supabase.from('profiles')
      .select('id,business_name,email,anrede').in('id', allowedIds);
    const empList = (employees || []).map(e => ({
      id: e.id,
      name: e.business_name || e.email?.split('@')[0] || 'Mitarbeiter',
      anrede: e.anrede || null
    }));

    // 4) Fetch working_hours, breaks, time_offs, custom_days, bookings for next 14 weeks
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: BUSINESS_TZ });
    const horizonDate = new Date();
    horizonDate.setDate(horizonDate.getDate() + 14 * 7);
    const horizon = horizonDate.toLocaleDateString('sv-SE', { timeZone: BUSINESS_TZ });
    const horizonStartIso = berlinLocalToUTC(today, '00:00').toISOString();
    const horizonEndIso = berlinLocalToUTC(horizon, '23:59').toISOString();

    const [whRes, brRes, toRes, cdRes, bkRes] = await Promise.all([
      supabase.from('working_hours').select('user_id,day_of_week,start_time,end_time,is_active').in('user_id', allowedIds),
      supabase.from('breaks').select('user_id,day_of_week,start_time,end_time').in('user_id', allowedIds),
      supabase.from('time_offs').select('employee_id,start_date,end_date').in('employee_id', allowedIds).lte('start_date', horizonEndIso).gte('end_date', horizonStartIso),
      supabase.from('custom_days').select('date,type,start_time,end_time').eq('owner_id', ownerId).gte('date', today).lte('date', horizon),
      supabase.from('bookings').select('user_id,start_time,end_time').in('user_id', allowedIds).eq('status', 'confirmed').gte('start_time', horizonStartIso).lte('start_time', horizonEndIso)
    ]);

    const wh = whRes.data || [];
    const breaks = brRes.data || [];
    const timeOffs = toRes.data || [];
    const customDays = cdRes.data || [];
    const bookings = bkRes.data || [];

    // Index helpers
    const whByEmpDay = new Map();
    wh.forEach(w => { if (w.is_active) whByEmpDay.set(`${w.user_id}|${w.day_of_week}`, w); });
    const breaksByEmpDay = new Map();
    breaks.forEach(b => {
      const key = `${b.user_id}|${b.day_of_week}`;
      if (!breaksByEmpDay.has(key)) breaksByEmpDay.set(key, []);
      breaksByEmpDay.get(key).push(b);
    });
    const customDayByDate = new Map(customDays.map(c => [c.date, c]));
    const bookingsByEmp = new Map();
    bookings.forEach(b => {
      if (!bookingsByEmp.has(b.user_id)) bookingsByEmp.set(b.user_id, []);
      bookingsByEmp.get(b.user_id).push(b);
    });

    function timeToMinsLocal(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
    function minsToTimeLocal(m) { const h = Math.floor(m / 60); const mm = m % 60; return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`; }

    // 5) Enumerate candidate slots
    const targetMin = preferredTime ? timeToMinsLocal(preferredTime) : null;
    const tod = preferences.timeOfDay; // morning|afternoon|any
    const step = 30;
    void recurrence; // recurrence handled by AI ranking, not by enumeration

    const candidates = [];
    const maxCandidates = 80;
    const dayCursor = new Date(today + 'T12:00:00Z');
    let safetyCounter = 0;

    while (candidates.length < maxCandidates && safetyCounter < 14 * 7) {
      const dateStr = dayCursor.toISOString().substring(0, 10);
      const dayOfWeek = berlinDayOfWeek(dateStr);

      // Custom day check (closed/holiday)
      const cd = customDayByDate.get(dateStr);
      const isClosedDay = cd && (cd.type === 'closed' || cd.type === 'holiday') && !cd.start_time && !cd.end_time;

      if (!isClosedDay) {
        for (const emp of empList) {
          if (candidates.length >= maxCandidates) break;
          const w = whByEmpDay.get(`${emp.id}|${dayOfWeek}`);
          if (!w) continue;

          let startMins = timeToMinsLocal(w.start_time);
          let endMins = timeToMinsLocal(w.end_time);
          if (cd && cd.type === 'special' && cd.start_time && cd.end_time) {
            startMins = timeToMinsLocal(cd.start_time);
            endMins = timeToMinsLocal(cd.end_time);
          }

          // Filter by morning/afternoon preference
          if (tod === 'morning') endMins = Math.min(endMins, 12 * 60);
          else if (tod === 'afternoon') startMins = Math.max(startMins, 12 * 60);

          // Build busy intervals: bookings + breaks + time_offs that hit this date
          const busy = [];
          (breaksByEmpDay.get(`${emp.id}|${dayOfWeek}`) || []).forEach(b => {
            busy.push({ start: timeToMinsLocal(b.start_time), end: timeToMinsLocal(b.end_time) });
          });
          (bookingsByEmp.get(emp.id) || []).forEach(b => {
            const s = new Date(b.start_time);
            const e = new Date(b.end_time);
            const sDate = s.toLocaleDateString('sv-SE', { timeZone: BUSINESS_TZ });
            if (sDate !== dateStr) return;
            const sLocal = parseInt(s.toLocaleTimeString('de-DE', { timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).split(':')[0]) * 60
                         + parseInt(s.toLocaleTimeString('de-DE', { timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).split(':')[1]);
            const eLocal = sLocal + Math.round((e - s) / 60000);
            busy.push({ start: sLocal, end: eLocal });
          });
          // Time-offs that include this date
          const offHit = timeOffs.find(t => t.employee_id === emp.id && t.start_date <= dateStr && t.end_date >= dateStr);
          if (offHit) continue; // whole day blocked

          // Generate slots
          for (let m = startMins; m + dur <= endMins; m += step) {
            const slotEnd = m + dur;
            const overlap = busy.some(b => m < b.end && slotEnd > b.start);
            if (overlap) continue;

            // Score: lower is better (closer to preferences)
            let score = 0;
            if (employeeId && emp.id !== employeeId) score += preferences.sameEmployee === 'preferred' ? 100 : 30;
            if (targetMin !== null) score += Math.abs(m - targetMin) / 5;
            // Earlier dates slightly preferred for series cohesion
            score += safetyCounter * 0.5;

            candidates.push({
              date: dateStr,
              time: minsToTimeLocal(m),
              employeeId: emp.id,
              score
            });
            if (candidates.length >= maxCandidates) break;
          }
        }
      }

      dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
      safetyCounter++;
    }

    // Sort by score and take top N (give AI ~3x candidates to choose from)
    candidates.sort((a, b) => a.score - b.score);
    const shortList = candidates.slice(0, Math.min(60, count * 5));

    if (shortList.length === 0) {
      return res.json({ candidates: [], selected: [], report: 'Im Suchzeitraum von 14 Wochen wurden keine freien Slots gefunden.' });
    }

    // 6) Send to n8n for AI ranking + report
    const customerName = customer
      ? ((customer.first_name || '') + ' ' + (customer.last_name || '')).trim() || customer.title || 'Patient'
      : 'Patient';

    const aiPayload = {
      candidates: shortList.map(({ score, ...c }) => c),
      count,
      preferences: {
        ...preferences,
        preferredEmployee: employeeId || null
      },
      service: { title: svc.title, duration: dur },
      employees: empList,
      customer: { name: customerName, id: customer?.id || null },
      sector
    };

    const N8N_AI_URL = process.env.N8N_AI_SERIES_URL || 'https://n8n.infinitymade.de/webhook/ai-series-scheduler';
    let aiResult = { selected: [], report: '' };
    try {
      const aiRes = await fetch(N8N_AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiPayload)
      });
      if (aiRes.ok) {
        aiResult = await aiRes.json();
      } else {
        console.error('[ai-suggest-series] n8n returned', aiRes.status);
      }
    } catch (err) {
      console.error('[ai-suggest-series] n8n error', err.message);
    }

    // 7) Fallback: if AI failed or returned empty, just take the top N by score
    let selected = Array.isArray(aiResult.selected) && aiResult.selected.length
      ? aiResult.selected.slice(0, count)
      : shortList.slice(0, count).map(({ score, ...c }) => c);
    let report = aiResult.report || `Wir haben ${selected.length} freie Termine gefunden, die Ihren Wünschen am besten entsprechen.`;

    res.json({
      success: true,
      selected,
      report,
      candidatesTotal: candidates.length,
      service: { id: svc.id, title: svc.title, duration: dur },
      employees: empList
    });
  } catch (err) {
    console.error('[ai-suggest-series] error', err);
    res.status(500).json({ error: err.message });
  }
});

// 5c. Batch-create with explicit slots (used after AI confirmation)
app.post('/api/booking/batch-create-explicit', async (req, res) => {
  const { ownerId, serviceId, slots, customerName, customerPhone, notes, hausbesuch, duration } = req.body;
  if (!ownerId || !Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ error: 'ownerId and slots[] required' });
  }
  let dur = parseInt(duration, 10);
  if (!dur || dur <= 0) {
    if (serviceId) {
      const { data: svc } = await supabase.from('services').select('duration_minutes,price_config').eq('id', serviceId).single();
      if (svc) {
        if (svc.duration_minutes && svc.duration_minutes > 0) dur = svc.duration_minutes;
        else if (svc.price_config?.durations) {
          const active = Object.entries(svc.price_config.durations).filter(([_, v]) => v && v.active).map(([k]) => parseInt(k)).filter(n => n > 0).sort((a, b) => a - b);
          if (active.length) dur = active[0];
        }
      }
    }
  }
  if (!dur || dur <= 0) dur = 30;

  const created = [];
  const conflicts = [];
  for (const s of slots) {
    if (!s || !s.date || !s.time || !s.employeeId) {
      conflicts.push({ slot: s, reason: 'Ungültiger Slot' });
      continue;
    }
    try {
      const start_time = berlinLocalToUTC(s.date, s.time);
      const end_time = new Date(start_time.getTime() + dur * 60000);
      const { data: bk, error } = await supabase.from('bookings').insert({
        user_id: s.employeeId,
        owner_id: ownerId,
        service_id: serviceId || null,
        start_time: start_time.toISOString(),
        end_time: end_time.toISOString(),
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        customer_email: 'manual@booking.com',
        notes: notes || null,
        hausbesuch: !!hausbesuch,
        status: 'confirmed'
      }).select().single();
      if (error) {
        conflicts.push({ slot: s, reason: error.code === '23P01' ? 'Slot bereits belegt' : error.message });
      } else {
        created.push({ id: bk.id, date: s.date, time: s.time, employeeId: s.employeeId });
      }
    } catch (err) {
      conflicts.push({ slot: s, reason: err.message });
    }
  }
  res.json({ created, conflicts, count: created.length });
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

app.post('/api/rezept/save', async (req, res) => {
  try {
    const { ownerId, patientId, arztName, arztNummer, diagnose, sitzungen, hausbesuch, befund, rezeptDatum } = req.body;
    if (!ownerId || !patientId || !arztName) {
      return res.status(400).json({ error: 'ownerId, patientId, arztName required' });
    }

    const nameNorm = arztName.trim();
    const { data: existingArzt } = await supabase
      .from('aerzte')
      .select('id, arzt_nummer')
      .eq('owner_id', ownerId)
      .ilike('arzt_name', nameNorm)
      .maybeSingle();

    let arztId;
    if (existingArzt) {
      arztId = existingArzt.id;
      if (arztNummer && arztNummer !== existingArzt.arzt_nummer) {
        await supabase.from('aerzte').update({ arzt_nummer: arztNummer }).eq('id', arztId);
      }
    } else {
      const { data: newArzt, error: arztErr } = await supabase.from('aerzte').insert({
        owner_id: ownerId,
        arzt_name: nameNorm,
        arzt_nummer: arztNummer || null
      }).select().single();
      if (arztErr) throw arztErr;
      arztId = newArzt.id;
    }

    await supabase.from('leads').update({
      arzt_id: arztId,
      hausbesuch: !!hausbesuch
    }).eq('id', patientId).eq('owner_id', ownerId);

    const { data: existingAnam } = await supabase
      .from('anamnese')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('patient_id', patientId)
      .maybeSingle();

    let existingNotizen = '';
    if (existingAnam) {
      const { data: anamData } = await supabase.from('anamnese').select('notizen').eq('id', existingAnam.id).single();
      existingNotizen = anamData?.notizen || '';
    }

    const notizen = befund
      ? (existingNotizen ? existingNotizen + '\n' : '') + 'Rezept ' + (rezeptDatum || new Date().toISOString().slice(0,10)) + ': ' + befund
      : undefined;

    const anamPayload = {
      arzt_name: nameNorm,
      arzt_nummer: arztNummer || null,
      diagnose: diagnose || null,
      rezept_sitzungen: sitzungen != null ? parseInt(sitzungen, 10) : null,
      hausbesuch: !!hausbesuch
    };
    if (notizen !== undefined) anamPayload.notizen = notizen;

    if (existingAnam) {
      await supabase.from('anamnese').update(anamPayload).eq('id', existingAnam.id);
    } else {
      await supabase.from('anamnese').insert({
        owner_id: ownerId,
        patient_id: patientId,
        ...anamPayload,
        notizen: notizen || null
      });
    }

    res.json({ success: true, arztId });
  } catch (err) {
    console.error('[rezept/save]', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Calendar API running on port ${PORT}`);
});
