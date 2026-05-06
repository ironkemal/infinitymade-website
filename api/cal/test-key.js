// POST /api/cal/test-key
// Body: { apiKey, username }
// Returns: { ok, username, email } or { ok:false, error }
//
// Cal.com v2 API (v1 is deprecated as of 2024). Auth via Bearer header.

import { json } from '../_lib/auth.js';

const CAL_API_VERSION = '2024-08-13';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const { apiKey, username } = req.body || {};
  if (!apiKey) return json(res, 400, { error: 'apiKey required' });

  try {
    const r = await fetch('https://api.cal.com/v2/me', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'cal-api-version': CAL_API_VERSION,
      },
    });

    if (!r.ok) {
      const text = await r.text();
      return json(res, 200, {
        ok: false,
        error: `Cal.com rejected the key (HTTP ${r.status})`,
        detail: text.slice(0, 200),
      });
    }

    const data = await r.json();
    // v2 wraps result: { status: "success", data: { id, username, email, ... } }
    const me = data?.data || data;
    const apiUsername = me?.username;
    const apiEmail = me?.email;

    if (username && apiUsername && apiUsername.toLowerCase() !== username.toLowerCase()) {
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
