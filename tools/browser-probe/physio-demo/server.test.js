import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, writeFile, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {baueFixture, baueBoot, erstelleHandler, pruefeOptionen, REPO_ROOT, SPEICHER_KEY, CSP, MAX_BODY_BYTES} from './server.mjs';

const original=await readFile(resolve(REPO_ROOT,'tools/browser-probe/redesign-fixture.js'),'utf8');
const owner='10000000-0000-4000-8000-000000000001';
function fixture({saved, failStorage=false}={}) {
  const store=new Map(saved?[[SPEICHER_KEY,JSON.stringify(saved)]]:[]);
  let fail=failStorage;
  const context=vm.createContext({window:{__rsDay:'2026-10-30'},structuredClone,crypto:webcrypto,Intl,Date,setTimeout,
    localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>{if(fail)throw new Error('quota');store.set(k,v);}}});
  const source=baueFixture({original,tabellenOverrides:{profiles:[{id:owner,sector:'physiotherapy'}],leads:[],services:[{id:'s1',title:'KG'}],bookings:[]}});
  vm.runInContext(source.replace('export function createClient()','function createClient()'),context);
  return {api:context.window.__lokaleTestpraxis,store,setFail:v=>{fail=v;}};
}
test('Physio injection precedes persistence; prior browser values win only in isolated store',()=>{
  const fresh=fixture(); assert.equal(fresh.api.tabellen.profiles[0].sector,'physiotherapy');
  assert.equal(fresh.store.has('praxura-lokale-testpraxis-v1'),false);
  const restored=fixture({saved:{version:1,tables:{leads:[{id:'persisted'}]}}});
  assert.equal(restored.api.tabellen.leads[0].id,'persisted');
  assert.equal(restored.api.tabellen.profiles[0].sector,'physiotherapy');
});
test('create patient, targeted update and upsert preserve one record across reload',async()=>{
  const f=fixture(); const c=f.api.client;
  const inserted=await c.from('leads').insert({first_name:'Clara',last_name:'Probe'}).select().single();
  assert.equal(inserted.error,null); assert.equal(inserted.data.name,'Clara Probe');
  assert.equal(inserted.data.owner_id,owner);
  const id=inserted.data.id;
  assert.equal((await c.from('leads').update({notes:'synthetisch'}).eq('id',id)).error,null);
  await c.from('leads').upsert({id,notes:'neu'},{onConflict:'id'});
  assert.equal(f.api.tabellen.leads.length,1);
  const next=fixture({saved:JSON.parse(f.store.get(SPEICHER_KEY))});
  assert.equal((await next.api.client.from('leads').select().eq('id',id).single()).data.notes,'neu');
});
test('unfiltered and unsupported-filter writes fail without changing rows',async()=>{
  const {api}=fixture(); await api.client.from('leads').insert({id:'p1'});
  for(const q of [api.client.from('leads').update({notes:'bad'}),api.client.from('leads').delete(),
    api.client.from('leads').delete().eq('id','p1').or('id.eq.p1'),
    api.client.from('leads').delete().eq('id','p1').overlaps('tags',[]),
    api.client.from('leads').delete().not('id','unknown','x')]) {
    assert.equal((await q).error.code,'LOCAL_UNSUPPORTED');
  }
  assert.equal(api.tabellen.leads.length,1); assert.equal(api.tabellen.leads[0].notes,undefined);
});
test('targeted delete preserves unrelated patient',async()=>{
  const {api}=fixture(); await api.client.from('leads').insert([{id:'p1'},{id:'p2'}]);
  await api.client.from('leads').delete().match({id:'p1'});
  assert.equal(api.tabellen.leads.length,1);assert.equal(api.tabellen.leads[0].id,'p2');
});
test('service assignment reads rebuild relations after delete and insert',async()=>{
  const {api}=fixture();const c=api.client;
  await c.from('employee_services').insert({employee_id:owner,service_id:'s1'});
  let read=await c.from('services').select('*,employee_services(*)').eq('id','s1').single();
  assert.equal(read.data.employee_services.length,1);
  assert.equal(read.data.employee_services[0].employee_id,owner);
  await c.from('employee_services').delete().eq('service_id','s1');
  await c.from('employee_services').insert({employee_id:'other',service_id:'s1'});
  read=await c.from('services').select('*,employee_services(*)').eq('id','s1').single();
  assert.equal(read.data.employee_services.length,1);
  assert.equal(read.data.employee_services[0].employee_id,'other');
});
test('storage failure rolls back entire write and reports error',async()=>{
  const f=fixture(); await f.api.client.from('leads').insert({id:'p1',notes:'before'});
  f.setFail(true);
  const result=await f.api.client.from('leads').update({notes:'after'}).eq('id','p1');
  assert.equal(result.error.code,'LOCAL_STORAGE_FAILED');assert.equal(f.api.tabellen.leads[0].notes,'before');
});
test('unknown table writes and RPC fail explicitly',async()=>{
  const {api}=fixture();
  assert.equal((await api.client.from('real_payments').insert({amount:1})).error.code,'LOCAL_UNSUPPORTED');
  assert.equal((await api.client.rpc('invented_success')).error.code,'LOCAL_UNSUPPORTED');
  assert.equal((await api.client.rpc('get_default_business')).error,null);
});
test('actual anamnese writer supports local upsert and reopen',async()=>{
  const {api}=fixture();
  assert.equal((await api.client.from('anamnese').upsert({owner_id:owner,patient_id:'p1',fachbereich:'physio',data:{ziel:'Treppensteigen'}},{onConflict:'patient_id'})).error,null);
  assert.equal((await api.client.from('anamnese').select().eq('patient_id','p1').single()).data.data.ziel,'Treppensteigen');
});
test('anamnese demo versions only same patient, owner and field; failed persistence rolls back flags',async()=>{
  const f=fixture();const c=f.api.client;
  const payload={owner_id:owner,patient_id:'p1',fachbereich:'physio',beschwerden:'synthetisch'};
  await c.from('anamnese').insert(payload);
  await c.from('anamnese').insert({...payload,patient_id:'p2'});
  await c.from('anamnese').insert({...payload,beschwerden:'Version zwei'});
  const latest=await c.from('anamnese').select().eq('patient_id','p1').eq('ist_aktuell',true).single();
  assert.equal(latest.data.version,2);assert.equal(latest.data.beschwerden,'Version zwei');
  assert.equal(f.api.tabellen.anamnese.find(r=>r.patient_id==='p2').ist_aktuell,true);
  f.setFail(true);assert.equal((await c.from('anamnese').insert(payload)).error.code,'LOCAL_STORAGE_FAILED');
  assert.equal(f.api.tabellen.anamnese.length,3);assert.equal(f.api.tabellen.anamnese.find(r=>r.version===2).ist_aktuell,true);
});
test('service assignment replacement uses explicit filtered delete and insert',async()=>{
  const {api}=fixture();await api.client.from('employee_services').insert({employee_id:'e1',service_id:'s1'});
  await api.client.from('employee_services').delete().eq('employee_id','e1');
  await api.client.from('employee_services').insert({employee_id:'e1',service_id:'s2'});
  assert.equal(api.tabellen.employee_services.length,1);assert.equal(api.tabellen.employee_services[0].service_id,'s2');
});
test('fixture connection drift fails before serving',()=>{
  assert.throws(()=>baueFixture({original:original.replace('const tabellen =','const changed ='),tabellenOverrides:{leads:[]}}),/Fixture-Anschluss/);
});
test('CLI options reject public/invalid settings and boot states limits',()=>{
  for(const options of [{port:80},{port:'18086x'},{rolle:'admin'},{tag:'2026-02-30'}]) assert.throws(()=>pruefeOptionen(options));
  assert.deepEqual(pruefeOptionen({port:'18086',rolle:'employee',tag:'2026-10-30'}),{port:18086,rolle:'employee',tag:'2026-10-30'});
  assert.match(baueBoot({rolle:'owner',tag:'2026-10-30'}),/Finanzkarten: feste Beispiele/);
  assert.match(CSP,/connect-src 'self'/);
});
async function request(handler,url,{method='GET',host='127.0.0.1:18086'}={}) {
  const response={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers);},end(body){this.body=body;}};
  await handler({url,method,headers:{host}},response);return response;
}
test('handler serves local app and denies backend mutation, unknown API, foreign Host',async()=>{
  const handler=erstelleHandler({root:REPO_ROOT,port:18086,rolle:'owner',fixture:'demo fixture',boot:'demo boot',antworten:{'/api/safe':{synthetic:true}}});
  const html=await request(handler,'/dashboard.html');assert.equal(html.status,200);assert.match(String(html.body),/src="\/demo-boot.js"/);
  assert.equal(html.headers['Content-Security-Policy'],CSP);
  assert.equal((await request(handler,'/api/safe')).status,200);
  assert.equal((await request(handler,'/api/safe',{method:'POST'})).status,501);
  assert.equal((await request(handler,'/api/booking/create')).status,501);
  assert.equal((await request(handler,'/dashboard.html',{host:'attacker.invalid'})).status,403);
  assert.equal((await request(handler,'/vendor/supabase-js.js')).body,'demo fixture');
  assert.equal((await request(handler,'/dashboard.html',{method:'HEAD'})).body,undefined);
});
test('private dirs, dot paths, traversal encoding and symlink escapes are denied',async()=>{
  const dir=await mkdtemp(resolve(tmpdir(),'physio-handler-'));
  const outside=await mkdtemp(resolve(tmpdir(),'physio-outside-'));
  try {
    await writeFile(resolve(outside,'secret.js'),'private');await symlink(resolve(outside,'secret.js'),resolve(dir,'leak.js'));
    const handler=erstelleHandler({root:dir,port:18086,rolle:'owner',fixture:'',boot:'',antworten:{}});
    for(const path of ['/tools/redesign-harness.mjs','/.env','/%2e%2e%2fsecret.js','/db/SCHEMA.sql','/leak.js','/api-backend/server.js']) {
      assert.equal((await request(handler,path)).status,403,path);
    }
  } finally {await rm(dir,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
});

async function engineRequest(handler,{host='127.0.0.1:18086',origin='http://127.0.0.1:18086',method='POST',data,raw}={}) {
  const req={url:'/__physio_demo_engine',method,headers:{host,origin,'content-type':'application/json'},async *[Symbol.asyncIterator](){yield raw??JSON.stringify(data??{pfad:'/api/rezept/confirm',methode:'POST',body:{patient_id:'p1'},tabellen:{profiles:[]}});}};
  const res={setHeader(){},writeHead(status){this.status=status;},end(body){this.body=body;}};
  await handler(req,res);return res;
}
test('engine endpoint rejects foreign origin, bad route, huge body, and does not expose GET',async()=>{
  let calls=0;
  const handler=erstelleHandler({root:REPO_ROOT,port:18086,rolle:'owner',fixture:'',boot:'',engine:async()=>{calls++;}});
  assert.equal((await engineRequest(handler,{origin:'https://foreign.invalid'})).status,403);
  assert.equal((await engineRequest(handler,{method:'GET'})).status,404);
  assert.equal((await engineRequest(handler,{raw:'x'.repeat(MAX_BODY_BYTES+1)})).status,413);
  assert.equal((await engineRequest(handler,{data:{pfad:'/api/gmail/send',methode:'POST',body:{},tabellen:{profiles:[]}}})).status,400);
  assert.equal(calls,0);
});
test('engine success carries synthetic tables; error carries no tentative mutations',async()=>{
  const args=[];
  const handler=erstelleHandler({root:REPO_ROOT,port:18086,rolle:'employee',fixture:'',boot:'',engine:async a=>{args.push(a);return {status:201,body:{id:'new'},tabellen:{prescriptions:[{id:'new'}]}};}});
  const ok=await engineRequest(handler); assert.equal(ok.status,201);assert.equal(JSON.parse(ok.body).tabellen.prescriptions[0].id,'new');
  assert.equal(args[0].rolle,'employee');
  const failHandler=erstelleHandler({root:REPO_ROOT,port:18086,rolle:'owner',fixture:'',boot:'',engine:async()=>({status:422,body:{error:'validation'},tabellen:{prescriptions:[{id:'partial'}]}})});
  assert.deepEqual(JSON.parse((await engineRequest(failHandler)).body),{error:'validation'});
});
test('browser adapter persists successful engine response, rejects intervening edits and failed response',async()=>{
  let deferred;let mode='success';const store=new Map();
  const tables={leads:[{id:'p1'}]};
  const window={__lokaleTestpraxis:{tabellen:tables},addEventListener(){},fetch:async()=>{
    if(mode==='wait')await new Promise(r=>{deferred=r;});
    return new Response(JSON.stringify(mode==='error'?{error:'bad'}:{body:{id:'new'},tabellen:{leads:[{id:'p2'}]}}),{status:mode==='error'?422:201});
  }};
  const context=vm.createContext({window,localStorage:{setItem:(k,v)=>store.set(k,v)},location:{href:'http://127.0.0.1:18086/dashboard.html',origin:'http://127.0.0.1:18086'},Request,Response,URL});
  vm.runInContext(baueBoot({rolle:'owner',tag:'2026-10-30'}),context);
  const call=()=>window.fetch('/api/rezept/confirm',{method:'POST',body:'{}'});
  assert.equal((await call()).status,201);assert.equal(tables.leads[0].id,'p2');assert.equal(JSON.parse(store.get(SPEICHER_KEY)).tables.leads[0].id,'p2');
  mode='wait';const pending=call();await new Promise(r=>setImmediate(r));tables.leads.push({id:'intervening'});deferred();assert.equal((await pending).status,409);assert.equal(tables.leads.length,2);
  mode='error';assert.equal((await call()).status,422);assert.equal(tables.leads.length,2);
});
