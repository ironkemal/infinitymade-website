/** Focused browser-store counter proof; synthetic fixture CRUD, no billing or live writes. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {erstelleDemoServer} from './server.mjs';

const out=process.env.PHYSIO_BERICHT||'/tmp/praxura-physio-controlling';
await mkdir(out,{recursive:true});
const port=Number(process.env.PORT||18089),origin=`http://127.0.0.1:${port}`;
const report={checks:[],errors:[],blocked:[],scope:'Browserlokaler synthetischer Store; keine neue Formular-/Abrechnungsabnahme'};
const browser=await chromium.launch();let demo,context,page;
const check=(name,ok)=>{report.checks.push({name,ok:!!ok});assert.ok(ok,name);};
async function start(rolle){
  demo=await erstelleDemoServer({port,rolle,tag:'2026-10-30'});
  await new Promise((resolve,reject)=>{demo.server.once('error',reject);demo.server.listen(port,'127.0.0.1',resolve);});
  context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
  await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==origin){report.blocked.push(r.request().url());return r.abort();}if(r.request().method()!=='GET')return r.abort();return r.continue();});
  await context.routeWebSocket('**/*',s=>s.close());
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(demo.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__physioControllingKontext?.()?.bereit===true);
}
async function stop(){await context?.close();await new Promise(r=>demo.server.close(r));}
const values=()=>page.locator('#panel-overview .px-k-geld dd').allTextContents();
async function waitValues(expected){await page.waitForFunction(expected=>JSON.stringify([...document.querySelectorAll('#panel-overview .px-k-geld dd')].map(e=>e.textContent))===JSON.stringify(expected),expected);}
try{
  await start('owner');
  await waitValues(['6','1','36','12','24','15']);
  check('Frischer Store: sechs VO, eine bereit, 36 Zeilen, zwölf dokumentiert',true);
  const mutation=await page.evaluate(async()=>{
    const d=window.__lokaleTestpraxis,rx=structuredClone(d.tabellen.prescriptions[0]);rx.id='50000000-0000-4000-8000-000000000099';rx.abrechnung_status='bereit';
    const a=await d.client.from('prescriptions').insert(rx).select();
    const row=d.tabellen.prescription_sessions.find(s=>s.status==='planned'&&s.booking_id!==null);
    const b=await d.client.from('prescription_sessions').update({status:'done'}).eq('id',row.id).select();
    return {ok:!a.error&&!b.error&&a.data.length===1&&b.data.length===1,row:row.id};
  });
  check('Synthetische Fixture-Insert/Update bestätigt',mutation.ok);
  await waitValues(['7','2','36','13','23','15']);check('Zähler reagieren ohne Reload auf Storeänderungen',true);
  await page.reload({waitUntil:'domcontentloaded'});await waitValues(['7','2','36','13','23','15']);check('Identische Zähler nach Reload',true);
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});
    await page.evaluate(()=>window.switchPanel('overview'));
    if(width===390&&await page.locator('#sidebar').evaluate(e=>e.classList.contains('open')))await page.locator('#hamburger').click();
    await page.waitForFunction(()=>document.querySelector('#panel-overview .px-k-geld dd')?.textContent==='7');
    await page.evaluate(()=>document.querySelector('#panel-overview .px-k-geld').scrollIntoView({block:'center'}));
    check(`Übersicht ${width}px ohne internen Überlauf`,await page.locator('#panel-overview .px-k-geld').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    await page.screenshot({path:`${out}/overview-${width}.png`,animations:'disabled'});
    await page.evaluate(()=>window.switchPanel('abrechnung'));
    const card=page.locator('#panel-abrechnung [data-demo-controlling]');await card.evaluate(e=>e.scrollIntoView({block:'center'}));
    check(`Abrechnung ${width}px gleiche sieben VO`,await card.locator('dd').first().textContent()==='7');
    check(`Abrechnung ${width}px ohne scheinbar berechnete Geldsumme`,!(await page.locator('#panel-abrechnung').innerText()).includes('€'));
    await page.screenshot({path:`${out}/abrechnung-${width}.png`,animations:'disabled'});
  }
  await page.evaluate(()=>window.switchPanel('overview'));
  const button=page.locator('#panel-overview [data-demo-controlling-refresh]');await button.focus();await button.press('Enter');
  await waitValues(['7','2','36','13','23','15']);check('Aktualisieren behält Tastaturfokus und 44px Ziel',await button.evaluate(e=>document.activeElement===e&&e.getBoundingClientRect().height>=44));
  await page.evaluate(async id=>{await window.__lokaleTestpraxis.client.from('prescription_sessions').update({heilmittel_index:1}).eq('id',id).select();},mutation.row);
  await page.waitForFunction(()=>document.querySelector('#panel-overview .px-k-geld')?.textContent.includes('Teilmenge'));
  check('Unbelegte Leistungszuordnung sichtbar Unknown statt Gesamtsumme',!(await values()).slice(2).some(v=>/^\d+$/.test(v)));
  await page.evaluate(()=>{window.__lokaleTestpraxis.speicherFehler=true;window.dispatchEvent(new Event('physio-demo:changed'));});
  await waitValues(Array(6).fill('Unbekannt'));check('Speicherfehler macht Übersicht unbekannt',true);
  check('Beträge bleiben unbekannt',await page.locator('#panel-overview .px-k-geld').innerText().then(t=>t.includes('Betrag unbekannt')&&!t.includes('€')));
  await stop();await start('employee');
  check('Employee erhält keine Zählerkarte',await page.locator('[data-demo-controlling-refresh]:visible').count()===0);
  const denied=await page.evaluate(async()=>{const {ladeDemoControlling}=await import('/demo-controlling.mjs');let reads=0;const r=await ladeDemoControlling({kontext:()=>({rolle:'employee'}),demo:()=>{reads++;throw Error('Kein Fachread');}});return {reads,status:r.status};});
  check('Employee Loader null Fachquellenzugriffe',denied.reads===0&&denied.status==='gesperrt');
  check('Keine Seitenfehler/Fremdrequests',!report.errors.length&&!report.blocked.length);
}catch(e){report.failure=e.stack;process.exitCode=1;await page?.screenshot({path:out+'/fehler.png'}).catch(()=>{});}
finally{await stop().catch(()=>{});await browser.close();await writeFile(out+'/bericht.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
