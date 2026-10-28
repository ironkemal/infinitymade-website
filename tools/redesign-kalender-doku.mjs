/**
 * Tatsächlicher DOMpfad Kalender → Tagestermin → Mehr → Fußbefund.
 * Ausschließlich vorhandenes geschlossenes synthetisches Harness; alle Writes
 * bleiben RS_READONLY. Kein injizierter Terminöffner, keine Produktänderung.
 * REDESIGN_PORT=18082 timeout -s KILL 240 node tools/redesign-kalender-doku.mjs
 * --kurz: Neu/Owner/hell1440. REDESIGN_KALENDER_DOKU_OUTPUT setzt Ausgabeordner.
 */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {WURZEL,starteServer,starteBrowser,oeffneDashboard} from './redesign-harness.mjs';
const out=process.env.REDESIGN_KALENDER_DOKU_OUTPUT||'/tmp/praxura-v704h-ui';
await mkdir(out,{recursive:true});
const fixture=await readFile(WURZEL+'/tools/browser-probe/redesign-fixture.js','utf8');
const anker="has_access: module !== 'abrechnung'";
assert.equal(fixture.split(anker).length,2,'Rechte-Fixture muss eindeutig sein');
const cases=[];
for(const design of ['neu','alt'])for(const [rolle,recht] of [['owner',true],['employee',true],['employee',false]])for(const [theme,breite] of [['hell',1440],['dunkel',390]])cases.push({design,rolle,recht,theme,breite});
if(process.argv.includes('--kurz'))cases.splice(1);
const server=await starteServer(),browser=await starteBrowser(),result=[];
const original=browser.newContext.bind(browser);
browser.newContext=async(...args)=>{const c=await original(...args);await c.routeWebSocket('**',ws=>ws.close());return c;};
try{for(const o of cases){
 const c=await oeffneDashboard(browser,{basis:server.basis,...o,szenario:'voll'}),p=c.page;
 p.setDefaultTimeout(15000);
 try{
  await p.route('**/vendor/supabase-js.js*',r=>r.fulfill({status:200,contentType:'text/javascript',body:fixture.replace(anker,o.recht?'has_access: true':anker)}));
  await p.reload({waitUntil:'domcontentloaded'});
  await p.locator('#sidebarNav .sidebar-item[data-panel="calendar"]').waitFor({state:'attached'});
  await p.evaluate(()=>{window.__kalDokuKlicks=[];document.addEventListener('click',e=>{if(e.isTrusted)window.__kalDokuKlicks.push(e.target.closest('button,a,.dv-booking-block')?.id||e.target.closest('.dv-booking-block')?.className||'DOM');},true);});
  if(o.breite===390)await p.locator('#hamburger').click();
  await p.locator('#sidebarNav .sidebar-item[data-panel="calendar"]').click();
  await p.locator('.cal-view-toggle [data-view="day"]').click();
  const termin=p.locator('#dayViewGrid .dv-booking-block').filter({hasText:'Erika'}).first();
  await termin.waitFor({state:'visible'});
  const buchung=await termin.evaluate(el=>({id:el._termin.id,leadId:el._termin.lead_id,status:el._termin.status}));
  assert.equal(buchung.id,'4000000-0000-4000-8000-000000000001');
  assert.equal(buchung.status,'completed','Abgeschlossener Termin vermeidet automatischen Statuswechsel');
  await termin.click();
  await p.locator('#bkActionModal').waitFor({state:'visible'});
  await p.locator('#bkActionMehrBtn').click();
  const foot=p.locator('#bkActionFussbefundBtn');
  if(o.recht){
   await foot.waitFor({state:'visible'});await foot.click();
   await p.waitForFunction(({id,leadId})=>document.querySelector('#panel-fussstatus')?.classList.contains('active')&&document.querySelector('#fbpPatient')?.value===leadId&&document.querySelector('#fbpTermin')?.value===id,buchung);
   await p.locator('#bkActionModal').waitFor({state:'hidden'});
   await p.waitForFunction(()=>document.querySelector('#fbpSaveBtn')?.disabled===false);
   await p.locator('#fbpNotiz').click({trial:true});
  }else assert.equal(await foot.isVisible(),false,'Employee ohne abrechnung erhält keinen Fußbefundeinstieg');
  const protokoll=await p.evaluate(()=>({writes:window.__rsFixture.writes,klicks:window.__kalDokuKlicks}));
  assert.deepEqual(c.protokoll.seitenfehler,[]);assert.deepEqual(c.protokoll.fremd,[]);
  const row={...o,buchung,klickzahl:protokoll.klicks.length,klicks:protokoll.klicks,gesperrteWrites:protokoll.writes,fussbefund:o.recht};
  result.push(row);console.log(JSON.stringify(row));
  await p.screenshot({path:out+'/'+o.design+'-'+o.rolle+'-'+o.recht+'-'+o.theme+'.png'});
 }catch(e){await p.screenshot({path:out+'/fehler.png'});throw e;}finally{await c.kontext.close();}
}await writeFile(out+'/bericht.json',JSON.stringify(result,null,2));}finally{await browser.close();await server.stop();}
