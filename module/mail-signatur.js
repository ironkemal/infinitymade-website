/** Structured mail footer. Mirror: module/mail-signatur.js; parity-tested there. No raw HTML. */
export const SIGNATUR_LIMITS = Object.freeze({ id:80, name:80, praxis:160, kontakt:160, adresse:500, telefon:80, email:254, website:500, zusatz:2000, logoUrl:500 });
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function https(value) {
  if (!value || /[\s\u0000-\u001f\u007f]/.test(value)) return '';
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function normalisiereSignatur(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const [key, limit] of Object.entries(SIGNATUR_LIMITS)) result[key] = typeof value[key] === 'string' ? value[key].trim().slice(0,limit) : '';
  result.layout = value.layout === 'kompakt' ? 'kompakt' : 'klassisch';
  result.website = https(result.website);
  result.logoUrl = https(result.logoUrl);
  return result;
}
export function pruefeSignatur(value) {
  if (value == null) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.keys(value).some(key => key !== 'layout' && !Object.hasOwn(SIGNATUR_LIMITS,key))) return false;
  if (value.layout != null && !['klassisch','kompakt'].includes(value.layout)) return false;
  return Object.entries(SIGNATUR_LIMITS).every(([key,limit]) => value[key] == null || (typeof value[key] === 'string' && value[key].length <= limit));
}
export function signaturText(value) {
  const s = normalisiereSignatur(value);
  return s ? [s.praxis,s.kontakt,s.adresse,s.telefon,s.email,s.website,s.zusatz].filter(Boolean).join('\n') : '';
}
export function signaturHtml(value) {
  const s = normalisiereSignatur(value);
  if (!s) return '';
  const lines = [s.kontakt,s.adresse,s.telefon,s.email,s.website,s.zusatz].filter(Boolean);
  const logo = s.logoUrl ? `<img src="${esc(s.logoUrl)}" alt="Praxislogo" width="120" style="display:block;max-width:120px;max-height:80px;height:auto;margin-bottom:12px">` : '';
  const details = `${s.praxis ? `<strong>${esc(s.praxis)}</strong><br>` : ''}${lines.map(v=>esc(v).replace(/\r?\n/g,'<br>')).join('<br>')}`;
  return `<div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#333;padding-top:16px;border-top:1px solid #ddd">${s.layout === 'kompakt' ? `<table role="presentation"><tr>${logo ? `<td style="padding-right:16px;vertical-align:top">${logo}</td>` : ''}<td>${details}</td></tr></table>` : logo + details}</div>`;
}
export function mailMitSignatur(body, value) {
  const text = String(body || '');
  const s = normalisiereSignatur(value);
  if (!s) return {text,html:null};
  const footer = signaturText(s);
  return {text:footer ? `${text}\n\n${footer}` : text,html:`<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;white-space:normal">${esc(text).replace(/\r?\n/g,'<br>')}</div><br>${signaturHtml(s)}`};
}
