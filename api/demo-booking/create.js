import { adminFetch, json } from '../_lib/auth.js';

const RESEND_KEY = process.env.RESEND_API_KEY;
const OWNER_EMAIL = 'ironkemal5@gmail.com';
const FROM = 'noreply@praxura.de';
const BASE_URL = 'https://praxura.de';

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

async function createCalendarEvent(booking) {
  const access_token = await getAccessToken();
  if (!access_token) return null;

  const [hour, min] = booking.booking_time.split(':').map(Number);
  const totalMin = hour * 60 + min + 30;
  const endHour = Math.floor(totalMin / 60);
  const endMin = totalMin % 60;
  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

  const event = {
    summary: `Analysegespräch Praxura – ${booking.name}`,
    description: `Unternehmen: ${booking.company || '—'}\nNachricht: ${booking.message || '—'}\n\nGebucht über praxura.de`,
    start: { dateTime: `${booking.booking_date}T${booking.booking_time}:00`, timeZone: 'Europe/Berlin' },
    end:   { dateTime: `${booking.booking_date}T${endTime}:00`,             timeZone: 'Europe/Berlin' },
    attendees: [{ email: booking.email, displayName: booking.name }],
    conferenceData: {
      createRequest: {
        requestId: `praxura-${booking.id}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] },
  };

  const evRes = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }
  );
  const evData = await evRes.json();
  return {
    event_id: evData.id || null,
    meet_link: evData.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || null,
  };
}

// ---------------------------------------------------------------------------
// Email helpers
// ---------------------------------------------------------------------------

function formatDateDE(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

async function sendConfirmationEmail(booking, meetLink, rescheduleToken) {
  if (!RESEND_KEY) return;

  const rescheduleUrl = `${BASE_URL}/demo-booking.html?reschedule=${rescheduleToken}`;
  const dateStr = formatDateDE(booking.booking_date);

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#FFFEFB;padding:32px;border-radius:12px;border:1px solid #e8e0d0">
      <p style="color:#6B5538;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">Praxura · Analysegespräch</p>
      <h1 style="font-size:24px;font-weight:400;color:#1A1611;margin-bottom:4px">Ihre Buchung ist bestätigt</h1>
      <p style="color:#4A4036;margin-bottom:24px">Wir freuen uns auf unser Gespräch, ${booking.name}.</p>

      <div style="background:#F1E9D6;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <p style="margin:4px 0;color:#1A1611"><strong>Datum:</strong> ${dateStr}</p>
        <p style="margin:4px 0;color:#1A1611"><strong>Uhrzeit:</strong> ${booking.booking_time} Uhr (Europe/Berlin)</p>
        <p style="margin:4px 0;color:#1A1611"><strong>Dauer:</strong> 30 Minuten · Video-Call</p>
        ${meetLink ? `<p style="margin:12px 0 4px;"><a href="${meetLink}" style="color:#6B5538;font-weight:600">→ Google Meet Link</a></p>` : ''}
      </div>

      <p style="margin-bottom:16px"><a href="${rescheduleUrl}" style="color:#6B5538;font-size:13px">Termin verschieben</a></p>
      <hr style="border:none;border-top:1px solid #e8e0d0;margin:24px 0">
      <p style="font-size:12px;color:#6E6458">Praxura · praxura.de · Bei Fragen: kontakt@infinitymade.de</p>
    </div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: booking.email,
      subject: `Analysegespräch bestätigt: ${dateStr} ${booking.booking_time} Uhr`,
      html,
    }),
  });
}

async function sendOwnerNotification(booking, meetLink) {
  if (!RESEND_KEY) return;

  const dateStr = formatDateDE(booking.booking_date);

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;background:#FFFEFB;padding:32px;border-radius:12px;border:1px solid #e8e0d0">
      <h2 style="font-size:18px;font-weight:600;color:#1A1611;margin-bottom:16px">Neues Analysegespräch gebucht</h2>
      <p><strong>Name:</strong> ${booking.name}</p>
      <p><strong>E-Mail:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
      <p><strong>Unternehmen:</strong> ${booking.company || '—'}</p>
      <p><strong>Nachricht:</strong> ${booking.message || '—'}</p>
      <hr style="border:none;border-top:1px solid #e8e0d0;margin:16px 0">
      <p><strong>Datum:</strong> ${dateStr} ${booking.booking_time} Uhr</p>
      ${meetLink ? `<p><a href="${meetLink}">Google Meet beitreten</a></p>` : ''}
    </div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: OWNER_EMAIL,
      subject: `[Praxura] Neues Gespräch: ${booking.name} – ${dateStr}`,
      html,
    }),
  });
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

  const { name, email, company, message, booking_date, booking_time } = body || {};

  // Validation
  if (!name?.trim() || !email?.trim() || !booking_date || !booking_time) {
    return json(res, 400, { error: 'Pflichtfelder fehlen' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) return json(res, 400, { error: 'Ungültiges Datum' });
  if (!/^\d{2}:\d{2}$/.test(booking_time)) return json(res, 400, { error: 'Ungültige Uhrzeit' });

  // Double-booking check
  const { ok: chkOk, data: existing } = await adminFetch(
    `/demo_bookings?booking_date=eq.${booking_date}&booking_time=eq.${booking_time}&status=eq.confirmed&select=id&limit=1`
  );
  if (chkOk && Array.isArray(existing) && existing.length > 0) {
    return json(res, 409, { error: 'Dieser Termin ist leider bereits vergeben. Bitte wählen Sie eine andere Zeit.' });
  }

  // Insert
  const { ok, data } = await adminFetch('/demo_bookings', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company?.trim() || null,
      message: message?.trim() || null,
      booking_date,
      booking_time,
      status: 'confirmed',
    }),
  });
  if (!ok || !data?.[0]) return json(res, 500, { error: 'Buchung konnte nicht gespeichert werden.' });

  const booking = data[0];

  // Google Calendar (non-blocking)
  let meetLink = null;
  try {
    const calResult = await createCalendarEvent(booking);
    if (calResult) {
      meetLink = calResult.meet_link;
      if (calResult.event_id) {
        await adminFetch(`/demo_bookings?id=eq.${booking.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ google_event_id: calResult.event_id }),
        });
      }
    }
  } catch (e) {
    console.error('[demo-booking/create] calendar error', e);
  }

  // Emails (non-blocking)
  try {
    await Promise.all([
      sendConfirmationEmail(booking, meetLink, booking.reschedule_token),
      sendOwnerNotification(booking, meetLink),
    ]);
  } catch (e) {
    console.error('[demo-booking/create] email error', e);
  }

  return json(res, 200, { ok: true, meet_link: meetLink, reschedule_token: booking.reschedule_token });
}
