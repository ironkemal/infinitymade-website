import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('./server.js', import.meta.url), 'utf8');
const route = source.slice(source.indexOf("app.get('/api/attendance/report'"), source.indexOf('// PATCH /api/attendance/:id/note'));
const site = '00000000-0000-4000-8000-000000000001';
async function run(business_id = site) {
  let handler, status = 200, result, calls = 0;
  const data = [
    {id:'zugeordnet',owner_id:'owner',business_id:site,date:'2026-11-17'},
    {id:'ohne',owner_id:'owner',business_id:null,date:'2026-11-17'},
    {id:'anderer-standort',owner_id:'owner',business_id:'other',date:'2026-11-17'},
    {id:'fremd',owner_id:'foreign',business_id:null,date:'2026-11-17'},
    {id:'spaeter',owner_id:'owner',business_id:null,date:'2026-11-18'},
  ];
  let rows = data;
  const q = { select(){return this;},eq(k,v){rows=rows.filter(r=>r[k]===v);return this;},gte(k,v){rows=rows.filter(r=>r[k]>=v);return this;},lte(k,v){rows=rows.filter(r=>r[k]<=v);return this;},order(){return this;},or(){rows=rows.filter(r=>r.business_id===site||r.business_id===null);return this;},then(resolve){return Promise.resolve({data:rows}).then(resolve);} };
  vm.runInNewContext(route,{app:{get:(path,auth,fn)=>{handler=fn;}},requireAuthAI:()=>{},UUID_RE:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,supabase:{from:()=>{calls++;return q;}},console});
  const res={status(n){status=n;return this;},json(v){result=v;return this;}};
  await handler({auth:{userId:'owner'},query:{business_id,date_from:'2026-11-16',date_to:'2026-11-17'}},res);
  return {status,result,calls};
}
test('Anwesenheit: Bis-Tag und nicht zugeordnete Einträge, keine fremden Owner/Standorte', async()=>{
  const {status,result}=await run();assert.equal(status,200);assert.deepEqual(Array.from(result.records,r=>r.id),['zugeordnet','ohne']);
});
test('Anwesenheit: manipulierte Standortfilter vor DB abweisen',async()=>{
  const r=await run('x),owner_id.neq.x');assert.equal(r.status,400);assert.equal(r.calls,0);
});

async function runCheckIn(body, siteOwner = 'owner') {
  const checkIn = source.slice(source.indexOf("app.post('/api/attendance/check-in'"), source.indexOf('// POST /api/attendance/check-out'));
  let handler, inserted, result;
  let status = 200;
  const queries = [];
  const data = {
    profiles: [{ id: 'employee', role: 'employee', owner_id: 'owner' }],
    businesses: [{ id: site, owner_id: siteOwner }],
    attendance: [],
  };
  const supabase = {
    from(table) {
      const query = { table, fields: [], filters: {} };
      queries.push(query);
      return {
        select(fields) { query.fields.push(fields); return this; },
        eq(field, value) { query.filters[field] = value; return this; },
        insert(record) { inserted = { ...record }; data.attendance.push(record); return this; },
        maybeSingle() {
          const match = data[table].find(row => Object.entries(query.filters).every(([field, value]) => row[field] === value));
          return { data: match || null };
        },
        single() { return this.maybeSingle(); },
      };
    },
  };
  vm.runInNewContext(checkIn, {
    app: { post: (path, limiter, auth, fn) => { handler = fn; } },
    attendanceLimiter: () => {},
    requireAuthAI: () => {},
    BUSINESS_TZ: 'Europe/Berlin',
    supabase,
    console,
  });
  const res = {
    status(code) { status = code; return this; },
    json(value) { result = value; return this; },
  };
  await handler({ auth: { userId: 'employee' }, body }, res);
  return { status, result, inserted, queries };
}

test('Anwesenheit: Check-in ignoriert alte GPS-Eingaben und speichert die Standortzuordnung', async () => {
  const { status, result, inserted, queries } = await runCheckIn({ business_id: site, lat: 12.3, lng: 45.6 });
  assert.equal(status, 200);
  assert.equal(result.ok, true);
  assert.equal(result.gps_checked, false);
  assert.equal(result.check_in_valid, null);
  assert.equal(inserted.check_in_at, result.check_in_at);
  assert.equal(inserted.business_id, site);
  assert.equal(inserted.owner_id, 'owner');
  assert.equal(inserted.check_in_valid, null);
  assert.deepEqual(Object.keys(inserted).sort(), ['business_id', 'check_in_at', 'check_in_valid', 'date', 'employee_id', 'owner_id', 'status']);
  assert.deepEqual(queries.filter(query => query.table !== 'attendance'), [
    { table: 'profiles', fields: ['owner_id, role'], filters: { id: 'employee' } },
    { table: 'businesses', fields: ['id'], filters: { id: site, owner_id: 'owner' } },
  ]);
});

test('Anwesenheit: Check-in weist den Standort eines fremden Mandanten vor dem Schreiben ab', async () => {
  const { status, result, inserted, queries } = await runCheckIn({ business_id: site }, 'foreign');
  assert.equal(status, 404);
  assert.equal(result.error, 'Standort nicht gefunden');
  assert.equal(inserted, undefined);
  assert.equal(queries.some(query => query.table === 'attendance'), false);
});

test('Anwesenheit: Check-in einer Einzelpraxis ohne Standortzuordnung ist möglich', async () => {
  const { status, result, inserted, queries } = await runCheckIn({});
  assert.equal(status, 200);
  assert.equal(result.ok, true);
  assert.equal(inserted.business_id, null);
  assert.equal(queries.some(query => query.table === 'businesses'), false);
});

test('Anwesenheit: Fehlermeldungen an die App sind deutsch (attendance.js zeigt data.error direkt an)', () => {
  const block = source.slice(source.indexOf("app.post('/api/attendance/check-in'"), source.indexOf('// ---- Gece 23:55 auto-close'));
  assert.ok(block.length > 1000);
  const fremd = [...block.matchAll(/error: '([^']*)'/g)].map(m => m[1]).filter(t => /[ıİğĞşŞ]|bulunamad|zorunlu|yapıldı|kaydedilemedi|sorgulanamad|hatası|Güncellenecek/.test(t));
  assert.deepEqual(fremd, []);
});
