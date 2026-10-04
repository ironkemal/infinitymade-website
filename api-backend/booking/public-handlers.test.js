import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as guards from './public-guards.js';

const serverSrc = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const extract = (s, e) => serverSrc.slice(serverSrc.indexOf(s), serverSrc.indexOf(e));
const bookingCode = extract("app.post('/api/booking/create'", '// 5. Verify Company Code');
const requestCode = extract("app.post('/api/booking-request/create'", '// GET /api/booking-request/list');

let bookingHandler, requestHandler, currentDb, lastAuditOwner;
let slotsCounter = 0, mailCounter = 0, calendarCounter = 0, approvedCounter = 0, logAccessCounter = 0;

const mockSupabase = {
  from(table) {
    let filters = {}, write = null;
    const b = {
      select: () => b,
      eq: (col, val) => { filters[col] = val; return b; },
      insert: (p) => {
        write = p;
        for (const r of (Array.isArray(p) ? p : [p])) {
          currentDb.writes.push({ table, data: { id: table === 'bookings' ? 'B' : 'BR', ...r } });
        }
        return b;
      },
      forUpdate: () => b,
      maybeSingle: () => b.then(),
      single: () => b.then(),
      then: (res) => {
        if (currentDb.error) {
          const out = { data: null, error: currentDb.error };
          return res ? res(out) : Promise.resolve(out);
        }
        if (write) {
          const last = currentDb.writes[currentDb.writes.length - 1]?.data || { id: 'B' };
          const out = { data: last, error: null };
          return res ? res(out) : Promise.resolve(out);
        }
        currentDb.reads++;
        const list = currentDb.tables[table] || [];
        const match = list.find(r => Object.entries(filters).every(([k, v]) => r[k] === v)) || null;
        const out = { data: match, error: null };
        return res ? res(out) : Promise.resolve(out);
      }
    };
    return b;
  }
};

const ctx = vm.createContext({
  ...guards,
  app: {
    post(path, ...m) {
      const fn = m[m.length - 1];
      if (path === '/api/booking/create') bookingHandler = fn;
      if (path === '/api/booking-request/create') requestHandler = fn;
    }
  },
  publicBookingLimiter: (req, res, next) => next?.(),
  bookingRequestLimiter: (req, res, next) => next?.(),
  slotsLookupLimiter: (req, res, next) => next?.(),
  supabase: mockSupabase,
  getAvailableSlots: async () => { slotsCounter++; return { slots: ['10:00'] }; },
  berlinLocalToUTC: (d, t) => new Date(`${d}T${t || '00:00'}:00Z`),
  timeToMins: (t) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; },
  utcToBerlinMinutes: () => 0,
  BUSINESS_TZ: 'Europe/Berlin',
  SLOT_STEP_MINUTES: 15,
  newOAuthClient: () => { calendarCounter++; throw new Error('newOAuthClient called'); },
  google: { auth: { OAuth2: function() { throw new Error('OAuth2 called'); } } },
  calendar: () => { throw new Error('calendar called'); },
  logAccess: (_supabase, entry) => { logAccessCounter++; lastAuditOwner = entry.ownerId; },
  createBookingsFromRequest: () => { approvedCounter++; throw new Error('approved helper called'); },
  createBookingsFromRequestFactory: () => () => { approvedCounter++; throw new Error('approved helper called'); },
  createSMTPTransport: () => ({ sendMail: () => { mailCounter++; return Promise.resolve(); } }),
  getMailFrom: () => 'synthetic@example.invalid', appBaseUrl: () => 'https://synthetic.invalid',
  process: { env: { SMTP_HOST: 'synthetic.invalid' } },
  console, Date, Error, Math, parseInt, parseFloat, String, Number, Boolean, Object, Array, Promise, JSON
});

vm.runInContext(bookingCode, ctx);
vm.runInContext(requestCode, ctx);

const F = {
  owner: { id: 'O', role: 'owner', owner_id: null, is_active: true, email: null, business_name: 'Praxis O', auto_approve: false },
  therapist: { id: 'T', role: 'employee', owner_id: 'O', is_active: true },
  service: { id: 'S', name: 'Svc', duration_minutes: 60, price: 50, owner_id: 'O', is_group: false, is_online_meeting: false, is_internal: false },
  lead: { id: 'L', owner_id: 'O' },
  patient: { id: 'P', owner_id: 'O' }
};

