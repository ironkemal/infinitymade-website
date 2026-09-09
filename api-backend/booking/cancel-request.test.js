import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { cancelRequestBookings } from './cancel-request.js';

function fixture({ failBooking = false, failRequest = false, missingBooking = false } = {}) {
  const calls = [];
  const sb = createClient('https://test.invalid', 'test-key', { auth: { persistSession: false }, global: {
    fetch: async (url, init) => {
      const u = new URL(url);
      const table = u.pathname.split('/').at(-1);
      calls.push(table);
      assert.equal(init.method, 'PATCH');
      assert.equal(u.searchParams.get('owner_id'), 'eq.praxis');
      assert.deepEqual(JSON.parse(init.body), { status: 'cancelled' });
      if ((table === 'bookings' && failBooking) || (table === 'booking_requests' && failRequest)) {
        return new Response(JSON.stringify({ message: 'Testfehler', code: '23514' }), { status: 400 });
      }
      if (table === 'bookings') {
        assert.equal(u.searchParams.get('id'), 'in.(erst,folge)');
        return new Response(JSON.stringify(missingBooking ? [] : [{ id: 'erst' }, { id: 'folge' }]));
      }
      return new Response(null, { status: 204 });
    },
  } });
  return { sb, calls };
}
const request = { id: 'anfrage', owner_id: 'praxis', booking_id: 'erst', booking_ids: ['folge', 'erst'] };

test('Patientenlink sagt alle Serientermine ab, bevor die Anfrage quittiert wird', async () => {
  const { sb, calls } = fixture();
  await cancelRequestBookings(sb, request);
  assert.deepEqual(calls, ['bookings', 'booking_requests']);
});

test('Terminfehler und fehlende Berechtigung quittieren die Anfrage nicht', async () => {
  for (const options of [{ failBooking: true }, { missingBooking: true }]) {
    const { sb, calls } = fixture(options);
    await assert.rejects(cancelRequestBookings(sb, request));
    assert.deepEqual(calls, ['bookings']);
  }
});

test('Fehler beim Quittieren bleibt sichtbar und kann erneut versucht werden', async () => {
  const { sb, calls } = fixture({ failRequest: true });
  await assert.rejects(cancelRequestBookings(sb, request));
  assert.deepEqual(calls, ['bookings', 'booking_requests']);
});
