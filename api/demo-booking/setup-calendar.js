import { json } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  if (!process.env.SETUP_SECRET || req.query.secret !== process.env.SETUP_SECRET) {
    return json(res, 403, { error: 'Forbidden' });
  }

  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  if (!CLIENT_ID) return json(res, 500, { error: 'GOOGLE_CLIENT_ID not configured' });

  const REDIRECT = 'https://praxura.de/api/demo-booking/calendar-callback';

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
  });

  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  res.end();
}
