/** Structured mail footer. Mirror: module/mail-signatur.js; parity-tested there. No raw HTML. */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   praxis: string,
 *   kontakt: string,
 *   adresse: string,
 *   telefon: string,
 *   email: string,
 *   website: string,
 *   zusatz: string,
 *   logoUrl: string,
 *   layout: 'klassisch' | 'kompakt',
 * }} NormalisierteSignatur
 */

export const SIGNATUR_LIMITS = Object.freeze({ id:80, name:80, praxis:160, kontakt:160, adresse:500, telefon:80, email:254, website:500, zusatz:2000, logoUrl:500 });
/** @param {unknown} value @returns {string} */
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));
/** @param {string} value @returns {string} */
function https(value) {
  if (!value || /[\s\u0000-\u001f\u007f]/.test(value)) return '';
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
/** @param {unknown} value @returns {NormalisierteSignatur | null} */
export function normalisiereSignatur(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = /** @type {Record<string, unknown>} */ (value);
  /** @type {Record<string, string>} */
  const raw = {};
  for (const [key, limit] of Object.entries(SIGNATUR_LIMITS)) {
    const field = input[key];
    raw[key] = typeof field === 'string' ? field.trim().slice(0,limit) : '';
  }
  return /** @type {NormalisierteSignatur} */ ({
    ...raw,
    layout: input.layout === 'kompakt' ? 'kompakt' : 'klassisch',
    website: https(raw.website),
    logoUrl: https(raw.logoUrl),
  });
}
/** @param {unknown} value @returns {boolean} */
export function pruefeSignatur(value) {
  if (value == null) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const input = /** @type {Record<string, unknown>} */ (value);
  if (Object.keys(input).some(key => key !== 'layout' && !Object.hasOwn(SIGNATUR_LIMITS,key))) return false;
  if (input.layout != null && (typeof input.layout !== 'string' || !['klassisch','kompakt'].includes(input.layout))) return false;
  return Object.entries(SIGNATUR_LIMITS).every(([key,limit]) => {
    const field = input[key];
    return field == null || (typeof field === 'string' && field.length <= limit);
  });
}
/** @param {unknown} value @returns {string} */
export function signaturText(value) {
  const s = normalisiereSignatur(value);
  return s ? [s.praxis,s.kontakt,s.adresse,s.telefon,s.email,s.website,s.zusatz].filter(Boolean).join('\n') : '';
}
/** @param {unknown} value @returns {string} */
export function signaturHtml(value) {
  const s = normalisiereSignatur(value);
  if (!s) return '';
  const lines = [s.kontakt,s.adresse,s.telefon,s.email,s.website,s.zusatz].filter(Boolean);
  const logo = s.logoUrl ? `<img src="${esc(s.logoUrl)}" alt="Praxislogo" width="120" style="display:block;max-width:120px;max-height:80px;height:auto;margin-bottom:12px">` : '';
  const details = `${s.praxis ? `<strong>${esc(s.praxis)}</strong><br>` : ''}${lines.map(v=>esc(v).replace(/\r?\n/g,'<br>')).join('<br>')}`;
  return `<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#333;padding-top:16px;border-top:1px solid #ddd">${s.layout === 'kompakt' ? `<table role="presentation"><tr>${logo ? `<td style="padding-right:16px;vertical-align:top">${logo}</td>` : ''}<td>${details}</td></tr></table>` : logo + details}</div>`;
}
/** @param {unknown} body @param {unknown} value @returns {{ text: string, html: string | null }} */
export function mailMitSignatur(body, value) {
  const text = String(body || '');
  const s = normalisiereSignatur(value);
  if (!s) return {text,html:null};
  const footer = signaturText(s);
  return {text:footer ? `${text}\n\n${footer}` : text,html:`<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;white-space:normal">${esc(text).replace(/\r?\n/g,'<br>')}</div><br>${signaturHtml(s)}`};
}
