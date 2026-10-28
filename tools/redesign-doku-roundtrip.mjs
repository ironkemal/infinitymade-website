/**
 * Geschlossener synthetischer Doku-Roundtrip auf bestehendem Redesign-Harness.
 * Aufruf: REDESIGN_PORT=18082 timeout -s KILL 240 node tools/redesign-doku-roundtrip.mjs
 * --kurz: nur Neu/Owner/Podologie/hell1440. Ergebnisse im REDESIGN_DOKU_OUTPUT
 * (Standard /tmp/praxura-v704f-ui); alle Eingaben frei erfunden.
 * REDESIGN_DOKU_DELAY_MS=1200 verzögert ausschließlich synthetische Dokuqueries
 * einschließlich Writes. Konkrete Zustände werden bis zum Timeout erwartet;
 * gemeinsame Start-/Panelpausen des Basisharness bleiben unverändert.
 *
 * Nur drei Doku-Tabellen erhalten pro Fall ausdrücklich freigegebene In-Memory-
 * Inserts/Updates. Alle anderen Writes bleiben ursprünglicher RS_READONLY-Fehler.
 * Echte DOM-Eingaben und Original-Writer; Nutzfelder werden aus tatsächlichen
 * Payloads erneut gelesen. IDs/Version/ist_aktuell sind synthetische Metadaten,
 * kein Nachweis echter Trigger, RLS, Transaktionen, Writer-Races oder Livepersistenz.
 * Employee-Fälle besitzen explizit injizierte bestehende Modulrechte einschließlich
 * abrechnung; keine Aussage zu neuer Rechtepolitik oder Produktstandardrechten.
 * HTTP-Fence aus Harness, WebSocket-Fence vor Seitenerzeugung. Keine Versand-,
 * KI-, Zahlungs-, Druck- oder Löschaktion. Keine Produkt-/Referenzänderung.
 */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {WURZEL,starteServer,starteBrowser,oeffneDashboard,wechsle} from './redesign-harness.mjs';
const root=WURZEL,out=process.env.REDESIGN_DOKU_OUTPUT||'/tmp/praxura-v704f-ui';await mkdir(out,{recursive:true});
const delayMs=Number(process.env.REDESIGN_DOKU_DELAY_MS||0);
assert.ok(Number.isInteger(delayMs)&&delayMs>=0&&delayMs<=2000,'Doku-Verzögerung muss 0–2000 ms betragen');
const lead='2000000-0000-4000-8000-000000000001',owner='10000000-0000-4000-8000-000000000001';
let fixture=await readFile(root+'/tools/browser-probe/redesign-fixture.js','utf8');
assert.equal(fixture.split('const wertAn =').length,2,'Fixture-Anker für Tabellen fehlt/mehrdeutig');
assert.equal(fixture.split('    if (this.schreib) {').length,2,'Fixture-Anker für Schreib-Fence fehlt/mehrdeutig');
const antwortAnker='return warten.then(() => this.lauf()).then(ok, fail);';
assert.equal(fixture.split(antwortAnker).length,2,'Fixture-Anker für Antwortverzögerung fehlt/mehrdeutig');
fixture=fixture.replace(antwortAnker,`return warten.then(() => ${delayMs} && ['anamnese','patient_notes','pat_fussbefund'].includes(this.tabelle) ? new Promise(r=>setTimeout(r,${delayMs})) : undefined).then(() => this.lauf()).then(ok, fail);`);
fixture=fixture.replace('const wertAn =',`for(const t of ['anamnese','patient_notes','pat_fussbefund'])tabellen[t]=[];
window.__rsDoku={accepted:[],rows:tabellen};
const wertAn =`);
fixture=fixture.replace('    if (this.schreib) {',`    if (this.schreib && this.tabelle === window.__rsDokuErlaubt) {
 const [art,input]=this.schreib, payloads=Array.isArray(input)?input:[input];
 if(!['anamnese','patient_notes','pat_fussbefund'].includes(this.tabelle)||!['insert','update'].includes(art))throw new Error('Doku-Fixture: nicht erlaubter Schreibweg');
 for(const v of payloads)if(v.owner_id!==OWNER||(v.patient_id||v.lead_id)!=='${lead}')throw new Error('Doku-Fixture: Scope verletzt');
 const table=tabellen[this.tabelle],result=[];
 for(const payload of payloads){
 let row;
 if(art==='update'){const matches=table.filter(r=>this.filter.every(f=>f(r)));if(matches.length!==1)throw new Error('Doku-Fixture: Update ohne exakte Zeile');row=matches[0];Object.assign(row,clone(payload));}
 else {const version=table.length+1;for(const prev of table)if(prev.fachbereich===payload.fachbereich)prev.ist_aktuell=false;
 row={...clone(payload),id:'90000000-0000-4000-8000-'+String(window.__rsDoku.accepted.length+1).padStart(12,'0'),version,ist_aktuell:true,created_at:TAG+'T10:15:0'+version+'Z',eintrag_id:payload.eintrag_id||'91000000-0000-4000-8000-000000000001',serie_id:payload.serie_id||'92000000-0000-4000-8000-000000000001',serie_farbe:payload.serie_farbe||'#333333'};table.push(row);}
 result.push(clone(row));window.__rsDoku.accepted.push({tabelle:this.tabelle,art,payload:clone(payload)});log.writes.push({tabelle:this.tabelle,art,synthetisch:true});
 }
 return {data:this.art==='liste'?result:result[0],error:null};
 }
    if (this.schreib) {`);
