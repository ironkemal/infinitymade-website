import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Import the actual Express router and Supabase SDK with synthetic configuration.
// Only SDK transport is mocked; filters and projections travel through PostgREST.
const routeUrl = new URL('./warteliste.routes.js', import.meta.url);
let importSequence = 0;
const source = fs.readFileSync(routeUrl, 'utf8')
  .replace(/from '([^']+)'/g, (_match, specifier) => {
    const resolved = specifier.startsWith('.') ? new URL(specifier, routeUrl).href : import.meta.resolve(specifier);
    return `from '${resolved}'`;
  })
  .replace('process.env.SUPABASE_URL', "'http://warteliste.synthetic.invalid'")
  .replace('process.env.SUPABASE_SERVICE_ROLE_KEY', "'synthetic-test-key'")
  .replace('{ auth: { persistSession: false } }',
    '{ auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: globalThis.__wartelisteSyntheticFetch } }');

async function setup({ employee = false, dbError = null, largeList = false } = {}) {
  const writes = [], reads = [];
  const tables = {
    profiles: [{id: 'owner-a', role: 'owner'}, {id: 'team-a', role: 'employee', owner_id: 'owner-a'}],
    leads: [{id:'lead-a', owner_id:'owner-a', first_name:'Own', phone:'own-phone'}, {id:'lead-b', owner_id:'owner-b', first_name:'SECRET', phone:'SECRET'}],
    services: [
      {id:'service-a', owner_id:'owner-a', title:'Own', duration_minutes:30, is_internal:true},
      {id:'legacy-a', owner_id:null, user_id:'owner-a', title:'Legacy', duration_minutes:45},
      {id:'service-b', owner_id:'owner-b', title:'SECRET'},
      {id:'conflicting', owner_id:'owner-b', user_id:'owner-a', title:'SECRET'},
    ],
    bookings: [{id:'booking-a', owner_id:'owner-a', start_time:'2026-10-19T08:00:00Z', end_time:'2026-10-19T09:00:00Z'}, {id:'booking-b', owner_id:'owner-b'}, {id:'legacy-booking', owner_id:null, user_id:'owner-a'}, {id:'conflicting-booking', owner_id:'owner-b', user_id:'owner-a'}],
    warteliste: [
      {id:'entry-a', owner_id:'owner-a', lead_id:'lead-a', service_id:'service-a', status:'waiting'},
      {id:'forged', owner_id:'owner-a', lead_id:'lead-b', service_id:'service-b', status:'waiting'},
      {id:'legacy', owner_id:'owner-a', service_id:'legacy-a', status:'waiting'},
      {id:'conflicting', owner_id:'owner-a', service_id:'conflicting', status:'waiting'},
      {id:'entry-b', owner_id:'owner-b', lead_id:'lead-b', status:'waiting'},
    ],
  };
  if (largeList) {
    tables.leads = Array.from({ length: 210 }, (_, i) => ({
      id: '00000000-0000-4000-8000-' + String(i).padStart(12, '0'), owner_id: 'owner-a', first_name: 'Synthetic',
    }));
    tables.warteliste = tables.leads.map((lead, i) => ({ id: 'entry-' + i, owner_id: 'owner-a', lead_id: lead.id, status: 'waiting' }));
  }
  const response = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: {'Content-Type':'application/json'},
  });
  globalThis.__wartelisteSyntheticFetch = async (input, options = {}) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'warteliste.synthetic.invalid', 'No real network allowed');
    assert.ok(String(input).length < 8000, 'IN-Abfragen müssen unter üblichen HTTP-URL-Limits bleiben');
    const headers = new Headers(options.headers);
    if (url.pathname === '/auth/v1/user') {
      return headers.get('authorization') === 'Bearer valid'
        ? response({id:employee ? 'team-a' : 'owner-a'})
        : response({message:'invalid token'}, 401);
    }
    assert.ok(url.pathname.startsWith('/rest/v1/'));
    const table = url.pathname.split('/').at(-1);
    const method = options.method || 'GET';
    const projection = url.searchParams.get('select') || '*';
    reads.push({table, method, projection, url});
    if (dbError === table) return response({message:'synthetic db failure'}, 500);
    let rows = (tables[table] || []).filter(row => [...url.searchParams].every(([key, filter]) => {
      if (['select','order','limit','offset'].includes(key)) return true;
      if (filter.startsWith('eq.')) return String(row[key]) === filter.slice(3);
      if (filter === 'is.null') return row[key] == null;
      if (filter.startsWith('in.(')) return filter.slice(4, -1).split(',').map(v => v.replaceAll('"','')).includes(row[key]);
      assert.fail(`Unhandled SDK filter ${key}=${filter}`);
    }));
    if (method !== 'GET') {
      const mutation = options.body ? JSON.parse(options.body) : {};
      writes.push({table, method, mutation, url});
      if (method === 'POST') rows = [{id:'new', ...mutation}];
      else if (method === 'PATCH') rows = rows.map(row => ({...row, ...mutation}));
      else if (method === 'DELETE') return new Response(null, {status:204});
    }
    rows = rows.map(row => {
      if (projection === '*') return {...row};
      const projected = Object.fromEntries(projection.split(',').map(k => k.trim()).filter(k => Object.hasOwn(row, k)).map(k => [k, row[k]]));
      // Reproduce privileged embedded-join behavior if the regression returns.
      if (projection.includes('leads:lead_id')) projected.leads = tables.leads.find(l => l.id === row.lead_id) || null;
      if (projection.includes('services:service_id')) projected.services = tables.services.find(s => s.id === row.service_id) || null;
      return projected;
    });
    if (headers.get('accept')?.includes('application/vnd.pgrst.object+json')) {
      return rows.length === 1 ? response(rows[0]) : response({code:'PGRST116', message:'Expected one row'}, 406);
    }
    return response(rows);
  };
  let router;
  try {
    ({default: router} = await import('data:text/javascript;base64,' + Buffer.from(source + `\n// setup ${importSequence++}`).toString('base64')));
  } finally {
    delete globalThis.__wartelisteSyntheticFetch;
  }
  async function call(method, path, body = {}, token = 'valid', id = 'entry-a') {
    const res = {statusCode:200, status(n) {this.statusCode=n;return this;}, json(value) {this.body=value;return this;}};
    const req = {method:method.toUpperCase(),url:path.replace('/:id','/'+id),headers:{authorization:token ? 'Bearer '+token : undefined},body,query:{}};
    await new Promise((resolve, reject) => {
      const json = res.json;
      res.json = function(value) {json.call(this,value);resolve();return this;};
      router.handle(req,res,error => error ? reject(error) : reject(new Error('Route did not respond')));
    });
    return res;
  }
  return {call,writes,reads};
}
for (const field of ['lead_id','service_id']) test(`POST rejects foreign ${field}`, async () => {
  const {call,writes} = await setup(); const r = await call('post','/',{[field]:field === 'lead_id' ? 'lead-b' : 'service-b'});
  assert.equal(r.statusCode,400); assert.equal(writes.length,0);
});
test('PATCH rejects foreign matched booking',async()=>{
  const {call,writes}=await setup(); const r=await call('patch','/:id',{status:'matched',matched_booking_id:'booking-b'});
  assert.equal(r.statusCode,400);assert.equal(writes.length,0);
});
for (const route of ['list','match']) test(`${route} never exposes forged lead/service contacts`,async()=>{
  const {call}=await setup();const r=await call(route==='list'?'get':'post',route==='list'?'/':'/match',{booking_id:'booking-a'});
  assert.equal(r.statusCode,200);assert.ok(!JSON.stringify(r.body).includes('SECRET'));
  const rows=route==='list'?r.body:r.body.candidates;
  assert.equal(rows.find(r=>r.id==='forged').leads,null);
  assert.equal(rows.find(r=>r.id==='entry-a').leads.first_name,'Own');
  if(route==='list')assert.equal(rows.find(r=>r.id==='forged').services,null);
});
for(const employee of [false,true])for(const service of ['service-a','legacy-a'])test(`own refs allowed employee=${employee} service=${service}`,async()=>{
  const {call,writes}=await setup({employee});const r=await call('post','/',{lead_id:'lead-a',service_id:service});
  assert.equal(r.statusCode,201);assert.equal(writes[0].mutation.owner_id,'owner-a');
});
test('optional refs and matched booking clearing remain allowed',async()=>{
 const {call}=await setup();assert.equal((await call('post','/')).statusCode,201);
 assert.equal((await call('patch','/:id',{matched_booking_id:null})).statusCode,200);
});
test('missing and invalid auth do not write',async()=>{
 const {call,writes}=await setup();for(const token of ['', 'invalid'])assert.equal((await call('post','/',{},token)).statusCode,401);assert.equal(writes.length,0);
});
for(const table of ['leads','services'])test(`reference lookup ${table} error fails closed`,async()=>{
 const {call,writes}=await setup({dbError:table});const r=await call('post','/',{lead_id:'lead-a',service_id:'service-a'});assert.equal(r.statusCode,500);assert.equal(writes.length,0);
});
for(const field of ['lead_id','service_id'])test(`non-scalar ${field} denied`,async()=>{
 const {call,writes}=await setup();assert.equal((await call('post','/',{[field]:['lead-a']})).statusCode,400);assert.equal(writes.length,0);
});

