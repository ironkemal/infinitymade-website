import { getAuthedUser, adminFetch, json } from '../_lib/auth.js';

const ADMIN_UUID = 'a82285cb-48c8-4c6c-b346-5f97343e7691';

export default async function handler(req, res) {
  const { user, error: authErr } = await getAuthedUser(req);
  if (authErr || !user) return json(res, 401, { error: 'Unauthorized' });
  if (user.id !== ADMIN_UUID) return json(res, 403, { error: 'Forbidden' });

  if (req.method === 'GET') {
    const type = req.query?.type || 'all';
    if (type === 'stats') {
      const owners = await adminFetch('/profiles?select=id,plan,plan_status&role=eq.owner');
      const emps = await adminFetch('/profiles?select=id&role=eq.employee');
      const bookings = await adminFetch('/bookings?select=id,status');
      const fb = await adminFetch('/feedbacks?select=id');
      const trialCount = (owners.data||[]).filter(o=>o.plan_status==='trial').length;
      return json(res, 200, {
        totalOwners: (owners.data||[]).length,
        totalEmployees: (emps.data||[]).length,
        totalBookings: (bookings.data||[]).length,
        totalFeedbacks: (fb.data||[]).length,
        trialCount,
        starterCount: (owners.data||[]).filter(o=>o.plan==='starter').length,
        professionalCount: (owners.data||[]).filter(o=>o.plan==='professional').length,
        klinikCount: (owners.data||[]).filter(o=>o.plan==='klinik').length,
      });
    }
    if (type === 'customers') {
      const { data, status } = await adminFetch('/profiles?select=*,bookings(count),leads(count)&role=eq.owner&order=created_at.desc');
      if (!data) return json(res, status||500, { error: 'DB error' });
      return json(res, 200, { items: data });
    }
    if (type === 'bookings') {
      const { data, status } = await adminFetch('/bookings?select=*,profiles!bookings_owner_id_fkey(business_name,email)&order=start_time.desc&limit=100');
      if (!data) return json(res, status||500, { error: 'DB error' });
      return json(res, 200, { items: data });
    }
    return json(res, 400, { error: 'Unknown type' });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
