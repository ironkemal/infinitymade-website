import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
const handler=source.slice(source.indexOf("document.getElementById('bkSaveBtn').addEventListener"));
const snapshot=handler.match(/  const serienKontext = .*;\n/)?.[0];
const firstAwait=handler.indexOf('await ');
const start=handler.indexOf('    await speichereLeistungenFuerErstellte(created, { showToast });');
const end=handler.indexOf('    // Terminbestätigung drucken dialog',start);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;

for(const ursprungsFlow of [false,true])test(`Originalaufrufer bindet nach Dialog-/Ownerwechsel ursprünglichen Kontext (Flow=${ursprungsFlow})`,async()=>{
  assert.ok(snapshot&&handler.indexOf(snapshot)<firstAwait,'Snapshot muss vor erstem await entstehen');
  assert.ok(start>=0&&end>start);
  const selected={value:'rx-A'},window={_physioFlow:ursprungsFlow?{prescription_id:'flow-A'}:null};
  let owner='owner-A',release,entered;
  const wait=new Promise(r=>release=r),paused=new Promise(r=>entered=r),calls=[];
  const run=new AsyncFunction('document','window','custId','getOwnerId','created','speichereLeistungenFuerErstellte','showToast','closeModal','refreshBookingViews','meldePodoSerienBindung','supabase','emit','bindeSerieAnVerordnung','gleicheSitzungenAb',snapshot+handler.slice(start,end));
  const record=async(_,o)=>{calls.push(o);return {ok:true,gebunden:1};};
  const pending=run({getElementById:()=>selected},window,'patient-A',()=>owner,[{id:'booking-A'}],async()=>{},()=>{},()=>{},async()=>{entered();await wait;},record,{},()=>{},record,()=>{});
  await paused;selected.value='rx-B';owner='owner-B';window._physioFlow={prescription_id:'flow-B'};release();await pending;
  assert.equal(calls.length,1);assert.equal(calls[0].prescriptionId,ursprungsFlow?'flow-A':'rx-A');assert.equal(calls[0].ownerId,'owner-A');
  if(!ursprungsFlow)assert.equal(calls[0].patientId,'patient-A');
});
