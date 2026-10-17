import test from 'node:test';
import assert from 'node:assert/strict';
import { erstelleRezeptPatientenkopf } from './rezept-patientenkopf.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(read) {
  const nodes=new Map();
  for(const id of ['rzPatientId','rzPatName','rzPatVorname','rzPatGeb','rzPatStrasse','rzPatOrt','rzPatVersNr',
    'rzPatStatus','rzPatKasse','rzPatKasseIk','rzArztName','rzLanr','rzBsnr','rzHausbesuch','rzSaveBtn','rzPatientHint'])
    nodes.set(id,{value:'',textContent:'',style:{},dataset:{},disabled:false});
  const parent={},wrap={parentElement:parent,isConnected:true};nodes.set('rzMaskeWrap',wrap);
  let owner='owner';
  const controller=erstelleRezeptPatientenkopf({document:{getElementById:id=>nodes.get(id)},getOwnerId:()=>owner,
    supabase:{from(table){let id;const q={select:()=>q,eq(k,v){id=v;return q;},maybeSingle:()=>read(table,id)};return q;}},
    leadGeburtsdatum:l=>l.geburtsdatum,leadHausbesuch:l=>!!l.hausbesuch,setHausbesuch:value=>{nodes.get('rzHausbesuch').checked=value;},vorauswahlArtAusPatient(){},tazeleIkHinweis(){},aktualisiereArztSperreBanner(){}});
  return {controller,nodes,wrap,setOwner:id=>{owner=id;}};
}
const row=id=>({data:{id,last_name:id+' ONLY',geburtsdatum:'2000-01-02',krankenkasse:'SYNTH-'+id},error:null});
test('Rezeptkopf: alte A-Antwort überschreibt geladenes B nicht',async()=>{
  const wait=deferred();const f=fixture((_,id)=>id==='A'?wait.promise:Promise.resolve(row(id)));
  const old=f.controller.load('A');await f.controller.load('B');wait.resolve(row('A'));await old;
  assert.equal(f.nodes.get('rzPatientId').value,'B');assert.equal(f.nodes.get('rzPatName').value,'B ONLY');
  assert.equal(f.nodes.get('rzSaveBtn').disabled,false);
});
test('Rezeptkopf: Patientenwechsel leert und sperrt Felder bis Daten vollständig geladen',async()=>{
  const wait=deferred();const f=fixture((_,id)=>id==='B'?wait.promise:Promise.resolve(row(id)));
  await f.controller.load('A');const loading=f.controller.load('B');
  assert.equal(f.nodes.get('rzPatName').value,'');assert.equal(f.nodes.get('rzSaveBtn').disabled,true);
  assert.equal(f.nodes.get('rzSaveBtn').dataset.patientLoading,'1');
  wait.resolve(row('B'));await loading;
  assert.equal(f.nodes.get('rzPatGeb').value,'02.01.2000');assert.equal(f.nodes.get('rzSaveBtn').dataset.patientLoading,undefined);
});
test('Rezeptkopf: Lesefehler bleibt gesperrt, neue Auswahl kann laden',async()=>{
  const f=fixture((_,id)=>Promise.resolve(id==='A'?{data:null,error:{message:'synthetic'}}:row(id)));
  assert.equal(await f.controller.load('A'),false);assert.equal(f.nodes.get('rzSaveBtn').disabled,true);
  assert.match(f.nodes.get('rzPatientHint').textContent,/erneut auswählen/);
  assert.equal(await f.controller.load('B'),true);assert.equal(f.nodes.get('rzSaveBtn').disabled,false);
});
test('Rezeptkopf: verspäteter Arzt aus A überschreibt B nicht',async()=>{
  const doctor=deferred();const f=fixture((table,id)=>table==='aerzte'?doctor.promise:Promise.resolve({...row(id),data:{...row(id).data,arzt_id:id==='A'?'doctor-A':null}}));
  const loading=f.controller.load('A');await Promise.resolve();await f.controller.load('B');
  doctor.resolve({data:{arzt_name:'A ONLY',lanr:'123',bsnr:'456'}});await loading;
  assert.equal(f.nodes.get('rzArztName').value,'');assert.equal(f.nodes.get('rzPatName').value,'B ONLY');
});
test('Rezeptkopf: Abwahl und Maskenreset verwerfen laufende Antworten',async()=>{
  for(const action of ['clear','reset']) {
    const wait=deferred();const f=fixture(()=>wait.promise);const loading=f.controller.load('A');
    if(action==='clear')await f.controller.load('');else f.controller.invalidate();
    wait.resolve(row('A'));assert.equal(await loading,false);assert.equal(f.nodes.get('rzPatName').value,'');
    assert.equal(f.nodes.get('rzSaveBtn').disabled,false);
  }
});
test('Rezeptkopf: bestehende Speichersperre bleibt nach Laden erhalten',async()=>{
  const f=fixture((_,id)=>Promise.resolve(row(id)));f.nodes.get('rzSaveBtn').disabled=true;
  await f.controller.load('A');assert.equal(f.nodes.get('rzSaveBtn').disabled,true);
});
test('Rezeptkopf: Ownerwechsel oder Umhängen verwirft alte Antwort',async()=>{
  for(const action of ['owner','parent']) {
    const wait=deferred();const f=fixture(()=>wait.promise);const loading=f.controller.load('A');
    if(action==='owner')f.setOwner('other');else f.wrap.parentElement={};
    wait.resolve(row('A'));assert.equal(await loading,false);assert.equal(f.nodes.get('rzPatName').value,'');
  }
});

