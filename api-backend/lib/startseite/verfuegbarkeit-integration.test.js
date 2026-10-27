import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createSlotAdapter } from './verfuegbarkeit-engine.js';
import { createVerfuegbarkeitKontext } from './verfuegbarkeit-kontext.js';
import { createVerfuegbarkeit } from './verfuegbarkeit.js';
import { createRequire } from 'node:module';

// Synthetic configuration only. Never import server bootstrap or read local env.
process.env.SUPABASE_URL = 'http://127.0.0.1:1';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic';
const { createVerfuegbarkeitRouter } = await import('../../routes/startseite-verfuegbarkeit.js');
const require = createRequire(import.meta.url);
const express = require('express');
const source = readFileSync(new URL('../../server.js', import.meta.url), 'utf8');
const extract = (name, async = false) => {
  const all = [...source.matchAll(new RegExp(`^${async ? 'async ' : ''}function ${name}\\([^]*?^}`, 'gm'))];
  assert.equal(all.length, 1, name); new vm.Script(`(${all[0][0]})`); return all[0][0];
};
const helpers = ['timeToMins', 'minsToTime', 'berlinOffsetMin', 'utcToBerlinMinutes', 'berlinDayOfWeek', 'berlinDayBoundsUTC'].map(n => extract(n)).join('\n');
const engineSource = extract('getAvailableSlots', true);
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tenant = id(1), employee = id(2), site = id(10), service = id(20);
const now = '2026-10-28T08:00:00.000Z'; // Wed, whole normal Berlin week Oct26–Nov1.
const scope = { tenantId: tenant, userId: tenant, role: 'owner' };
const slotInput = { tenantId: tenant, userId: tenant, businessId: site, serviceId: service,
  tag: '2026-10-28', dauerMin: 30, pufferMin: 0, rasterMin: 15, jetzt: now };
const booking = (n, date, start = '10:00', end = '11:00', extra = {}) => ({ id: id(n), owner_id: tenant,
  user_id: tenant, business_id: site, businesses: { owner_id: tenant }, status: 'confirmed', group_parent_id: null,
  start_time: `${date}T${start}:00+01:00`, end_time: `${date}T${end}:00+01:00`,
  is_group: false, group_capacity: 1, service_id: service, ...extra });

