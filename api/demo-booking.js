/**
 * Demo Booking API — single function, dispatches via ?action=
 *
 * GET  /api/demo-booking?action=availability&date=YYYY-MM-DD
 * POST /api/demo-booking?action=create
 * POST /api/demo-booking?action=reschedule
 * GET  /api/demo-booking?action=setup-calendar&secret=SETUP_SECRET
 * GET  /api/demo-booking?action=calendar-callback&code=...
 */

import { adminFetch, json } from './_lib/auth.js';
import nodemailer from 'nodemailer';

const OWNER_EMAIL = 'ironkemal5@gmail.com';
const FROM        = 'Praxura <noreply@praxura.de>';
const BASE_URL    = 'https://praxura.de';
const CAL_REDIRECT = `${BASE_URL}/api/demo-booking?action=calendar-callback`;

// ─── SMTP ────────────────────────────────────────────────────────────────────

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// ─── Google Calendar ─────────────────────────────────────────────────────────

async function getAccessToken() {
  const { GOOGLE_DEMO_CALENDAR_REFRESH_TOKEN: rt, GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
  if (!rt || !id || !secret) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: rt, grant_type: 'refresh_token' }),
  });
  const { access_token } = await r.json();
  return access_token || null;
}

async function createCalendarEvent(booking) {
  const access_token = await getAccessToken();
  if (!access_token) return null;

  const [h, m] = booking.booking_time.split(':').map(Number);
  const total = h * 60 + m + 30;
  const endTime = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

  const event = {
    summary: `Analysegespräch Praxura – ${booking.name}`,
    description: `Unternehmen: ${booking.company || '—'}\nNachricht: ${booking.message || '—'}\n\nGebucht über praxura.de`,
    start: { dateTime: `${booking.booking_date}T${booking.booking_time}:00`, timeZone: 'Europe/Berlin' },
    end:   { dateTime: `${booking.booking_date}T${endTime}:00`,             timeZone: 'Europe/Berlin' },
    attendees: [{ email: booking.email, displayName: booking.name }],
    conferenceData: { createRequest: { requestId: `praxura-${booking.id}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] },
  };

  const r = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
    { method: 'POST', headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(event) }
  );
  const d = await r.json();
  return { event_id: d.id || null, meet_link: d.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null };
}

async function updateCalendarEvent(eventId, booking) {
  const access_token = await getAccessToken();
  if (!access_token || !eventId) return null;

  const [h, m] = booking.booking_time.split(':').map(Number);
  const total = h * 60 + m + 30;
  const endTime = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `Analysegespräch Praxura – ${booking.name}`,
        start: { dateTime: `${booking.booking_date}T${booking.booking_time}:00`, timeZone: 'Europe/Berlin' },
        end:   { dateTime: `${booking.booking_date}T${endTime}:00`,             timeZone: 'Europe/Berlin' },
      }),
    }
  );
  const d = await r.json();
  return d.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null;
}

// ─── Email ───────────────────────────────────────────────────────────────────

function fmtDE(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function cardHtml(inner) {
  return `<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#FFFEFB;padding:32px;border-radius:12px;border:1px solid #e8e0d0">${inner}<hr style="border:none;border-top:1px solid #e8e0d0;margin:24px 0"><p style="font-size:12px;color:#6E6458">Praxura · praxura.de · Bei Fragen: kontakt@infinitymade.de</p></div>`;
}

async function sendConfirmationEmails(booking, meetLink, rescheduleToken) {
  if (!process.env.SMTP_HOST) return;
  const dateStr = fmtDE(booking.booking_date);
  const rescheduleUrl = `${BASE_URL}/demo-booking.html?reschedule=${rescheduleToken}`;
  const meetRow = meetLink ? `<p style="margin:12px 0 4px"><a href="${meetLink}" style="color:#6B5538;font-weight:600">→ Google Meet Link</a></p>` : '';

  const bookerHtml = cardHtml(`
    <p style="color:#6B5538;font-size:12px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">Praxura · Analysegespräch</p>
    <h1 style="font-size:24px;font-weight:400;color:#1A1611;margin-bottom:4px">Ihre Buchung ist bestätigt</h1>
    <p style="color:#4A4036;margin-bottom:24px">Wir freuen uns auf unser Gespräch, ${booking.name}.</p>
    <div style="background:#F1E9D6;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:4px 0;color:#1A1611"><strong>Datum:</strong> ${dateStr}</p>
      <p style="margin:4px 0;color:#1A1611"><strong>Uhrzeit:</strong> ${booking.booking_time} Uhr (Europe/Berlin)</p>
      <p style="margin:4px 0;color:#1A1611"><strong>Dauer:</strong> 30 Minuten · Video-Call</p>
      ${meetRow}
    </div>
    <p><a href="${rescheduleUrl}" style="color:#6B5538;font-size:13px">Termin verschieben</a></p>`);

  const ownerHtml = cardHtml(`
    <h2 style="font-size:18px;font-weight:600;color:#1A1611;margin-bottom:16px">Neues Analysegespräch gebucht</h2>
    <p><strong>Name:</strong> ${booking.name}</p>
    <p><strong>E-Mail:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
    <p><strong>Unternehmen:</strong> ${booking.company || '—'}</p>
    <p><strong>Nachricht:</strong> ${booking.message || '—'}</p>
    <p style="margin-top:12px"><strong>Datum:</strong> ${dateStr} ${booking.booking_time} Uhr</p>
    ${meetLink ? `<p><a href="${meetLink}">Google Meet beitreten</a></p>` : ''}`);

  const t = createTransport();
  await Promise.all([
    t.sendMail({ from: FROM, to: booking.email, subject: `Analysegespräch bestätigt: ${dateStr} ${booking.booking_time} Uhr`, html: bookerHtml }),
    t.sendMail({ from: FROM, to: OWNER_EMAIL,   subject: `[Praxura] Neues Gespräch: ${booking.name} – ${dateStr}`, html: ownerHtml }),
  ]);
}

async function sendRescheduleEmails(booking, meetLink) {
  if (!process.env.SMTP_HOST) return;
  const dateStr = fmtDE(booking.booking_date);
  const meetRow = meetLink ? `<p style="margin:12px 0 4px"><a href="${meetLink}" style="color:#6B5538;font-weight:600">→ Google Meet Link</a></p>` : '';

  const bookerHtml = cardHtml(`
    <p style="color:#6B5538;font-size:12px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">Praxura · Analysegespräch</p>
    <h1 style="font-size:24px;font-weight:400;color:#1A1611;margin-bottom:4px">Termin verschoben</h1>
    <p style="color:#4A4036;margin-bottom:24px">Ihr Gespräch wurde erfolgreich neu terminiert, ${booking.name}.</p>
    <div style="background:#F1E9D6;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:4px 0;color:#1A1611"><strong>Neues Datum:</strong> ${dateStr}</p>
      <p style="margin:4px 0;color:#1A1611"><strong>Uhrzeit:</strong> ${booking.booking_time} Uhr (Europe/Berlin)</p>
      <p style="margin:4px 0;color:#1A1611"><strong>Dauer:</strong> 30 Minuten · Video-Call</p>
      ${meetRow}
    </div>`);

  const ownerHtml = cardHtml(`
    <h2 style="font-size:18px;font-weight:600;color:#1A1611;margin-bottom:16px">Analysegespräch verschoben</h2>
    <p><strong>Name:</strong> ${booking.name}</p>
    <p><strong>E-Mail:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
    <p style="margin-top:12px"><strong>Neuer Termin:</strong> ${dateStr} ${booking.booking_time} Uhr</p>
    ${meetLink ? `<p><a href="${meetLink}">Google Meet beitreten</a></p>` : ''}`);

  const t = createTransport();
  await Promise.all([
    t.sendMail({ from: FROM, to: booking.email, subject: `Termin verschoben: ${dateStr} ${booking.booking_time} Uhr`, html: bookerHtml }),
    t.sendMail({ from: FROM, to: OWNER_EMAIL,   subject: `[Praxura] Termin verschoben: ${booking.name} – ${dateStr}`, html: ownerHtml }),
  ]);
}

// ─── Action handlers ─────────────────────────────────────────────────────────

async function handleAvailability(req, res) {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(res, 400, { error: 'Invalid date' });
  try {
    const { ok, data } = await adminFetch(`/demo_bookings?select=booking_time&booking_date=eq.${date}&status=eq.confirmed`);
    return json(res, 200, { bookedTimes: ok && Array.isArray(data) ? data.map(r => r.booking_time) : [] });
  } catch { return json(res, 200, { bookedTimes: [] }); }
}

async function handleCreate(req, res) {
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const { name, email, company, message, booking_date, booking_time } = body || {};
  if (!name?.trim() || !email?.trim() || !booking_date || !booking_time) return json(res, 400, { error: 'Pflichtfelder fehlen' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) return json(res, 400, { error: 'Ungültiges Datum' });
  if (!/^\d{2}:\d{2}$/.test(booking_time)) return json(res, 400, { error: 'Ungültige Uhrzeit' });

  const { ok: chkOk, data: existing } = await adminFetch(
    `/demo_bookings?booking_date=eq.${booking_date}&booking_time=eq.${booking_time}&status=eq.confirmed&select=id&limit=1`
  );
  if (chkOk && Array.isArray(existing) && existing.length > 0)
    return json(res, 409, { error: 'Dieser Termin ist leider bereits vergeben. Bitte wählen Sie eine andere Zeit.' });

  const { ok, data } = await adminFetch('/demo_bookings', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), company: company?.trim() || null, message: message?.trim() || null, booking_date, booking_time, status: 'confirmed' }),
  });
  if (!ok || !data?.[0]) return json(res, 500, { error: 'Buchung konnte nicht gespeichert werden.' });
  const booking = data[0];

  let meetLink = null;
  try {
    const cal = await createCalendarEvent(booking);
    if (cal) {
      meetLink = cal.meet_link;
      if (cal.event_id) await adminFetch(`/demo_bookings?id=eq.${booking.id}`, { method: 'PATCH', body: JSON.stringify({ google_event_id: cal.event_id }) });
    }
  } catch (e) { console.error('[demo-booking] calendar', e); }

  try { await sendConfirmationEmails(booking, meetLink, booking.reschedule_token); }
  catch (e) { console.error('[demo-booking] email', e); }

  return json(res, 200, { ok: true, meet_link: meetLink, reschedule_token: booking.reschedule_token });
}

