import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {run as appointment} from './tasks/appointment-confirm-draft.js';
import {run as series} from './tasks/series-scheduler.js';
import {run as b2c} from './tasks/b2c-draft.js';
import {run as b2b} from './tasks/b2b-draft.js';
import {DIAGNOSEGRUPPEN} from './catalogs/rezept-optionen.js';
import {run as normalize} from './tasks/rezept-normalize.js';
import {run as ocr} from './tasks/rezept-ocr.js';
const id='11111111-1111-4111-8111-111111111111';
const cfg={mode:'jeton',valid:true,activationReady:true,mailReady:true,allowFreeText:false};
function context(transport,config=cfg) {return {tenantId:id,userId:id,role:'owner',dependencies:{config,ownerDecision:{enabled:true},dictionary:[],transport}};}
const response=output=>({content:JSON.stringify(output),model:'gpt-4o-mini',deployment:'local-test',usage:{prompt_tokens:2,completion_tokens:3,total_tokens:5},latency_ms:1});
const appPayload={patient:{name:'Müller, Zoë',email:'zoe@example.invalid'},service:{title:'Manuelle Therapie'},slots:[{date:'2026-10-09',time:'09:30',employeeName:'Frau Schmitt'},{date:'2026-10-12',time:'11:00',employeeName:'Frau Schmitt'}],owner_info:{business_name:'Praxis Muster',sender_name:'Max Test',city:'Berlin'}};
test('Only gateway imports provider driver; deterministic validator stays model-free',()=>{
 for(const f of fs.readdirSync(new URL('./tasks/',import.meta.url)).filter(f=>f.endsWith('.js'))) assert.ok(!fs.readFileSync(new URL('./tasks/'+f,import.meta.url),'utf8').includes('azureClient.js'),f);
 assert.ok(!fs.readFileSync(new URL('./tasks/rezept-validate.js',import.meta.url),'utf8').includes('executeKiTask'));
});
test('Jeton appointment draft masks real fields before prompt then restores exact local values',async()=>{
 let providerPayload;
 const result=await appointment(appPayload,context(async options=>{
  const raw=options.messages.find(m=>m.role==='user').content;providerPayload=JSON.parse(raw);
  for(const secret of ['Müller','Zoë','zoe@example.invalid','2026-10-09','2026-10-12','09:30','11:00','Frau Schmitt','Manuelle Therapie','Praxis Muster','Berlin']) assert.ok(!raw.includes(secret),secret);
  return response({to_name:providerPayload.patient.name,to_email:providerPayload.patient.email,subject:providerPayload.service.title,body:providerPayload.slots.map(s=>`${s.date} ${s.time} ${s.employeeName}`).join('; ')});
 }));
 assert.equal(result.draft.to_name,appPayload.patient.name);assert.equal(result.draft.to_email,appPayload.patient.email);assert.equal(result.draft.subject,appPayload.service.title);
 assert.equal(result.draft.body,'2026-10-09 09:30 Frau Schmitt; 2026-10-12 11:00 Frau Schmitt');assert.equal(result._meta.usage.total_tokens,5);
});
test('Appointment output unknown field and forged placeholder both fail before restore',async()=>{
 for(const output of [{to_name:null,to_email:null,subject:'Termine',body:'Hallo',unknown:'x'},{to_name:null,to_email:null,subject:'Termine',body:'⟦SLOT_0⟧'}]) await assert.rejects(appointment(appPayload,context(async()=>response(output))),{code:'KI_ANTWORT_UNGUELTIG'});
});
test('Appointment validates original fields and mailReady rather than dummy sanitized values',async()=>{
 let calls=0;const transport=async()=>{calls++;return response({});};
 await assert.rejects(appointment({...appPayload,slots:[{date:'BAD_DATE',time:'09:30'}]},context(transport)),{code:'KI_SCHEMA'});
 await assert.rejects(appointment(appPayload,context(transport,{...cfg,mailReady:false})),{code:'AI_MAIL_DISABLED'});assert.equal(calls,0);
});
const seriesPayload={count:2,recurrence:'weekly',sector:'physiotherapy',targetDates:['2026-10-09','2026-10-16'],emptyDates:[],candidates:[{date:'2026-10-09',time:'10:00',employeeId:'emp-fixture-1',bucket:0},{date:'2026-10-17',time:'10:00',employeeId:'emp-fixture-1',bucket:1,shiftedFromDate:'2026-10-16',dateShiftDays:1}],employees:[{id:'emp-fixture-1',name:'Synthetische Therapeutin',anrede:'Frau'}],service:{title:'Manuelle Therapie',duration:30},customer:{id:'customer-fixture',name:'Synthetischer Patient'},preferences:{sameEmployee:'always',preferredEmployee:'emp-fixture-1'},previousSelected:[]};
test('Series actual flat candidates with shift metadata preserve employee membership and usage',async()=>{
 const res=await series(seriesPayload,context(async options=>{
  const p=JSON.parse(options.messages.find(m=>m.role==='user').content);assert.ok(!JSON.stringify(p).includes('emp-fixture-1'));assert.equal(p.preferences.preferredEmployee,p.employees[0].id);
  assert.equal(p.candidates[1].dateShiftDays,1);return response({selected:p.candidates.map(({date,time,employeeId})=>({date,time,employeeId})),report:'Termine gewählt.'});
 }));assert.deepEqual(JSON.parse(JSON.stringify(res.selected)),seriesPayload.candidates.map(({date,time,employeeId})=>({date,time,employeeId})));assert.equal(res._meta.usage.total_tokens,5);
});
test('Series rejects invented employee, unoffered times and duplicate dates',async()=>{
 for(const failure of ['employee','time','duplicate']) await assert.rejects(series(seriesPayload,context(async options=>{
  const p=JSON.parse(options.messages.find(m=>m.role==='user').content);const selected=p.candidates.map(({date,time,employeeId})=>({date,time,employeeId}));
  if(failure==='employee')selected[0].employeeId='invented';if(failure==='time')selected[0].time='22:00';if(failure==='duplicate')selected[1]={...selected[0]};return response({selected,report:'Termine gewählt.'});
 })),{code:'KI_ANTWORT_UNGUELTIG'});
});
test('Freitext mail drafts stay closed in Jeton and direct without explicit freeText',async()=>{
 for(const run of [b2c,b2b])for(const config of [cfg,{...cfg,mode:'direkt'}])await assert.rejects(run({intent:'Bitte Entwurf erstellen'},context(async()=>{assert.fail('Provider forbidden');},config)));
});
test('OCR remains closed with no transport regardless of valid synthetic payload',async()=>{
 await assert.rejects(ocr({image_base64:'synthetic'},context(async()=>assert.fail('Provider forbidden'))),{code:'AI_OCR_DISABLED'});
});

