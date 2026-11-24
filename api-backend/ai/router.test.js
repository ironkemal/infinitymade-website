import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {validateKiChallenge} from '../../module/ki-client.js';
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-unused-key';
const {createAiRouter} = await import('./router.js');
import {createFakeOwnerDecisionStore,CURRENT_EINWILLIGUNG_VERSION} from './ki-einwilligung.js';
const id='22222222-2222-4222-8222-222222222222';
const owner={role:'owner',userId:id,tenantId:id};
const employee={role:'employee',userId:'33333333-3333-4333-8333-333333333333',tenantId:id};
const client={from:()=>({insert:async()=>({error:null})})};
/** @type {Record<string, unknown>} */
const active={mode:'direkt',valid:true,activationReady:true,mailReady:true,allowFreeText:true};
/** @param {any} req @param {any} res @param {any} next */
const authMiddleware=(req,res,next)=>req.auth?next():res.status(401).json({success:false,error:'Authentifizierung erforderlich'});
/** @param {Record<string, any>} [options] */
function router(options={}) {return createAiRouter({store:createFakeOwnerDecisionStore({defaultEnabled:true}),configProvider:()=>active,authMiddleware,supabase:/** @type {any} */ (client),...options});}
/** @param {import('express').Router} r @param {{ method?: string, path?: string, body?: unknown, auth?: { role: string, userId: string, tenantId: string } | null }} [opts] */
async function request(r,{method='GET',path='/_config',body,auth=owner}={}) {
 const app=express();app.use(express.json());
 app.use((/** @type {any} */ req,/** @type {any} */ _res,/** @type {any} */ next)=>{req.auth=auth;next();});
 app.use('/api/ai',r);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 try {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const res=await fetch(`http://127.0.0.1:${port}/api/ai${path}`,{method,headers:{'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:res.status,body:await res.json()};
 }
 finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('Authenticated health and owner-only configuration',async()=>{
 assert.equal((await request(router(),{path:'/_health',auth:null})).status,401);
 assert.equal((await request(router(),{auth:employee})).status,403);
 assert.equal((await request(router(),{auth:{...owner,userId:employee.userId}})).status,403);
 const res=await request(router());assert.equal(res.body.active,true);assert.equal(res.body.optIn.enabled,true);
});
test('Configuration requires strict valid/operator/owner state and hides arbitrary mode',async()=>{
 for(const cfg of [{...active,valid:undefined},{...active,valid:'true'},{...active,activationReady:'true'},{...active,mode:'PATIENT_SENTINEL'},{...active,mode:'aus'}]) {
  const res=await request(router({configProvider:()=>cfg}));assert.equal(res.body.active,false);assert.ok(!JSON.stringify(res.body).includes('PATIENT_SENTINEL'));
 }
 assert.equal((await request(router({store:createFakeOwnerDecisionStore({defaultEnabled:false})}))).body.active,false);
});
test('Employee state exposes only effective capabilities, mail gate and freeText gate',async()=>{
 for(const mode of ['direkt','jeton']) for(const mailReady of [false,true]) for(const allowFreeText of [false,true]) {
  const cfg={...active,mode,mailReady,allowFreeText};const res=await request(router({configProvider:()=>cfg}),{path:'/_healthstate',auth:employee});
  assert.equal(res.status,200);assert.equal(res.body.active,true);
  assert.deepEqual(res.body.capabilities,{freeText:allowFreeText,mailDraft:mailReady&&allowFreeText,appointmentDraft:mailReady});
  assert.equal(res.body.optIn,undefined);assert.equal(res.body.operatorReady,undefined);
 }
});
test('Owner opt-in exact payload and revocation invalidate actual tenant cache hook',async()=>{
 /** @type {string | null} */
 let invalidated=null;const r=router({store:createFakeOwnerDecisionStore({defaultEnabled:false}),invalidateJeton:(/** @type {string} */ tenant)=>{invalidated=tenant;}});
 assert.equal((await request(r,{method:'PATCH',auth:employee,body:{enabled:true}})).status,403);
 for(const body of [{enabled:'false'},{enabled:true,activationReady:true},{enabled:true,tenantId:id}]) assert.equal((await request(r,{method:'PATCH',body})).status,400);
 const enabled=await request(r,{method:'PATCH',body:{enabled:true,informationVersion:CURRENT_EINWILLIGUNG_VERSION}});assert.equal(enabled.status,200);assert.equal(enabled.body.optIn.enabled,true);
 const revoked=await request(r,{method:'PATCH',body:{enabled:false}});assert.equal(revoked.status,200);assert.equal(revoked.body.optIn.enabled,false);assert.equal(invalidated,id);
});
test('Server dependencies cannot be replaced through client payload; usage reaches audit',async()=>{
 /** @type {any} */
 let received;
 /** @type {any} */
 let row;
 const db={from:(/** @type {string} */ table)=>{assert.equal(table,'ai_audit_log');return {insert:async (/** @type {unknown} */ value)=>{row=value;return {error:null};}};}};
 const r=router({supabase:db,tasks:{fixture:async(/** @type {any} */ payload,/** @type {any} */ context)=>{received=context;assert.equal(payload.dependencies.supabase,'attacker');return {draft:{subject:'Hallo'},_meta:{usage:{prompt_tokens:2,completion_tokens:3,total_tokens:5}}};}}});
 const res=await request(r,{method:'POST',path:'/fixture',body:{dependencies:{supabase:'attacker'}}});assert.equal(res.status,200);assert.equal(received.dependencies.supabase,db);assert.equal(res.body._meta,undefined);assert.equal(row.total_tokens,5);
});
test('Task failures and unknown paths never reflect internal sentinel',async()=>{
 /** @type {Error & { code?: string }} */
 const err=new Error('PATIENT_SENTINEL endpoint SECRET');err.code='AI_TIMEOUT';
 const r=router({tasks:{failure:async()=>{throw err;}}});
 const failed=await request(r,{method:'POST',path:'/failure',body:{}});assert.equal(failed.status,503);assert.equal(failed.body.code,'AI_TIMEOUT');assert.ok(!JSON.stringify(failed.body).includes('SENTINEL'));
 assert.equal((await request(r,{method:'POST',path:'/constructor',body:{}})).status,404);
 const unknown=await request(r,{method:'POST',path:'/PATIENT_SENTINEL',body:{}});assert.equal(unknown.status,404);assert.ok(!JSON.stringify(unknown.body).includes('SENTINEL'));
});
test('Only bounded fresh complete challenge receives 409 candidate response',async()=>{
 const expiresAt=Date.now()+60000;const challengeId='a'.repeat(64)+'.'+expiresAt;
 const good={code:'KI_RUECKFRAGE',challengeId,expiresAt,candidates:[{id:'c_1',text:'Synthetische Rückfrage',type:'NAME'}]};
 const r=router({tasks:{question:async()=>{throw good;}}});const res=await request(r,{method:'POST',path:'/question',body:{}});assert.equal(res.status,409);assert.equal(res.body.challengeId,challengeId);assert.deepEqual(res.body.candidates,[{id:'c_1',text:'Synthetische Rückfrage',type:'NAME'}]);assert.equal(validateKiChallenge(res.body),true,'Real router challenge must satisfy client contract');
 for(const bad of [{...good,expiresAt:1},{...good,challengeId:'PATIENT_SENTINEL'},{...good,candidates:[{id:'x',text:'x'.repeat(201),type:'NAME'}]},{...good,candidates:[{id:'x',text:'Synthetisch',type:'PATIENT_SENTINEL'}]}]) {
  const rejected=await request(router({tasks:{question:async()=>{throw bad;}}}),{method:'POST',path:'/question',body:{}});assert.equal(rejected.body.candidates,undefined);assert.ok(!JSON.stringify(rejected.body).includes('PATIENT_SENTINEL'));
 }
});

// KI-Aufgaben einzeln an/aus (Phase 7b, 23.11.2026)
test('PATCH /_aufgaben: nur Inhaber, Body exakt, GET /_config zeigt Sperren', async () => {
 const {createAufgabenSperreStore} = await import('./ki-aufgaben-sperre.js');
 const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-aufg-r-')); fs.chmodSync(dir, 0o700);
 const aufgabenStore = createAufgabenSperreStore({ directory: dir });
 const r = router({ aufgabenStore });
 assert.equal((await request(r, { method: 'PATCH', path: '/_aufgaben', body: { gesperrt: ['serie'] }, auth: employee })).status, 403);
 assert.equal((await request(r, { method: 'PATCH', path: '/_aufgaben', body: { gesperrt: ['serie'], extra: 1 } })).status, 400);
 assert.equal((await request(r, { method: 'PATCH', path: '/_aufgaben', body: { gesperrt: ['unbekannt'] } })).status, 400);
 const ok = await request(r, { method: 'PATCH', path: '/_aufgaben', body: { gesperrt: ['serie'] } });
 assert.equal(ok.status, 200); assert.deepEqual(ok.body.gesperrt, ['serie']);
 const cfg = await request(r);
 assert.deepEqual(cfg.body.aufgaben.filter((/** @type {any} */ a) => a.gesperrt).map((/** @type {any} */ a) => a.id), ['serie']);
});

// KI-Stufe 2 Option D (Konsey 24.11.2026): Verbindungstest + Anzeige eigener Zugang
test('POST /_verbindungstest: nur Inhaber, nur direkt, synthetischer Ping, nur ok/Code zurück', async () => {
 /** @type {any[]} */ const pings = [];
 const ok = async (/** @type {any} */ o) => { pings.push(o); return { content: 'OK' }; };
 const r = router({ pingTransport: ok });
 assert.equal((await request(r, { method: 'POST', path: '/_verbindungstest', body: {}, auth: employee })).status, 403);
 const res = await request(r, { method: 'POST', path: '/_verbindungstest', body: { endpoint: 'https://evil.example' } });
 assert.equal(res.status, 200); assert.deepEqual(res.body, { success: true, ok: true });
 assert.equal(pings.length, 1);
 assert.deepEqual(pings[0].messages, [{ role: 'system', content: 'Antworte nur mit OK.' }, { role: 'user', content: 'OK?' }]);
 assert.equal(JSON.stringify(pings[0]).includes('evil'), false, 'Body des Clients fließt nicht in den Ping');
 const fehler = router({ pingTransport: async () => { const e = /** @type {any} */ (new Error('Antwort mit Geheimnis https://intern')); e.code = 'AI_HTTP_401'; throw e; } });
 const f = await request(fehler, { method: 'POST', path: '/_verbindungstest', body: {} });
 assert.deepEqual(f.body, { success: true, ok: false, code: 'AI_HTTP_401' });
 const jeton = router({ configProvider: () => ({ ...active, mode: 'jeton' }), pingTransport: ok });
 assert.deepEqual((await request(jeton, { method: 'POST', path: '/_verbindungstest', body: {} })).body, { success: true, ok: false, code: 'NUR_DIREKT' });
});

test('anbieterAnzeige: eigener Host = „Eigener Azure-Zugang (Admin-Konfiguration)“, Praxura-Host = Microsoft-Name', async () => {
 const { anbieterAnzeige } = await import('./router.js');
 const { VERIFIED_AZURE_HOSTS } = await import('./ki-config.js');
 const eigen = anbieterAnzeige({ mode: 'direkt', provider: 'azure', region: 'germanywestcentral', endpoint: 'https://praxis-muster.openai.azure.com' });
 assert.equal(eigen?.name, 'Eigener Azure-Zugang (Admin-Konfiguration)'); assert.equal(eigen?.eigener, true);
 assert.equal(JSON.stringify(eigen).includes('praxis-muster'), false, 'Host wird nicht angezeigt');
 const pr = anbieterAnzeige({ mode: 'direkt', provider: 'azure', region: 'swedencentral', endpoint: `https://${VERIFIED_AZURE_HOSTS[0]}` });
 assert.equal(pr?.name, 'Microsoft Azure OpenAI'); assert.equal(pr?.eigener, undefined);
});
