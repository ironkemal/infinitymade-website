import { json } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const { code, error: oauthError } = req.query;

  if (oauthError) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!DOCTYPE html><html><body style="font-family:monospace;padding:40px;max-width:600px">
      <h2>&#x274C; OAuth-Fehler</h2>
      <p>Google hat einen Fehler zurückgegeben: <strong>${oauthError}</strong></p>
      <p>Bitte versuche es erneut über <code>/api/demo-booking/setup-calendar?secret=...</code></p>
    </body></html>`);
    return;
  }

  if (!code) return json(res, 400, { error: 'No code' });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'https://praxura.de/api/demo-booking/calendar-callback',
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json();

  const refreshToken = tokens.refresh_token || '';
  const hasToken = Boolean(refreshToken);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:monospace;padding:40px;max-width:600px">
    <h2>${hasToken ? '&#x2705; Google Calendar verbunden' : '&#x26A0;&#xFE0F; Kein Refresh-Token erhalten'}</h2>
    ${hasToken
      ? `<p>Füge diesen Wert als <strong>GOOGLE_DEMO_CALENDAR_REFRESH_TOKEN</strong> in Vercel ein:</p>
         <textarea readonly style="width:100%;height:80px;padding:8px;background:#f5f5f5;border:1px solid #ccc;font-family:monospace">${refreshToken}</textarea>
         <p style="margin-top:16px">Schritte:</p>
         <ol>
           <li>Vercel → Projekt → Settings → Environment Variables</li>
           <li>Add new: <code>GOOGLE_DEMO_CALENDAR_REFRESH_TOKEN</code></li>
           <li>Paste den Wert oben ein &amp; Deploy auslösen</li>
         </ol>`
      : `<p>Google hat keinen <code>refresh_token</code> zurückgegeben. Mögliche Ursachen:</p>
         <ul>
           <li>Die App hatte bereits Zugriff — <a href="https://myaccount.google.com/permissions" target="_blank">Zugriff widerrufen</a> und erneut versuchen</li>
           <li><code>prompt=consent</code> war nicht gesetzt (Setup-Endpoint prüfen)</li>
         </ul>
         <p>Token-Antwort (Debug):</p>
         <pre style="background:#f5f5f5;padding:12px;overflow:auto">${JSON.stringify(tokens, null, 2)}</pre>`
    }
    <hr style="margin-top:32px;border:none;border-top:1px solid #ccc">
    <p style="color:#666;font-size:12px">Diese Seite ist nur für den Eigentümer sichtbar. Schliesse das Fenster nach dem Kopieren.</p>
  </body></html>`);
}
