import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as guards from './public-guards.js';
import * as authGuards from './auth-guards.js';
import * as backendSeries from './series.js';
import * as frontendSeries from '../../module/serien-termine.js';

const serverSrc = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const extract = (s, e) => {
  const startIdx = serverSrc.indexOf(s);
  const endIdx = serverSrc.indexOf(e, startIdx);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Failed to extract hunk: ${s} ... ${e}`);
  }
  return serverSrc.slice(startIdx, endIdx);
};

const batchCreateCode = extract("app.post('/api/booking/batch-create'", '// ---- Feedback-NLU für den KI-Serien-Retry');
const explicitCode = extract("app.post('/api/booking/batch-create-explicit'", '// 6. Manual Booking (From Admin Panel)');
const manualCode = extract("app.post('/api/booking/manual-create'", '// 6b. Update Booking — status, reschedule');
const patchCode = extract("app.patch('/api/booking/:id'", '// --- Phase 2: AI-driven Rezept-Workflow ---');

let batchCreateHandler, explicitHandler, manualHandler, patchHandler;
let currentDb;

const mockSupabase = {
  from(table) {
    let filters = {}, writeOp = null;
    const b = {
      select: () => b,
      eq: (col, val) => { filters[col] = val; return b; },
      insert: (p) => {
        writeOp = { type: 'insert', payload: p };
        const rows = Array.isArray(p) ? p : [p];
        for (const r of rows) {
          const inserted = { id: r.id || 'BK_' + (currentDb.writes.length + 1), ...r };
          currentDb.writes.push({ table, op: 'insert', data: inserted });
          if (!currentDb.tables[table]) currentDb.tables[table] = [];
          currentDb.tables[table].push(inserted);
        }
        return b;
      },
      update: (u) => {
        writeOp = { type: 'update', payload: u };
        return b;
      },
      maybeSingle: () => b.then((res) => {
        if (writeOp && writeOp.type === 'update') {
          // If no rows matched update, maybeSingle returns null data
          const list = currentDb.tables[table] || [];
          const matched = list.filter(r => Object.entries(filters).every(([k, v]) => r[k] === v));
          if (matched.length === 0) return { data: null, error: null };
        }
        return res;
      }),
      single: () => b.then((res) => {
        if (writeOp && writeOp.type === 'update') {
          const list = currentDb.tables[table] || [];
          const matched = list.filter(r => Object.entries(filters).every(([k, v]) => r[k] === v));
          if (matched.length === 0) {
            return { data: null, error: { code: 'PGRST116', message: 'No rows' } };
          }
        }
        return res;
      }),
      then: (resolve) => {
        if (currentDb.error) {
          const out = { data: null, error: currentDb.error };
          return resolve ? resolve(out) : Promise.resolve(out);
        }
        if (writeOp) {
          if (writeOp.type === 'insert') {
            const last = currentDb.writes[currentDb.writes.length - 1]?.data || { id: 'BK' };
            const out = { data: last, error: null };
            return resolve ? resolve(out) : Promise.resolve(out);
          }
          if (writeOp.type === 'update') {
            const list = currentDb.tables[table] || [];
            let updatedRow = null;
            for (let i = 0; i < list.length; i++) {
              if (Object.entries(filters).every(([k, v]) => list[i][k] === v)) {
                list[i] = { ...list[i], ...writeOp.payload };
                updatedRow = list[i];
                currentDb.writes.push({ table, op: 'update', data: updatedRow });
                break;
              }
            }
            const out = updatedRow
              ? { data: updatedRow, error: null }
              : { data: null, error: null };
            return resolve ? resolve(out) : Promise.resolve(out);
          }
        }
        currentDb.reads++;
        const list = currentDb.tables[table] || [];
        const match = list.find(r => Object.entries(filters).every(([k, v]) => r[k] === v)) || null;
        const out = { data: match, error: null };
        return resolve ? resolve(out) : Promise.resolve(out);
      }
    };
    return b;
  }
};

const ctx = vm.createContext({
  ...guards,
  ...authGuards,
  ...backendSeries,
  pruefeLeadId: async (leadId, ownerId) => {
    if (!leadId) return null;
    const { data } = await mockSupabase.from('leads').select('id').eq('id', leadId).eq('owner_id', ownerId).maybeSingle();
    return data?.id || null;
  },
  berlinLocalToUTC: (d, t) => new Date(`${d}T${t || '00:00'}:00Z`),
  berlinDayOfWeek: backendSeries.wochentag,
  app: {
    post(path, ...m) {
      const fn = m[m.length - 1];
      if (path === '/api/booking/batch-create') batchCreateHandler = fn;
      if (path === '/api/booking/batch-create-explicit') explicitHandler = fn;
      if (path === '/api/booking/manual-create') manualHandler = fn;
    },
    patch(path, ...m) {
      const fn = m[m.length - 1];
      if (path === '/api/booking/:id') patchHandler = fn;
    }
  },
  requireAuthAI: (req, res, next) => next?.(),
  supabase: mockSupabase,
  console, Date, Error, Math, parseInt, parseFloat, String, Number, Boolean, Object, Array, Promise, JSON, Set, Buffer
});

vm.runInContext(batchCreateCode, ctx);
vm.runInContext(explicitCode, ctx);
vm.runInContext(manualCode, ctx);
vm.runInContext(patchCode, ctx);

const F = {
  owner: { id: 'O', role: 'owner', owner_id: null, is_active: true, email: 'owner@praxura.de', business_name: 'Praxis O' },
  foreignOwner: { id: 'FO', role: 'owner', owner_id: null, is_active: true, email: 'foreign@praxura.de', business_name: 'Praxis Foreign' },
  therapist: { id: 'T', role: 'employee', owner_id: 'O', is_active: true },
  inactiveTherapist: { id: 'TI', role: 'employee', owner_id: 'O', is_active: false },
  foreignTherapist: { id: 'FT', role: 'employee', owner_id: 'FO', is_active: true },
  service: { id: 'S', title: 'Physiotherapie', duration_minutes: 30, price: '50', owner_id: 'O', is_internal: false },
  internalService: { id: 'SI', title: 'Blanko PD', duration_minutes: 45, price: '60', owner_id: 'O', is_internal: true },
  legacyServiceUserIdOnly: { id: 'SL', title: 'Alte Leistung', duration_minutes: 20, price: '30', user_id: 'O', owner_id: null, is_internal: false },
  foreignService: { id: 'FS', title: 'Fremde Leistung', duration_minutes: 30, price: '50', owner_id: 'FO', is_internal: false },
  lead: { id: 'L', owner_id: 'O' },
  booking: { id: 'B1', owner_id: 'O', user_id: 'T', service_id: 'S', status: 'confirmed', start_time: '2026-10-20T10:00:00Z', end_time: '2026-10-20T10:30:00Z' },
  foreignBooking: { id: 'FB1', owner_id: 'FO', user_id: 'FT', service_id: 'FS', status: 'confirmed', start_time: '2026-10-20T10:00:00Z', end_time: '2026-10-20T10:30:00Z' }
};

function resetDb(overrides = {}) {
  currentDb = {
    tables: {
      profiles: [F.owner, F.foreignOwner, F.therapist, F.inactiveTherapist, F.foreignTherapist],
      services: [F.service, F.internalService, F.legacyServiceUserIdOnly, F.foreignService],
      leads: [F.lead],
      bookings: [JSON.parse(JSON.stringify(F.booking)), JSON.parse(JSON.stringify(F.foreignBooking))],
      ...overrides.tables
    },
    writes: [],
    reads: 0,
    error: overrides.error || null
  };
}

const mockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; }
  };
  return res;
};

const authReq = (body = {}, tenantId = 'O', params = {}) => ({
  auth: { tenantId },
  body,
  params
});

describe('Authenticated Booking Security Guards Suite (K4)', () => {
  beforeEach(() => resetDb());

  describe('Foreign and Inactive Therapist Validation', () => {
    it('manual-create rejects foreign therapist with 400 and zero writes', async () => {
      const res = mockRes();
      await manualHandler(authReq({
        employeeId: 'FT',
        start_time: '2026-10-20T10:00:00Z',
        end_time: '2026-10-20T10:30:00Z'
      }, 'O'), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.error, 'Ungültiger Therapeut');
      assert.equal(currentDb.writes.length, 0);
    });

    it('manual-create rejects inactive therapist with 400 and zero writes', async () => {
      const res = mockRes();
      await manualHandler(authReq({
        employeeId: 'TI',
        start_time: '2026-10-20T10:00:00Z',
        end_time: '2026-10-20T10:30:00Z'
      }, 'O'), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.error, 'Therapeut nicht verfügbar');
      assert.equal(currentDb.writes.length, 0);
    });

    it('batch-create rejects foreign therapist with 400 and zero writes', async () => {
      const res = mockRes();
      await batchCreateHandler(authReq({
        userId: 'FT',
        startDate: '2026-10-20',
        time: '10:00',
        count: 2
      }, 'O'), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.error, 'Ungültiger Therapeut');
      assert.equal(currentDb.writes.length, 0);
    });

    it('batch-create rejects inactive therapist with 400 and zero writes', async () => {
      const res = mockRes();
      await batchCreateHandler(authReq({
        userId: 'TI',
        startDate: '2026-10-20',
        time: '10:00',
        count: 2
      }, 'O'), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.error, 'Therapeut nicht verfügbar');
      assert.equal(currentDb.writes.length, 0);
    });

    it('batch-create-explicit rejects foreign therapist in any slot with 400 and zero writes', async () => {
      const res = mockRes();
      await explicitHandler(authReq({
        slots: [
          { date: '2026-10-20', time: '10:00', employeeId: 'T' },
          { date: '2026-10-27', time: '10:00', employeeId: 'FT' }
        ]
      }, 'O'), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.error, 'Ungültiger Therapeut');
      assert.equal(currentDb.writes.length, 0);
    });

    it('batch-create-explicit rejects inactive therapist in any slot with 400 and zero writes', async () => {
      const res = mockRes();
      await explicitHandler(authReq({
        slots: [
          { date: '2026-10-20', time: '10:00', employeeId: 'TI' }
        ]
      }, 'O'), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.error, 'Therapeut nicht verfügbar');
      assert.equal(currentDb.writes.length, 0);
    });
  });

  describe('Foreign Service and Internal Service Validation', () => {
    it('manual-create rejects foreign service with 400 and zero writes', async () => {
      const res = mockRes();
      await manualHandler(authReq({
        employeeId: 'T',
        serviceId: 'FS',
        start_time: '2026-10-20T10:00:00Z',
        end_time: '2026-10-20T10:30:00Z'
      }, 'O'), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.error, 'Service not found');
      assert.equal(currentDb.writes.length, 0);
    });

    it('batch-create rejects foreign service with 400 and zero writes', async () => {
      const res = mockRes();
      await batchCreateHandler(authReq({
        userId: 'T',
        serviceId: 'FS',
        startDate: '2026-10-20',
        time: '10:00',
        count: 2
      }, 'O'), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.error, 'Service not found');
      assert.equal(currentDb.writes.length, 0);
    });

    it('batch-create-explicit rejects foreign service with 400 and zero writes', async () => {
      const res = mockRes();
      await explicitHandler(authReq({
        serviceId: 'FS',
        slots: [{ date: '2026-10-20', time: '10:00', employeeId: 'T' }]
      }, 'O'), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.error, 'Service not found');
      assert.equal(currentDb.writes.length, 0);
    });

    it('allows internal services (is_internal: true) on all authenticated endpoints', async () => {
      // 1. manual-create with internal service
      const resManual = mockRes();
      await manualHandler(authReq({
        employeeId: 'T',
        serviceId: 'SI',
        start_time: '2026-10-20T10:00:00Z',
        end_time: '2026-10-20T10:45:00Z'
      }, 'O'), resManual);
      assert.equal(resManual.statusCode, 200);
      assert.equal(currentDb.writes.length, 1);
      assert.equal(currentDb.writes[0].data.service_id, 'SI');

      // 2. batch-create with internal service
      const resBatch = mockRes();
      await batchCreateHandler(authReq({
        userId: 'T',
        serviceId: 'SI',
        startDate: '2026-10-21',
        time: '11:00',
        count: 2
      }, 'O'), resBatch);
      assert.equal(resBatch.statusCode, 200);
      assert.equal(resBatch.body.count, 2);

      // 3. batch-create-explicit with internal service
      const resExplicit = mockRes();
      await explicitHandler(authReq({
        serviceId: 'SI',
        slots: [{ date: '2026-10-22', time: '12:00', employeeId: 'T' }]
      }, 'O'), resExplicit);
      assert.equal(resExplicit.statusCode, 200);
      assert.equal(resExplicit.body.count, 1);
    });

    it('resolves canonical ownership via actual services.user_id when owner_id is null', async () => {
      const res = mockRes();
      await manualHandler(authReq({
        employeeId: 'T',
        serviceId: 'SL',
        start_time: '2026-10-20T10:00:00Z',
        end_time: '2026-10-20T10:20:00Z'
      }, 'O'), res);
      assert.equal(res.statusCode, 200);
      assert.equal(currentDb.writes[0].data.service_id, 'SL');
    });
  });

  describe('Owner-Self as Target Employee', () => {
    it('owner role profile itself (id === canonicalOwnerId) succeeds as employee target', async () => {
      const resManual = mockRes();
      await manualHandler(authReq({
        employeeId: 'O', // owner treating themselves as employee
        serviceId: 'S',
        start_time: '2026-10-20T10:00:00Z',
        end_time: '2026-10-20T10:30:00Z'
      }, 'O'), resManual);
      assert.equal(resManual.statusCode, 200);
      assert.equal(currentDb.writes[0].data.user_id, 'O');

      const resBatch = mockRes();
      await batchCreateHandler(authReq({
        userId: 'O',
        serviceId: 'S',
        startDate: '2026-10-21',
        time: '10:00',
        count: 1
      }, 'O'), resBatch);
      assert.equal(resBatch.statusCode, 200);
      assert.equal(resBatch.body.count, 1);
    });
  });

  describe('Invalid Count and Dates & Recurrence', () => {
    it('batch-create rejects count < 1, count > 52, missing params, invalid date with 400 and zero writes', async () => {
      for (const invalidBody of [
        { userId: 'T', startDate: '2026-10-20', time: '10:00', count: 0 },
        { userId: 'T', startDate: '2026-10-20', time: '10:00', count: 53 },
        { userId: 'T', startDate: '', time: '10:00', count: 2 },
        { userId: 'T', startDate: 'not-a-date', time: '10:00', count: 2 },
        { userId: '', startDate: '2026-10-20', time: '10:00', count: 2 },
        // Calendar rollover (Feb 30)
        { userId: 'T', startDate: '2026-02-30', time: '10:00', count: 2 },
        // Fractional count (1.5)
        { userId: 'T', startDate: '2026-10-20', time: '10:00', count: 1.5 },
        { userId: 'T', startDate: '2026-10-20', time: '10:00', count: '1.5' },
        // Invalid weekdays
        { userId: 'T', startDate: '2026-10-20', time: '10:00', count: 2, weekdays: [99, -5] }
      ]) {
        const res = mockRes();
        await batchCreateHandler(authReq(invalidBody, 'O'), res);
        assert.equal(res.statusCode, 400);
        assert.equal(currentDb.writes.length, 0);
      }
    });

    it('batch-create handler with recurrence biweekly and no intervalDays writes dates 14 days apart', async () => {
      const res = mockRes();
      await batchCreateHandler(authReq({
        userId: 'T',
        startDate: '2026-10-14',
        time: '10:00',
        count: 3,
        recurrence: 'biweekly',
        weekdays: [3]
      }, 'O'), res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 3);
      const writtenDates = currentDb.writes.filter(w => w.table === 'bookings').map(w => w.data.start_time.substring(0, 10));
      assert.deepEqual(writtenDates, ['2026-10-14', '2026-10-28', '2026-11-11']);
    });
  });

  describe('PATCH /api/booking/:id Security & 404', () => {
    it('PATCH missing booking returns 404 via maybeSingle (not 500)', async () => {
      const res = mockRes();
      await patchHandler(authReq({ status: 'cancelled' }, 'O', { id: 'NON_EXISTENT' }), res);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body?.error, 'Buchung nicht gefunden oder keine Berechtigung.');
      assert.equal(currentDb.writes.length, 0);
    });

    it('PATCH foreign booking returns 404 via maybeSingle (not 500)', async () => {
      const res = mockRes();
      await patchHandler(authReq({ status: 'cancelled' }, 'O', { id: 'FB1' }), res);
      assert.equal(res.statusCode, 404);
      assert.equal(res.body?.error, 'Buchung nicht gefunden oder keine Berechtigung.');
      assert.equal(currentDb.writes.length, 0);
    });

    it('PATCH accepts status/time updates only, ignoring foreign/malicious body fields', async () => {
      const res = mockRes();
      await patchHandler(authReq({
        status: 'cancelled',
        cancellation_reason: 'Patient krank',
        owner_id: 'ATTACKER',
        user_id: 'ATTACKER'
      }, 'O', { id: 'B1' }), res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      const updated = currentDb.tables.bookings.find(b => b.id === 'B1');
      assert.equal(updated.status, 'cancelled');
      assert.equal(updated.cancellation_reason, 'Patient krank');
      assert.equal(updated.owner_id, 'O');
      assert.equal(updated.user_id, 'T');
    });

    it('PATCH allows cancel and completed on historical bookings with inactive owned therapist', async () => {
      // Modify booking B1 to reference inactive owned therapist TI
      currentDb.tables.bookings[0].user_id = 'TI';
      const resCancel = mockRes();
      await patchHandler(authReq({ status: 'cancelled', cancellation_reason: 'Historisch storniert' }, 'O', { id: 'B1' }), resCancel);
      assert.equal(resCancel.statusCode, 200);
      assert.equal(resCancel.body.success, true);
      assert.equal(currentDb.tables.bookings[0].status, 'cancelled');

      const resComplete = mockRes();
      await patchHandler(authReq({ status: 'completed' }, 'O', { id: 'B1' }), resComplete);
      assert.equal(resComplete.statusCode, 200);
      assert.equal(resComplete.body.success, true);
      assert.equal(currentDb.tables.bookings[0].status, 'completed');
    });

    it('PATCH rejects existing booking if referencing foreign therapist', async () => {
      // Modify booking B1 to reference foreign therapist FT
      currentDb.tables.bookings[0].user_id = 'FT';
      const res = mockRes();
      await patchHandler(authReq({ status: 'cancelled' }, 'O', { id: 'B1' }), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.error, 'Ungültiger Therapeut');
      assert.equal(currentDb.writes.length, 0);
    });

    it('PATCH rejects existing booking if referencing foreign service', async () => {
      // Modify booking B1 to reference foreign service FS
      currentDb.tables.bookings[0].service_id = 'FS';
      const res = mockRes();
      await patchHandler(authReq({ status: 'cancelled' }, 'O', { id: 'B1' }), res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body?.error, 'Service not found');
      assert.equal(currentDb.writes.length, 0);
    });

    it('PATCH returns 400 when no updatable fields provided', async () => {
      const res = mockRes();
      await patchHandler(authReq({}, 'O', { id: 'B1' }), res);
      assert.equal(res.statusCode, 400);
      assert.equal(currentDb.writes.length, 0);
    });
  });

  describe('Genuine Database Error 500', () => {
    it('database error 500 returns Interner Serverfehler with zero writes', async () => {
      resetDb({ error: new Error('Postgres connection pool exhausted') });

      const resManual = mockRes();
      await manualHandler(authReq({ employeeId: 'T', start_time: '2026-10-20T10:00:00Z', end_time: '2026-10-20T10:30:00Z' }, 'O'), resManual);
      assert.equal(resManual.statusCode, 500);
      assert.equal(resManual.body?.error, 'Interner Serverfehler');
      assert.equal(currentDb.writes.length, 0);

      const resBatch = mockRes();
      await batchCreateHandler(authReq({ userId: 'T', startDate: '2026-10-20', time: '10:00', count: 2 }, 'O'), resBatch);
      assert.equal(resBatch.statusCode, 500);
      assert.equal(resBatch.body?.error, 'Interner Serverfehler');
      assert.equal(currentDb.writes.length, 0);

      const resPatch = mockRes();
      await patchHandler(authReq({ status: 'cancelled' }, 'O', { id: 'B1' }), resPatch);
      assert.equal(resPatch.statusCode, 500);
      assert.equal(resPatch.body?.error, 'Interner Serverfehler');
      assert.equal(currentDb.writes.length, 0);
    });
  });

  describe('Frontend/Backend Series Date Parity', () => {
    it('confirmed bug parity: start 2026-10-14 (Mi) chosen [1] (Mo) produces 2026-10-19 (never 2026-10-12)', () => {
      const fe = frontendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 2, intervalDays: 7, wochentage: [1] });
      const be = backendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 2, intervalDays: 7, wochentage: [1] });
      assert.deepEqual(fe, ['2026-10-19', '2026-10-26']);
      assert.deepEqual(fe, be);
      assert.ok(be.every(d => d >= '2026-10-14'), 'Kein Termin vor Startdatum');
    });

    it('weekly, daily, biweekly and custom interval parity', () => {
      // Weekly
      const feWeekly = frontendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 3, intervalDays: 7, wochentage: [3] });
      const beWeekly = backendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 3, intervalDays: 7, wochentage: [3] });
      assert.deepEqual(feWeekly, beWeekly);
      assert.deepEqual(beWeekly, ['2026-10-14', '2026-10-21', '2026-10-28']);

      // Daily
      const feDaily = frontendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 4, taeglich: true });
      const beDaily = backendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 4, taeglich: true });
      assert.deepEqual(feDaily, beDaily);
      assert.deepEqual(beDaily, ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']);

      // Biweekly
      const feBiweekly = frontendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 3, intervalDays: 14, wochentage: [3] });
      const beBiweekly = backendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 3, intervalDays: 14, wochentage: [3] });
      assert.deepEqual(feBiweekly, beBiweekly);
      assert.deepEqual(beBiweekly, ['2026-10-14', '2026-10-28', '2026-11-11']);

      // Custom interval (21 days)
      const feCustom = frontendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 3, intervalDays: 21, wochentage: [3] });
      const beCustom = backendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 3, intervalDays: 21, wochentage: [3] });
      assert.deepEqual(feCustom, beCustom);
      assert.deepEqual(beCustom, ['2026-10-14', '2026-11-04', '2026-11-25']);
    });

    it('unsorted selected weekdays parity', () => {
      const fe = frontendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 4, intervalDays: 7, wochentage: [5, 1, 5] });
      const be = backendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 4, intervalDays: 7, wochentage: [5, 1, 5] });
      assert.deepEqual(fe, be);
      assert.deepEqual(be, ['2026-10-16', '2026-10-19', '2026-10-23', '2026-10-26']);
    });

    it('DST transition parity (October 2026)', () => {
      const fe = frontendSeries.serienDaten({ startDatum: '2026-10-21', anzahl: 3, intervalDays: 7, wochentage: [3] });
      const be = backendSeries.serienDaten({ startDatum: '2026-10-21', anzahl: 3, intervalDays: 7, wochentage: [3] });
      assert.deepEqual(fe, be);
      assert.deepEqual(be, ['2026-10-21', '2026-10-28', '2026-11-04']);
    });

    it('empty weekdays defaults to start weekday parity', () => {
      const fe = frontendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 2, intervalDays: 7, wochentage: [] });
      const be = backendSeries.serienDaten({ startDatum: '2026-10-14', anzahl: 2, intervalDays: 7, wochentage: [] });
      assert.deepEqual(fe, be);
      assert.deepEqual(be, ['2026-10-14', '2026-10-21']);
    });
  });
});