function setup(options = {}) {
  const tables = {
    profiles: [{ id: tenant, owner_id: null, role: 'owner', is_active: true }],
    businesses: [{ id: site, owner_id: tenant, is_default: true, closed_days: [] }],
    services: [{ id: service, owner_id: tenant, user_id: tenant, duration_minutes: 30,
      is_group: false, is_internal: false, business_id: null, required_certificate: null }],
    employee_services: [{ id: id(21), employee_id: tenant, service_id: service, business_id: null }],
    employee_business_assignments: [], therapist_certificates: [],
    working_hours: Array.from({ length: 7 }, (_, day_of_week) => ({ id: id(30 + day_of_week),
      user_id: tenant, day_of_week, start_time: '09:00', end_time: '12:00', is_active: true })),
    custom_days: [], breaks: [], time_offs: [], calendar_integrations: [],
    bookings: [booking(100, '2026-10-26'), booking(101, '2026-10-28'), booking(102, '2026-11-01', '11:00', '11:30')],
    ...options.tables
  };
  const calls = [];
  const from = table => {
    const filters = [], operations = []; let columns, countWanted = false, range = null, single = false;
    const compare = (left, op, right) => {
      if (op === 'eq' || op === 'is') return left === right;
      const a = typeof left === 'string' && /^\d{4}-/.test(left) ? Date.parse(left) : left;
      const b = typeof right === 'string' && /^\d{4}-/.test(right) ? Date.parse(right) : right;
      return op === 'gte' ? a >= b : op === 'lte' ? a <= b : op === 'gt' ? a > b : a < b;
    };
    const q = {
      select(c, o) { columns = c; countWanted = o?.count === 'exact'; return q; },
      order() { return q; }, range(a, b) { range = [a, b]; return q; },
      maybeSingle() { single = true; return q; }, single() { single = true; return q; },
      in(key, list) { operations.push(['in', key, list]); filters.push(r => list.includes(r[key])); return q; },
      or(expr) { operations.push(['or', expr]); filters.push(r => expr.split(',').some(part => {
        const [, key, op, value] = /^([a-z_]+)\.(eq|gte|gt)\.(.*)$/.exec(part) || [];
        assert.ok(key, expr); return compare(r[key], op, value);
      })); return q; },
      then(ok, fail) { return Promise.resolve().then(() => {
        calls.push({ table, columns, range: range && [...range], countWanted, operations });
        if (options.reject === table) throw new Error('synthetic private details');
        if (options.error === table) return { data: null, error: { message: 'synthetic private details' }, count: null };
        let rows = (tables[table] || []).filter(r => filters.every(f => f(r))).sort((a, b) => a.id.localeCompare(b.id));
        let count = countWanted ? rows.length : null;
        if (options.noCount === table) count = null;
        if (single) {
          if (rows.length > 1) return { data: null, error: { code: 'PGRST116' }, count: null };
          return { data: rows[0] ?? null, error: null, count };
        }
        if (range) rows = rows.slice(range[0], range[1] + 1);
        rows = rows.slice(0, options.cap ?? 1000);
        if (options.dropPage === table && range?.[0] > 0) rows = [];
        if (options.poison === table) rows = rows.map(r => ({ ...r, owner_id: id(999) }));
        return { data: rows, error: null, count };
      }).then(ok, fail); }
    };
    for (const op of ['eq', 'is', 'gte', 'lte', 'gt', 'lt']) q[op] = (key, val) => { operations.push([op,key,val]); filters.push(r => compare(r[key], op, val)); return q; };
    return q;
  };
  const supabase = { from };
  const context = vm.createContext({ Date, Intl, supabase, console: { error() {} },
    newOAuthClient: () => ({ setCredentials() { if (options.oauthError) throw new Error('synthetic'); } }),
    google: { calendar: () => ({ freebusy: { async query() {
      if (options.googleError) throw new Error('synthetic');
      return options.googleResponse ?? { data: { calendars: { primary: { busy: [] } } } };
    } } }) }
  });
  vm.runInContext(`const BUSINESS_TZ='Europe/Berlin',SLOT_STEP_MINUTES=15,GOOGLE_KONFIGURIERT=${options.googleConfigured !== false};${helpers}\n${engineSource}`, context);
  const engine = context.getAvailableSlots;
  const adapters = createSlotAdapter({ engine });
  const build = () => createVerfuegbarkeit({ ladeKontext: createVerfuegbarkeitKontext({ supabase, ladeBasis: adapters.ladeBasis }),
    slotAdapter: adapters.slotAdapter, jetzt: () => new Date(options.now || now) });
  return { calls, tables, engine, ...adapters, build };
}

