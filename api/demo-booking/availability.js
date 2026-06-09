import { adminFetch, json } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json(res, 400, { error: 'Invalid date' });
  }

  try {
    const { ok, data } = await adminFetch(
      `/demo_bookings?select=booking_time&booking_date=eq.${date}&status=eq.confirmed`
    );
    const bookedTimes = ok && Array.isArray(data) ? data.map(r => r.booking_time) : [];
    return json(res, 200, { bookedTimes });
  } catch (e) {
    console.error('[demo-booking/availability] error', e);
    return json(res, 200, { bookedTimes: [] });
  }
}
