import '../../test-browser-config.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {erstellePhysioDaten} from './daten.mjs';
import {berechneDemoControlling,ladeDemoControlling,demoControllingHtml} from './controlling.mjs';

function fixture(){
  const tabellen=erstellePhysioDaten({tag:'2026-10-30'});
  const uid=tabellen.profiles.find(p=>p.role==='owner').id;
  const kontext={rolle:'owner',uid,ownerId:uid,businessId:null,patientsGemeinsam:false,bereit:true};
  const source={tabellen,client:{auth:{getUser:async()=>({data:{user:{id:uid}},error:null})}}};
  return {tabellen,kontext,source,run:()=>berechneDemoControlling({tabellen,kontext})};
}
test('Aktueller Seed zählt gespeicherte Status/Sitzungen, niemals Finanzbeträge',()=>{
  const f=fixture(),r=f.run();assert.equal(r.status,'ok');assert.equal(r.zaehler.verordnungen.anzahl,6);assert.equal(r.zaehler.bereit.anzahl,1);
  assert.equal(r.zaehler.sitzungen.anzahl,36);assert.equal(r.zaehler.erbracht.anzahl,12);assert.equal(r.gesamtCent,null);
  assert.match(demoControllingHtml(r),/Betrag unbekannt/);assert.doesNotMatch(demoControllingHtml(r),/0,00|€|≈/);
});
test('Neuer Parent, Änderung done und Status bereit werden aus Rohstore gezählt; JSON-Reload identisch',()=>{
  const f=fixture(),rx=structuredClone(f.tabellen.prescriptions[0]);rx.id='50000000-0000-4000-8000-000000000099';rx.abrechnung_status='bereit';
  f.tabellen.prescriptions.push(rx);assert.equal(f.run().zaehler.verordnungen.anzahl,7);assert.equal(f.run().zaehler.bereit.anzahl,2);
  const row=f.tabellen.prescription_sessions.find(s=>s.status==='planned');row.status='done';
  assert.equal(f.run().zaehler.erbracht.anzahl,13);
  assert.deepEqual(berechneDemoControlling({tabellen:JSON.parse(JSON.stringify(f.tabellen)),kontext:f.kontext}),f.run());
});
test('Standort folgt Patienten A/NULL; B und Fremdowner ausgeschlossen',()=>{
  const f=fixture(),a='70000000-0000-4000-8000-000000000001',b='70000000-0000-4000-8000-000000000002';
  f.kontext.businessId=a;
  const rx=f.tabellen.prescriptions[0];f.tabellen.leads.find(p=>p.id===rx.patient_id).business_id=b;
  assert.equal(f.run().zaehler.verordnungen.anzahl,5);
  rx.owner_id='foreign';assert.equal(f.run().zaehler.verordnungen.anzahl,5);
  f.kontext.patientsGemeinsam=true;assert.equal(f.run().zaehler.verordnungen.anzahl,5);
});
for(const mutate of [f=>delete f.tabellen.bookings,f=>delete f.tabellen.prescription_sessions,f=>f.source.speicherFehler=true,f=>{f.source.wiederherstellungsFehler=true;f.source.speicherFehler=false;}])test('Fehlende Quelle/Storagefehler erzeugt Unknown',async()=>{
  const f=fixture();mutate(f);const r=await ladeDemoControlling({kontext:()=>f.kontext,demo:()=>f.source});
  assert.equal(r.zaehler.sitzungen.anzahl,null);assert.doesNotMatch(demoControllingHtml(r),/>0<|€|0,00/);
});
for(const mutate of [s=>s.booking_id='40000000-0000-4000-8000-000000000099',s=>s.heilmittel_index=1,s=>delete s.heilmittel_index,s=>s.session_number=99,s=>s.status='unknown'])test('Fehlende/ungültige Sitzungszuordnung bleibt Teilmenge+Unknown',()=>{
  const f=fixture();mutate(f.tabellen.prescription_sessions[0]);const r=f.run();assert.equal(r.status,'teilweise');assert.equal(r.zaehler.sitzungen.anzahl,null);assert.ok(r.zaehler.sitzungen.bekanntAnzahl>0);assert.match(demoControllingHtml(r),/Teilmenge/);
});
for(const change of ['owner','patient','standort'])test(`Terminabweichung ${change} liefert keine bestätigte Sitzung`,()=>{
  const f=fixture();const b=f.tabellen.bookings.find(b=>b.id===f.tabellen.prescription_sessions[0].booking_id);
  if(change==='owner')b.owner_id='foreign';if(change==='patient')b.lead_id=f.tabellen.leads[1].id;
  if(change==='standort'){f.kontext.businessId=f.tabellen.businesses[0].id;b.business_id='70000000-0000-4000-8000-000000000099';}
  assert.equal(f.run().zaehler.sitzungen.anzahl,null);
});
test('Unbekannter Rezeptstatus und fehlender Patient erzeugen keine Entwarnung',()=>{
  const f=fixture();delete f.tabellen.prescriptions[0].abrechnung_status;assert.equal(f.run().zaehler.bereit.anzahl,null);
  f.tabellen.prescriptions[0].patient_id=null;assert.equal(f.run().zaehler.verordnungen.anzahl,null);
});
test('Abgesagte Sitzung/Termin zählen nicht aktiv; keine Verwendung eingebetteter veralteter Sessions',()=>{
  const f=fixture();f.tabellen.prescription_sessions[0].status='cancelled';f.tabellen.prescriptions[0].prescription_sessions=[];
  assert.equal(f.run().zaehler.sitzungen.anzahl,35);
});
test('Employee vor Tabellen und Auth gesperrt',async()=>{
  const kontext={rolle:'employee'};const source=()=>{throw new Error('Kein Storezugriff erlaubt');};
  assert.equal((await ladeDemoControlling({kontext:()=>kontext,demo:source})).status,'gesperrt');
  assert.equal(berechneDemoControlling({kontext,get tabellen(){throw new Error('Fachread');}}).status,'gesperrt');
});
for(const change of ['uid','ownerId','businessId','patientsGemeinsam','bereit','rolle'])test(`Kontextwechsel während Auth ${change} verwirft Antwort`,async()=>{
  const f=fixture();let release;f.source.client.auth.getUser=()=>new Promise(r=>release=r);
  const pending=ladeDemoControlling({kontext:()=>f.kontext,demo:()=>f.source});
  f.kontext[change]=change==='bereit'?false:change==='patientsGemeinsam'?true:'changed';release({data:{user:{id:f.kontext.uid}}});
  assert.notEqual((await pending).status,'ok');
});
test('Falsche Auth/Profile und endlicher Auth-Hänger bleiben Unknown',async()=>{
  const f=fixture();f.source.client.auth.getUser=async()=>({data:{user:{id:'foreign'}}});
  assert.equal((await ladeDemoControlling({kontext:()=>f.kontext,demo:()=>f.source})).zaehler.bereit.anzahl,null);
  f.source.client.auth.getUser=()=>new Promise(()=>{});
  assert.equal((await ladeDemoControlling({kontext:()=>f.kontext,demo:()=>f.source,timeoutMs:5})).status,'unbekannt');
});
