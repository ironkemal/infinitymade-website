// POST /api/cal/test-key
// Body: { apiKey, username }
// Returns: { ok, username, email } or { ok:false, error }
//
// Used during onboarding to validate Cal.com API key without exposing
// the key to the browser (Cal.com may also block CORS).

import { json } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const { apiKey, username } = req.body || {};
  if (!apiKey) return json(res, 400, { error: 'apiKey required' });

  try {
    const r = await fetch(`https://api.cal.com/v1/me?apiKey=${encodeURIComponent(apiKey)}`);
    if (!r.ok) {
      const text = await r.text();
      return json(res, 200, {
        ok: false,
        error: `Cal.com rejected the key (HTTP ${r.status})`,
        detail: text.slice(0, 200),
      });
    }
    const data = await r.json();
    const apiUsername = data.user?.username || data.username;
    const apiEmail = data.user?.email || data.email;

    if (username && apiUsername && apiUsername !== username) {
      return json(res, 200, {
        ok: false,
        error: `Username mismatch — API key belongs to "${apiUsername}", not "${username}"`,
        apiUsername,
      });
    }

    return json(res, 200, {
      ok: true,
      username: apiUsername,
      email: apiEmail,
    });
  } catch (err) {
    return json(res, 500, { ok: false, error: err.message });
  }
}