test('Originalengine + Kontext + B08: Woche inklusive Vergangenheit, unabhängiges Minutenorakel', async () => {
  const s = setup();
  const dto = await s.build().woche(scope);
  assert.deepEqual(dto, { status: 'ok', grund: null, arbeitsMin: 7 * 180, gebuchtMin: 60 + 60 + 30, quote: 150 / 1260 });
  assert.equal(s.calls.filter(c => c.table === 'bookings').length, 7);
  assert.ok(!JSON.stringify(dto).includes('user_id'));
});
test('Originalengine + Kontext + B08: echte Service-Starts, nicht Slotzahl mal Dauer', async () => {
  const s = setup(); const dto = await s.build().tag(scope);
  assert.equal(dto.status, 'ok'); assert.equal(dto.minimumMin, 30);
  assert.ok(dto.luecken[0].starts.length > 1);
  assert.ok(dto.luecken[0].freiMin < dto.luecken[0].starts.length * 30);
  assert.ok(dto.luecken[0].starts.every(x => x.start > '09:30'));
});
test('Engine-Basis aus selben Reads: Arbeit, Sperren, Buchungen, extern separat', async () => {
  const s = setup({ tables: { breaks: [{ id: id(90), user_id: tenant, day_of_week: 3, start_time: '11:15', end_time: '11:30' }] } });
  const out = await s.slotAdapter(slotInput);
  assert.equal(out.vollstaendig, true);
  assert.deepEqual(JSON.parse(JSON.stringify(out.basis.arbeitsintervalle)), [{ start: 540, end: 720 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(out.basis.sperren)), [{ start: 675, end: 690 }]);
  assert.equal(out.basis.buchungen.length, 1); assert.equal(out.basis.externeBelegung.length, 0);
  assert.equal(out.basis.externStatus, 'nicht_konfiguriert');
  assert.ok(s.calls.filter(c => ['bookings', 'breaks', 'time_offs'].includes(c.table)).every(c => c.countWanted && c.range));
});
for (const table of ['bookings', 'breaks', 'time_offs', 'profiles', 'businesses', 'services', 'employee_services', 'calendar_integrations']) {
  for (const failure of ['error', 'reject']) test(`Endpfad ${table} ${failure}: Unknown, keine Teilwerte`, async () => {
    const dto = await setup({ [failure]: table }).build().tag(scope);
    assert.equal(dto.status, 'unbekannt'); assert.equal(dto.luecken, null);
    assert.ok(!JSON.stringify(dto).includes('synthetic'));
  });
}
for (const table of ['bookings', 'breaks', 'time_offs']) {
  test(`Engine fehlender Count ${table}: kein Vollständigkeitsbeleg`, async () => {
    assert.equal((await setup({ noCount: table }).build().tag(scope)).status, 'unbekannt');
  });
}
test('Gruppenteilnehmer >1000 und Provider-cap7: alle tatsächlich verwendet, Restplatz ohne freie Gruppenminuten', async () => {
  const parent = booking(100, '2026-10-28', '09:00', '12:00', { is_group: true, group_capacity: 1002 });
  const children = Array.from({ length: 1001 }, (_, i) => booking(200 + i, '2026-10-28', '09:00', '12:00', { group_parent_id: parent.id }));
  const s = setup({ cap: 7, tables: { bookings: [parent, ...children], services: [{ id: service, owner_id: tenant, user_id: tenant,
    duration_minutes: 30, is_group: true, is_internal: false, business_id: null, required_certificate: null }] } });
  const dto = await s.build().tag(scope);
  assert.equal(dto.status, 'ok'); assert.equal(dto.luecken[0].freiMin, 0);
  assert.ok(dto.luecken[0].starts.every(x => x.art === 'gruppenrestplatz'));
  assert.ok(s.calls.filter(c => c.table === 'bookings' && c.columns.includes('group_parent_id')).length > 140);
  assert.equal((await s.build().woche(scope)).gebuchtMin, 180);
});
test('Engine-Abbruch einer nichtleeren Pagination bleibt Unknown', async () => {
  const bookings = Array.from({ length: 20 }, (_, i) => booking(100 + i, '2026-10-28'));
  assert.equal((await setup({ cap: 7, dropPage: 'bookings', tables: { bookings } }).build().tag(scope)).status, 'unbekannt');
});
test('Mandantenfremde Enginebuchung bleibt Unknown', async () => {
  assert.equal((await setup({ poison: 'bookings' }).build().tag(scope)).status, 'unbekannt');
});
const integration = { id: id(80), user_id: tenant, provider: 'google', business_id: null,
  access_token: 'synthetic', refresh_token: 'synthetic', calendar_id: 'primary' };
for (const [name, options] of [
  ['Timeout', { googleError: true }], ['OAuth', { oauthError: true }],
  ['fehlendes Token', { tables: { calendar_integrations: [{ ...integration, access_token: null }] } }],
  ['bewusst aus aber vorhandene erwartete Verbindung', { googleConfigured: false }],
  ['per-Kalenderfehler', { googleResponse: { data: { calendars: { primary: { busy: [], errors: [{}] } } } } }],
  ['falscher ausgewählter Kalender', { tables: { calendar_integrations: [{ ...integration, calendar_id: 'other' }] } }]
]) test(`Google ${name} bleibt Unknown`, async () => {
  const optionsWithConnection = { ...options, tables: { calendar_integrations: [integration], ...options.tables } };
  const dto = await setup(optionsWithConnection).build().tag(scope);
  assert.equal(dto.status, 'unbekannt'); assert.equal(dto.luecken, null);
});
test('Google verbunden: Busy fließt in dieselbe Wochenrohgrundlage', async () => {
  const s = setup({ tables: { calendar_integrations: [integration] },
    googleResponse: { data: { calendars: { primary: { busy: [{ start: '2026-10-28T11:15:00+01:00', end: '2026-10-28T11:30:00+01:00' }] } } } } });
  const result = await s.slotAdapter(slotInput);
  assert.equal(result.vollstaendig, true); assert.equal(result.basis.externStatus, 'verbunden');
  assert.equal(result.basis.externeBelegung.length, 1);
});
for (const [name, tables] of [
  ['Nullpause', { breaks: [{ id: id(90), user_id: tenant, day_of_week: 3, start_time: '10:00', end_time: '10:00' }] }],
  ['Rückwärtspause', { breaks: [{ id: id(90), user_id: tenant, day_of_week: 3, start_time: '11:00', end_time: '10:00' }] }],
  ['Vortagsbuchung', { bookings: [booking(100, '2026-10-27', '23:00', '23:30', { end_time: '2026-10-28T10:00:00+01:00' })] }]
]) test(`${name}: keine Normalisierung in erfundene Kapazität`, async () => {
  assert.equal((await setup({ tables }).build().tag(scope)).status, 'unbekannt');
});
test('DST-Woche mit 25h-Tag bleibt Unknown', async () => {
  const dto = await setup({ now: '2026-10-25T08:00:00Z' }).build().woche(scope);
  assert.equal(dto.status, 'unbekannt'); assert.equal(dto.quote, null);
});
test('DST-Woche mit 23h-Tag bleibt Unknown', async () => {
  assert.equal((await setup({ now: '2026-03-29T08:00:00Z' }).build().woche(scope)).status, 'unbekannt');
});
test('Mehrere Standorte: Behandlerkapazität und Buchungen vereinigt statt verdoppelt', async () => {
  const s = setup({ tables: { businesses: [
    { id: site, owner_id: tenant, is_default: true, closed_days: [] },
    { id: id(11), owner_id: tenant, is_default: false, closed_days: [] }
  ] } });
  const dto = await s.build().woche(scope);
  assert.equal(dto.arbeitsMin, 1260); assert.equal(dto.gebuchtMin, 150);
});
test('Alle eligible Services: Vereinigung der Startzeugen, keine Mindestdauerannahme', async () => {
  const s = setup();
  s.tables.services.push({ ...s.tables.services[0], id: id(22), duration_minutes: 15 });
  s.tables.employee_services.push({ ...s.tables.employee_services[0], id: id(23), service_id: id(22) });
  const dto = await s.build().tag(scope);
  assert.equal(dto.status, 'ok'); assert.equal(dto.minimumMin, 15); assert.equal(dto.luecken[0].freiMin, 75);
  assert.deepEqual(new Set(dto.luecken[0].starts.map(x => x.serviceId)), new Set([service, id(22)]));
});
test('Geschlossene Woche braucht trotzdem vollständige Rohreads, Quote bleibt null', async () => {
  const s = setup(); s.tables.businesses[0].closed_days = [0,1,2,3,4,5,6];
  const dto = await s.build().woche(scope);
  assert.deepEqual(dto, { status: 'ok', grund: 'KEINE_ARBEITSZEIT', gebuchtMin: 0, arbeitsMin: 0, quote: null });
  assert.equal(s.calls.filter(c => c.table === 'bookings').length, 7);
});
test('Employee-Tag: ausschließlich eigenes Profil/Zuordnungen/Buchungen, Ownertermine ohne Einfluss', async () => {
  const s = setup();
  s.tables.profiles.push({ id: employee, owner_id: tenant, role: 'employee', is_active: true });
  s.tables.employee_services[0].employee_id = employee;
  const dto = await s.build().tag({ tenantId: tenant, userId: employee, role: 'employee' });
  assert.equal(dto.status, 'ok'); assert.ok(dto.luecken.every(p => p.userId === employee));
  assert.ok(dto.luecken[0].starts.some(p => p.start === '10:00'), 'Ownerbooking darf eigenen Start nicht blockieren');
  for (const c of s.calls.filter(c => c.table === 'profiles')) assert.ok(c.operations.some(o => o[0] === 'eq' && o[1] === 'id' && o[2] === employee));
  for (const c of s.calls.filter(c => c.table === 'bookings')) assert.ok(c.operations.some(o => o[0] === 'eq' && o[1] === 'user_id' && o[2] === employee));
});
test('uninstrumentierte Legacy-Engine liefert niemals vollständige Basis', async () => {
  const result = await createSlotAdapter({ engine: async () => ({ slots: ['10:00'] }) }).slotAdapter(slotInput);
  assert.equal(result.vollstaendig, false); assert.deepEqual(result.slots, []);
});
for (const end of ['2026-10-28T11:00:30+01:00', '2026-10-28T11:00:00.001+01:00', '2026-10-28T11:00:00.000001+01:00']) {
  test(`Review-Repro Buchung mit Sekunden/Subsekunden ${end}: Unknown statt Start11:00`, async () => {
    const s = setup({ tables: { bookings: [booking(100, '2026-10-28', '10:00', '11:00', { end_time: end })] } });
    assert.equal((await s.build().tag(scope)).status, 'unbekannt');
    assert.equal((await s.build().woche(scope)).quote, null);
  });
}
test('Google-Belegung mit Sekunden bleibt Unknown', async () => {
  const dto = await setup({ tables: { calendar_integrations: [integration] }, googleResponse: { data: { calendars: { primary: {
    busy: [{ start: '2026-10-28T10:00:00+01:00', end: '2026-10-28T11:00:30+01:00' }] } } } } }).build().tag(scope);
  assert.equal(dto.status, 'unbekannt');
});

async function request(router, path, authHeader = true) {
  const app = express(); app.use(router);
  const handler = app._router;
  return new Promise((resolve, reject) => {
    const req = Object.assign(Object.create({}), { method: 'GET', url: path, headers: authHeader ? { authorization: 'synthetic' } : {} });
    const headers = {};
    const res = { setHeader(k, v) { headers[k.toLowerCase()] = v; }, getHeader(k) { return headers[k.toLowerCase()]; },
      end(body) { resolve({ status: this.statusCode ?? 200, body: JSON.parse(body), headers }); } };
    handler.handle(req, res, reject);
  });
}
test('Echte Router→Factory→Engine-Grenze: Owner200; EmployeeWoche403 vor Quellen; Overrides400', async () => {
  const s = setup(); let identity = scope, factories = 0;
  const router = createVerfuegbarkeitRouter({ auth: (req, res, next) => {
    if (!req.headers.authorization) return res.status(401).json({ code: 'AUTH' }); req.auth = identity; next();
  }, createLader: () => { factories++; return s.build(); } });
  assert.equal((await request(router, '/startseite/woche')).body.arbeitsMin, 1260);
  const before = s.calls.length; const count = factories;
  identity = { tenantId: tenant, userId: employee, role: 'employee' };
  assert.equal((await request(router, '/startseite/woche')).status, 403);
  assert.equal(factories, count); assert.equal(s.calls.length, before);
  assert.equal((await request(router, '/startseite/tag?tenantId=fremd')).status, 400);
  assert.equal((await request(router, '/startseite/tag', false)).status, 401);
  identity = { ...scope, userId: employee };
  assert.equal((await request(router, '/startseite/tag')).status, 403);
  assert.equal(s.calls.length, before);
});
test('Router maskiert Fabrikfehler ohne Rohdetails, no-store auch Unknown', async () => {
  const router = createVerfuegbarkeitRouter({ auth: (req, _res, next) => { req.auth = scope; next(); },
    createLader() { throw new Error('synthetic private details'); } });
  const response = await request(router, '/startseite/tag');
  assert.equal(response.status, 503); assert.equal(response.body.luecken, null);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.ok(!JSON.stringify(response.body).includes('private'));
});
