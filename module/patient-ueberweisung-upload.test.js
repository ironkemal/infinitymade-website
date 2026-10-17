import test from 'node:test';
import assert from 'node:assert/strict';
import { erstelleUeberweisungUpload } from './patient-ueberweisung-upload.js';
import fs from 'node:fs';
import vm from 'node:vm';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(insert=async()=>({error:null})) {
  let patient='A',owner='owner',reader;
  const writes=[],reloads=[],toasts=[];
  const controller=erstelleUeberweisungUpload({getPatientId:()=>patient,getOwnerId:()=>owner,
    FileReader:class {constructor(){reader=this;}readAsDataURL(){}},
    supabase:{from:()=>({insert:row=>{writes.push(row);return insert();}})},
    showToast:m=>toasts.push(m),reload:async id=>{reloads.push(id);}});
  return {controller,writes,reloads,toasts,setPatient:id=>{patient=id;},setOwner:id=>{owner=id;},
    complete(){reader.result='data:application/pdf;base64,U1lOVEgtQQ==';reader.onload();},fail(){reader.onerror();}};
}
test('Überweisung: Wechsel während Dateilesen schreibt keine Datei unter B',async()=>{
  const f=fixture();const loading=f.controller.upload({name:'A.pdf'});f.setPatient('B');f.complete();
  assert.equal(await loading,false);assert.equal(f.writes.length,0);assert.equal(f.reloads.length,0);
});
test('Überweisung: Schließen und Wiederöffnen derselben Akte verwirft alte Auswahl',async()=>{
  const f=fixture();const loading=f.controller.upload({});f.controller.invalidate();f.complete();
  assert.equal(await loading,false);assert.equal(f.writes.length,0);
});
test('Überweisung: gültiger Upload bleibt fest an Originalpatient und Owner gebunden',async()=>{
  const f=fixture();const loading=f.controller.upload({});f.complete();assert.equal(await loading,true);
  assert.equal(f.writes[0].lead_id,'A');assert.equal(f.writes[0].owner_id,'owner');assert.deepEqual(f.reloads,['A']);
});
test('Überweisung: verspäteter INSERT-Abschluss lädt neue Akte nicht nach',async()=>{
  const wait=deferred(),f=fixture(()=>wait.promise);const loading=f.controller.upload({});f.complete();await Promise.resolve();
  assert.equal(f.writes[0].lead_id,'A');f.setPatient('B');wait.resolve({error:null});
  assert.equal(await loading,false);assert.equal(f.reloads.length,0);assert.equal(f.toasts.length,0);
});
test('Überweisung: Ownerwechsel und Lesefehler schreiben nichts',async()=>{
  const f=fixture();const loading=f.controller.upload({});f.setOwner('other');f.complete();await loading;assert.equal(f.writes.length,0);
  const g=fixture();const failed=g.controller.upload({});g.fail();assert.equal(await failed,false);assert.equal(g.writes.length,0);assert.match(g.toasts[0],/gelesen/);
});

test('Überweisung: bereits gestartetes Akten-Nachladen darf neuen Patienten nicht überschreiben',async()=>{
  const source=fs.readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
  const start=source.indexOf('async function loadPatientDetailUeberweisung(leadId) {');
  const end=source.indexOf('async function loadPatientDetailRechnungen(',start);
  const wait=deferred(),content={innerHTML:'B ONLY'};
  const c=vm.createContext({pdCurrentLeadId:'A',ueberweisungUpload:{version:()=>1},
    document:{getElementById:()=>content},supabase:{from(){const q={select:()=>q,eq:()=>q,order:()=>wait.promise};return q;}}});
  vm.runInContext(source.slice(start,end),c);const loading=c.loadPatientDetailUeberweisung('A');
  c.pdCurrentLeadId='B';wait.resolve({data:[]});await loading;assert.equal(content.innerHTML,'B ONLY');
});
