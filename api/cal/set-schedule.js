// POST /api/cal/set-schedule
// Auth: Bearer <supabase_user_jwt>
// Cal.com v2: POST /v2/schedules

import { getAuthedUser, adminFetch, getBusinessSecret, json } from '../_lib/auth.js';

const CAL_API_VERSION = '2024-06-11';

const DAY_NAMES = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday'
};

function buildAvailability(workingHours) {
  // Cal.com v2 schedule.availability:
  // [{ days: ["Monday","Tuesday"], startTime: "09:00", endTime: "18:00" }]
  const buckets = new Map();
  for (const [dayKey, h] of Object.entries(workingHours || {})) {
    if (!h || h.closed) continue;
    const key = `${h.open || '09:00'}-${h.close || '18:00'}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(DAY_NAMES[dayKey]);
  }
  return [...buckets.entries()].map(([range, days]) => {
    const [start, end] = range.split('-');
    return { days, startTime: start, endTime: end };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { user, error: authErr } = await getAuthedUser(req);
  if (!user) return json(res, 401, { error: authErr });
  const userId = user.id;

  const { ok: pOk, data: profileRows } = await adminFetch(
    `/profiles?id=eq.${userId}&select=business_name,cal_username,working_hours`
  );
  if (!pOk || !profileRows?.[0]) return json(res, 404, { error: 'Profile not found' });
  const { business_name, cal_username, working_hours } = profileRows[0];
  if (!cal_username) return json(res, 400, { error: 'cal_username not configured' });

  const apiKey = await getBusinessSecret(userId, 'cal_api_key');
  if (!apiKey) return json(res, 400, { error: 'Cal.com API key not configured' });

  const availability = buildAvailability(working_hours);
  if (!availability.length) return json(res, 400, { error: 'No working hours configured' });

  const scheduleBody = {
    name: `${business_name || cal_username} — Hours`,
    timeZone: 'Europe/Berlin',
    isDefault: true,
    availability,
  };

  const schedRes = await fetch('https://api.cal.com/v2/schedules', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'cal-api-version': CAL_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(scheduleBody),
  });

  if (!schedRes.ok) {
    const text = await schedRes.text();
    return json(res, 500, {
      ok: false,
      error: `Cal.com rejected schedule (HTTP ${schedRes.status})`,
      detail: text.slice(0, 300),
    });
  }

  const schedData = await schedRes.json();
  const scheduleId = schedData?.data?.id || schedData?.schedule?.id || schedData?.id;

  return json(res, 200, {
    ok: true,
    scheduleId,
    days: availability,
  });
}
