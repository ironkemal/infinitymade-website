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
