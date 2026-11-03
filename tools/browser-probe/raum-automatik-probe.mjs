// Echte DOM-Interaktionen, synthetische DB, isolierte HTTPS-Route. Kein Server/Live-Zugriff.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
let checks = 0;
try {
  const page = await browser.newPage();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'https://raum-test.invalid') return route.abort();
    if (url.pathname === '/') return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8">
      <main style="max-width:900px;padding:12px;margin:auto;box-sizing:border-box;">
      <div id="addServiceForm"><h3>Leistung</h3><button class="save">Speichern</button></div>
      <div id="gkvServiceForm"><h3>GKV-Leistung</h3><button class="save">Speichern</button></div>
      <section id="bookingModal" hidden><input id="bk-id"><div id="bkEmployeeGroup">Therapeut</div>
        <label>Beginn<input id="bkStart" type="datetime-local" value="2026-11-04T09:00"></label>
        <select id="bkService"><option value="s1">Liege</option><option value="s2">Becken</option></select>
        <label>Minuten<input id="bkDurationValue" type="number" value="30"></label>
        <label><input type="checkbox" id="bkHausbesuch">Hausbesuch</label><div id="bkLeistungExtra"></div>
      </section></main>`});
    if (!/^\/module\/[a-z-]+\.js$/.test(url.pathname)) return route.abort();
    return route.fulfill({contentType:'text/javascript',body:await readFile(new URL(`../..${url.pathname}`,import.meta.url),'utf8')});
  });
  await page.goto('https://raum-test.invalid/');
  await page.addStyleTag({content:await readFile(new URL('../../dashboard.css',import.meta.url),'utf8')});
  await page.evaluate(async () => {
    const editor = await import('/module/leistungs-raum.js');
    const raum = await import('/module/raum-auswahl.js');
    window.f = {old:false,fehler:false,belegungsFehler:false,delay:0,extra:[],saved:{},requirements:['Liege'],rooms:[
      {id:'r1',name:'Liegeraum',business_id:'b',sort:0,aktiv:true,plaetze:1,ausstattung:['Liege']},
      {id:'r2',name:'Kombiraum',business_id:'b',sort:1,aktiv:true,plaetze:1,ausstattung:['Liege','Becken']},
      {id:'fremd',name:'Anderer Standort',business_id:'x',aktiv:true,ausstattung:['Liege','Becken']},
    ],services:[{id:'s1',raum_ausstattung:['Liege']},{id:'s2',raum_ausstattung:['Becken']}],bookings:[]};
    const db = {from(table) {
      let columns='',filters={};
      const q={select(c){columns=c;return q;},eq(k,v){filters[k]=v;return q;},not(){return q;},lt(k,v){filters[k]=v;return q;},gt(k,v){filters[k]=v;return q;},limit(){return q;},maybeSingle(){return Promise.resolve({data:{room_id:'r1'},error:null});},then(resolve){
        const delay=window.f.delay;
        const result=window.f.fehler ? {error:{code:'42501'}} : table==='services' ? (window.f.old?{error:{code:'42703'}}:{data:[],error:null}) : table==='rooms' ? (window.f.old&&columns.includes('ausstattung')?{error:{code:'42703'}}:{data:structuredClone(window.f.rooms),error:null}) : window.f.belegungsFehler ? {error:{code:'offline'}} : {data:structuredClone(window.f.bookings),error:null};
        return new Promise(r=>setTimeout(()=>r(result),delay)).then(resolve);
      }};return q;
    }};
    window.openEditor=(id,anforderungen=[])=>editor.oeffneLeistungsRaum({form:document.getElementById(id),supabase:db,ownerId:'o',anforderungen});
    for(const id of ['addServiceForm','gkvServiceForm']) document.querySelector(`#${id} .save`).addEventListener('click',async()=>{window.f.saved[id]=await editor.leistungsRaumPayload(document.getElementById(id));});
    window.roomPayload=()=>raum.raumFelder();
    raum.raumAuswahlVerdrahten({supabase:db,getOwnerId:()=> 'o',getBusinessId:()=> 'b',getDauerMin:()=>Number(document.getElementById('bkDurationValue').value),getServices:()=>window.f.services,getLeistungen:()=>[{serviceId:document.getElementById('bkService').value},...window.f.extra]});
    window.openBooking=async id=>{const modal=document.getElementById('bookingModal');modal.hidden=true;await new Promise(r=>setTimeout(r,0));document.getElementById('bk-id').value=id||'';modal.hidden=false;};
  });
  for (const id of ['addServiceForm','gkvServiceForm']) {
    await page.evaluate(id=>window.openEditor(id,['Liege']),id);
    const form=page.locator(`#${id}`);
    await form.locator('.leistungs-raum-add').waitFor();
    assert.equal(await form.locator('input[type=checkbox]:checked').count(),1);checks++;
    await form.locator('.leistungs-raum-neu').fill('Licht');
    await form.locator('.leistungs-raum-add').click();
    await form.locator('input[type=checkbox][value="Liege"]').uncheck();
    await form.locator('.save').click();
    await page.waitForFunction(id=>window.f.saved[id],id);
    assert.deepEqual(await page.evaluate(id=>window.f.saved[id].felder.raum_ausstattung,id),['Licht']);checks++;
    await page.evaluate(id=>window.openEditor(id,[]),id);
    await form.locator('.leistungs-raum-add').waitFor();
    assert.equal(await form.locator('input[type=checkbox]:checked').count(),0);checks++;
  }
  await page.evaluate(()=>window.openBooking());
  await page.waitForFunction(()=>!document.querySelector('#bkRaumGroup').hidden);
  assert.equal(await page.locator('#bkRaum').inputValue(),'r1');checks++;
  assert.deepEqual(await page.evaluate(()=>window.roomPayload()),{room_id:null,raum_service_ids:['s1']});checks++;
  await page.evaluate(()=>{window.f.extra=[{serviceId:'s2'}];document.querySelector('#bkLeistungExtra').append(document.createElement('span'));});
  await page.waitForFunction(()=>document.querySelector('#bkRaum').value==='r2');
  assert.deepEqual(await page.evaluate(()=>window.roomPayload().raum_service_ids),['s1','s2']);checks++;
  await page.locator('#bkRaum').selectOption('r1');
  assert.match(await page.locator('#bkRaumFrei').innerText(),/nicht alle/);checks++;
  assert.equal((await page.evaluate(()=>window.roomPayload())).room_automatisch,false);checks++;
  await page.locator('#bkDurationValue').fill('40');
  assert.equal(await page.locator('#bkRaum').inputValue(),'r1');checks++;
  await page.locator('#bkHausbesuch').check();
  assert.match(await page.locator('#bkRaumFrei').innerText(),/Kein Praxisraum/);checks++;
  await page.locator('#bkHausbesuch').uncheck();
  await page.evaluate(()=>{window.f.extra=[];return window.openBooking('bestehend');});
  await page.waitForFunction(()=>!document.querySelector('#bkRaumGroup').hidden);
  await page.locator('#bkService').selectOption('s2');
  assert.equal(await page.locator('#bkRaum').inputValue(),'r1');checks++;
  assert.deepEqual(await page.evaluate(()=>window.roomPayload()),{raum_service_ids:['s2']});checks++;
  await page.evaluate(()=>{window.f.extra=[{serviceId:'s1'}];document.querySelector('#bkLeistungExtra').append(document.createElement('span'));});
  assert.deepEqual(await page.evaluate(()=>window.roomPayload().raum_service_ids),['s2','s1']);checks++;
  await page.evaluate(()=>{window.f.extra=[];document.querySelector('#bkLeistungExtra').replaceChildren();});
  assert.deepEqual(await page.evaluate(()=>window.roomPayload().raum_service_ids),['s2']);checks++;
  await page.evaluate(()=>{window.f.belegungsFehler=true;return window.openBooking();});
  await page.waitForFunction(()=>document.querySelector('#bkRaumFrei').textContent.includes('nicht geladen'));
  assert.equal(await page.locator('#bkRaum').inputValue(),'');checks++;
  await page.evaluate(()=>{window.f.belegungsFehler=false;window.f.services.forEach(s=>s.is_online_meeting=true);return window.openBooking();});
  await page.waitForFunction(()=>document.querySelector('#bkRaumFrei').textContent.includes('Kein Praxisraum'));
  assert.equal(await page.locator('#bkRaum').isDisabled(),true);checks++;
  assert.equal((await page.evaluate(()=>window.roomPayload())).room_id,null);checks++;
  await page.evaluate(()=>{window.f.services.forEach(s=>s.is_online_meeting=false);});
  // Verspätete Öffnung darf geschlossene Maske nicht nachträglich freigeben.
  await page.evaluate(async()=>{window.f.delay=150;await window.openBooking();document.querySelector('#bookingModal').hidden=true;});
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#bkRaumGroup').evaluate(el=>el.hidden),true);checks++;
  assert.deepEqual(await page.evaluate(()=>window.roomPayload()),{raum_service_ids:['s2']});checks++;
  await page.evaluate(()=>{window.f.delay=0;window.f.old=true;window.openEditor('addServiceForm',['Liege']);});
  await page.waitForFunction(()=>document.querySelector('#addServiceForm .leistungs-raum').textContent.includes('derzeit nicht verfügbar'));
  await page.locator('#addServiceForm .save').click();
  await page.waitForFunction(()=>Object.keys(window.f.saved.addServiceForm.felder).length===0);
  checks++;
  await page.evaluate(()=>{window.f.old=false;window.f.fehler=true;window.openEditor('gkvServiceForm',['Liege']);});
  await page.waitForFunction(()=>document.querySelector('#gkvServiceForm .leistungs-raum').textContent.includes('nicht geladen'));
  await page.locator('#gkvServiceForm .save').click();
  await page.waitForFunction(()=>window.f.saved.gkvServiceForm.ok===false);checks++;
  for(const theme of ['light','dark']) for(const width of [390,1280]) {
    await page.setViewportSize({width,height:850});
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}/${theme} overflow`);checks++;
  }
  console.log(`${checks}/${checks} Browserprüfungen PASS; synthetische Serviceeditoren und Terminmaske, keine Live-/DB-Abnahme.`);
} finally { await browser.close(); }
