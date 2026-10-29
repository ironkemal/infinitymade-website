/** Actual app UI against local synthetic runtime; no live data or external IO. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {erstelleDemoServer} from './server.mjs';

const out=process.env.PHYSIO_BERICHT||'/tmp/praxura-physio-probe';
await mkdir(out,{recursive:true});
const demo=await erstelleDemoServer({port:18086,tag:'2026-10-30'});
const report={checks:[],errors:[],blocked:[],api:[]};
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
await context.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(u.origin!=='http://127.0.0.1:18086'){report.blocked.push(u.origin);return r.abort();}
  return r.continue();
});
await context.routeWebSocket('**/*',s=>s.close());
const page=await context.newPage();page.setDefaultTimeout(12000);
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/')) report.api.push({path:new URL(r.url()).pathname,status:r.status()});});
const check=(name,ok)=>{report.checks.push({name,ok:!!ok});assert.ok(ok,name);};
async function panel(id){
  await page.evaluate(id=>window.switchPanel(id),id);
  await page.locator('#panel-'+id+'.active').waitFor();
}
const tables=()=>page.evaluate(()=>window.__lokaleTestpraxis.tabellen);
try{
  await new Promise((resolve,reject)=>{demo.server.once('error',reject);demo.server.listen(demo.port,'127.0.0.1',resolve);});
  await page.goto(demo.url);await page.waitForFunction(()=>typeof window.switchPanel==='function'&&document.getElementById('panel-overview')?.classList.contains('active'));
  check('Physio-Profil aktiv',(await tables()).profiles[0].sector==='physiotherapy');
  await panel('services');await page.locator('#gkvCatalogSection').waitFor({state:'visible'});
  check('KG und MT sichtbar',await page.locator('#panel-services').innerText().then(t=>t.includes('Krankengymnastik')&&t.includes('Manuelle Therapie')));
  await page.screenshot({path:out+'/leistungen-1440.png'});
  const before=(await tables()).services.length;
  await page.locator('#servicesGrid').getByRole('button',{name:/Leistung/}).first().click();
  await page.locator('#srvTitle').fill('Physio Demo Selbstzahler');
  await page.locator('.srv-dur-card[data-dur="30"] .dur-cb').check();
  await page.locator('.srv-dur-card[data-dur="30"] .dur-price').fill('45');
  const type=page.locator('#srvKostentraegerTyp');if(await type.isVisible())await type.selectOption('privat');
  await page.locator('#srvSaveBtn').click();await page.locator('#addServiceForm').waitFor({state:'hidden'});
  let t=await tables();const service=t.services.find(s=>s.title==='Physio Demo Selbstzahler');
  check('Leistung über UI gespeichert',t.services.length===before+1&&service?.duration_minutes===30&&Number(service?.price)===45);
  check('Therapeuten zugeordnet',t.employee_services.some(e=>e.service_id===service.id));
  await page.reload();await page.waitForFunction(()=>typeof window.switchPanel==='function'&&window.__lokaleTestpraxis);
  check('Leistung nach Reload erhalten',(await tables()).services.some(s=>s.id===service.id));
  await panel('kunden');
  const newPatient=page.locator('#panel-kunden').getByRole('button',{name:/Patient.*(anlegen|hinzufügen)|Neuer Patient|Hinzufügen/}).first();
  await newPatient.click();
  await page.locator('#lead-first-name').fill('Lena');await page.locator('#lead-last-name').fill('Physiotest');
  await page.locator('#lead-geburtsdatum').fill('1988-04-12');
  await page.locator('#leadSaveBtn').click();await page.locator('#leadModal').waitFor({state:'hidden'});
  t=await tables();const patient=t.leads.find(p=>p.last_name==='Physiotest');check('Patient über UI gespeichert',!!patient);
  await panel('anamnese');await page.locator('#anamPatientSelect').selectOption(patient.id);
  await page.waitForFunction(()=>!document.getElementById('anamSaveBtn').disabled);
  await page.locator('#anamHauptbeschwerde').fill('Synthetische Vorführung: Belastungsschmerz am Knie.');
  await page.locator('#anamNotizen').fill('Nur Testdaten; Übungsprogramm besprochen.');
  await page.locator('#anamSaveBtn').click();
  await page.waitForFunction(id=>window.__lokaleTestpraxis.tabellen.anamnese?.some(a=>a.patient_id===id&&a.ist_aktuell),patient.id);
  check('Physio-Anamnese gespeichert',(await tables()).anamnese.some(a=>a.patient_id===patient.id&&a.fachbereich==='physio'));
  await page.reload();await page.waitForFunction(()=>typeof window.switchPanel==='function'&&window.__lokaleTestpraxis);
  await panel('anamnese');await page.locator('#anamPatientSelect').selectOption(patient.id);
  await page.waitForFunction(()=>!document.getElementById('anamSaveBtn').disabled);
  check('Anamnese erneut geöffnet',(await page.locator('#anamHauptbeschwerde').inputValue()).includes('Belastungsschmerz'));
  await page.evaluate(id=>window.openRezeptModal(null,id),patient.id);
  await page.locator('#rzPatientId').waitFor({state:'attached'});
  await page.locator('#rzAusstDate').fill('2026-10-29');
  await page.locator('#rzArztName').fill('Dr. Demo Beispiel');
  await page.locator('#rzLanr').fill('999999900');await page.locator('#rzBsnr').fill('999999900');
  await page.locator('#rzIcd').fill('M54.5');await page.locator('#rzDg').fill('WS');
  // Kassen-/Versichertendaten wie von der Karte (erfunden; KVNR mit gültiger Prüfziffer, IK wie Testpraxis).
  await page.locator('#rzPatKasse').fill('Kasse Synthetisch');
  await page.locator('#rzPatKasseIk').fill('999999999');
  await page.locator('#rzPatVersNr').fill('Z123456783');
  // Heilmittel aus dem Katalog wählen (setzt Positionsnummer), nicht frei tippen.
  await page.locator('#rzHm').click();await page.locator('#rzHm').pressSequentially('Krankengym');
  await page.waitForTimeout(600);report.hmItems=await page.locator('.icd10-dropdown-item').allTextContents();await page.locator('.icd10-dropdown-item',{hasText:'Krankengymnastik'}).first().click();
  const freq=await page.locator('#rzFreq option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
  if(freq.length)await page.locator('#rzFreq').selectOption(freq[0]);
  report.frequenz=freq[0]||null;
  await page.locator('#rzAnzahl').fill('6');// Das Kästchen ist im Muster-13-Bild unsichtbar (dashboard.html .m13-cbx); Nutzer klicken die Beschriftung.
  await page.locator('label:has(#rzUnterschrift)').click();
  if(!(await page.locator('#rzUnterschrift').isChecked()))throw new Error('Unterschrift nicht gesetzt');
  const rxBefore=(await tables()).prescriptions.length;
  await page.locator('#rzSaveBtn').click();
  const draft=page.getByRole('button',{name:'Als Entwurf speichern',exact:true});
  if(await draft.isVisible().catch(()=>false))await draft.click();
  await page.waitForFunction(n=>window.__lokaleTestpraxis.tabellen.prescriptions.length>n,rxBefore);
  t=await tables();const rx=t.prescriptions.find(r=>r.patient_id===patient.id);
  check('Verordnung über Originalhandler gespeichert',!!rx&&rx.therapie_bereich==='physio');
  // /rezept/confirm legt keine Sitzungen an (server.js); sie entstehen beim Verknüpfen von Terminen.
  // Clinical source gaps must stay a draft, never fabricate an insurance clearance.
  report.verordnungStatus=rx.status;
  if(await page.locator('#rezeptModal').isVisible())await page.locator('#rezeptModal .modal-close').click();
  await page.evaluate(()=>window.openBookingModal(null));
  await page.locator('#bkCustomerSearch').fill('Physiotest');
  // Erster Listeneintrag kann „Neuer Patient (Schnellerfassung)“ sein — gezielt die angelegte Patientin wählen.
  await page.locator('#bkCustomerList li',{hasText:'Physiotest'}).first().click();
  // Verordnung des Patienten im Terminformular wählen (Karte in #bkVeroCards), damit die Serie die Sitzungen belegt.
  await page.locator('#bkVeroCards > *').first().waitFor({state:'visible'});
  report.veroKarten=await page.locator('#bkVeroCards > *').allTextContents();
  await page.locator('#bkVeroCards > *').first().click();
  report.gewaehlt=await page.locator('#bkSelectedRxId').inputValue();
  // Mit gewählter Verordnung kommt die Leistung aus ihr (#bkServiceAusVerordnung), die Auswahl ist dann ausgeblendet.
  if(await page.locator('#bkService').isVisible())await page.locator('#bkService').selectOption(service.id);
  report.leistungAusVo=await page.locator('#bkServiceAusVerordnung').isVisible();
  report.bkServiceWert=await page.locator('#bkService').inputValue();
  await page.locator('#bkStart').fill('2026-11-02T16:00');
  await page.locator('summary.bk-mehr-titel').click();
  await page.locator('#bkSeriesToggle').check();await page.locator('#bkSeriesCount').fill('3');
  await page.locator('#bkSaveBtn').click();
  await page.locator('#bookingModal').waitFor({state:'hidden'});
  // Serie bindet die freien Sitzungen erst nach dem Schließen des Formulars (bindeSerieAnVerordnung).
  await page.waitForFunction(id=>window.__lokaleTestpraxis.tabellen.prescription_sessions.filter(x=>x.prescription_id===id&&x.booking_id).length>=3,rx.id,{timeout:8000}).catch(()=>{});
  t=await tables();const voService=t.services.find(s=>s.code==='X0501');
  const series=t.bookings.filter(b=>b.lead_id===patient.id&&b.service_id===voService.id);
  check('Serie belegt freie Sitzungen der Verordnung',t.prescription_sessions.filter(x=>x.prescription_id===rx.id&&series.some(b=>b.id===x.booking_id)).length===3);
  report.sitzungen={zurVerordnung:t.prescription_sessions.filter(x=>x.prescription_id===rx.id).length,mitSerie:t.prescription_sessions.filter(x=>x.prescription_id===rx.id&&series.some(b=>b.id===x.booking_id)).length,rxStatus:rx.status};
  check('Terminserie über Originalhandler gespeichert',series.length===3&&series.every(b=>(Date.parse(b.end_time)-Date.parse(b.start_time))/60000===voService.duration_minutes));
  await page.reload();await page.waitForFunction(()=>typeof window.switchPanel==='function'&&window.__lokaleTestpraxis);
  check('Verordnung und Serie nach Reload erhalten',(await tables()).prescriptions.some(r=>r.id===rx.id)&&(await tables()).bookings.filter(b=>series.some(s=>s.id===b.id)).length===3);
  // Behandlungsdoku: heutigen Vorführtermin (Seed: geplante Sitzung am Demotag) im Kalender starten und dokumentieren.
  t=await tables();
  const heuteBk=t.bookings.filter(b=>String(b.start_time).startsWith('2026-10-30')&&t.prescription_sessions.some(x=>x.booking_id===b.id&&x.status==='planned')).sort((a,b)=>a.start_time.localeCompare(b.start_time))[0];
  report.dokuTermin=heuteBk&&{name:heuteBk.customer_name,start:heuteBk.start_time};
  await panel('calendar');
  const tagLabel=async()=>page.locator('#dayViewDateLabel').innerText();
  for(let i=0;i<5&&!(await tagLabel()).includes('30.');i++){await page.locator('#dayViewNext').click();await page.waitForTimeout(500);}
  await page.waitForTimeout(800);await page.locator('#dayViewGrid .dv-booking-block',{hasText:heuteBk.customer_name.split(' ').pop()}).first().click({force:true});
  await page.locator('#bkActionStartBtn').click();
  await page.locator('#inputModalField').fill('Synthetische Vorführung: Mobilisation Knie, Übungen angeleitet.');
  await page.locator('#inputModalOk').click();
  await page.waitForFunction(id=>window.__lokaleTestpraxis.tabellen.prescription_sessions.some(x=>x.booking_id===id&&x.status==='done'),heuteBk.id,{timeout:8000});
  t=await tables();const erledigt=t.prescription_sessions.find(x=>x.booking_id===heuteBk.id);
  check('Behandlung dokumentiert (Sitzung erledigt + Notiz)',erledigt?.status==='done'&&String(erledigt.notes||'').includes('Mobilisation'));
  await page.reload();await page.waitForFunction(()=>typeof window.switchPanel==='function'&&window.__lokaleTestpraxis);
  check('Dokumentation nach Reload erhalten',(await tables()).prescription_sessions.some(x=>x.booking_id===heuteBk.id&&x.status==='done'));
  await panel('abrechnung');check('Abrechnungsübersicht erreichbar',await page.locator('#panel-abrechnung').isVisible());
  await page.setViewportSize({width:390,height:844});await panel('services');
  if(await page.locator('#sidebar').evaluate(e=>e.classList.contains('open')))await page.locator('#hamburger').click();
  check('Leistungen mobil ohne Dokumentüberlauf',await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
  await page.screenshot({path:out+'/leistungen-390.png'});
  check('Keine Seitenfehler',report.errors.length===0);check('Keine Fremdrequests',report.blocked.length===0);
}catch(error){report.failure=error.message;process.exitCode=1;await page.screenshot({path:out+'/fehler.png'}).catch(()=>{});}
finally{await context.close();await browser.close();await new Promise(r=>demo.server.close(r));await writeFile(out+'/bericht.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