for (const employee of [false, true]) test(`own booking PATCH and tenant write scope employee=${employee}`, async () => {
  const {call, writes} = await setup({employee});
  const result = await call('patch', '/:id', {status:'matched', matched_booking_id:'booking-a', notes:'synthetic'});
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.matched_booking_id, 'booking-a');
  assert.equal(writes[0].url.searchParams.get('owner_id'), 'eq.owner-a');
  assert.equal(writes[0].url.searchParams.get('id'), 'eq.entry-a');
});
for (const employee of [false, true]) test(`GET/match preserve own contacts and isolate reads employee=${employee}`, async () => {
  const {call, reads} = await setup({employee});
  for (const [method, path] of [['get','/'], ['post','/match']]) {
    const result = await call(method, path, {booking_id:'booking-a'});
    assert.equal(result.statusCode, 200);
    const rows = path === '/' ? result.body : result.body.candidates;
    assert.ok(!rows.some(row => row.id === 'entry-b'));
    assert.equal(rows.find(row => row.id === 'entry-a').leads.phone, 'own-phone');
    if (path === '/') {
      assert.deepEqual(rows.find(row => row.id === 'entry-a').services, {title:'Own',duration_minutes:30});
      assert.deepEqual(rows.find(row => row.id === 'legacy').services, {title:'Legacy',duration_minutes:45});
      assert.equal(rows.find(row => row.id === 'conflicting').services, null);
    }
  }
  for (const read of reads.filter(read => ['leads','services'].includes(read.table))) {
    if (read.table === 'services' && read.url.searchParams.get('owner_id') === 'is.null') {
      assert.equal(read.url.searchParams.get('user_id'), 'eq.owner-a');
    } else assert.equal(read.url.searchParams.get('owner_id'), 'eq.owner-a');
    assert.ok(read.url.searchParams.has('id'));
  }
  for (const read of reads.filter(read => read.table === 'warteliste')) {
    assert.ok(!read.projection.includes('leads:'));
    assert.ok(!read.projection.includes('services:'));
  }
});
test('canonical owner takes precedence over legacy user_id on POST', async () => {
  const {call,writes} = await setup();
  assert.equal((await call('post','/',{service_id:'conflicting'})).statusCode,400);
  assert.equal(writes.length,0);
});
for (const value of ['missing', '', [], {}, 42, false]) test(`PATCH rejects invalid booking reference ${JSON.stringify(value)}`, async () => {
  const {call,writes} = await setup();
  assert.equal((await call('patch','/:id',{matched_booking_id:value})).statusCode,400);
  assert.equal(writes.length,0);
});
test('booking lookup failure prevents PATCH', async () => {
  const {call,writes} = await setup({dbError:'bookings'});
  assert.equal((await call('patch','/:id',{matched_booking_id:'booking-a'})).statusCode,500);
  assert.equal(writes.length,0);
});
for (const table of ['leads','services']) test(`GET hydration ${table} failure never returns contacts`, async () => {
  const {call} = await setup({dbError:table});
  const result = await call('get','/');
  assert.equal(result.statusCode,500);
  assert.equal(result.body.candidates,undefined);
  assert.ok(!JSON.stringify(result.body).includes('own-phone'));
});
test('match hydration failure never returns contacts', async () => {
  const {call} = await setup({dbError:'leads'});
  const result = await call('post','/match',{booking_id:'booking-a'});
  assert.equal(result.statusCode,500);
  assert.equal(result.body.candidates,undefined);
});
for (const [method,path] of [['get','/'],['post','/'],['post','/match'],['patch','/:id'],['delete','/:id']]) {
  test(`${method} ${path} requires auth before database access`,async () => {
    const {call,writes,reads} = await setup();
    for (const token of ['', 'invalid']) assert.equal((await call(method,path,{},token)).statusCode,401);
    assert.equal(writes.length,0);
    assert.equal(reads.length,0);
  });
}
test('foreign entries cannot be patched or deleted; team cannot delete', async () => {
  const owner = await setup();
  for (const method of ['patch','delete']) {
    assert.equal((await owner.call(method,'/:id',{status:'cancelled'},'valid','entry-b')).statusCode,403);
  }
  assert.equal(owner.writes.length,0);
  const team = await setup({employee:true});
  assert.equal((await team.call('delete','/:id')).statusCode,403);
  assert.equal(team.writes.length,0);
  assert.equal((await owner.call('delete','/:id')).statusCode,200);
  assert.equal(owner.writes[0].url.searchParams.get('owner_id'),'eq.owner-a');
});
test('match requires own booking', async () => {
  const {call} = await setup();
  assert.equal((await call('post','/match',{booking_id:'booking-b'})).statusCode,403);
});
test('große Warteliste lädt Kontakte in begrenzten Mandantenabfragen', async () => {
  const { call, reads } = await setup({ largeList: true });
  const result = await call('get', '/');
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.length, 210);
  assert.ok(result.body.every(row => row.leads?.first_name === 'Synthetic'));
  assert.equal(reads.filter(read => read.table === 'leads').length, 3);
});
test('PATCH erhält eigene Legacy-Termine und bevorzugt owner_id vor user_id', async () => {
  const { call, writes } = await setup();
  assert.equal((await call('patch', '/:id', { matched_booking_id: 'legacy-booking' })).statusCode, 200);
  const before = writes.length;
  assert.equal((await call('patch', '/:id', { matched_booking_id: 'conflicting-booking' })).statusCode, 400);
  assert.equal(writes.length, before);
});
