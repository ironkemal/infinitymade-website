import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createBookingsFromRequestFactory } from './from-request.js';

const source = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const start = source.indexOf("app.post('/api/booking-request/approve'");
const code = source.slice(start, source.indexOf('// POST /api/booking-request/decline', start));

function fixture(rpcResult) {
  const writes = [], rpcCalls = [];
  let handler;
  const request = { id: 'request', owner_id: 'owner', employee_id: 'employee', updated_at: '2026-10-15T00:00:00Z', status: 'pending', preferred_date: '2026-11-01', preferred_time: '10:00', patients: { vorname: 'QA', nachname: 'Test' } };
  const supabase = {
    from(table) {
      const b = {
        select: () => b, eq: () => b,
        maybeSingle: async () => ({ data: table === 'profiles' ? { id: 'owner' } : request }),
        insert: () => { writes.push(table); throw new Error('Verbotener nichtatomarer Insert'); },
        update: () => { writes.push(table); throw new Error('Verbotenes nichtatomares Update'); },
      };
      return b;
    },
    rpc: async (name, args) => { rpcCalls.push({ name, args }); return rpcResult; },
  };
  const createBookingsFromRequest = createBookingsFromRequestFactory({
    supabase, berlinLocalToUTC: (date, time) => new Date(`${date}T${time}:00Z`),
    generateRecurringDates: () => [], getAvailableSlots: async () => ({ slots: ['10:00'] }),
  });
  vm.runInNewContext(code, {
    app: { post: (_path, _auth, _limiter, fn) => { handler = fn; } }, requireAuthAI: () => {}, bookingRequestApprovalLimiter: () => {},
    supabase, gehoertZurPraxis: async () => true, anfrageKorrekturenPruefen: async () => ({ aenderungen: {} }),
    createBookingsFromRequest, leadAusAnfrage: async () => 'lead-qa', console: { error: () => {} },
  });
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
  return { writes, rpcCalls, res, run: () => handler({ auth: { userId: 'owner' }, body: { request_id: 'request', owner_id: 'owner' } }, res) };
}

for (const errorCode of ['PGRST202', '42883']) {
  test(`fehlende atomare RPC ${errorCode}: 503 ohne Kalender-/Anfrage-Schreibzugriff`, async () => {
    const f = fixture({ error: { code: errorCode } }); await f.run();
    assert.equal(f.res.statusCode, 503); assert.equal(f.writes.length, 0);
  });
}
for (const errorCode of ['23P01', '40001']) {
  test(`Konflikt ${errorCode}: 409 ohne Bestätigung`, async () => {
    const f = fixture({ error: { code: errorCode } }); await f.run();
    assert.equal(f.res.statusCode, 409); assert.equal(f.writes.length, 0);
  });
}
test('Fehler im atomaren Anfrageupdate wird nicht als Erfolg gemeldet', async () => {
  const f = fixture({ error: { code: '23514', message: 'request update rejected' } }); await f.run();
  assert.equal(f.res.statusCode, 500); assert.equal(f.writes.length, 0);
});
for (const data of [null, {}, { booking_id: 'b', booking_ids: [] }]) {
  test(`leeres/unvollständiges RPC-Ergebnis ist kein Erfolg: ${JSON.stringify(data)}`, async () => {
    const f = fixture({ data }); await f.run(); assert.equal(f.res.statusCode, 500);
  });
}
test('Erfolg übernimmt ausschließlich IDs der atomaren RPC', async () => {
  const f = fixture({ data: { booking_id: 'persisted', booking_ids: ['persisted'], sessions_created: 1 } }); await f.run();
  assert.equal(f.res.statusCode, 200); assert.equal(f.res.body.booking_id, 'persisted');
  assert.equal(f.writes.length, 0); assert.equal(f.rpcCalls.length, 1);
  assert.equal(f.rpcCalls[0].args.p_actor_id, 'owner');
  assert.equal(f.rpcCalls[0].args.p_expected_updated_at, '2026-10-15T00:00:00Z');
  assert.equal(f.rpcCalls[0].args.p_bookings.length, 1);
});
