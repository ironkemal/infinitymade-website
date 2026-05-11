import { getAuthedUser, json } from '../_lib/auth.js';

const APIFY_TOKEN = process.env.APIFY_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { user, error: authErr } = await getAuthedUser(req);
  if (!user) return json(res, 401, { error: authErr });

  if (!APIFY_TOKEN) return json(res, 500, { error: 'Apify token not configured' });

  const { query, limit, language, countryCode } = req.body || {};
  if (!query) return json(res, 400, { error: 'Query is required' });

  const max = Math.min(parseInt(limit, 10) || 20, 100);
  const lang = language || 'de';
  const country = countryCode || 'de';

  try {
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchStringsArray: [query],
          maxCrawledPlacesPerSearch: max,
          language: lang,
          countryCode: country,
          scrapeContacts: true,
          skipClosedPlaces: true,
        }),
      }
    );

    if (!apifyRes.ok) {
      const errText = await apifyRes.text().catch(() => '');
      return json(res, 502, { error: `Apify HTTP ${apifyRes.status}: ${errText.slice(0, 200)}` });
    }

    const items = await apifyRes.json();
    if (!Array.isArray(items)) {
      return json(res, 502, { error: 'Unexpected Apify response' });
    }

    return json(res, 200, { items });
  } catch (e) {
    return json(res, 500, { error: e.message || 'Apify request failed' });
  }
}