test('Explicit direct mail drafts mask recipient then restore exact values and usage',async()=>{
 for(const run of [b2c,b2b]) {
  const payload={intent:'Bitte einen freundlichen Entwurf erstellen.',contacts:[{id:'contact-1',name:'Zoë Mustermann',email:'zoe@example.invalid'}],owner_info:{business_name:'Musterpraxis'}};
  const res=await run(payload,context(async opts=>{const prompt=opts.messages.find(m=>m.role==='user').content;assert.ok(!prompt.includes('Zoë Mustermann'));assert.ok(!prompt.includes('zoe@example.invalid'));const name=prompt.match(/name="([^"]+)"/)[1],email=prompt.match(/email="([^"]+)"/)[1];return response({to_name:name,to_email:email,subject:'Termin',body:`Guten Tag ${name}, vielen Dank.`});},{...cfg,mode:'direkt',allowFreeText:true}));
  assert.equal(res.draft.to_name,'Zoë Mustermann');assert.equal(res.draft.to_email,'zoe@example.invalid');assert.equal(res._meta.usage.total_tokens,5);
 }
});
test('Normalize output rejects missing and extra nested keys before canonicalization',async()=>{
 const payload={rezept:{diagnosegruppe:DIAGNOSEGRUPPEN[0]},heilmittel_positionen:[]};const empty={value:null,match:'none',confidence:0,note:null};const base={frequenz:{...empty},diagnosegruppe:{value:DIAGNOSEGRUPPEN[0],match:'exact',confidence:1,note:null},heilmittel:{...empty,label:null},ergaenzendes_heilmittel:{...empty,label:null}};
 const result=await normalize(payload,context(async()=>response(base)));assert.equal(result.normalized.diagnosegruppe.value,DIAGNOSEGRUPPEN[0]);
 for(const bad of [{},{...base,diagnosegruppe:{...base.diagnosegruppe,patient:'hidden'}}])await assert.rejects(normalize(payload,context(async()=>response(bad))),{code:'KI_ANTWORT_UNGUELTIG'});
});

test('Normalize actual X-code catalogue entry survives closed validation and canonical mapping',async()=>{
 const label='Allgemeine Krankengymnastik (KG) Einzel';
 const payload={rezept:{heilmittel:'X0501'},heilmittel_positionen:[{x:'X0501',label}]};
 const empty={value:null,match:'none',confidence:0,note:null};const output={frequenz:{...empty},diagnosegruppe:{...empty},heilmittel:{value:'X0501',label,match:'exact',confidence:1,note:null},ergaenzendes_heilmittel:{...empty,label:null}};
 const res=await normalize(payload,context(async opts=>{assert.ok(opts.messages.find(m=>m.role==='user').content.includes('X0501'));return response(output);}));assert.equal(res.normalized.heilmittel.value,'X0501');assert.equal(res.normalized.heilmittel.label,label);
 await assert.rejects(normalize({...payload,heilmittel_positionen:[{x:'ABC',label}]},context(async()=>assert.fail('Provider forbidden'))),{code:'KI_SCHEMA'});
});
