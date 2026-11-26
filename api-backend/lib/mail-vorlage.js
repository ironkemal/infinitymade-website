// Einheitliche, spam-sichere E-Mail-Vorlagen & Header-Helfer für Praxura.
//
// Warum das gegen Spam hilft:
// 1. Jede HTML-Mail erhält automatisch eine passende text/plain-Alternative (multipart/alternative) —
//    reines HTML ohne Textteil triggert bei GMX, Web.de, T-Online und Gmail häufig Spam-Punkte.
// 2. Message-ID wird auf die Domain der Absenderadresse ausgerichtet (statt Container-Hostname).
// 3. Saubere, schlanke HTML-Struktur im aktuellen Praxura-Design (#0f766e / #faf8f5),
//    alle Nutzereingaben strikt HTML-maskiert.

import crypto from 'node:crypto';

/** @param {unknown} s */
export function escMailHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] || c));
}

/**
 * Extrahiert die Domain aus einem From-Header (`"Praxis" <info@praxis.de>`) oder einer Mailadresse.
 * @param {unknown} fromWert
 * @returns {string}
 */
export function absenderDomain(fromWert) {
  const s = String(fromWert || '');
  const match = s.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return match ? match[1].toLowerCase() : 'praxura.de';
}

/**
 * Erzeugt eine RFC-5322-konforme Message-ID passend zur Absender-Domain.
 * @param {unknown} fromWert
 * @returns {string}
 */
export function baueMessageId(fromWert) {
  const domain = absenderDomain(fromWert);
  const rand = crypto.randomBytes(10).toString('hex');
  return `<${rand}.${Date.now()}@${domain}>`;
}

/**
 * Einfache Klartext-Ableitung aus HTML, falls kein expliziter `text` mitgegeben wurde.
 * @param {unknown} html
 * @returns {string}
 */
export function htmlZuText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Rendert eine moderne, zustellbare Praxura-E-Mail als { html, text }.
 *
 * @param {{
 *   praxis?: string | null,
 *   titel: string,
 *   anrede?: string | null,
 *   absaetze?: Array<string>,
 *   boxZeilen?: Array<{ label: string, wert: string }>,
 *   aktionen?: Array<{ label: string, href: string, stil?: 'primary' | 'link' }>,
 *   hinweis?: string | null,
 * }} opts
 * @returns {{ html: string, text: string }}
 */
export function renderePraxuraMail({
  praxis = 'Praxura',
  titel,
  anrede = '',
  absaetze = [],
  boxZeilen = [],
  aktionen = [],
  hinweis = '',
}) {
  const praxisName = String(praxis || 'Praxura').trim() || 'Praxura';
  const saubereAbsaetze = (absaetze || []).filter((a) => a != null && String(a).trim() !== '');
  const saubereBox = (boxZeilen || []).filter((z) => z && z.label && z.wert);
  const saubereAktionen = (aktionen || []).filter((a) => a && a.label && a.href);

  const boxHtml = saubereBox.length
    ? `<div style="background:#F4F6F9;border:1px solid #E6E9EE;border-radius:12px;padding:14px 16px;margin:18px 0;">
        ${saubereBox.map((z) =>
          `<p style="margin:5px 0;font-size:14px;line-height:1.5;color:#0B0F17;"><strong>${escMailHtml(z.label)}:</strong> ${escMailHtml(z.wert)}</p>`
        ).join('')}
      </div>`
    : '';

  const aktionenHtml = saubereAktionen.length
    ? `<div style="margin:20px 0;">
        ${saubereAktionen.map((a) => (a.stil === 'link'
          ? `<p style="margin:8px 0;font-size:13px;"><a href="${escMailHtml(a.href)}" style="color:#2563EB;text-decoration:underline;">${escMailHtml(a.label)}</a></p>`
          : `<p style="margin:10px 0;"><a href="${escMailHtml(a.href)}" style="display:inline-block;background:#0B0F17;color:#ffffff;padding:11px 20px;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;">${escMailHtml(a.label)}</a></p>`
        )).join('')}
      </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0B0F17;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E6E9EE;border-radius:18px;padding:28px 26px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#2563EB;margin-bottom:8px;">${escMailHtml(praxisName)}</div>
    <h2 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0B0F17;">${escMailHtml(titel)}</h2>
    ${anrede ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escMailHtml(anrede)}</p>` : ''}
    ${saubereAbsaetze.map((p) =>
      `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#344054;">${escMailHtml(p).replace(/\n/g, '<br>')}</p>`
    ).join('')}
    ${boxHtml}
    ${aktionenHtml}
    ${hinweis ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#475467;">${escMailHtml(hinweis)}</p>` : ''}
    <hr style="border:none;border-top:1px solid #E6E9EE;margin:22px 0 14px;">
    <p style="margin:0;font-size:12px;color:#5B6474;">${escMailHtml(praxisName)} · Gesendet über Praxura</p>
  </div>
</body>
</html>`;

  const textTeile = [
    `${praxisName} — ${titel}`,
    '',
    anrede || null,
    ...saubereAbsaetze,
    saubereBox.length ? '' : null,
    ...saubereBox.map((z) => `${z.label}: ${z.wert}`),
    saubereAktionen.length ? '' : null,
    ...saubereAktionen.map((a) => `${a.label}: ${a.href}`),
    hinweis ? `\n${hinweis}` : null,
    `\n--\n${praxisName}`,
  ].filter((z) => z !== null);

  return { html, text: textTeile.join('\n').replace(/\n{3,}/g, '\n\n').trim() };
}

/**
 * Ergänzt Nodemailer-Mailoptionen um Zustellbarkeits-Defaults (text, domain-aligned messageId, Auto-Submitted).
 * @param {{
 *   from: string,
 *   to: string,
 *   replyTo?: string,
 *   subject: string,
 *   html?: string,
 *   text?: string,
 *   autoSubmitted?: boolean,
 *   headers?: Record<string, string>,
 * }} opts
 */
export function baueMailOptionen({
  from,
  to,
  replyTo,
  subject,
  html,
  text,
  autoSubmitted = false,
  headers = {},
}) {
  const extraHeaders = { ...headers };
  if (autoSubmitted && !extraHeaders['Auto-Submitted']) {
    extraHeaders['Auto-Submitted'] = 'auto-generated';
  }
  return {
    from,
    to,
    ...(replyTo ? { replyTo } : {}),
    subject,
    messageId: baueMessageId(from),
    ...(html ? { html } : {}),
    text: text || htmlZuText(html),
    ...(Object.keys(extraHeaders).length ? { headers: extraHeaders } : {}),
  };
}