async function handleReschedule(req, res) {
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const { token, new_date, new_time } = body || {};
  if (!token || !new_date || !new_time) return json(res, 400, { error: 'token, new_date und new_time sind erforderlich' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(new_date)) return json(res, 400, { error: 'Ungültiges Datum' });
  if (!/^\d{2}:\d{2}$/.test(new_time)) return json(res, 400, { error: 'Ungültige Uhrzeit' });

  const { ok: findOk, data: found } = await adminFetch(`/demo_bookings?reschedule_token=eq.${encodeURIComponent(token)}&select=*&limit=1`);
  if (!findOk || !Array.isArray(found) || found.length === 0) return json(res, 404, { error: 'Ungültiger oder abgelaufener Token' });
  const booking = found[0];
  if (booking.status !== 'confirmed') return json(res, 409, { error: 'Dieser Termin kann nicht verschoben werden' });

  const { ok: chkOk, data: existing } = await adminFetch(
    `/demo_bookings?booking_date=eq.${new_date}&booking_time=eq.${new_time}&status=eq.confirmed&id=neq.${booking.id}&select=id&limit=1`
  );
  if (chkOk && Array.isArray(existing) && existing.length > 0)
    return json(res, 409, { error: 'Dieser Termin ist leider bereits vergeben. Bitte wählen Sie eine andere Zeit.' });

  const { ok: upOk, data: updated } = await adminFetch(`/demo_bookings?id=eq.${booking.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ booking_date: new_date, booking_time: new_time }),
  });
  if (!upOk) return json(res, 500, { error: 'Termin konnte nicht aktualisiert werden.' });

  const upd = (Array.isArray(updated) ? updated[0] : null) || { ...booking, booking_date: new_date, booking_time: new_time };

  let meetLink = null;
  try { if (booking.google_event_id) meetLink = await updateCalendarEvent(booking.google_event_id, upd); }
  catch (e) { console.error('[demo-booking] calendar reschedule', e); }

  try { await sendRescheduleEmails(upd, meetLink); }
  catch (e) { console.error('[demo-booking] email reschedule', e); }

  return json(res, 200, { ok: true, meet_link: meetLink });
}

function handleSetupCalendar(req, res) {
  if (req.query.secret !== process.env.SETUP_SECRET) return json(res, 403, { error: 'Forbidden' });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: CAL_REDIRECT,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
  });
  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  res.end();
}

async function handleCalendarCallback(req, res) {
  const { code } = req.query;
  if (!code) return json(res, 400, { error: 'No code' });

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: CAL_REDIRECT,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await r.json();

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!DOCTYPE html><html><body style="font-family:monospace;padding:40px;max-width:600px">
    <h2>✅ Google Calendar verbunden</h2>
    <p>Füge diesen Wert als <strong>GOOGLE_DEMO_CALENDAR_REFRESH_TOKEN</strong> in Vercel ein:</p>
    <textarea style="width:100%;height:80px;padding:8px;background:#f5f5f5;border:1px solid #ccc">${tokens.refresh_token || 'ERROR: No refresh_token'}</textarea>
    <p style="color:#666;font-size:12px">Vercel → Settings → Environment Variables → Add new → Redeploy</p>
  </body></html>`);
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const { action } = req.query;

  if (action === 'availability' && req.method === 'GET') return handleAvailability(req, res);
  if (action === 'create'       && req.method === 'POST') return handleCreate(req, res);
  if (action === 'reschedule'   && req.method === 'POST') return handleReschedule(req, res);
  if (action === 'setup-calendar'   && req.method === 'GET') return handleSetupCalendar(req, res);
  if (action === 'calendar-callback' && req.method === 'GET') return handleCalendarCallback(req, res);

  return json(res, 400, { error: 'Unknown action' });
}
