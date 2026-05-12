import { getAuthedUser, adminFetch, json } from '../_lib/auth.js';

const ADMIN_UUID = 'a82285cb-48c8-4c6c-b346-5f97343e7691';

export default async function handler(req, res) {
  const { user, error: authErr } = await getAuthedUser(req);
  if (authErr || !user) return json(res, 401, { error: 'Unauthorized' });
  if (user.id !== ADMIN_UUID) return json(res, 403, { error: 'Forbidden' });

  if (req.method === 'GET') {
    const { ok, data, status } = await adminFetch('/feedbacks?select=*,profiles(email,business_name)&order=created_at.desc');
    if (!ok) return json(res, status || 500, { error: 'DB error', details: data });
    return json(res, 200, { items: data || [] });
  }

  if (req.method === 'PATCH') {
    const { id, status: st, priority, admin_notes } = req.body || {};
    if (!id) return json(res, 400, { error: 'id required' });
    const payload = {};
    if (st !== undefined) payload.status = st;
    if (priority !== undefined) payload.priority = priority;
    if (admin_notes !== undefined) payload.admin_notes = admin_notes;
    const { ok, data, status: s } = await adminFetch(`/feedbacks?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!ok) return json(res, s || 500, { error: 'Update failed', details: data });
    return json(res, 200, { updated: data });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
