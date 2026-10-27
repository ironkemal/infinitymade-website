import test from 'node:test';
import assert from 'node:assert/strict';
import { createVerfuegbarkeitKontext } from './verfuegbarkeit-kontext.js';
import { createVerfuegbarkeit } from './verfuegbarkeit.js';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tenant = uuid(1), employee = uuid(2), service = uuid(3), site = uuid(4);
const input = (extra = {}) => ({ version: 1, modus: 'tag', tenantId: tenant, userId: tenant, role: 'owner',
  tage: ['2026-10-27'], jetzt: '2026-10-27T09:00:00.000Z', ...extra });
const fixture = () => ({
  profiles: [{ id: tenant, owner_id: null, role: 'owner', is_active: true },
    { id: employee, owner_id: tenant, role: 'employee', is_active: true }],
  services: [{ id: service, owner_id: tenant, user_id: null, duration_minutes: 25, is_internal: false,
    is_group: false, business_id: null, required_certificate: null }],
  businesses: [], employee_services: [{ id: uuid(10), employee_id: employee, service_id: service, business_id: null }],
  employee_business_assignments: [], therapist_certificates: []
});
function mock(tables, { cap = 500, response, ignoreFilters = false } = {}) {
  const reads = [];
  const supabase = { from(table) {
    const filters = [];
    const q = {
      select(columns, options) { assert.equal(options.count, 'exact'); assert.ok(!/name|patient|notes/i.test(columns)); return q; },
      eq(column, value) { filters.push([column, value]); return q; },
      in(column, value) { filters.push([column, value]); return q; },
      or(value) { filters.push(['or', value]); return q; },
      order(column) { assert.equal(column, 'id'); return q; },
      async range(start, end) {
        reads.push({ table, filters: structuredClone(filters), start, end });
        let all = [...tables[table]].sort((a, b) => a.id.localeCompare(b.id));
        if (!ignoreFilters) for (const [key, value] of filters) {
          all = all.filter(row => key === 'or'
            ? value.split(',').some(term => { const [field, , expected] = term.split('.'); return row[field] === expected; })
            : Array.isArray(value) ? value.includes(row[key]) : row[key] === value);
        }
        const normal = { data: all.slice(start, Math.min(end + 1, start + cap)), count: all.length, error: null };
        return response ? response({ table, start, filters, normal }) : normal;
      }
    };
    return q;
  } };
  return { supabase, reads };
}
const load = (tables, options = {}, dependencies = {}) => {
  const db = mock(tables, options);
  return { ...db, run: createVerfuegbarkeitKontext({ supabase: db.supabase, ...dependencies }) };
};
const unknown = result => { assert.equal(result.vollstaendig, false); assert.deepEqual(result.behandler, []); assert.equal(result.gruende.length, 1); };
const weekInput = () => input({ modus: 'woche', tage: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'] });
const basis = scope => ({ version: 1, ...scope, vollstaendig: true, gruende: [],
  quellen: { arbeitszeit: 'vollstaendig', sperren: 'vollstaendig', buchungen: 'vollstaendig', extern: 'nicht_erforderlich' },
  externStatus: 'aus', arbeitsintervalle: [{ start: 480, end: 960 }], sperren: [], buchungen: [], externeBelegung: [], rasterUrsprung: 480 });

test('complete pages below requested cap retain every active clinician and explicit service', async () => {
  const { run, reads } = load(fixture(), { cap: 1 });
  const context = await run(input());
  assert.equal(context.vollstaendig, true);
  assert.equal(context.behandler.length, 2);
  assert.deepEqual(context.behandler[0].leistungen, []);
  assert.deepEqual(context.behandler[1].leistungen, [{ tenantId: tenant, serviceId: service, businessId: null,
    aktiv: true, erlaubt: true, dauerMin: 25, pufferMin: 0, rasterMin: 15, istGruppe: false }]);
  assert.deepEqual(reads.filter(r => r.table === 'profiles').map(r => r.start), [0, 1]);
});

test('employee uses own metadata filters and never reads other team assignments', async () => {
  const { run, reads } = load(fixture());
  const result = await run(input({ userId: employee, role: 'employee' }));
  assert.equal(result.vollstaendig, true);
  assert.deepEqual(result.behandler.map(p => p.userId), [employee]);
  assert.deepEqual(reads.find(r => r.table === 'profiles').filters, [['id', employee]]);
  for (const table of ['employee_services', 'employee_business_assignments']) {
    assert.deepEqual(reads.find(r => r.table === table).filters, [['employee_id', [employee]]]);
  }
  assert.deepEqual(reads.find(r => r.table === 'therapist_certificates').filters, [['owner_id', tenant], ['profile_id', employee]]);
});

for (const change of [{ role: 'admin' }, { userId: employee }, { tenantId: 'nope' }, { businessId: site },
  { modus: 'woche', userId: employee, role: 'employee' }, { tage: ['2026-02-30'] }, { version: 2 }]) {
  test(`denied scope performs zero reads ${JSON.stringify(change)}`, async () => {
    const { run, reads } = load(fixture());
    await assert.rejects(run(input(change)), err => err.status === 403);
    assert.equal(reads.length, 0);
  });
}

for (const fault of ['error', 'count', 'truncated', 'duplicate', 'changedCount']) {
  test(`pagination rejects ${fault}`, async () => {
    const { run } = load(fixture(), { cap: 1, response: ({ table, start, normal }) => {
      if (table !== 'profiles') return normal;
      if (fault === 'error') return { ...normal, error: { message: 'secret' } };
      if (fault === 'count') return { ...normal, count: null };
      if (fault === 'truncated' && start) return { ...normal, data: [] };
      if (fault === 'duplicate' && start) return { ...normal, data: [fixture().profiles[0]] };
      if (fault === 'changedCount' && start) return { ...normal, count: 1 };
      return normal;
    } });
    unknown(await run(input()));
  });
}

for (const [table, mutate] of [
  ['profiles', db => { db.profiles[1].owner_id = uuid(999); }],
  ['services', db => { db.services[0].user_id = uuid(999); }],
  ['businesses', db => { db.businesses = [{ id: site, owner_id: uuid(999), is_default: true }]; }],
  ['employee_services', db => { db.employee_services[0].employee_id = uuid(999); }],
  ['employee_business_assignments', db => { db.employee_business_assignments = [{ id: uuid(12), employee_id: employee, business_id: uuid(999) }]; }],
  ['therapist_certificates', db => { db.therapist_certificates = [{ id: uuid(12), owner_id: tenant, profile_id: uuid(999), certificate: 'MT' }]; }]
]) {
  test(`validates returned ${table} membership even when source ignores filter`, async () => {
    const db = fixture(); mutate(db);
    unknown(await load(db, { ignoreFilters: true }).run(input()));
  });
}

test('legacy service user_id ownership accepted only without conflict', async () => {
  const db = fixture(); db.services[0].owner_id = null; db.services[0].user_id = tenant;
  assert.equal((await load(db).run(input())).vollstaendig, true);
});

test('no service assignments remains Unknown; no noninternal services is known empty', async () => {
  const db = fixture(); db.employee_services = [];
  unknown(await load(db).run(input()));
  db.services[0].is_internal = true;
  assert.equal((await load(db).run(input())).vollstaendig, true);
});

test('employee missing own assignment is Unknown even if another employee assigned', async () => {
  const db = fixture(); db.employee_services[0].employee_id = tenant;
  unknown(await load(db).run(input({ userId: employee, role: 'employee' })));
});

test('missing required certificate is Unknown, never silently removes eligible service', async () => {
  const db = fixture(); db.services[0].required_certificate = 'MT';
  unknown(await load(db).run(input()));
  db.therapist_certificates = [{ id: uuid(12), owner_id: tenant, profile_id: employee, certificate: 'MT' }];
  assert.equal((await load(db).run(input())).vollstaendig, true);
});

for (const value of [null, 0, -1, 30.5, 1441, '30']) {
  test(`invalid duration ${value} never defaults`, async () => {
    const db = fixture(); db.services[0].duration_minutes = value;
    unknown(await load(db).run(input()));
  });
}

test('employee unique default fallback and global service resolve real site', async () => {
  const db = fixture(); db.businesses = [{ id: site, owner_id: tenant, is_default: true }];
  const result = await load(db).run(input());
  assert.equal(result.vollstaendig, true);
  assert.deepEqual(result.behandler[1].standorte, [site]);
  assert.equal(result.behandler[1].leistungen[0].businessId, site);
});

test('no default and multiple defaults are Unknown, explicit assignments need none', async () => {
  const db = fixture(); db.businesses = [{ id: site, owner_id: tenant, is_default: false }];
  unknown(await load(db).run(input()));
  db.businesses[0].is_default = true;
  db.businesses.push({ id: uuid(5), owner_id: tenant, is_default: true });
  unknown(await load(db).run(input()));
  db.employee_business_assignments = [{ id: uuid(12), employee_id: employee, business_id: site }];
  const result = await load(db).run(input());
  assert.equal(result.vollstaendig, true);
  assert.deepEqual(result.behandler[1].standorte, [site]);
  assert.deepEqual(result.behandler[0].standorte, [site, uuid(5)]);
});

test('explicit service and assignment sites must agree and belong to clinician', async () => {
  const db = fixture(); db.businesses = [{ id: site, owner_id: tenant, is_default: true }, { id: uuid(5), owner_id: tenant, is_default: false }];
  db.services[0].business_id = site; db.employee_services[0].business_id = uuid(5);
  unknown(await load(db).run(input()));
  db.services[0].business_id = null;
  unknown(await load(db).run(input()));
  db.employee_business_assignments = [{ id: uuid(12), employee_id: employee, business_id: uuid(5) }];
  assert.equal((await load(db).run(input())).behandler[1].leistungen[0].businessId, uuid(5));
});

test('week loads all seven dates/person/sites including past, retains original raw basis', async () => {
  const calls = [], returned = [];
  const { run } = load(fixture(), {}, { ladeBasis: async scope => { calls.push(scope); const b = basis(scope); returned.push(b); return b; } });
  const result = await run(weekInput());
  assert.equal(result.vollstaendig, true);
  assert.equal(calls.length, 14);
  assert.deepEqual([...new Set(calls.map(c => c.tag))], weekInput().tage);
  assert.ok(calls.some(c => c.tag === '2026-10-26'));
  assert.equal(result.wochenbasis.tage[0], returned[0]);
  const measured = createVerfuegbarkeit({ ladeKontext: run, slotAdapter: async () => assert.fail('week must not read slots'), jetzt: () => new Date(input().jetzt) });
  assert.deepEqual(await measured.woche({ tenantId: tenant, userId: tenant, role: 'owner' }),
    { status: 'ok', grund: null, gebuchtMin: 0, arbeitsMin: 6720, quote: 0 });
});

for (const defect of ['missing', 'incomplete', 'wrongScope', 'source', 'external', 'throws']) {
  test(`week fail closed on ${defect}`, async () => {
    const dependency = defect === 'missing' ? {} : { ladeBasis: async scope => {
      if (defect === 'throws') throw new Error('secret');
      const b = basis(scope);
      if (defect === 'incomplete') b.vollstaendig = false;
      if (defect === 'wrongScope') b.userId = uuid(999);
      if (defect === 'source') b.quellen.buchungen = 'unbekannt';
      if (defect === 'external') b.externStatus = 'kaputt';
      return b;
    } };
    const result = await load(fixture(), {}, dependency).run(weekInput());
    unknown(result); assert.ok(!JSON.stringify(result).includes('secret'));
  });
}

test('tag never preloads basis and errors are fixed codes only', async () => {
  const { run } = load(fixture(), {}, { ladeBasis: () => assert.fail('no day preload') });
  assert.equal((await run(input())).vollstaendig, true);
  const broken = createVerfuegbarkeitKontext({ supabase: { from() { throw new Error('patient secret'); } } });
  const result = await broken(input()); unknown(result);
  assert.deepEqual(result.gruende, ['QUELLEN_UNVOLLSTAENDIG']);
});


test('inactive team members remain membership evidence but never measured clinicians', async () => {
  const db = fixture(); db.profiles[1].is_active = false;
  const result = await load(db).run(input());
  assert.equal(result.vollstaendig, true);
  assert.deepEqual(result.behandler.map(p => p.userId), [tenant]);
  unknown(await load(db).run(input({ userId: employee, role: 'employee' })));
});

test('weekly basis covers all sites, including clinicians without assigned service', async () => {
  const db = fixture(); db.businesses = [{ id: site, owner_id: tenant, is_default: true }, { id: uuid(5), owner_id: tenant, is_default: false }];
  db.employee_business_assignments = [
    { id: uuid(12), employee_id: employee, business_id: site },
    { id: uuid(13), employee_id: employee, business_id: uuid(5) }
  ];
  const calls = [];
  const result = await load(db, {}, { ladeBasis: async scope => { calls.push(scope); return basis(scope); } }).run(weekInput());
  assert.equal(result.vollstaendig, true);
  assert.equal(calls.length, 28);
  for (const person of [tenant, employee]) for (const business of [site, uuid(5)]) {
    assert.deepEqual(calls.filter(c => c.userId === person && c.businessId === business).map(c => c.tag), weekInput().tage);
  }
});

test('B08 retains Unknown for DST and zero/reverse raw blocker; loader does not normalize', async () => {
  for (const mode of ['dst', 'zero', 'reverse']) {
    const instant = mode === 'dst' ? '2026-10-25T09:00:00.000Z' : input().jetzt;
    const run = load(fixture(), {}, { ladeBasis: async scope => {
      const result = basis(scope);
      if (mode === 'zero') result.sperren = [{ start: 500, end: 500 }];
      if (mode === 'reverse') result.sperren = [{ start: 600, end: 500 }];
      return result;
    } }).run;
    const adapter = createVerfuegbarkeit({ ladeKontext: run, slotAdapter: async () => assert.fail('no slots'), jetzt: () => new Date(instant) });
    const measured = await adapter.woche({ tenantId: tenant, userId: tenant, role: 'owner' });
    assert.equal(measured.status, 'unbekannt');
    assert.equal(measured.grund, mode === 'dst' ? 'ZEITBASIS_UNKLAR' : 'INTERVALL_UNGUELTIG');
    assert.equal(measured.arbeitsMin, null);
  }
});
