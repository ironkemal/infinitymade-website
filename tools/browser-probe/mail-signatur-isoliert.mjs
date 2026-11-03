/** Account-free browser integration test. All network blocked; storage/DB/AI are in-memory fakes. */
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),css=await readFile(new URL('dashboard.css',root),'utf8');
const bundled=await build({stdin:{resolveDir:root.pathname,contents:`
import {verbindeMailSignaturen} from './module/mail-signatur-anbindung.js';
import {refreshKiControls,runMailDraftInUi} from './module/ki-client.js';
window.reset=(role='owner')=>{
 document.body.innerHTML='<div id="mailSignaturEditor"></div><div id="mailSignaturCompose"></div><div><div id="b2cAiMessages"></div><div><textarea id="b2cAiInput"></textarea><button id="b2cAiSendBtn">Entwurf</button></div></div>';
 window.profil={id:'synthetic-owner',role,business_name:'TEST-Isoliert',street:'Testweg',city:'Testort',email:'qa@example.invalid'};
 window.writes=[];window.uploads=[];window.toasts=[];window.rejectSave=false;window.rejectUpload=false;
 const supabase={from(table){let payload,id;return{update(p){payload=p;return this},eq(key,v){id=v;return this},select(){return this},async single(){if(window.rejectSave)return{error:{message:'simulated'}};window.writes.push({table,id,payload});return{data:{id}}}}},storage:{from(bucket){return{async upload(path,blob,options){if(window.rejectUpload)return{error:{message:'simulated'}};window.uploads.push({bucket,path,type:blob.type,size:blob.size,options});return{}},getPublicUrl(){return{data:{publicUrl:'https://fixture.test/logo.png'}}}}}}};
 window.ctrl=verbindeMailSignaturen({supabase,getProfil:()=>window.profil,getUserId:()=> 'synthetic-owner',showToast:(text)=>window.toasts.push(text)});window.ctrl.oeffnen();
};
window.refresh=async active=>refreshKiControls({getToken:async()=> 'synthetic-not-a-token',isOwner:()=>true,fetchImpl:async()=>({ok:true,json:async()=>({success:true,mode:'direkt',active,operatorReady:true,ownerActive:true,mailReady:true,capabilities:{freeText:active,mailDraft:active}})})});
window.draft=async enabled=>{window.aiCalls=0;window.messages=[];return runMailDraftInUi({intent:'Synthetischer Text',containerId:'b2cAiMessages',aiAddMsg:(s)=>window.messages.push(s),openComposeModal:d=>window.lastDraft=d},{getToken:async()=> 'synthetic-not-a-token',getKiConfig:async()=>({effective:enabled,mode:'direkt',capabilities:{freeText:enabled,mailDraft:enabled}}),fetchImpl:async()=>{window.aiCalls++;return{ok:true,status:200,json:async()=>({success:true,draft:{subject:'TEST',body:'Synthetischer Entwurf'}})}}}).then(()=>true,()=>false);};
window.reset();
`},bundle:true,write:false,format:'iife'});
const browser=await chromium.launch();let checks=0;
try{
const page=await browser.newPage({viewport:{width:390,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let network=0;
await page.route('**/*',route=>{network++;if(route.request().url()==='https://fixture.test/')return route.fulfill({contentType:'text/html',body:'<html><head></head><body></body></html>'});return route.abort();});
await page.goto('https://fixture.test/');await page.addStyleTag({content:css});await page.addScriptTag({content:bundled.outputFiles[0].text});
async function fresh(role='owner'){await page.evaluate(role=>window.reset(role),role);}
async function create(){await page.getByRole('button',{name:'Neue Vorlage',exact:true}).click();await page.locator('[data-feld=name]').fill('TEST-Fußzeile');}
async function save(){await page.locator('[data-speichern]').click();await page.waitForFunction(()=>!document.querySelector('fieldset').disabled);}
await create();await page.locator('[data-standard]').check();await save();assert.deepEqual(await page.evaluate(()=>({n:writes.length,id:writes[0].id,table:writes[0].table})),{n:1,id:'synthetic-owner',table:'profiles'});checks++;
await page.evaluate(()=>{ctrl.oeffnen();ctrl.entwurf()});assert.equal(await page.locator('[data-feld=name]').inputValue(),'TEST-Fußzeile');assert.equal(await page.evaluate(()=>ctrl.auswahl().name),'TEST-Fußzeile');checks++;
await page.evaluate(()=>window.rejectSave=true);await page.locator('[data-feld=praxis]').fill('NICHT GESPEICHERT');await save();assert.equal(await page.evaluate(()=>profil.mail_signatur_einstellungen.vorlagen[0].praxis),'TEST-Isoliert');assert.match(await page.evaluate(()=>toasts.at(-1)),/nicht gespeichert/);checks++;
await fresh();await create();const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1600;c.height=100;return c.toDataURL('image/png').split(',')[1]});
await page.locator('[data-logo]').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForFunction(()=>uploads.length===1);assert.deepEqual(await page.evaluate(()=>({bucket:uploads[0].bucket,own:uploads[0].path.startsWith('synthetic-owner/'),type:uploads[0].type})),{bucket:'avatars',own:true,type:'image/png'});assert.equal(await page.locator('[data-vorschau] img').getAttribute('src'),'https://fixture.test/logo.png');checks++;
await page.locator('[data-logo]').setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg></svg>')});await page.waitForFunction(()=>toasts.some(x=>x.includes('PNG, JPG')));assert.equal(await page.evaluate(()=>uploads.length),1);checks++;
await fresh();await page.locator('[data-import]').setInputFiles({name:'vorlage.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({name:'Importiert',praxis:'Eigene Praxis',zusatz:'<img onerror=alert(1)>'}))});await page.waitForFunction(()=>document.querySelector('[data-feld=name]')?.value==='Importiert');assert.equal(await page.locator('[data-vorschau] img').count(),0);checks++;
await page.locator('[data-import]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"name":"Bad","html":"<script>"}')});await page.waitForFunction(()=>toasts.length>0);assert.equal(await page.locator('[data-feld=name]').inputValue(),'Importiert');checks++;
await fresh('employee');assert.equal(await page.locator('[data-neu]').isDisabled(),true);assert.equal(await page.evaluate(()=>writes.length+uploads.length),0);checks++;
await fresh();await page.evaluate(()=>refresh(false));assert.equal(await page.locator('#b2cAiInput').isDisabled(),true);assert.match(await page.locator('#b2cAiInputStatus').innerText(),/nicht bereit/);checks++;
await page.evaluate(()=>refresh(true));assert.equal(await page.locator('#b2cAiInput').isDisabled(),false);assert.equal(await page.evaluate(()=>draft(true)),true);assert.equal(await page.evaluate(()=>lastDraft.subject),'TEST');assert.equal(await page.evaluate(()=>aiCalls),1);checks++;
assert.equal(await page.evaluate(()=>draft(false)),false);assert.equal(await page.evaluate(()=>aiCalls),0);checks++;
await fresh();await create();for(const width of [390,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>{const e=document.getElementById('mailSignaturEditor');return e.scrollWidth>e.clientWidth}),false);}checks++;
await fresh();const raceCount=await page.evaluate(async()=>{profil.mail_signatur_einstellungen={vorlagen:Array.from({length:9},(_,i)=>({id:'v'+i,name:'Vorlage'+i})),standard_id:''};ctrl.oeffnen();const handler=document.querySelector('[data-import]').onchange;const releases=[];const file={size:100,text:()=>new Promise(resolve=>releases.push(resolve))};const pending=[handler({target:{files:[file]}}),handler({target:{files:[file]}})];for(const release of releases)release(JSON.stringify({name:'Import'}));await Promise.all(pending);return document.querySelector('#mailVorlage').options.length-1;});assert.equal(raceCount,10,'concurrent imports respect ten-template limit');checks++;
assert.deepEqual(errors,[]);assert.ok(network>=1); // route intercepts every request; no external service reached
console.log(JSON.stringify({checks,pass:true,accountsUsed:0,realDbWrites:0,realUploads:0,mailsSent:0,externalAiCalls:0}));
}finally{await browser.close();}
