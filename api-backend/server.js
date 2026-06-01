// Sentry MUST be initialised before any other import so it can instrument them.
import './instrument.js';
import * as Sentry from '@sentry/node';

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { google } from 'googleapis';
import aiRouter from './ai/router.js';
import billingAbrechnungRouter from './billing/api/abrechnung.routes.js';
import billingMahnwesenRouter from './billing/api/mahnwesen.routes.js';
import billingStatistikRouter from './billing/api/statistik.routes.js';
import wartelisteRouter from './billing/api/warteliste.routes.js';
import { defaultPositionForHeilmittel, resolvePositionsnummer } from './billing/codes/physio_positions.js';
import { requireAuth as requireAuthAI } from './ai/auth.js';
import { run as rezeptOcrRun } from './ai/tasks/rezept-ocr.js';
import { validateRezept } from './ai/validators/validate.js';
import { logCall as aiLogCall, hashRequest as aiHashRequest } from './ai/audit.js';
import { logAccess, accessLogger } from './_lib/access-log.js';
import crypto from 'crypto';

dotenv.config();

const app = express();

// Trust proxy (Traefik) so rate-limit can read real client IP from X-Forwarded-For
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '15mb' })); // raised for rezept image base64 payloads

// ============================================================================
// Rate limiters — public endpoint abuse koruması
// ============================================================================
// Public booking flow: agresif limit (anonim, IP bazlı)
const publicBookingLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 dakika
  limit: 20,                  // IP başına 20 istek/dakika
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte warten Sie eine Minute.' },
});

// Slot lookup: hafif (kullanıcı tıklayarak gezinebilir)
const slotsLookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,                  // IP başına 60 sorgu/dakika
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte warten Sie eine Minute.' },
});

// Verify-code (employee signup): brute-force koruma
const verifyCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,   // 10 dakika
  limit: 5,                   // IP başına 5 deneme
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Zu viele Versuche. Bitte warten Sie 10 Minuten.' },
});

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

// DSGVO Art. 32 access audit — auto-log every authenticated /api request.
// Anonymous endpoints (booking flow) log explicitly from their handlers.
app.use('/api', accessLogger(supabase));

// Unified AI gateway (Phase 0). All Azure OpenAI traffic routes through here.
app.use('/api/ai', aiRouter);

// § 302 SGB V Sammelabrechnung routes.
app.use('/api/billing', billingAbrechnungRouter);

// Mahnwesen (dunning) routes.
app.use('/api/billing', billingMahnwesenRouter);

// Statistik / analytics routes.
app.use('/api/billing', billingStatistikRouter);

// Warteliste (Bekleme Listesi) routes.
app.use('/api/warteliste', wartelisteRouter);

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

// Helper to calculate available slots for a user and date
async function getAvailableSlots(userId, date, duration, businessId, buffer = 0, step = 30, serviceId = null) {
  const dayOfWeek = berlinDayOfWeek(date);
  const { start: dayStart, end: dayEnd } = berlinDayBoundsUTC(date);

  // Reject past dates entirely
  const now = new Date();
  const todayStr = now.toLocaleDateString('sv-SE', { timeZone: BUSINESS_TZ });
  if (date < todayStr) return { slots: [] };

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

  // 1.1 Fetch requested service if serviceId is provided to check if it's a group service
  let isRequestedServiceGroup = false;
  if (serviceId) {
    const { data: svc } = await supabase
      .from('services')
      .select('is_group')
      .eq('id', serviceId)
      .maybeSingle();
    if (svc && svc.is_group) {
      isRequestedServiceGroup = true;
    }
  }

  // 1.4 Check business closed_days (multi-business açılış günleri)
  let activeBiz = null;
  if (businessId) {
    const { data: explicitBiz } = await supabase
      .from('businesses')
      .select('id, closed_days, owner_id')
      .eq('id', businessId)
      .maybeSingle();
    // Güvenlik: business gerçekten bu owner'a ait mi?
    if (explicitBiz && explicitBiz.owner_id === ownerId) {
      activeBiz = explicitBiz;
    }
  }
  if (!activeBiz && profile?.owner_id) {
    // Employee — owner'in altinda employee'nin atandigi business'i bul
    const { data: assigned } = await supabase
      .from('employee_business_assignments')
      .select('business_id, businesses(id, closed_days, is_default)')
      .eq('employee_id', userId);
    if (assigned && assigned.length) {
      // Default'a atanmissa onu, degilse ilk
      const def = assigned.find(a => a.businesses?.is_default);
      activeBiz = (def || assigned[0])?.businesses || null;
    }
  }
  if (!activeBiz) {
    // Owner kendisi veya employee'nin atamasi yoksa: owner'in default business
    const { data: defaultBiz } = await supabase
      .from('businesses')
      .select('id, closed_days')
      .eq('owner_id', ownerId)
      .eq('is_default', true)
      .maybeSingle();
    activeBiz = defaultBiz || null;
  }

  if (activeBiz && Array.isArray(activeBiz.closed_days) && activeBiz.closed_days.length) {
    // berlinDayOfWeek server local TZ'den bağımsız (DST-safe)
    const jsDow = berlinDayOfWeek(date);
    if (activeBiz.closed_days.includes(jsDow)) {
      return { slots: [], reason: 'business_closed_day' };
    }
  }

  // 1.5 Check custom_days (shop-wide closed/holiday/special)
  const { data: customDay } = await supabase
    .from('custom_days')
    .select('type,start_time,end_time')
    .eq('owner_id', ownerId)
    .eq('date', date)
    .maybeSingle();

  if (customDay && (customDay.type === 'closed' || customDay.type === 'holiday') && !customDay.start_time && !customDay.end_time) {
    return { slots: [], reason: 'custom_day_closed' };
  }

  // 2. Get Working Hours — employee first, fallback to owner
  let wh = (await supabase
    .from('working_hours')
    .select('*')
    .eq('user_id', userId)
    .eq('day_of_week', dayOfWeek)
    .single()).data;

  // Correct fallback logic: only fall back if the employee has no record at all (wh is null)
  if (!wh) {
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
    return { slots: [], reason: 'working_hours_inactive' };
  }

  const startMinutes = timeToMins(wh.start_time);
  const endMinutes = timeToMins(wh.end_time);

  // 2. Get existing bookings for this date (Supabase stores TIMESTAMPTZ as UTC)
  // Only query bookings where group_parent_id IS NULL to prevent child bookings
  // from incorrectly blocking the time slots.
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, start_time, end_time, is_group, group_capacity, service_id')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .is('group_parent_id', null)
    .gte('start_time', dayStart)
    .lte('start_time', dayEnd);

  // Query actual participant counts for group parent slots
  const parentIds = (bookings || []).filter(b => b.is_group).map(b => b.id);
  const participantCounts = {};
  if (parentIds.length > 0) {
    const { data: participants } = await supabase
      .from('bookings')
      .select('group_parent_id')
      .in('group_parent_id', parentIds)
      .eq('status', 'confirmed');
    (participants || []).forEach(p => {
      participantCounts[p.group_parent_id] = (participantCounts[p.group_parent_id] || 0) + 1;
    });
  }

  const bookedIntervals = [];

  (bookings || []).forEach(b => {
    // If it's a group booking, and we are searching for slots for the SAME group service,
    // and there is still remaining capacity, it's not a blocked slot!
    if (b.is_group) {
      const count = participantCounts[b.id] || 0;
      const cap = b.group_capacity || 1;
      if (isRequestedServiceGroup && b.service_id === serviceId && count < cap) {
        // Safe to book here! Do not block this interval
        return;
      }
    }

    bookedIntervals.push({
      start: utcToBerlinMinutes(new Date(b.start_time)),
      end: utcToBerlinMinutes(new Date(b.end_time))
    });
  });

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

  return { slots };
}