test('Rezeptkopf: automatisch übernommener Arzt und Hausbesuch bleiben nicht bei anderem Patienten',async()=>{
  const f=fixture((table,id)=>Promise.resolve(table==='aerzte'?{data:{arzt_name:id,lanr:'lanr-'+id,bsnr:'bsnr-'+id}}:
    {data:{...row(id).data,arzt_id:'doctor-'+id,hausbesuch:id==='A'}}));
  await f.controller.load('A');assert.equal(f.nodes.get('rzArztName').value,'doctor-A');assert.equal(f.nodes.get('rzHausbesuch').checked,true);
  await f.controller.load('B');assert.equal(f.nodes.get('rzArztName').value,'doctor-B');assert.equal(f.nodes.get('rzLanr').value,'lanr-doctor-B');assert.equal(f.nodes.get('rzHausbesuch').checked,false);
});
test('Rezeptkopf: manuell bearbeitete Arztwerte bleiben bei Patientenwechsel erhalten',async()=>{
  const f=fixture((table,id)=>Promise.resolve(table==='aerzte'?{data:{arzt_name:id}}:{data:{...row(id).data,arzt_id:'doctor-'+id}}));
  await f.controller.load('A');f.nodes.get('rzArztName').value='Manual doctor';
  await f.controller.load('B');assert.equal(f.nodes.get('rzArztName').value,'Manual doctor');
});
test('Rezeptkopf: einzeln korrigierte LANR bleibt mit ganzer Arztidentität zusammen',async()=>{
  const f=fixture((table,id)=>Promise.resolve(table==='aerzte'?{data:{arzt_name:id,lanr:'lanr-'+id,bsnr:'bsnr-'+id}}:
    {data:{...row(id).data,arzt_id:'doctor-'+id}}));
  await f.controller.load('A');f.nodes.get('rzLanr').value='manual LANR';
  await f.controller.load('B');assert.equal(f.nodes.get('rzArztName').value,'doctor-A');
  assert.equal(f.nodes.get('rzLanr').value,'manual LANR');assert.equal(f.nodes.get('rzBsnr').value,'bsnr-doctor-A');
});
test('Rezeptkopf: vorhandene manuelle Teilangabe verhindert automatische fremde Arztidentität',async()=>{
  const f=fixture((_,id)=>Promise.resolve({data:{...row(id).data,arzt_id:'doctor-'+id}}));
  f.nodes.get('rzLanr').value='manual LANR';await f.controller.load('B');
  assert.equal(f.nodes.get('rzArztName').value,'');assert.equal(f.nodes.get('rzLanr').value,'manual LANR');
});
