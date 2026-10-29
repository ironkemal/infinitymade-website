import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dokumentiereSitzung,liesSitzungsnotizEntwurf} from './sitzung-dokumentation.js';

const basis={bookingId:'booking-A',ownerId:'owner-A',userId:'user-A',status:'done',notes:'Mobilisation Knie – exakt',terminStart:'2026-11-02T15:00:00Z'};
function db({error,leer=false,abweichend=false}={}){
  const rows=leer?[]:[{id:'session-A',prescription_id:'rx-A',booking_id:'booking-A',status:'planned'}];
  return {rows,from(){let patch;const q={update(p){patch=p;return q;},eq(k,v){assert.equal(k,'booking_id');assert.equal(v,'booking-A');return q;},async select(){if(error)return {data:null,error};rows.forEach(r=>Object.assign(r,patch));return {data:rows.map(r=>({...r,...(abweichend?{notes:'anderer Text'}:{})})),error:null};}};return q;}};
}
test('Sessionstatus, exakte Notiz und Identitäten bleiben nach bestätigtem Write/JSON-Reload erhalten',async()=>{
  const sb=db();const fort=[];const r=await dokumentiereSitzung({...basis,supabase:sb,fortschritt:async(_,id)=>fort.push(id)});
  assert.equal(r.gespeichert,true);assert.deepEqual(fort,['rx-A']);
  const [row]=JSON.parse(JSON.stringify(sb.rows));assert.equal(row.notes,basis.notes);assert.equal(row.status,'done');assert.equal(row.id,'session-A');assert.equal(row.prescription_id,'rx-A');assert.equal(row.booking_id,'booking-A');assert.equal(row.done_at,basis.terminStart);
  assert.equal(liesSitzungsnotizEntwurf(basis),'');
});
for(const [name,opt] of [['Storagefehler',{error:{code:'LOCAL_STORAGE_FAILED'}}],['null Zeilen',{leer:true}],['unbestätigter Text',{abweichend:true}]])test(`${name}: kein Erfolg, Notiz bleibt isoliert verfügbar`,async()=>{
  let fort=0;const sb=db(opt);const r=await dokumentiereSitzung({...basis,supabase:sb,fortschritt:async()=>fort++});
  assert.equal(r.ok,false);assert.equal(r.gespeichert,false);assert.ok(r.meldung);assert.equal(fort,0);assert.equal(liesSitzungsnotizEntwurf(basis),basis.notes);
  for(const scope of [{...basis,bookingId:'booking-B'},{...basis,ownerId:'owner-B'},{...basis,userId:'user-B'}])assert.equal(liesSitzungsnotizEntwurf(scope),'');
});
test('Fortschrittsfehler behauptet keinen Rollback der gespeicherten Notiz',async()=>{
  const r=await dokumentiereSitzung({...basis,supabase:db(),fortschritt:async()=>{throw Error('synthetisch');}});
  assert.equal(r.gespeichert,true);assert.match(r.meldung,/Sitzung gespeichert/);assert.equal(liesSitzungsnotizEntwurf(basis),'');
});

const source=readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
const start=source.indexOf('async function handleTerminStarten()');
const ende=source.indexOf('\nfunction checkPlanActive()',start);
for(const hausbesuch of [false,true])for(const erfolgreich of [false,true])test(`Original-Klickhandler wartet Write ab (Hausbesuch=${hausbesuch}, Erfolg=${erfolgreich})`,async()=>{
  let release,entered;const wait=new Promise(r=>release=r),paused=new Promise(r=>entered=r),nav=[],hinweise=[];
  const ctx=vm.createContext({bkActionBookingCache:{id:'booking-A',customer_name:'',start_time:basis.terminStart,hausbesuch,fahrt_status:'fahrt_return_pending'},currentSession:{user:{id:'user-A'}},getOwnerId:()=> 'owner-A',getSector:()=> 'physiotherapy',terminIstPodo:()=>false,bkActionTimer:null,closeBkActionPanel(){},showInputModal:async()=>basis.notes,liesSitzungsnotizEntwurf,markPrescriptionSession:async(...args)=>{assert.equal(args[0],'booking-A');entered();await wait;return {gespeichert:erfolgreich,meldung:erfolgreich?'':'Nicht gespeichert'};},calculateSessionInfo:async()=>({current:2}),switchPanel:p=>nav.push(p),renderBkActionFahrtState:async()=>nav.push('fahrt'),showToast:m=>hinweise.push(m),prefillNotesPatientId:null});
  vm.runInContext(source.slice(start,ende),ctx);const pending=ctx.handleTerminStarten();await paused;assert.deepEqual(nav,[]);release();await pending;
  assert.deepEqual(nav,erfolgreich?[hausbesuch?'fahrt':'notizen']:[]);assert.equal(hinweise.length,erfolgreich?0:1);
});
