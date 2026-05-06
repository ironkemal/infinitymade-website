// POST /api/cal/create-event-types
// Auth: Bearer <supabase_user_jwt>
// Cal.com v2: POST /v2/event-types with Bearer auth.

import { getAuthedUser, adminFetch, getBusinessSecret, json } from '../_lib/auth.js';

const CAL_API_VERSION = '2024-06-14';

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { user, error: authErr } = await getAuthedUser(req);
  if (!user) return json(res, 401, { error: authErr });

  const userId = user.id;

  const { ok: pOk, data: profileRows } = await adminFetch(
    `/profiles?id=eq.${userId}&select=business_name,cal_username`
  );
  if (!pOk || !profileRows?.[0]) return json(res, 404, { error: 'Profile not found' });
  const { business_name, cal_username } = profileRows[0];
  if (!cal_username) return json(res, 400, { error: 'cal_username not configured' });

  const apiKey = await getBusinessSecret(userId, 'cal_api_key');
  if (!apiKey) return json(res, 400, { error: 'Cal.com API key not configured' });

  const { ok: sOk, data: services } = await adminFetch(
    `/business_services?business_id=eq.${userId}&is_active=eq.true&select=*`
  );
  if (!sOk) return json(res, 500, { error: 'Could not load services' });
  if (!services?.length) return json(res, 200, { ok: true, created: 0, message: 'No services to provision' });

  const businessSlug = slugify(business_name || cal_username);
  const results = [];

  for (const svc of services) {
    if (svc.cal_event_type_id) {
      results.push({ id: svc.id, status: 'skip', reason: 'already has event_type_id' });
      continue;
    }

    const slug = `${businessSlug}-${slugify(svc.name)}`.slice(0, 80);
    const body = {
      title: svc.name,
      slug,
      lengthInMinutes: svc.duration_minutes || 30,
      description: svc.description || '',
      hidden: true,
    };

    const calRes = await fetch('https://api.cal.com/v2/event-types', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'cal-api-version': CAL_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!calRes.ok) {
      const text = await calRes.text();
      results.push({ id: svc.id, status: 'fail', error: `${calRes.status}: ${text.slice(0, 160)}` });
      continue;
    }
    const calData = await calRes.json();
    const eventTypeId = calData?.data?.id || calData?.event_type?.id || calData?.id;

    if (eventTypeId) {
      await adminFetch(
        `/business_services?id=eq.${svc.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ cal_event_type_id: String(eventTypeId) }),
        }
      );
      results.push({ id: svc.id, status: 'ok', eventTypeId });
    } else {
      results.push({ id: svc.id, status: 'fail', error: 'No event_type_id in Cal response' });
    }
  }

  const okCount = results.filter(r => r.status === 'ok').length;
  return json(res, 200, {
    ok: true,
    created: okCount,
    total: results.length,
    results,
  });
}