// 2. Booking Routes (Get Slots & Create)
app.post('/api/booking/get-slots', slotsLookupLimiter, async (req, res) => {
  const { userId, date, duration, businessId, serviceId } = req.body; // date: YYYY-MM-DD
  if (!userId || !date || !duration) return res.status(400).json({ error: 'Missing params' });

  try {
    const buffer = parseInt(req.body.buffer) || 0;
    const step   = parseInt(req.body.step)   || 30;
    const result = await getAvailableSlots(userId, date, duration, businessId, buffer, step, serviceId);
    if (result.reason) {
      return res.json({ slots: [], reason: result.reason });
    }
    res.json({ slots: result.slots });
  } catch (error) {
    console.error('get-slots error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/booking/create', publicBookingLimiter, async (req, res) => {
  const { userId, serviceId, date, time, customerName, customerEmail, customerPhone, businessId, leadId } = req.body;
  
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

    // Closed-day and slot validation
    const slotValidation = await getAvailableSlots(
      userId,
      date,
      service.duration_minutes,
      businessId,
      parseInt(req.body.buffer) || 0,
      parseInt(req.body.step) || 30,
      serviceId
    );
    if (slotValidation.reason === 'business_closed_day') {
      return res.status(400).json({ error: 'An diesem Wochentag ist das Geschäft geschlossen.' });
    }
    if (slotValidation.reason === 'custom_day_closed') {
      return res.status(400).json({ error: 'An diesem Tag ist das Geschäft geschlossen.' });
    }
    if (slotValidation.reason === 'working_hours_inactive' || !slotValidation.slots.includes(time)) {
      return res.status(400).json({ error: 'Der gewählte Termin ist leider nicht mehr verfügbar.' });
    }

    // date+time arrive as Berlin local — convert to UTC for storage
    const start_time = berlinLocalToUTC(date, time);
    const end_time = new Date(start_time.getTime() + service.duration_minutes * 60000);

    const owner_id = (req.body.ownerId != null) ? req.body.ownerId : userId; // solopreneur fallback

    // businessId verilmiş ve gerçekten bu owner'a aitse onu kullan, aksi halde trigger fallback
    let resolvedBusinessId = null;
    if (businessId) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .eq('id', businessId)
        .eq('owner_id', owner_id)
        .maybeSingle();
      if (biz) resolvedBusinessId = biz.id;
    }

    // Resolve actual owner_id for lead (employee -> owner)
    let resolvedOwnerId = owner_id;
    if (!req.body.ownerId) {
      const { data: empProfile } = await supabase.from('profiles').select('owner_id').eq('id', userId).maybeSingle();
      resolvedOwnerId = empProfile?.owner_id || userId;
    }

    // Check if it's a group service
    let parentBooking = null;
    if (service.is_group) {
      // Find an existing confirmed group booking at the exact same start_time for the same therapist
      const { data: existingGroup } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', userId)
        .eq('service_id', serviceId)
        .eq('start_time', start_time.toISOString())
        .eq('is_group', true)
        .is('group_parent_id', null)
        .eq('status', 'confirmed')
        .maybeSingle();

      if (existingGroup) {
        // Enforce capacity check
        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('group_parent_id', existingGroup.id)
          .eq('status', 'confirmed');
        
        const cap = existingGroup.group_capacity || 1;
        if ((count || 0) >= cap) {
          return res.status(400).json({ error: 'Diese Gruppe ist bereits voll belegt.' });
        }
        parentBooking = existingGroup;
      } else {
        // Create new parent group booking
        const parentPayload = {
          user_id: userId,
          owner_id: owner_id,
          service_id: serviceId,
          start_time: start_time.toISOString(),
          end_time: end_time.toISOString(),
          customer_name: `Gruppe: ${service.title}`,
          customer_email: 'group@booking.com',
          is_group: true,
          group_capacity: service.group_capacity || 5,
          status: 'confirmed'
        };
        if (resolvedBusinessId) parentPayload.business_id = resolvedBusinessId;

        const { data: newParent, error: parentErr } = await supabase
          .from('bookings')
          .insert(parentPayload)
          .select()
          .single();
        
        if (parentErr) throw parentErr;
        parentBooking = newParent;
      }
    }

    // Insert actual participant booking (child booking if parentBooking exists)
    const insertPayload = {
      user_id: userId,
      owner_id: owner_id,
      service_id: serviceId,
      start_time: start_time.toISOString(),
      end_time: end_time.toISOString(),
      customer_name: customerName,
      customer_email: customerEmail || `wa${(customerPhone || 'anon').replace(/\D/g, '')}@whatsapp.local`,
      customer_phone: customerPhone,
      status: 'confirmed',
      lead_id: leadId || null
    };
    if (resolvedBusinessId) insertPayload.business_id = resolvedBusinessId;
    if (parentBooking) {
      insertPayload.group_parent_id = parentBooking.id;
    }

    const { data: booking, error: dbErr } = await supabase.from('bookings').insert(insertPayload).select().single();

    if (dbErr) {
      if (dbErr.code === '23P01') {
        return res.status(409).json({ error: 'Dieser Termin wurde gerade von jemand anderem gebucht. Bitte wählen Sie einen anderen Slot.' });
      }
      throw dbErr;
    }

    // Google Meet — only after booking exists. Failures here don't roll back the booking;
    // we just return without a meeting link and log for ops.
    let meetingLink = null;
    const { data: integ } = await supabase.from('calendar_integrations').select('*').eq('user_id', userId).eq('provider', 'google').maybeSingle();

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

    // Upsert lead into leads table
    try {
      const normPhone = customerPhone ? customerPhone.replace(/\D/g, '') : null;
      const email = (customerEmail || '').trim().toLowerCase();

      console.log('[lead upsert]', { resolvedOwnerId, email, normPhone, customerName });

      let activeLeadId = leadId;

      if (!activeLeadId) {
        if (email) {
          const { data: existing } = await supabase
            .from('leads')
            .select('*')
            .eq('owner_id', resolvedOwnerId)
            .eq('email', email)
            .limit(1)
            .maybeSingle();

          if (existing) {
            activeLeadId = existing.id;
            const updates = {};
            if (customerName && !existing.title) updates.title = customerName;
            if (customerPhone && !existing.phone) { updates.phone = customerPhone; updates.phone_normalized = normPhone; }
            if (existing.status !== 'booked') updates.status = 'booked';
            if (Object.keys(updates).length > 0) {
              updates.updated_at = new Date().toISOString();
              await supabase.from('leads').update(updates).eq('id', existing.id);
              console.log('[lead upsert] updated existing by email:', existing.id);
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
            activeLeadId = newLead?.id;
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
            activeLeadId = existing.id;
            const updates = {};
            if (customerName && !existing.title) updates.title = customerName;
            if (existing.status !== 'booked') updates.status = 'booked';
            if (Object.keys(updates).length > 0) {
              updates.updated_at = new Date().toISOString();
              await supabase.from('leads').update(updates).eq('id', existing.id);
              console.log('[lead upsert] updated existing by phone:', existing.id);
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
            activeLeadId = newLead?.id;
            console.log('[lead upsert] inserted new lead by phone:', newLead?.id);
          }
        }
      }

      // If a lead was created or found, and the booking doesn't have it, update it!
      if (activeLeadId && !booking.lead_id) {
        await supabase.from('bookings').update({ lead_id: activeLeadId }).eq('id', booking.id);
        booking.lead_id = activeLeadId;
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

    // DSGVO audit — anonymous booking creates a patient record on owner's behalf
    logAccess(supabase, {
      ownerId: userId, ip: req.ip, userAgent: req.headers['user-agent'],
      method: 'POST', path: req.path, resource: 'booking', resourceId: booking.id,
      action: 'create', statusCode: 200,
      metadata: { source: 'public_booking_page', service_id: service?.id },
    });

    res.json({ success: true, booking });
  } catch (err) {
    console.error('Booking create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Verify Company Code (Bypass RLS)
app.post('/api/verify-code', verifyCodeLimiter, async (req, res) => {
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
      startDate, weekdays,
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
    let empList = (employees || []).map(e => ({
      id: e.id,
      name: e.business_name || e.email?.split('@')[0] || 'Mitarbeiter',
      anrede: e.anrede || null
    }));

    // Gender filter from preferences.notes — enforce server-side so AI can't drift
    const notesLower = (preferences.notes || '').toLowerCase();
    const wantsFemale = /\bweiblich|\bfrau\b|\bfemale|\bwoman|\bkadin|\bkadın|\bbayan/.test(notesLower);
    const wantsMale = /\bmännlich|\bmaennlich|\bherr\b|\bmale\b|\bman\b|\berkek|\bbay /.test(notesLower);
    let genderFilterApplied = null;
    if (wantsFemale) {
      const filtered = empList.filter(e => e.anrede === 'Frau');
      if (filtered.length) { empList = filtered; genderFilterApplied = 'female'; }
    } else if (wantsMale) {
      const filtered = empList.filter(e => e.anrede === 'Herr');
      if (filtered.length) { empList = filtered; genderFilterApplied = 'male'; }
    }
    // Re-derive allowedIds after gender filter so DB queries below scope to those staff
    allowedIds = empList.map(e => e.id);
    if (allowedIds.length === 0) {
      return res.json({
        success: true, selected: [], report: 'Kein Mitarbeiter mit gewünschter Anrede verfügbar. Bitte Anrede der Mitarbeiter im Team-Panel pflegen.',
        candidatesTotal: 0, service: { id: svc.id, title: svc.title, duration: dur }, employees: empList
      });
    }

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

    // 5) Compute target dates from recurrence rules
    const targetMin = preferredTime ? timeToMinsLocal(preferredTime) : null;
    const tod = preferences.timeOfDay; // morning|afternoon|any
    const step = 30;
    const anchor = startDate || today;
    const anchorWd = berlinDayOfWeek(anchor);
    // Respect user's weekday selection exactly. Only fall back to anchor weekday if none chosen.
    const wdSet = (weekdays && weekdays.length) ? new Set(weekdays.map(Number)) : new Set([anchorWd]);

    function addDaysISO(dateStr, days) {
      const d = new Date(dateStr + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().substring(0, 10);
    }

    const targetDates = [];
    if (recurrence === 'daily') {
      for (let i = 0; i < count; i++) targetDates.push(addDaysISO(anchor, i));
    } else {
      const weekStep = recurrence === 'biweekly' ? 14 : 7;
      // For each selected weekday, compute the first occurrence on/after the anchor
      const sortedWds = [...wdSet].sort((a, b) => ((a - anchorWd + 7) % 7) - ((b - anchorWd + 7) % 7));
      const firstByWd = new Map();
      sortedWds.forEach(wd => {
        const diff = (wd - anchorWd + 7) % 7;
        firstByWd.set(wd, addDaysISO(anchor, diff));
      });
      const perBucket = sortedWds.length;
      const buckets = Math.ceil(count / perBucket);
      for (let b = 0; b < buckets && targetDates.length < count; b++) {
        for (const wd of sortedWds) {
          if (targetDates.length >= count) break;
          targetDates.push(addDaysISO(firstByWd.get(wd), b * weekStep));
        }
      }
    }
    // Final guard: dedupe + sort chronologically (defensive — should not be needed)
    const seen = new Set();
    const dedupedTargets = [];
    targetDates.sort().forEach(d => { if (!seen.has(d)) { seen.add(d); dedupedTargets.push(d); } });
    targetDates.length = 0;
    Array.prototype.push.apply(targetDates, dedupedTargets);

    // Cap horizon to what we fetched (14 weeks)
    const horizonCap = horizon;
    const cappedDates = targetDates.filter(d => d <= horizonCap);

    // 6) Enumerate slots for each target date (multiple slots per date for AI to choose)
    const candidates = [];
    const candidatesByDate = new Map();

    for (let i = 0; i < cappedDates.length; i++) {
      const dateStr = cappedDates[i];
      const dayOfWeek = berlinDayOfWeek(dateStr);
      const cd = customDayByDate.get(dateStr);
      const isClosedDay = cd && (cd.type === 'closed' || cd.type === 'holiday') && !cd.start_time && !cd.end_time;
      if (isClosedDay) { candidatesByDate.set(dateStr, []); continue; }

      const dateSlots = [];
      for (const emp of empList) {
        const w = whByEmpDay.get(`${emp.id}|${dayOfWeek}`);
        if (!w) continue;

        let startMins = timeToMinsLocal(w.start_time);
        let endMins = timeToMinsLocal(w.end_time);
        if (cd && cd.type === 'special' && cd.start_time && cd.end_time) {
          startMins = timeToMinsLocal(cd.start_time);
          endMins = timeToMinsLocal(cd.end_time);
        }
        if (tod === 'morning') endMins = Math.min(endMins, 12 * 60);
        else if (tod === 'afternoon') startMins = Math.max(startMins, 12 * 60);

        const busy = [];
        (breaksByEmpDay.get(`${emp.id}|${dayOfWeek}`) || []).forEach(b => {
          busy.push({ start: timeToMinsLocal(b.start_time), end: timeToMinsLocal(b.end_time) });
        });
        (bookingsByEmp.get(emp.id) || []).forEach(b => {
          const s = new Date(b.start_time);
          const e = new Date(b.end_time);
          const sDate = s.toLocaleDateString('sv-SE', { timeZone: BUSINESS_TZ });
          if (sDate !== dateStr) return;
          const tParts = s.toLocaleTimeString('de-DE', { timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).split(':');
          const sLocal = parseInt(tParts[0]) * 60 + parseInt(tParts[1]);
          const eLocal = sLocal + Math.round((e - s) / 60000);
          busy.push({ start: sLocal, end: eLocal });
        });
        const offHit = timeOffs.find(t => t.employee_id === emp.id && t.start_date <= dateStr && t.end_date >= dateStr);
        if (offHit) continue;

        for (let m = startMins; m + dur <= endMins; m += step) {
          const slotEnd = m + dur;
          const overlap = busy.some(b => m < b.end && slotEnd > b.start);
          if (overlap) continue;

          let score = 0;
          if (employeeId && emp.id !== employeeId) score += preferences.sameEmployee === 'preferred' ? 100 : 30;
          if (targetMin !== null) score += Math.abs(m - targetMin) / 5;

          dateSlots.push({
            date: dateStr,
            time: minsToTimeLocal(m),
            employeeId: emp.id,
            bucket: i,
            score
          });
        }
      }
      dateSlots.sort((a, b) => a.score - b.score);
      candidatesByDate.set(dateStr, dateSlots.slice(0, 6));
      dateSlots.slice(0, 6).forEach(s => candidates.push(s));
    }

    // Identify target dates with NO available slots and look for nearby
    // replacement days (±3 days, preferring later shifts first). This lets
    // the scheduler fall back automatically instead of returning "no slot".
    const emptyDates = [];
    const SHIFT_DAYS = [1, -1, 2, -2, 3, -3];

    function enumerateDay(dateStr) {
      const dayOfWeek = berlinDayOfWeek(dateStr);
      const cd = customDayByDate.get(dateStr);
      const isClosedDay = cd && (cd.type === 'closed' || cd.type === 'holiday') && !cd.start_time && !cd.end_time;
      if (isClosedDay) return [];
      const slots = [];
      for (const emp of empList) {
        const w = whByEmpDay.get(`${emp.id}|${dayOfWeek}`);
        if (!w) continue;
        let startMins = timeToMinsLocal(w.start_time);
        let endMins = timeToMinsLocal(w.end_time);
        if (cd && cd.type === 'special' && cd.start_time && cd.end_time) {
          startMins = timeToMinsLocal(cd.start_time);
          endMins = timeToMinsLocal(cd.end_time);
        }
        if (tod === 'morning') endMins = Math.min(endMins, 12 * 60);
        else if (tod === 'afternoon') startMins = Math.max(startMins, 12 * 60);
        const busy = [];
        (breaksByEmpDay.get(`${emp.id}|${dayOfWeek}`) || []).forEach(b => {
          busy.push({ start: timeToMinsLocal(b.start_time), end: timeToMinsLocal(b.end_time) });
        });
        (bookingsByEmp.get(emp.id) || []).forEach(b => {
          const s = new Date(b.start_time);
          const e = new Date(b.end_time);
          const sDate = s.toLocaleDateString('sv-SE', { timeZone: BUSINESS_TZ });
          if (sDate !== dateStr) return;
          const tParts = s.toLocaleTimeString('de-DE', { timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).split(':');
          const sLocal = parseInt(tParts[0]) * 60 + parseInt(tParts[1]);
          const eLocal = sLocal + Math.round((e - s) / 60000);
          busy.push({ start: sLocal, end: eLocal });
        });
        const offHit = timeOffs.find(t => t.employee_id === emp.id && t.start_date <= dateStr && t.end_date >= dateStr);
        if (offHit) continue;
        for (let m = startMins; m + dur <= endMins; m += step) {
          if (busy.some(b => m < b.end && m + dur > b.start)) continue;
          let score = 0;
          if (employeeId && emp.id !== employeeId) score += preferences.sameEmployee === 'preferred' ? 100 : 30;
          if (targetMin !== null) score += Math.abs(m - targetMin) / 5;
          slots.push({ date: dateStr, time: minsToTimeLocal(m), employeeId: emp.id, score });
        }
      }
      return slots.sort((a, b) => a.score - b.score);
    }

    cappedDates.forEach((d, bucketIdx) => {
      if ((candidatesByDate.get(d) || []).length === 0) {
        emptyDates.push(d);
        // Try to shift this target to a nearby day so the patient still gets a slot.
        for (const offset of SHIFT_DAYS) {
          const altDate = addDaysISO(d, offset);
          if (altDate < today || altDate > horizonCap) continue;
          const altSlots = enumerateDay(altDate);
          if (altSlots.length === 0) continue;
          const best = altSlots[0];
          const shifted = {
            date: best.date,
            time: best.time,
            employeeId: best.employeeId,
            bucket: bucketIdx,
            score: best.score + 50,
            shiftedFromDate: d,
            dateShiftDays: offset
          };
          const existing = candidatesByDate.get(d) || [];
          existing.push(shifted);
          candidatesByDate.set(d, existing);
          candidates.push(shifted);
          break;
        }
      }
    });

    // Cap total candidates sent to AI
    const shortList = candidates.slice(0, 120);

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
      recurrence,
      targetDates: cappedDates,
      emptyDates,
      preferences: {
        ...preferences,
        preferredEmployee: employeeId || null
      },
      genderFilterApplied,
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

    // 7) Validate + dedupe AI response, fall back to deterministic pick per target date.
    // Use a lookup so we can re-attach shift metadata after the AI strips it.
    const candidateByKey = new Map(shortList.map(c => [`${c.date}|${c.time}|${c.employeeId}`, c]));
    const cleanFromAi = (Array.isArray(aiResult.selected) ? aiResult.selected : [])
      .filter(s => s && s.date && s.time && s.employeeId)
      .filter(s => candidateByKey.has(`${s.date}|${s.time}|${s.employeeId}`));
    const dateSeen = new Set();
    const selected = [];
    function pushSlot(slot, originalTargetDate) {
      const original = candidateByKey.get(`${slot.date}|${slot.time}|${slot.employeeId}`) || slot;
      const out = { date: slot.date, time: slot.time, employeeId: slot.employeeId };
      const origDate = original.shiftedFromDate || originalTargetDate || slot.date;
      if (origDate !== slot.date) {
        out.shiftedFromDate = origDate;
        out.dateShiftDays = original.dateShiftDays != null
          ? original.dateShiftDays
          : Math.round((new Date(slot.date + 'T12:00:00Z') - new Date(origDate + 'T12:00:00Z')) / 86400000);
      }
      if (targetMin !== null) {
        const [hh, mm] = slot.time.split(':').map(Number);
        const slotMin = hh * 60 + mm;
        if (slotMin !== targetMin) out.timeShiftMin = slotMin - targetMin;
      }
      selected.push(out);
    }
    for (const s of cleanFromAi) {
      if (dateSeen.has(s.date)) continue;
      dateSeen.add(s.date);
      pushSlot(s);
      if (selected.length >= count) break;
    }
    if (selected.length < count) {
      for (const d of cappedDates) {
        if (selected.length >= count) break;
        if (dateSeen.has(d)) continue;
        const slots = candidatesByDate.get(d) || [];
        if (!slots.length) continue;
        const best = slots[0];
        pushSlot({ date: best.date, time: best.time, employeeId: best.employeeId }, d);
        dateSeen.add(best.date);
      }
    }

    // Summarize shifts in the report so the user sees what happened
    const dayShifts = selected.filter(s => s.dateShiftDays != null);
    const timeShifts = selected.filter(s => s.dateShiftDays == null && s.timeShiftMin != null);
    const reportLines = [];
    reportLines.push(`${selected.length} Termine gefunden.`);
    if (dayShifts.length) reportLines.push(`⚠ ${dayShifts.length} Termin(e) auf einen anderen Tag verschoben (Wunschtag voll belegt).`);
    if (timeShifts.length) reportLines.push(`⏱ ${timeShifts.length} Termin(e) zeitlich angepasst (Wunschzeit belegt).`);
    const unmetTargets = cappedDates.filter(d => !selected.some(s => s.date === d || s.shiftedFromDate === d));
    if (unmetTargets.length) reportLines.push(`✗ Für ${unmetTargets.length} Wunschtag(e) konnte trotz Suche im Umkreis kein Slot gefunden werden.`);
    let report = aiResult.report || reportLines.join(' ');
    if (genderFilterApplied) {
      report += ` (Gefiltert auf ${genderFilterApplied === 'female' ? 'weibliche' : 'männliche'} Behandler.)`;
    }

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

// --- Phase 2: AI-driven Rezept-Workflow ---

function stripDataUriPrefix(b64) {
  if (!b64) return null;
  const m = String(b64).match(/^data:[^;]+;base64,(.+)$/);
  return m ? m[1] : b64;
}

// Upload: accept base64 image, store to Supabase Storage, run OCR + validators,
// return the parsed draft (NO DB write yet — user confirms first).
app.post('/api/rezept/upload', requireAuthAI, async (req, res) => {
  try {
    const { image_base64, image_mime } = req.body || {};
    if (!image_base64) {
      return res.status(400).json({ error: 'image_base64 required' });
    }

    const mime = (image_mime || 'image/jpeg').toLowerCase();
    const ext = mime.includes('png') ? 'png' : (mime.includes('webp') ? 'webp' : 'jpg');
    const tenantId = req.auth.tenantId;
    const fileId = crypto.randomUUID();
    const storagePath = `${tenantId}/${new Date().toISOString().slice(0, 10)}/${fileId}.${ext}`;

    const rawB64 = stripDataUriPrefix(image_base64);
    const buffer = Buffer.from(rawB64, 'base64');
    if (buffer.length < 1000) {
      return res.status(400).json({ error: 'Image too small / decode failed' });
    }

    const { error: upErr } = await supabase
      .storage
      .from('prescriptions')
      .upload(storagePath, buffer, { contentType: mime, upsert: false });
    if (upErr) throw upErr;

    // Run OCR — pass the original data-URI so the model gets a proper image block
    const dataUri = image_base64.startsWith('data:')
      ? image_base64
      : `data:${mime};base64,${rawB64}`;

    // OCR happens outside the unified /api/ai router, so audit logging must be
    // wired explicitly here — otherwise rezept-ocr usage never lands in
    // ai_audit_log and the admin AI-cost panel undercounts dramatically.
    const ocrT0 = Date.now();
    const ocrReqHash = aiHashRequest({ image_mime: mime, size: buffer.length });
    let ocrResult, ocrStatus = 'ok', ocrError = null, ocrMeta = {};
    try {
      ocrResult = await rezeptOcrRun({ image_base64: dataUri });
      ocrMeta = ocrResult._meta || {};
    } catch (e) {
      ocrStatus = 'error';
      ocrError = e.message || String(e);
      throw e;
    } finally {
      aiLogCall({
        tenantId,
        userId: req.auth?.userId,
        task: 'rezept-ocr',
        model: ocrMeta.model,
        deployment: ocrMeta.deployment,
        usage: ocrMeta.usage || {},
        latencyMs: ocrMeta.latency_ms ?? (Date.now() - ocrT0),
        status: ocrStatus,
        error: ocrError,
        dryRun: !!ocrMeta.dry_run,
        requestHash: ocrReqHash,
      });
    }
    const parsed = ocrResult.parsed || {};

    // Map OCR output → validator input shape
    const rezeptForValidator = {
      icd10: parsed.rezept?.icd10,
      diagnosegruppe: parsed.rezept?.diagnosegruppe,
      heilmittel: parsed.rezept?.heilmittel,
      heilmittel_feld_text: parsed.rezept?.heilmittel_feld_text,
      anzahl_einheiten: parsed.rezept?.anzahl_einheiten,
      frequenz: parsed.rezept?.frequenz,
      ausstellungsdatum: parsed.arzt?.ausstellungsdatum,
      behandlungsbeginn: parsed.rezept?.behandlungsbeginn,
      is_dringend: !!parsed.rezept?.is_dringend,
      hausbesuch: !!parsed.rezept?.hausbesuch,
      is_blanko: !!parsed.rezept?.is_blanko,
      is_lhb_bvb: !!parsed.rezept?.is_lhb_bvb,
      bericht_angefordert: !!parsed.rezept?.bericht_angefordert,
      patient_geburtsdatum: parsed.patient?.geburtsdatum
    };

    const validation = validateRezept(rezeptForValidator);

    res.json({
      success: true,
      storage_path: storagePath,
      parsed,
      validation,
      ocr_confidence: ocrResult.ocr_confidence,
      dry_run: !!ocrResult._meta?.dry_run
    });
  } catch (err) {
    console.error('[rezept/upload]', err);
    res.status(500).json({ error: err.message });
  }
});

// Confirm: accept the user-edited fields, re-validate, write prescription
// row + validation snapshot, auto-match-or-create patient.
app.post('/api/rezept/confirm', requireAuthAI, async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const userId = req.auth.userId;
    const {
      storage_path,
      parsed,                  // possibly user-edited
      proceed_anyway = false   // user clicked "Proceed despite warnings"
    } = req.body || {};

    if (!parsed) return res.status(400).json({ error: 'parsed required' });

    const patient = parsed.patient || {};
    const arzt = parsed.arzt || {};
    const rezept = parsed.rezept || {};

    // --- Auto-match-or-create patient ---
    let patientId = null;
    const dob = patient.geburtsdatum || null;
    const fn = (patient.first_name || '').trim();
    const ln = (patient.last_name || '').trim();

    if (dob && (fn || ln)) {
      const { data: matches } = await supabase
        .from('leads')
        .select('id')
        .eq('owner_id', tenantId)
        .eq('geburtsdatum', dob)
        .ilike('first_name', fn || '%')
        .ilike('last_name', ln || '%')
        .limit(1);

      if (matches && matches.length) {
        patientId = matches[0].id;
        // Backfill contact info the employee just collected
        const patch = {};
        if (patient.email) patch.email = patient.email;
        if (patient.phone) patch.phone = patient.phone;
        if (patient.versichertennummer) patch.versichertennummer = patient.versichertennummer;
        if (patient.krankenkasse) patch.krankenkasse = patient.krankenkasse;
        // Fahrtenbuch: strukturlu adres backfill (yalnızca eksikse doldur — kullanıcı manuel düzeltiyorsa override yapma)
        if (patient.street) patch.street = patient.street;
        if (patient.plz) patch.plz = patient.plz;
        if (patient.city) patch.city = patient.city;
        if (Object.keys(patch).length) {
          await supabase.from('leads').update(patch).eq('id', patientId);
        }
      }
    }

    if (!patientId) {
      const fullName = patient.name || [fn, ln].filter(Boolean).join(' ') || null;
      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          owner_id: tenantId,
          first_name: fn || null,
          last_name: ln || null,
          title: fullName,
          geburtsdatum: dob,
          geschlecht: patient.geschlecht || null,
          versichertennummer: patient.versichertennummer || null,
          krankenkasse: patient.krankenkasse || null,
          email: patient.email || null,
          phone: patient.phone || null,
          // Fahrtenbuch: strukturlu kolonlar (eski tek string yerine)
          street: patient.street || null,
          plz: patient.plz || null,
          city: patient.city || null,
          status: 'booked',
          metadata: {
            geburtsdatum: dob,
            versichertennummer: patient.versichertennummer || null,
            krankenkasse: patient.krankenkasse || null,
            hausbesuch: !!rezept.hausbesuch
          }
        })
        .select('id')
        .single();
      if (leadErr) throw leadErr;
      patientId = newLead.id;
    }

    // --- Auto-match-or-create doctor (aerzte) ---
    let arztId = null;
    if (arzt.lanr) {
      const { data: existing } = await supabase
        .from('aerzte')
        .select('id')
        .eq('owner_id', tenantId)
        .eq('lanr', arzt.lanr)
        .maybeSingle();
      if (existing) arztId = existing.id;
    }
    if (!arztId && arzt.name) {
      const { data: newArzt, error: arztErr } = await supabase
        .from('aerzte')
        .insert({
          owner_id: tenantId,
          arzt_name: arzt.name,
          lanr: arzt.lanr || null,
          bsnr: arzt.bsnr || null
        })
        .select('id')
        .single();
      if (!arztErr && newArzt) arztId = newArzt.id;
    }

    // --- Re-validate with possibly edited fields ---
    const rezeptForValidator = {
      icd10: rezept.icd10,
      diagnosegruppe: rezept.diagnosegruppe,
      heilmittel: rezept.heilmittel,
      heilmittel_feld_text: rezept.heilmittel_feld_text,
      anzahl_einheiten: rezept.anzahl_einheiten,
      frequenz: rezept.frequenz,
      ausstellungsdatum: arzt.ausstellungsdatum,
      behandlungsbeginn: rezept.behandlungsbeginn,
      is_dringend: !!rezept.is_dringend,
      hausbesuch: !!rezept.hausbesuch,
      is_blanko: !!rezept.is_blanko,
      is_lhb_bvb: !!rezept.is_lhb_bvb,
      patient_geburtsdatum: dob
    };
    const validation = validateRezept(rezeptForValidator);

    const rezeptTyp = rezept.is_blanko ? 'blanko' : (rezept.is_lhb_bvb ? 'lhb_bvb' : 'standard');

    // --- Resolve Krankenkasse → ik. Prefer frontend-supplied IK (datalist
    // pick) over fuzzy name-based lookup so therapist intent wins. ---
    let kostentraegerIk = patient.kostentraeger_ik || null;
    if (!kostentraegerIk && patient.krankenkasse) {
      const { data: kkMatch } = await supabase
        .from('kostentraeger')
        .select('ik')
        .ilike('name', `%${patient.krankenkasse.trim()}%`)
        .eq('active', true)
        .limit(1)
        .maybeSingle();
      if (kkMatch?.ik) kostentraegerIk = kkMatch.ik;
    }

    // --- Resolve Heilmittel-Position. Frontend can send the canonical
    // X-template (e.g. "X0501") via the datalist match; otherwise fall back
    // to the short-code default map (KG → X0501 → 20501). ---
    let heilmittelPosition = null;
    if (rezept.heilmittel_position) {
      try { heilmittelPosition = resolvePositionsnummer(rezept.heilmittel_position, '22'); }
      catch (_e) { heilmittelPosition = rezept.heilmittel_position; }
    } else {
      const posTemplate = defaultPositionForHeilmittel(rezept.heilmittel);
      if (posTemplate) {
        try { heilmittelPosition = resolvePositionsnummer(posTemplate, '22'); }
        catch (_e) { /* ignore */ }
      }
    }

    // --- Insert prescription row ---
    const { data: rx, error: rxErr } = await supabase
      .from('prescriptions')
      .insert({
        owner_id: tenantId,
        patient_id: patientId,
        arzt_id: arztId,
        image_storage_path: storage_path || null,
        image_uploaded_at: storage_path ? new Date().toISOString() : null,
        status: 'confirmed',
        rezept_typ: rezeptTyp,
        icd10: rezept.icd10 || null,
        diagnosegruppe: rezept.diagnosegruppe || null,
        leitsymptomatik: rezept.leitsymptomatik || null,
        heilmittel: rezept.heilmittel || null,
        heilmittel_feld_text: rezept.heilmittel_feld_text || null,
        heilmittel_position: heilmittelPosition,
        anzahl_einheiten: rezept.anzahl_einheiten ?? null,
        frequenz: rezept.frequenz || null,
        ausstellungsdatum: arzt.ausstellungsdatum || null,
        behandlungsbeginn: rezept.behandlungsbeginn || null,
        is_dringend: !!rezept.is_dringend,
        hausbesuch: !!rezept.hausbesuch,
        is_blanko: !!rezept.is_blanko,
        is_lhb_bvb: !!rezept.is_lhb_bvb,
        bericht_angefordert: !!rezept.bericht_angefordert,
        bericht_status: rezept.bericht_status || 'offen',
        doctor_lanr: arzt.lanr || null,
        doctor_bsnr: arzt.bsnr || null,
        kostentraeger_ik: kostentraegerIk,
        gueltig_bis: validation.computed?.gueltig_bis || null,
        computed: validation.computed || null,
        warnings: validation.warnings || null,
        blockers_overridden: proceed_anyway ? (validation.blockers || null) : null,
        ocr_raw_response: parsed,
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
        proceed_anyway: !!proceed_anyway,
        total_bonuses_eur: validation.computed?.bonus_eur ?? null
      })
      .select('id')
      .single();
    if (rxErr) throw rxErr;

    // --- Validation snapshot ---
    await supabase.from('prescription_validations').insert({
      prescription_id: rx.id,
      engine: validation.engine || 'standard',
      input_snapshot: rezeptForValidator,
      result: validation,
      ok: !!validation.ok,
      warnings_count: (validation.warnings || []).length,
      blockers_count: (validation.blockers || []).length,
      proceeded_anyway: !!proceed_anyway,
      validated_by: userId
    });

    res.json({
      success: true,
      prescription_id: rx.id,
      patient_id: patientId,
      arzt_id: arztId,
      rezept_typ: rezeptTyp,
      validation
    });
  } catch (err) {
    console.error('[rezept/confirm]', err);
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

// ===== Phase 4: WhatsApp bot prescription lookup =====
// Returns the active prescription for a patient identified by phone, plus
// remaining session count and Gültig bis horizon. Used by the n8n
// `get_active_prescription` toolHttpRequest. Server-internal: no JWT
// (matches the existing booking tools), but ownerId is required so we
// never leak across tenants.
app.post('/api/prescription/lookup-by-phone', async (req, res) => {
  try {
    const { ownerId, phone } = req.body || {};
    if (!ownerId || !phone) {
      return res.status(400).json({ error: 'ownerId and phone required' });
    }
    const normalized = String(phone).replace(/\s+/g, '');

    // 1. Find the patient by phone (try exact + last 9 digits suffix match)
    const { data: leads } = await supabase
      .from('leads')
      .select('id, first_name, last_name, title, phone')
      .eq('owner_id', ownerId)
      .limit(50);
    const last9 = normalized.replace(/\D/g, '').slice(-9);
    const patient = (leads || []).find(l => {
      const p = String(l.phone || '').replace(/\s+/g, '');
      return p === normalized || p.replace(/\D/g, '').slice(-9) === last9;
    });
    if (!patient) {
      return res.json({ found: false, reason: 'no_patient_for_phone' });
    }

    // 2. Active prescription = open status, newest first
    const { data: rx } = await supabase
      .from('prescriptions')
      .select('id, rezept_typ, status, heilmittel, icd10, diagnosegruppe, anzahl_einheiten, frequenz, ausstellungsdatum, gueltig_bis')
      .eq('patient_id', patient.id)
      .in('status', ['parsed', 'confirmed', 'in_therapy'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!rx) {
      return res.json({ found: true, patient_id: patient.id, has_active: false });
    }

    // 3. Session counts
    const { data: sessions } = await supabase
      .from('prescription_sessions')
      .select('id, status, session_number')
      .eq('prescription_id', rx.id);
    const total = rx.anzahl_einheiten || (sessions || []).length;
    const done = (sessions || []).filter(s => s.status === 'done').length;
    const noShow = (sessions || []).filter(s => s.status === 'no_show').length;
    const remaining = Math.max(0, total - done);

    let gueltigBisDays = null;
    if (rx.gueltig_bis) {
      const today0 = new Date(); today0.setHours(0, 0, 0, 0);
      gueltigBisDays = Math.round((new Date(rx.gueltig_bis) - today0) / 86400000);
    }

    // 4. Next planned booking (linked session that isn't done)
    let nextAppointment = null;
    const { data: nextSession } = await supabase
      .from('prescription_sessions')
      .select('booking_id, session_number, bookings ( start_time, services ( title ) )')
      .eq('prescription_id', rx.id)
      .eq('status', 'planned')
      .order('session_number', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextSession?.bookings?.start_time) {
      nextAppointment = {
        session_number: nextSession.session_number,
        start_time: nextSession.bookings.start_time,
        service: nextSession.bookings.services?.title || null
      };
    }

    res.json({
      found: true,
      has_active: true,
      patient_id: patient.id,
      patient_name: [patient.first_name, patient.last_name].filter(Boolean).join(' ') || patient.title || null,
      prescription: {
        id: rx.id,
        typ: rx.rezept_typ,
        status: rx.status,
        heilmittel: rx.heilmittel,
        icd10: rx.icd10,
        diagnosegruppe: rx.diagnosegruppe,
        frequenz: rx.frequenz,
        ausstellungsdatum: rx.ausstellungsdatum,
        gueltig_bis: rx.gueltig_bis,
        gueltig_bis_days: gueltigBisDays
      },
      sessions: { total, done, no_show: noShow, remaining },
      next_appointment: nextAppointment
    });
  } catch (err) {
    console.error('[prescription/lookup-by-phone]', err);
    res.status(500).json({ error: err.message });
  }
});

// Sentry error handler — must be registered AFTER all controllers and BEFORE
// any other Express error middleware.
Sentry.setupExpressErrorHandler(app);

// Final fallthrough error handler — attaches Sentry event id to response so
// support can correlate user-reported issues with the captured event.
app.use((err, req, res, _next) => {
  console.error('[express error]', err.message);
  res.status(500).json({
    error: 'Internal server error',
    sentry_event_id: res.sentry || null,
  });
});

// Debug endpoint — only mounted when DEBUG_SENTRY=1, throws an error so we
// can verify the pipeline. Never expose in production.
if (process.env.DEBUG_SENTRY === '1') {
  app.get('/debug-sentry', (req, res) => {
    // Belt + suspenders: throw should be caught by setupExpressErrorHandler,
    // but we also captureException explicitly so the test never fails because
    // of v8 instrumentation timing.
    const err = new Error('Sentry smoke test from calendar-api ' + Date.now());
    Sentry.captureException(err);
    throw err;
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Calendar API running on port ${PORT}`);
});
