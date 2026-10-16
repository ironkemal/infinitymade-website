import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fahrtAnzeigeText, fahrtZweckUndZiel } from './fahrtenbuch-regeln.js';

const source = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
const start = source.indexOf('async function saveFahrtEndHandler()');
const handler = source.slice(start, source.indexOf('\n}\n', start) + 2);
const bookingId = '12345678-1111-4111-8111-111111111111';

function harness({ oldRow = null, lookupError = null } = {}) {
  const writes = [], reads = [];
  const booking = { id: bookingId, owner_id: 'owner', start_km: 100, lead_id: 'patient', fahrt_status: 'fahrt_return_pending' };
  const dom = { feStartKm: { value: '100' }, feEndKm: { value: '110' }, feError: { style: {} } };
  const supabase = { from(table) {
    const q = {
      select() { return this; }, eq() { return this; },
      update(payload) { writes.push({ table, kind: 'update', payload }); return this; },
      upsert(payload) { writes.push({ table, kind: 'upsert', payload }); return this; },
      maybeSingle() {
        reads.push(table);
        return Promise.resolve(table === 'fahrten' ? { data: oldRow, error: lookupError } : table === 'leads' ? { data: { id: 'patient', duration_min: 20 } } : { data: { id: bookingId } });
      },
      then(resolve) { resolve({ error: null }); },
    };
    return q;
  } };
  const context = vm.createContext({
    document: { getElementById: id => dom[id] }, supabase, bkActionBookingCache: booking,
    fahrtEndAktuell: b => b, fahrtAnzeigeText, fahrtZweckUndZiel,
    currentProfile: {}, currentSession: { user: { id: 'user' } },
    showToast() {}, closeModal() {}, fahrtEndAbschluss() {}, closeBkActionPanel() {}, switchPanel() {}, console,
  });
  vm.runInContext(handler + '\nglobalThis.save = saveFahrtEndHandler;', context);
  return { save: context.save, writes, reads, booking };
}

test('Trip reference lookup failure causes no booking update or trip write', async () => {
  const h = harness({ lookupError: new Error('synthetic lookup failure') });
  await h.save();
  assert.equal(h.writes.length, 0);
  assert.equal(h.booking.fahrt_status, 'fahrt_return_pending');
});

test('Trip completion preserves existing legacy reference and gives new rows full UUID reference', async () => {
  for (const oldRow of [null, { booking_id: bookingId, lead_id: 'patient', zweck: 'Patientenbesuch', zielort: 'Patientenbesuch (s. Verzeichnis Nr. P-12345678)' }]) {
    const h = harness({ oldRow });
    await h.save();
    const trip = h.writes.find(w => w.table === 'fahrten');
    assert.ok(trip);
    assert.equal(trip.payload.zielort, oldRow ? oldRow.zielort : 'Patientenbesuch (s. Verzeichnis Nr. P-12345678111141118111111111111111)');
    assert.equal(trip.payload.booking_id, bookingId);
    assert.equal(h.booking.fahrt_status, 'fahrt_completed');
  }
});
