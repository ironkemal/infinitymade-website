import { adminFetch, json } from '../_lib/auth.js';
import nodemailer from 'nodemailer';

const OWNER_EMAIL = 'ironkemal5@gmail.com';
const FROM = 'Praxura <noreply@praxura.de>';
const BASE_URL = 'https://praxura.de';

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ---------------------------------------------------------------------------
// Google Calendar helpers
// ---------------------------------------------------------------------------

async function getAccessToken() {
  const REFRESH_TOKEN = process.env.GOOGLE_DEMO_CALENDAR_REFRESH_TOKEN;
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  if (!REFRESH_TOKEN || !CLIENT_ID || !CLIENT_SECRET) return null;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const { access_token } = await tokenRes.json();
  return access_token || null;
}

async function updateCalendarEvent(eventId, booking) {
  const access_token = await getAccessToken();
  if (!access_token || !eventId) return null;

  const [hour, min] = booking.booking_time.split(':').map(Number);
  const totalMin = hour * 60 + min + 30;
  const endHour = Math.floor(totalMin / 60);
  const endMin = totalMin % 60;
  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

  const patch = {
    summary: `Analysegespräch Praxura – ${booking.name}`,
    start: { dateTime: `${booking.booking_date}T${booking.booking_time}:00`, timeZone: 'Europe/Berlin' },
    end:   { dateTime: `${booking.booking_date}T${endTime}:00`,             timeZone: 'Europe/Berlin' },
  };

  const evRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }
  );
  const evData = await evRes.json();
  // Meet link is preserved on PATCH; extract it in case it changed
  return evData.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null;
}

// ---------------------------------------------------------------------------
// Email helper
// ---------------------------------------------------------------------------

function formatDateDE(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

async function sendRescheduleConfirmation(booking, meetLink) {
  if (!process.env.SMTP_HOST) return;

  const dateStr = formatDateDE(booking.booking_date);

  const bookerHtml = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#FFFEFB;padding:32px;border-radius:12px;border:1px solid #e8e0d0">
      <p style="color:#6B5538;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">Praxura · Analysegespräch</p>
      <h1 style="font-size:24px;font-weight:400;color:#1A1611;margin-bottom:4px">Termin verschoben</h1>
      <p style="color:#4A4036;margin-bottom:24px">Ihr Gespräch wurde erfolgreich neu terminiert, ${booking.name}.</p>

      <div style="background:#F1E9D6;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <p style="margin:4px 0;color:#1A1611"><strong>Neues Datum:</strong> ${dateStr}</p>
        <p style="margin:4px 0;color:#1A1611"><strong>Uhrzeit:</strong> ${booking.booking_time} Uhr (Europe/Berlin)</p>
        <p style="margin:4px 0;color:#1A1611"><strong>Dauer:</strong> 30 Minuten · Video-Call</p>
        ${meetLink ? `<p style="margin:12px 0 4px;"><a href="${meetLink}" style="color:#6B5538;font-weight:600">→ Google Meet Link</a></p>` : ''}
      </div>

      <hr style="border:none;border-top:1px solid #e8e0d0;margin:24px 0">
      <p style="font-size:12px;color:#6E6458">Praxura · praxura.de · Bei Fragen: kontakt@infinitymade.de</p>
    </div>`;

  const ownerHtml = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#FFFEFB;padding:32px;border-radius:12px;border:1px solid #e8e0d0">
      <h2 style="font-size:18px;font-weight:600;color:#1A1611;margin-bottom:16px">Analysegespräch verschoben</h2>
      <p><strong>Name:</strong> ${booking.name}</p>
      <p><strong>E-Mail:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
      <hr style="border:none;border-top:1px solid #e8e0d0;margin:16px 0">
      <p><strong>Neuer Termin:</strong> ${dateStr} ${booking.booking_time} Uhr</p>
      ${meetLink ? `<p><a href="${meetLink}">Google Meet beitreten</a></p>` : ''}
    </div>`;

  const t = createTransport();
  await Promise.all([
    t.sendMail({ from: FROM, to: booking.email, subject: `Termin verschoben: ${dateStr} ${booking.booking_time} Uhr`, html: bookerHtml }),
    t.sendMail({ from: FROM, to: OWNER_EMAIL, subject: `[Praxura] Termin verschoben: ${booking.name} – ${dateStr}`, html: ownerHtml }),
  ]);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return json(res, 400, { error: 'Invalid JSON' });
  }

  const { token, new_date, new_time } = body || {};

  if (!token || !new_date || !new_time) {
    return json(res, 400, { error: 'token, new_date und new_time sind erforderlich' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(new_date)) return json(res, 400, { error: 'Ungültiges Datum' });
  if (!/^\d{2}:\d{2}$/.test(new_time)) return json(res, 400, { error: 'Ungültige Uhrzeit' });

  // Find booking by token
  const { ok: findOk, data: found } = await adminFetch(
    `/demo_bookings?reschedule_token=eq.${encodeURIComponent(token)}&select=*&limit=1`
  );
  if (!findOk || !Array.isArray(found) || found.length === 0) {
    return json(res, 404, { error: 'Ungültiger oder abgelaufener Token' });
  }
  const booking = found[0];

  if (booking.status !== 'confirmed') {
    return json(res, 409, { error: 'Dieser Termin kann nicht verschoben werden' });
  }

  // Double-booking check on new slot
  const { ok: chkOk, data: existing } = await adminFetch(
    `/demo_bookings?booking_date=eq.${new_date}&booking_time=eq.${new_time}&status=eq.confirmed&id=neq.${booking.id}&select=id&limit=1`
  );
  if (chkOk && Array.isArray(existing) && existing.length > 0) {
    return json(res, 409, { error: 'Dieser Termin ist leider bereits vergeben. Bitte wählen Sie eine andere Zeit.' });
  }

  // Update booking
  const { ok: updateOk, data: updated } = await adminFetch(`/demo_bookings?id=eq.${booking.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ booking_date: new_date, booking_time: new_time }),
  });
  if (!updateOk) return json(res, 500, { error: 'Termin konnte nicht aktualisiert werden.' });

  const updatedBooking = (Array.isArray(updated) ? updated[0] : null) || { ...booking, booking_date: new_date, booking_time: new_time };

  // Update Google Calendar event (non-blocking)
  let meetLink = null;
  try {
    if (booking.google_event_id) {
      meetLink = await updateCalendarEvent(booking.google_event_id, updatedBooking);
    }
  } catch (e) {
    console.error('[demo-booking/reschedule] calendar error', e);
  }

  // Emails (non-blocking)
  try {
    await sendRescheduleConfirmation(updatedBooking, meetLink);
  } catch (e) {
    console.error('[demo-booking/reschedule] email error', e);
  }

  return json(res, 200, { ok: true, meet_link: meetLink });
}
