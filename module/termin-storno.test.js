import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storniereTermin } from './termin-storno.js';
import { aktiveSitzungszeilen } from './sitzung-aktiv.js';

test('Absage sendet PATCH mit Status und Grund; derselbe Termin bleibt erhalten', async () => {
  let request;
  const result = await storniereTermin({ apiBase: '/api', token: 'test-token', bookingId: 'termin-1', reason: '  Krank  ',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ booking: { id: 'termin-1', status: 'cancelled' } }) };
    },
  });
  assert.equal(request.url, '/api/booking/termin-1');
  assert.equal(request.options.method, 'PATCH');
  assert.equal(request.options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(request.options.body), { status: 'cancelled', cancellation_reason: 'Krank' });
  assert.equal(result.id, 'termin-1');
});

test('ohne Anmeldung wird kein Request gesendet', async () => {
  await assert.rejects(storniereTermin({ token: null, bookingId: '1', fetchImpl: () => assert.fail('kein Request') }), /anmelden/);
});

test('Fehler oder nicht bestätigte Absage werden niemals als Erfolg gemeldet', async () => {
  for (const response of [
    { ok: false, body: { error: 'Sitzung bereits erledigt' } },
    { ok: true, body: { booking: { id: '1', status: 'confirmed' } } },
    { ok: true, body: { booking: { id: 'anderer', status: 'cancelled' } } },
  ]) {
    await assert.rejects(storniereTermin({ token: 't', bookingId: '1', fetchImpl: async () => ({
      ok: response.ok, json: async () => response.body,
    }) }));
  }
});

test('geplante freigegebene Einheit ist unvergeben, abgesagte Zuordnungen sind nicht aktiv', () => {
  const rows = [
    { id: 'frei', status: 'planned', booking_id: null },
    { id: 'aktiv', status: 'planned', booking_id: 'a', bookings: { status: 'confirmed' } },
    { id: 'alt-storno', status: 'planned', booking_id: 'b', bookings: { status: 'cancelled' } },
    { id: 'sitzung-storno', status: 'cancelled', booking_id: 'c' },
    { id: 'no-show', status: 'no_show', booking_id: 'd', bookings: { status: 'no_show' } },
  ];
  const active = aktiveSitzungszeilen(rows);
  assert.deepEqual(active.filter(s => !s.booking_id).map(s => s.id), ['frei']);
  assert.deepEqual(active.filter(s => s.booking_id).map(s => s.id), ['aktiv', 'no-show']);
});