function resetDb(overrides = {}) {
  lastAuditOwner = undefined; slotsCounter = 0; mailCounter = 0; calendarCounter = 0; approvedCounter = 0; logAccessCounter = 0;
  currentDb = {
    tables: {
      profiles: [F.owner, F.therapist],
      services: [F.service],
      leads: [F.lead],
      patients: [F.patient],
      calendar_integrations: [],
      bookings: [],
      booking_requests: [],
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

describe('Public Booking Handlers Guard & Honeypot Suite', () => {
  beforeEach(() => resetDb());

  it('Honeypot trapped returns 200 { success: true } with ZERO DB/slots/calendar/mail on both routes', async () => {
    const resBooking = mockRes();
    await bookingHandler({ body: { website: 'spam.com', serviceId: 'S' } }, resBooking);
    assert.equal(resBooking.statusCode, 200);
    assert.deepEqual(resBooking.body, { success: true });
    assert.equal(currentDb.reads, 0);
    assert.equal(currentDb.writes.length, 0);
    assert.equal(slotsCounter, 0);
    assert.equal(mailCounter, 0); assert.equal(calendarCounter, 0);

    const resReq = mockRes();
    await requestHandler({ body: { website: 'bot-fill', owner_id: 'O' } }, resReq);
    assert.equal(resReq.statusCode, 200);
    assert.deepEqual(resReq.body, { success: true });
    assert.equal(currentDb.reads, 0);
    assert.equal(currentDb.writes.length, 0);
    assert.equal(slotsCounter, 0);
    assert.equal(mailCounter, 0); assert.equal(calendarCounter, 0);
  });

  it('Honeypot invalid types return 400 Ungültige Anfrage with ZERO DB on both routes', async () => {
    const resBooking = mockRes();
    await bookingHandler({ body: { website: 12345 } }, resBooking);
    assert.equal(resBooking.statusCode, 400);
    assert.equal(resBooking.body?.error, 'Ungültige Anfrage');
    assert.equal(currentDb.reads, 0);
    assert.equal(currentDb.writes.length, 0);

    const resReq = mockRes();
    await requestHandler({ body: { website: true } }, resReq);
    assert.equal(resReq.statusCode, 400);
    assert.equal(resReq.body?.error, 'Ungültige Anfrage');
    assert.equal(currentDb.reads, 0);
    assert.equal(currentDb.writes.length, 0);
  });

  it('Legacy valid anonymous booking writes exactly 1 with owner O from service, ignoring body owner attacker', async () => {
    const res = mockRes();
    const req = {
      body: {
        userId: 'T', serviceId: 'S', leadId: 'L',
        date: '2099-01-01', time: '10:00',
        customerName: 'Max Mustermann', customerEmail: 'max@example.com',
        owner_id: 'ATTACKER_ID'
      },
      headers: {}, ip: '127.0.0.1', path: '/api/booking/create'
    };
    await bookingHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(currentDb.writes.length, 1);
    assert.equal(currentDb.writes[0].table, 'bookings');
    assert.equal(currentDb.writes[0].data.owner_id, 'O');
    assert.equal(lastAuditOwner, 'O');
    assert.notEqual(currentDb.writes[0].data.owner_id, 'ATTACKER_ID');
    assert.equal(slotsCounter, 1);
  });

  it('Canonical owner priority: service owner_id O over user_id OTHER with therapist valid under O', async () => {
    resetDb({
      tables: {
        services: [{ ...F.service, id: 'S2', owner_id: 'O', user_id: 'OTHER' }]
      }
    });
    const res = mockRes();
    await bookingHandler({
      headers: {}, body: { userId: 'T', serviceId: 'S2', leadId: 'L', date: '2099-01-01', time: '10:00', customerName: 'Max', customerEmail: 'm@ex.com' }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(currentDb.writes.length, 1);
    assert.equal(currentDb.writes[0].data.owner_id, 'O');
    assert.equal(lastAuditOwner, 'O');
  });

  it('Root check: root owner as therapist (data.id === canonicalOwnerId) succeeds', async () => {
    const res = mockRes();
    await bookingHandler({
      headers: {}, body: { userId: 'O', serviceId: 'S', leadId: 'L', date: '2099-01-01', time: '10:00', customerName: 'Max', customerEmail: 'm@ex.com' }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(currentDb.writes.length, 1);
    assert.equal(currentDb.writes[0].data.owner_id, 'O');
    assert.equal(lastAuditOwner, 'O');
  });

  it('Booking rejects before slots and zero writes on invalid guards', async () => {
    resetDb({ tables: { profiles: [{ ...F.owner, is_active: false }, F.therapist] } });
    let res = mockRes();
    await bookingHandler({ body: { userId: 'T', serviceId: 'S', date: '2099-01-01', time: '10:00' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Ungültige Praxis');
    assert.equal(slotsCounter, 0);
    assert.equal(currentDb.writes.length, 0);

    resetDb({ tables: { services: [{ ...F.service, is_internal: true }] } });
    res = mockRes();
    await bookingHandler({ body: { userId: 'T', serviceId: 'S', date: '2099-01-01', time: '10:00' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Service nicht verfügbar');
    assert.equal(slotsCounter, 0);
    assert.equal(currentDb.writes.length, 0);

    resetDb({ tables: { profiles: [F.owner, { ...F.therapist, owner_id: 'FOREIGN' }] } });
    res = mockRes();
    await bookingHandler({ body: { userId: 'T', serviceId: 'S', date: '2099-01-01', time: '10:00' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Ungültiger Therapeut');
    assert.equal(slotsCounter, 0);
    assert.equal(currentDb.writes.length, 0);

    resetDb({ tables: { profiles: [F.owner, { ...F.therapist, is_active: false }] } });
    res = mockRes();
    await bookingHandler({ body: { userId: 'T', serviceId: 'S', date: '2099-01-01', time: '10:00' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Therapeut nicht verfügbar');
    assert.equal(slotsCounter, 0);
    assert.equal(currentDb.writes.length, 0);

    resetDb({ tables: { leads: [{ id: 'L', owner_id: 'FOREIGN' }] } });
    res = mockRes();
    await bookingHandler({ body: { userId: 'T', serviceId: 'S', leadId: 'L', date: '2099-01-01', time: '10:00' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Ungültiger Lead');
    assert.equal(slotsCounter, 0);
    assert.equal(currentDb.writes.length, 0);
  });

  it('Request rejects foreign service / patient / inactive employee / invalid owner with zero writes', async () => {
    resetDb({ tables: { services: [{ ...F.service, owner_id: 'FOREIGN' }] } });
    let res = mockRes();
    await requestHandler({ body: { owner_id: 'O', service_id: 'S', payment_type: 'selbstzahler', dsgvo_consent: true } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Service not found');
    assert.equal(currentDb.writes.length, 0);

    resetDb({ tables: { patients: [{ id: 'P', owner_id: 'FOREIGN' }] } });
    res = mockRes();
    await requestHandler({ body: { owner_id: 'O', patient_id: 'P', payment_type: 'selbstzahler', dsgvo_consent: true } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Ungültiger Patient');
    assert.equal(currentDb.writes.length, 0);

    resetDb({ tables: { profiles: [F.owner, { ...F.therapist, is_active: false }] } });
    res = mockRes();
    await requestHandler({ body: { owner_id: 'O', employee_id: 'T', payment_type: 'selbstzahler', dsgvo_consent: true } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Therapeut nicht verfügbar');
    assert.equal(currentDb.writes.length, 0);

    resetDb({ tables: { profiles: [{ ...F.owner, owner_id: 'PARENT' }] } });
    res = mockRes();
    await requestHandler({ body: { owner_id: 'O', payment_type: 'selbstzahler', dsgvo_consent: true } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body?.error, 'Ungültige Praxis');
    assert.equal(currentDb.writes.length, 0);
  });

  it('Service-free request works and creates exactly 1 booking_request without mail/helper', async () => {
    const res = mockRes();
    await requestHandler({ body: { owner_id: 'O', patient_id: 'P', payment_type: 'selbstzahler', dsgvo_consent: true } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(currentDb.writes.length, 1);
    assert.equal(currentDb.writes[0].table, 'booking_requests');
    assert.equal(approvedCounter, 0);
    assert.equal(mailCounter, 0); assert.equal(calendarCounter, 0);
  });

  it('Database error 500 returns Interner Serverfehler with no effects on both routes', async () => {
    resetDb({ error: new Error('Postgres connection failed') });
    const resBooking = mockRes();
    await bookingHandler({ body: { userId: 'T', serviceId: 'S', date: '2099-01-01', time: '10:00' } }, resBooking);
    assert.equal(resBooking.statusCode, 500);
    assert.equal(resBooking.body?.error, 'Interner Serverfehler');
    assert.equal(slotsCounter, 0);
    assert.equal(currentDb.writes.length, 0);

    const resReq = mockRes();
    await requestHandler({ body: { owner_id: 'O', patient_id: 'P', payment_type: 'selbstzahler', dsgvo_consent: true } }, resReq);
    assert.equal(resReq.statusCode, 500);
    assert.equal(resReq.body?.error, 'Interner Serverfehler');
    assert.equal(currentDb.writes.length, 0);
  });
});
