/** P01 actual renderer probe; entirely synthetic; fences installed BEFORE page creation. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { starteServer, starteBrowser, WURZEL, wechsle } from '../redesign-harness.mjs';
const out = `${WURZEL}/redesign/phase01/evidence/${process.env.P01_OUT || 'p01'}`;
await mkdir(out, { recursive: true });
const fixture = (await readFile(`${WURZEL}/tools/browser-probe/redesign-fixture.js`, 'utf8'))
 .replace("sector: 'podologie'", "sector: 'physiotherapy'").replace('Podologie Musterpraxis', 'Physio Musterpraxis');
const server = await starteServer(); const browser = await starteBrowser();
const results=[];
async function open({width=1440,theme='hell',role='owner',scenario='voll',design='neu',withoutCss=false}={}) {
 const context=await browser.newContext({viewport:{width,height:1000},locale:'de-DE',timezoneId:'Europe/Berlin',serviceWorkers:'block'});
 const log={foreign:[],writes:[],ws:[],errors:[],api:[]};
 await context.routeWebSocket('**/*', ws=>{log.ws.push(ws.url());ws.close();});
 await context.route('**/*', async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==server.basis){log.foreign.push(url.origin);return route.abort();}
  if(!['GET','HEAD'].includes(req.method())){log.writes.push(req.method()+' '+url.pathname);return route.fulfill({status:503,json:{error:'synthetic write fence'}});}
  if(url.pathname==='/vendor/supabase-js.js')return route.fulfill({contentType:'text/javascript',body:fixture});
  if(withoutCss && (url.pathname.startsWith('/design/')||url.pathname==='/praxura-design.css'))return route.fulfill({contentType:'text/css',body:''});
  if(url.pathname==='/api/config')return route.fulfill({json:{supabaseUrl:'https://synthetic.invalid',supabaseAnonKey:'synthetisch-anon',apiBase:'/api',istKutu:false,telemetryEnabled:false,designVorschau:true}});
  if(url.pathname.startsWith('/api/')){log.api.push(url.pathname);return route.fulfill({status:scenario==='fehler'?503:200,json:{records:[]}});}
  return route.continue();
 });
 await context.addInitScript(({theme,role,scenario})=>{localStorage.setItem('im-theme',theme==='dunkel'?'dark':'light');window.__rsDay='2026-10-23';window.__rsRolle=role;window.__rsSzenario=scenario;},{theme,role,scenario});
 const page=await context.newPage();page.on('pageerror',e=>log.errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-10-23T10:15:00+02:00'));
 await page.goto(`${server.basis}/dashboard.html?design=${design}`);
 await page.waitForSelector('#sidebarNav .sidebar-item',{state:'attached',timeout:20000});
 await page.waitForFunction(()=>{const a=document.getElementById('app');return a&&a.style.display!=='none';},null,{timeout:30000});
 await page.waitForTimeout(500);
 return{context,page,log};
}
try{
 if(process.env.P01_START){
  for(const role of ['owner','employee'])for(const theme of ['hell','dunkel'])for(const width of [390,1440]){
   const x=await open({width,theme,role});const {page}=x;
   await page.waitForSelector('#pxStartseite .px-k-next');await page.waitForTimeout(300);
   await page.evaluate(()=>{window.__p01Task=document.getElementById('startAufgaben');window.__p01Input=document.getElementById('startAufgabeInput');});
   await page.locator('#startAufgabeInput').fill('Synthetischer ungespeicherter Aufgabenentwurf');
   const voBefore=await page.locator('#physioRezKpi').evaluate(e=>({status:e.dataset.pxStatus,display:e.style.display}));
   await page.locator('#physioRezKpi').evaluate(e=>{e.dataset.pxStatus='fehler';e.style.display='none';});
   await page.waitForTimeout(100);
   const afterError=await page.evaluate(()=>({same:window.__p01Task===document.getElementById('startAufgaben')&&window.__p01Input===document.getElementById('startAufgabeInput'),value:document.getElementById('startAufgabeInput').value}));
   assert.equal(afterError.same,true);assert.equal(afterError.value,'Synthetischer ungespeicherter Aufgabenentwurf');
   await page.locator('#physioRezKpi').evaluate((e,old)=>{e.dataset.pxStatus=old.status;e.style.display=old.display;},voBefore);
   // Existing source nodes restore and return as identical nodes during an in-place design switch.
   await page.evaluate(()=>document.documentElement.dataset.design='alt');await page.waitForTimeout(100);
   assert.equal(await page.locator('#startAufgaben').evaluate(e=>e.parentElement.id),'panel-overview');
   await page.evaluate(()=>document.documentElement.dataset.design='neu');await page.waitForTimeout(100);
   assert.equal(await page.locator('#startAufgaben').evaluate(e=>e===window.__p01Task),true);
   if(role==='owner'){
    assert.ok(await page.locator('#pxStartseite [data-aktion="akte"]').count()>0);
    await page.locator('#pxStartseite [data-aktion="akte"]').first().click();
    await page.waitForSelector('#patientDetailModal:not([hidden])');
    await page.locator('#patientDetailModal .modal-close').click();
   }else{assert.equal(await page.locator('#pxStartseite [data-aktion="akte"]').count(),0);assert.ok((await page.locator('#pxStartseite .px-k-next').innerText()).includes('Heute stehen keine Termine an.'));}
   if(role==='owner'){await page.locator('#pxStartseite [data-ziel="rechnungen"]').click();assert.equal(await page.locator('#panel-rechnungen').evaluate(e=>e.classList.contains('active')),true);await wechsle(page,'overview');}
   await page.locator('#pxStartseite [data-aktion="kalender"]').first().click();
   assert.equal(await page.locator('#panel-calendar').evaluate(e=>e.classList.contains('active')),true);
   await wechsle(page,'overview');
   await page.locator('#pxStartseite [data-ziel="ueberblick"]').click();
   assert.equal(await page.locator('#panel-ueberblick').evaluate(e=>e.classList.contains('active')),true);
   await wechsle(page,'overview');await page.evaluate(()=>document.getElementById('mainArea').scrollTo(0,0));
   const metrics=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,finance:document.querySelectorAll('#pxStartseite .px-k-geld').length,tasksSame:window.__p01Task===document.getElementById('startAufgaben'),inputSame:window.__p01Input===document.getElementById('startAufgabeInput'),value:document.getElementById('startAufgabeInput').value}));
   assert.ok(metrics.document<=width);assert.equal(metrics.finance,role==='owner'?1:0);assert.equal(metrics.tasksSame,true);assert.equal(metrics.inputSame,true);
   await page.screenshot({path:`${out}/${role}-${theme}-${width}-start.png`,animations:'disabled',fullPage:true});
   await page.locator('#startAufgabeAddBtn').click();await page.waitForTimeout(300);
   assert.equal(await page.locator('#startAufgabeInput').inputValue(),'Synthetischer ungespeicherter Aufgabenentwurf');
   const fixture=await page.evaluate(()=>window.__rsFixture);assert.deepEqual(fixture.writes,[{tabelle:'praxis_aufgaben',art:'insert'}]);
   await page.locator('#startAufgaben').screenshot({path:`${out}/${role}-${theme}-${width}-tasks.png`,animations:'disabled'});
   results.push({role,theme,width,afterError,metrics,fixture,log:x.log});await x.context.close();
  }
  for(const scenario of ['leer','fehler','langsam']){
   const x=await open({width:390,scenario});await x.page.waitForSelector('#pxStartseite .px-k-next');
   const text=await x.page.locator('#pxStartseite .px-k-next').innerText();
   if(scenario==='leer')assert.ok(text.includes('Heute stehen keine Termine an.'));
   if(scenario==='fehler')assert.ok(text.includes('konnte nicht geladen werden'));
   results.push({scenario,text,log:x.log});await x.context.close();
  }
 }else if(process.env.P01_INTERACTIONS){
  for(const width of [390,1440]){
   const x=await open({width});const {page}=x;const checks={width};
   await wechsle(page,'overview');
   checks.tasks=await page.locator('#startAufgaben').evaluate(e=>({connected:e.isConnected,visible:!!e.getClientRects().length,display:getComputedStyle(e).display}));
   await wechsle(page,'calendar');
   checks.views=[];
   for(const view of ['week','month','day']){
    await page.locator('#panel-calendar .cal-view-btn[data-view="'+view+'"]').click();await page.waitForTimeout(300);
    checks.views.push({view,active:await page.locator('#panel-calendar .cal-view-btn[data-view="'+view+'"]').evaluate(e=>e.classList.contains('active'))});
    await page.screenshot({path:`${out}/interaction-${width}-${view}.png`,animations:'disabled'});
   }
   await wechsle(page,'anamnese');
   await page.locator('#anamHauptbeschwerde').fill('Synthetische Eingabe bleibt bei Validierungsfehler erhalten.');
   checks.saveWithoutPatientDisabled=await page.locator('#anamSaveBtn').isDisabled();
   if(!checks.saveWithoutPatientDisabled)await page.locator('#anamSaveBtn').click();
   checks.retainedAfterValidation=await page.locator('#anamHauptbeschwerde').inputValue();
   checks.patientOptions=await page.locator('#anamPatientSelect option').count();
   assert.ok(checks.patientOptions>1,'required patient options');
   {
    await page.locator('#anamPatientSelect').selectOption({index:1});
    await page.locator('#anamHauptbeschwerde').fill('Synthetischer Schreibfehler erhält diese Eingabe.');
    checks.saveWithPatientDisabled=await page.locator('#anamSaveBtn').isDisabled();
    assert.equal(checks.saveWithPatientDisabled,false,'required enabled Save');
    if(!checks.saveWithPatientDisabled){await page.locator('#anamSaveBtn').click();await page.waitForTimeout(500);}
    checks.retainedAfterWriteError=await page.locator('#anamHauptbeschwerde').inputValue();
   }
   await page.locator('#anamBeschwerdenOther').focus();await page.keyboard.press('Escape');
   checks.escape=await page.locator('#anamBeschwerdenOther').evaluate(e=>document.activeElement===e);
   checks.targets=await page.locator('#panel-anamnese .panel-actions button').evaluateAll(es=>es.map(e=>({id:e.id,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
   results.push({interactions:checks,log:x.log,fixture:await page.evaluate(()=>window.__rsFixture)});await x.context.close();
  }
 }else{
 const widths=process.env.P01_PRINT?[]:process.env.P01_QUICK?[390,1440]:[390,768,1024,1025,1440];
 for(const role of ['owner','employee'])for(const theme of ['hell','dunkel'])for(const width of widths){
  const {context,page,log}=await open({width,theme,role});
  const entry={role,theme,width,panels:[],log};
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.pxShell),'v2','shell mounted in neu');
  for(const id of ['overview','calendar','anamnese']){
   const active=await wechsle(page,id);
   const metrics=await page.evaluate(id=>{const panel=document.getElementById('panel-'+id);const r=panel.getBoundingClientRect();return{active:panel.classList.contains('active'),width:innerWidth,document:document.documentElement.scrollWidth,panelWidth:r.width,taskNode:!!document.getElementById('startAufgaben'),physio:getComputedStyle(document.getElementById('anamPhysioForm')).display,checkboxes:document.querySelectorAll('#anamPhysioForm input[type=checkbox]').length};},id);
   const shot=`${role}-${theme}-${width}-${id}.png`;
   if(role==='owner'&&(width===390||width===1440))await page.screenshot({path:`${out}/${shot}`,animations:'disabled'});
   entry.panels.push({id,active,...metrics,shot:role==='owner'&&(width===390||width===1440)?shot:null});
  }
  entry.fixture=await page.evaluate(()=>window.__rsFixture);
  results.push(entry);await context.close();
 }
 for(const scenario of (process.env.P01_PRINT?[]:['leer','fehler','langsam','gross'])){
  const {context,page,log}=await open({width:390,scenario});
  const panels=[];for(const id of ['overview','calendar','anamnese']){panels.push({id,active:await wechsle(page,id)});}
  results.push({scenario,panels,log,fixture:await page.evaluate(()=>window.__rsFixture)});await context.close();
 }
 // Alt control: approved base CSS was already present. Remove ONLY new style payload
 // for baseline, then compare identical actual renderers with payload loaded.
 for(const width of (process.env.P01_PRINT?[1440]:[390,1440]))for(const theme of (process.env.P01_PRINT?['hell']:['hell','dunkel'])){
  const hashes=[];
  for(const withoutCss of [true,false]){
   const x=await open({width,theme,design:process.env.P01_PRINT?'neu':'alt',withoutCss});
   if(process.env.P01_PRINT)await x.page.emulateMedia({media:'print'});
   const snapshots=[];
   for(const id of ['overview','calendar','anamnese']){await wechsle(x.page,id);snapshots.push(createHash('sha256').update(await x.page.screenshot({animations:'disabled'})).digest('hex'));}
   hashes.push(snapshots);await x.context.close();
  }
  results.push({alt:true,print:!!process.env.P01_PRINT,width,theme,pixelEqual:hashes[0].every((h,i)=>h===hashes[1][i]),hashes});
 }
 }
 await writeFile(`${out}/${process.env.P01_START?'start':process.env.P01_INTERACTIONS?'interactions':process.env.P01_PRINT?'print':'results'}.json`,JSON.stringify(results,null,2));
 for(const r of results){
  assert.equal(r.log?.errors?.length||0,0,'page errors');
  assert.equal(r.log?.foreign?.length||0,0,'foreign request');
  assert.equal(r.log?.writes?.length||0,0,'network write attempt');
  assert.equal(r.log?.ws?.length||0,0,'WebSocket attempt');
  if(r.alt)assert.equal(r.pixelEqual,true,'Alt pixel regression');
  for(const p of r.panels||[]){assert.equal(p.active,true,p.id+' active');if(p.document)assert.ok(p.document<=p.width,p.id+' overflow');}
  if(r.interactions){const i=r.interactions;assert.equal(i.tasks.visible,true,'current task node visible');assert.ok(i.views.every(v=>v.active),'calendar view changes');assert.ok(i.retainedAfterValidation.includes('Synthetische'),'input retained');assert.deepEqual(i.targets.map(t=>t.id).sort(),['kioskEinwilligungBtn','kioskStartBtn'].sort(),'expected action IDs');assert.ok(i.targets.every(t=>t.height>=44&&t.width>=44),'Anamnese action targets');assert.equal(i.retainedAfterWriteError,'Synthetischer Schreibfehler erhält diese Eingabe.');assert.deepEqual(r.fixture.writes,[{tabelle:'anamnese',art:'insert'}],'exactly one isolated insert');}
 }
 console.log(JSON.stringify({cases:results.length,overflows:results.filter(x=>x.panels?.some(p=>p.document>p.width)).map(x=>({role:x.role,theme:x.theme,width:x.width,panels:x.panels})),alt:results.filter(x=>x.alt),pageErrors:[...new Set(results.flatMap(x=>x.log?.errors||[]))],fences:results.map(x=>({foreign:x.log?.foreign,writes:x.log?.writes,ws:x.log?.ws})).filter(x=>x.foreign?.length||x.writes?.length||x.ws?.length)},null,2));
}finally{await browser.close();await server.stop();}
