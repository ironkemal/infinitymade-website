import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadTherapeutenStatistik } from './therapeuten.js';

const tenant = '00000000-0000-4000-8000-000000000001';
const employee = '00000000-0000-4000-8000-000000000002';
const foreign = '00000000-0000-4000-8000-000000000003';
const cutoff = '2026-03-08T12:00:00.000Z';
const booking = (id, extra = {}) => ({
  id, user_id: employee, owner_id: tenant, start_time: '2026-09-08T12:00:00.000Z',
  status: 'confirmed', services: { is_internal: false }, ...extra,
});
const profile = (id = employee, extra = {}) => ({
  id, owner_id: tenant, owner_first_name: 'Anna', owner_last_name: 'Muster', ...extra,
});

// Echter Supabase-Querybuilder, ausschließlich lokaler HTTP-Ersatz.
// Der Ersatz prüft Spalten/Filter und simuliert PostgREST mit Testdaten.
function fixture({ bookings = [], profiles = [profile()], failTable, failOffset = 0 } = {}) {
  const calls = [];
  const supabase = createClient('https://statistik.invalid', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      assert.equal(init.method, 'GET');
      const url = new URL(input);
      const table = url.pathname.split('/').at(-1);
      const q = url.searchParams;
      calls.push({ table, query: q });
      if (table === failTable && Number(q.get('offset') || 0) >= failOffset) {
        return new Response(JSON.stringify({ message: 'Testfehler', code: '42703' }), { status: 400 });
      }
      let rows;
      if (table === 'bookings') {
        assert.equal(q.get('select'), 'id,user_id,services(is_internal)');
        assert.equal(q.get('owner_id'), `eq.${tenant}`);
        assert.equal(q.get('start_time'), `gte.${cutoff}`);
        assert.equal(q.get('status'), 'neq.cancelled');
        assert.equal(q.get('order'), 'id.asc');
        const offset = Number(q.get('offset'));
        const limit = Number(q.get('limit'));
        assert.ok(limit > 0 && limit <= 1000);
        rows = bookings
          .filter(b => b.owner_id === tenant && b.start_time >= cutoff && b.status !== 'cancelled' && b.status !== null)
          .sort((a, b) => String(a.id).localeCompare(String(b.id)))
          .slice(offset, offset + limit)
          .map(({ id, user_id, services }) => ({ id, user_id, services }));
      } else {
        assert.equal(table, 'profiles');
        assert.equal(q.get('select'), 'id,owner_first_name,owner_last_name,business_name');
        assert.equal(q.get('or'), `(id.eq.${tenant},owner_id.eq.${tenant})`);
        const ids = q.get('id').slice(4, -1).split(',');
        rows = profiles.filter(p => ids.includes(p.id) && (p.id === tenant || p.owner_id === tenant));
      }
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  return { supabase, calls };
}

test('zwei Patiententermine zählen, Pause/Privat/Fortbildung und Storno nicht', async () => {
  const { supabase } = fixture({ bookings: [
    booking('1'), booking('2', { status: 'completed' }),
    ...['BLOCK_PAUSE', 'BLOCK_PRIV', 'BLOCK_FORTB'].map((code, i) =>
      booking(`block-${i}`, { services: { code, is_internal: true } })),
    booking('cancelled', { status: 'cancelled' }),
    booking('old', { start_time: '2026-03-08T11:59:59.000Z' }),
    booking('foreign', { owner_id: foreign }),
  ] });
  assert.deepEqual(await loadTherapeutenStatistik(supabase, tenant, cutoff), [{ name: 'Anna Muster', count: 2 }]);
});

test('fehlende Leistung und nullable is_internal verlieren keine Patiententermine', async () => {
  const { supabase } = fixture({ bookings: [
    booking('1', { services: null }), booking('2', { services: { is_internal: null } }),
    booking('3', { services: { code: 'INTERN', is_internal: true } }),
  ] });
  assert.deepEqual(await loadTherapeutenStatistik(supabase, tenant, cutoff), [{ name: 'Anna Muster', count: 2 }]);
});

test('Inhaber und Mitarbeiter mit gleichem Namen werden nach user_id getrennt', async () => {
  const { supabase } = fixture({
    bookings: [booking('1'), booking('2'), booking('3', { user_id: tenant })],
    profiles: [profile(), profile(tenant, { owner_id: null })],
  });
  assert.deepEqual(await loadTherapeutenStatistik(supabase, tenant, cutoff), [
    { name: 'Anna Muster', count: 2 }, { name: 'Anna Muster', count: 1 },
  ]);
});

test('alle Seiten zählen und erst danach die fünf häufigsten Therapeuten bestimmen', async () => {
  const ids = Array.from({ length: 7 }, (_, i) => `00000000-0000-4000-8000-${String(i + 10).padStart(12, '0')}`);
  const bookings = ids.flatMap((id, i) => Array.from({ length: 200 + i }, (_, n) => booking(`${i}-${n}`, { user_id: id })));
  const { supabase, calls } = fixture({ bookings, profiles: ids.map((id, i) => profile(id, { owner_first_name: String(i) })) });
  assert.deepEqual(await loadTherapeutenStatistik(supabase, tenant, cutoff), [6, 5, 4, 3, 2].map(i => ({ name: `${i} Muster`, count: 200 + i })));
  assert.equal(calls.filter(c => c.table === 'bookings').length, 3);
});

test('nur Blocker oder keine Termine ergeben eine leere Liste ohne Profilabfrage', async () => {
  for (const bookings of [[], [booking('block', { services: { is_internal: true } })]]) {
    const { supabase, calls } = fixture({ bookings });
    assert.deepEqual(await loadTherapeutenStatistik(supabase, tenant, cutoff), []);
    assert.deepEqual(calls.map(c => c.table), ['bookings']);
  }
});

test('Namensfallback zählt Termine weiter, fremde Profile werden nicht offengelegt', async () => {
  const { supabase } = fixture({
    bookings: [booking('1'), booking('2', { user_id: foreign })],
    profiles: [profile(employee, { owner_first_name: null, owner_last_name: '', business_name: 'Praxis A' }), profile(foreign, { owner_id: foreign })],
  });
  assert.deepEqual(await loadTherapeutenStatistik(supabase, tenant, cutoff), [
    { name: 'Praxis A', count: 1 }, { name: 'Nicht zugeordnet', count: 1 },
  ]);
});

test('Termin- und Profilfehler werden weitergereicht statt als leere Statistik getarnt', async () => {
  for (const failTable of ['bookings', 'profiles']) {
    const { supabase } = fixture({ bookings: [booking('1')], failTable });
    await assert.rejects(loadTherapeutenStatistik(supabase, tenant, cutoff), new RegExp(`therapeuten/${failTable}: Testfehler`));
  }
});

test('Fehler auf einer Folgeseite liefert keine unvollständigen Zahlen', async () => {
  const { supabase } = fixture({
    bookings: Array.from({ length: 501 }, (_, i) => booking(String(i))),
    failTable: 'bookings', failOffset: 500,
  });
  await assert.rejects(loadTherapeutenStatistik(supabase, tenant, cutoff), /therapeuten\/bookings: Testfehler/);
});

test('Statistik-Endpoint liefert Therapeuten und meldet deren Abfragefehler mit HTTP 500', async (t) => {
  const env = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.SUPABASE_URL = 'https://statistik.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  t.after(() => {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  let fail = false;
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    assert.equal(init.method, 'GET');
    const url = new URL(input);
    assert.equal(url.hostname, 'statistik.invalid');
    const table = url.pathname.split('/').at(-1);
    let data = [];
    if (table === 'user') data = { id: tenant };
    else if (table === 'profiles') data = url.searchParams.has('or')
      ? [profile()] : { id: tenant, role: 'owner', owner_id: null };
    else if (table === 'bookings') {
      if (fail) return new Response(JSON.stringify({ message: 'Testfehler', code: '42703' }), { status: 400 });
      data = [booking('1'), booking('block', { services: { is_internal: true } })];
    }
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  });
  const { default: router } = await import('../api/statistik.routes.js');
  const handler = router.stack.find(layer => layer.route?.path === '/statistik').route.stack[0].handle;
  for (const shouldFail of [false, true]) {
    fail = shouldFail;
    const response = {
      statusCode: 200, body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({ headers: { authorization: 'Bearer test-token' }, query: { monate: '6' } }, response);
    assert.equal(response.statusCode, fail ? 500 : 200);
    if (fail) assert.equal(response.body.error, 'therapeuten/bookings: Testfehler');
    else assert.deepEqual(response.body.therapeuten, [{ name: 'Anna Muster', count: 1 }]);
  }
});
