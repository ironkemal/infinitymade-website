/**
 * POST /api/contact
 * Sends contact form submission to info@praxura.de
 */

import nodemailer from 'nodemailer';
import { json } from './_lib/auth.js';

const RECIPIENT = 'info@praxura.de';
const FROM      = 'Praxura Website <noreply@praxura.de>';

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function sanitize(str) {
  return String(str || '').trim().slice(0, 2000);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return json(res, 400, { error: 'Invalid JSON' }); }

  const vorname  = sanitize(body?.vorname);
  const nachname = sanitize(body?.nachname);
  const firma    = sanitize(body?.firma);
  const email    = sanitize(body?.email);
  const nachricht = sanitize(body?.nachricht);

  if (!vorname || !nachname || !email || !nachricht)
    return json(res, 400, { error: 'Pflichtfelder fehlen' });

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email))
    return json(res, 400, { error: 'Ungültige E-Mail-Adresse' });

  if (!process.env.SMTP_HOST) {
    console.error('[contact] SMTP_HOST not set');
    return json(res, 500, { error: 'E-Mail-Versand nicht konfiguriert' });
  }

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;background:#FFFEFB;padding:32px;border-radius:12px;border:1px solid #e8e0d0">
      <p style="color:#6B5538;font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px">Praxura · Kontaktformular</p>
      <h2 style="font-size:20px;font-weight:600;color:#1A1611;margin-bottom:20px">Neue Kontaktanfrage</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1A1611">
        <tr><td style="padding:8px 0;color:#6E6458;width:130px;vertical-align:top">Name</td><td style="padding:8px 0"><strong>${vorname} ${nachname}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6E6458;vertical-align:top">Firma</td><td style="padding:8px 0">${firma || '—'}</td></tr>
        <tr><td style="padding:8px 0;color:#6E6458;vertical-align:top">E-Mail</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#6B5538">${email}</a></td></tr>
        <tr><td style="padding:8px 0;color:#6E6458;vertical-align:top">Nachricht</td><td style="padding:8px 0;white-space:pre-wrap">${nachricht}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e8e0d0;margin:24px 0">
      <p style="font-size:11px;color:#6E6458">Eingegangen über praxura.de/kontakt.html · ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}</p>
    </div>`;

  try {
    const t = createTransport();
    await t.sendMail({
      from: FROM,
      to: RECIPIENT,
      replyTo: email,
      subject: `[Praxura Kontakt] ${vorname} ${nachname}${firma ? ` · ${firma}` : ''}`,
      html,
    });
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error('[contact] sendMail failed', e);
    return json(res, 500, { error: 'E-Mail konnte nicht gesendet werden.' });
  }
}