const cases=[];for(const design of ['neu','alt'])for(const rolle of ['owner','employee'])for(const theme of ['hell','dunkel'])cases.push({design,rolle,theme,breite:theme==='hell'?1440:390,sector:'podologie'});
if(process.argv.includes('--kurz'))cases.splice(1);else for(const sector of ['physiotherapy','ergotherapie','logopaedie'])cases.push({design:'neu',rolle:'owner',theme:'hell',breite:1440,sector});
const server=await starteServer(),browser=await starteBrowser(),rows=[];
const orig=browser.newContext.bind(browser);browser.newContext=async(...args)=>{const c=await orig(...args);await c.routeWebSocket('**',ws=>ws.close());return c;};
try{for(const o of cases){const c=await oeffneDashboard(browser,{basis:server.basis,...o,szenario:'voll'}),p=c.page;p.setDefaultTimeout(15000);
try{
 const source=fixture.replace("has_access: module !== 'abrechnung'","has_access: true").replace("sector: 'podologie'","sector: '"+o.sector+"'");
 await p.route('**/vendor/supabase-js.js*',r=>r.fulfill({status:200,contentType:'text/javascript',body:source}));
 await p.reload({waitUntil:'domcontentloaded'});await p.locator('#sidebarNav .sidebar-item').first().waitFor({state:'attached'});
 const before=await p.evaluate(()=>window.__rsFixture.writes.length);
 for(const art of (o.sector==='podologie'?['anamnese','notizen','fussbefund']:['anamnese'])){
 console.log('BEGIN',o.design,o.rolle,o.theme,art);const marker='SYNTHETISCH '+o.design+' '+o.rolle+' '+o.theme+' '+art;
 await p.evaluate(t=>window.__rsDokuErlaubt=t,{anamnese:'anamnese',notizen:'patient_notes',fussbefund:'pat_fussbefund'}[art]);
 if(o.design==='neu'){
 await p.evaluate(id=>window.openPatientDetail(id),lead);await p.locator('#patientDetailModal').waitFor({state:'visible'});
 await p.locator('#patientDetailModal .pd-tab[data-tab="'+({notizen:'verlauf'}[art]||art)+'"]').click();
 if(art==='notizen')await p.locator('#pdVerlaufNotizenBox summary').click();
 await p.locator('#'+({anamnese:'pdPanelAnamnese',notizen:'pdPanelNotes',fussbefund:'pdPanelFussbefund'}[art])+' .px-akte-aktionen button').click();
 }else{
 await wechsle(p,art==='fussbefund'?'fussstatus':art);
 if(art==='notizen'){await p.locator('#notesPatientInput').fill('Erika');await p.locator('#notesPatientList li').first().click();assert.equal(await p.locator('#notesPatient').inputValue(),lead);}
 else if(art==='anamnese')await p.locator('#anamPatientSelect').selectOption(lead);else{await p.locator('#fbpPatientSearch').fill('Erika');await p.locator('#fbpPatientDropdown [data-id]').first().click();assert.equal(await p.locator('#fbpPatient').inputValue(),lead);}
 }
 const speichern={anamnese:'anamSaveBtn',notizen:'notesSaveBtn',fussbefund:'fbpSaveBtn'}[art];
 await p.waitForFunction(id=>{const el=document.getElementById(id);return el&&!el.disabled;},speichern);
 if(art==='anamnese'){
 await p.locator('#anamSaveBtn').waitFor({state:'visible'});
 if(o.sector==='podologie')for(const [feld,val]of [['diabetes','nein'],['gerinnung','nein'],['allergien','keine']])await p.locator('[data-anf-feld="'+feld+'"] input[value="'+val+'"]').check();
 await p.locator(o.sector==='physiotherapy'?'#anamNotizen':'[data-anf-feld="bemerkungen"] textarea').fill(marker);
 await p.locator('#anamSaveBtn').click();
 }else if(art==='notizen'){
 await p.locator('#notesTherapist').fill(marker);await p.locator('#notesDoctor').fill('SYNTHETISCH Arzt');await p.locator('#notesSaveBtn').click();
 }else{
 await p.locator('#fbpTermin').selectOption('__ohne__');await p.locator('#fbpNotiz').fill(marker);await p.locator('#fbpSaveBtn').click();
 }
 await p.waitForFunction(({t,marker})=>window.__rsDoku.accepted.some(w=>w.tabelle===t&&JSON.stringify(w.payload).includes(marker)),{t:{anamnese:'anamnese',notizen:'patient_notes',fussbefund:'pat_fussbefund'}[art],marker});
 await p.waitForFunction(id=>{const el=document.getElementById(id);return el&&!el.disabled;},speichern);
 const feld=art==='anamnese'?(o.sector==='physiotherapy'?'#anamNotizen':'[data-anf-feld="bemerkungen"] textarea'):art==='notizen'?'#notesTherapist':'#fbpNotiz';
 await p.locator(feld).fill('SYNTHETISCH UNGESPEICHERT');
 const tabelle={anamnese:'anamnese',notizen:'patient_notes',fussbefund:'pat_fussbefund'}[art];
 const readsVorher=await p.evaluate(t=>window.__rsFixture.reads.filter(x=>x===t).length,tabelle);
 await wechsle(p,'kunden');await wechsle(p,art==='fussbefund'?'fussstatus':art);
 if(art==='notizen'){await p.locator('#notesPatientInput').fill('Erika');await p.locator('#notesPatientList li').first().click();assert.equal(await p.locator('#notesPatient').inputValue(),lead);}
 else if(art==='anamnese')await p.locator('#anamPatientSelect').selectOption(lead);else{await p.locator('#fbpPatientSearch').fill('Erika');await p.locator('#fbpPatientDropdown [data-id]').first().click();assert.equal(await p.locator('#fbpPatient').inputValue(),lead);}
 await p.waitForFunction(({t,vorher})=>window.__rsFixture.reads.filter(x=>x===t).length>vorher,{t:tabelle,vorher:readsVorher});
 if(art!=='fussbefund')await p.waitForFunction(({feld,marker,id})=>document.querySelector(feld)?.value===marker&&!document.getElementById(id)?.disabled,{feld,marker,id:speichern});
 if(art==='fussbefund'){
 // Existing saved version is selected through its rendered list entry.
 await p.locator('#fbpTableContainer .fbp-btn-open').first().click();await p.waitForFunction(marker=>document.querySelector('#fbpNotiz')?.value===marker,marker);
 }
 assert.ok((await p.evaluate(t=>window.__rsFixture.reads.filter(x=>x===t).length,tabelle))>readsVorher,'Wiederöffnen muss Quelle erneut lesen');
 const accepted=await p.evaluate(()=>window.__rsDoku.accepted);
 if(art==='anamnese')assert.equal(accepted.at(-1).payload.created_by,o.rolle==='owner'?owner:'10000000-0000-4000-8000-000000000002');if(art==='fussbefund')assert.equal(accepted.at(-1).payload.erfasst_von,o.rolle==='owner'?owner:'10000000-0000-4000-8000-000000000002');assert.equal(accepted.at(-1).payload.owner_id,owner);assert.equal(accepted.at(-1).payload.patient_id||accepted.at(-1).payload.lead_id,lead);
 await p.screenshot({path:out+'/'+o.design+'-'+o.rolle+'-'+o.theme+'-'+o.sector+'-'+art+'.png'});
 rows.push({...o,art,delayMs,writes:accepted.length});console.log(JSON.stringify(rows.at(-1)));
 }
 assert.equal((await p.evaluate(()=>window.__rsFixture.writes.length))-before,o.sector==='podologie'?3:1);
 assert.deepEqual(c.protokoll.seitenfehler,[]);assert.deepEqual(c.protokoll.fremd,[]);
}catch(e){console.error(JSON.stringify(await p.evaluate(()=>({accepted:window.__rsDoku?.accepted,writes:window.__rsFixture?.writes,patient:document.querySelector('#fbpPatient')?.value,termin:document.querySelector('#fbpTermin')?.value,disabled:document.querySelector('#fbpSaveBtn')?.disabled}))));await p.screenshot({path:out+'/fehler.png'});console.error(await p.locator('body').innerText().then(t=>t.slice(-1500)));throw e;}finally{await c.kontext.close();}
}await writeFile(out+'/bericht.json',JSON.stringify(rows,null,2));}finally{await browser.close();await server.stop();}
