// Signierte Anfragen der Box an Merkez (K2b.17). Adresse NUR aus env MERKEZ_URL —
// kein Host im Code (O-161 (a)).
import { signiereAnfrage } from './signatur.js';
import { ladeKimlik } from './kimlik.js';

function basisUrl(baseUrl) {
  const b = (baseUrl || process.env.MERKEZ_URL || '').replace(/\/+$/, '');
  if (!b) throw new Error('MERKEZ_URL ist nicht gesetzt');
  // Klartext-HTTP nur für lokale Tests (Merkez-Schlüssel/Codes laufen sonst im Klartext).
  if (!/^https:\/\//i.test(b) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(b)) {
    throw new Error('MERKEZ_URL muss https:// sein');
  }
  return b;
}

/**
 * @param {string} pfad  z. B. '/v1/ip' (fester Pfad, keine Sonderzeichen)
 * @param {{method?:string, body?:object, kimlik?:object, ohneSignatur?:boolean, baseUrl?:string, fetchImpl?:Function, timeoutMs?:number, jetzt?:number}} [opt]
 * @returns {Promise<{status:number, ok:boolean, json:any, serverzeit:number|null}>}
 *   `serverzeit` nur zur Diagnose bei 401 — die Box übernimmt sie NIE als eigene Uhr.
 */
export async function merkezFetch(pfad, { method = 'POST', body, kimlik, ohneSignatur = false, baseUrl, fetchImpl = globalThis.fetch, timeoutMs = 15000, jetzt } = {}) {
  if (!pfad.startsWith('/')) throw new Error('Pfad muss mit / beginnen');
  const url = basisUrl(baseUrl) + pfad;
  const bodyText = body === undefined ? undefined : JSON.stringify(body);
  const headers = { Accept: 'application/json' };
  if (bodyText !== undefined) headers['Content-Type'] = 'application/json';
  if (!ohneSignatur) {
    const k = kimlik || ladeKimlik();
    if (!k) throw new Error('Keine Kutu-Kimlik vorhanden (kayit.js zuerst ausführen)');
    Object.assign(headers, signiereAnfrage({ method, url, body: bodyText, kimlik: k, jetzt }).headers);
  }
  const antwort = await fetchImpl(url, {
    method,
    redirect: 'error', // signierte Anfrage nie an eine umgeleitete Adresse weiterreichen
    headers,
    body: bodyText,
    signal: AbortSignal.timeout(timeoutMs),
  });
  let json = null;
  try { json = await antwort.json(); } catch { /* kein JSON */ }
  return { status: antwort.status, ok: antwort.ok, json, serverzeit: Number.isFinite(json?.serverzeit) ? json.serverzeit : null };
}
