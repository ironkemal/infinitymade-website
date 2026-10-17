import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(process.env.PRAXURA_FUSSBEFUND_TEST_SOURCE || new URL('./fussbefund.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i=0;i<10;i++) await Promise.resolve(); };

// Exercise original module-private handlers, including real form collection.
function fixture({ read = async () => ({ data: [], error: null }), risk = async id => ({ row: { patient_id: id }, fehler: false }), insert } = {}) {
  const nodes = new Map();
  for (const id of ['fbpPatient','fbpTermin','fbpDatum','fbpNotiz','fbpWagner','fbpSaveBtn']) {
    nodes.set(id, { value: '', disabled: false, textContent: '', dataset: {}, innerHTML: '', style: {}, isConnected: true });
  }
  const writes = [], messages = [];
  const sb = { from(table) {
    let id; const q = { select: () => q, eq(k,v) { if(k === 'lead_id') id=v; return q; }, neq: () => q, order: () => q,
      limit: () => read(table,id), insert(payload) { writes.push(payload[0]); return q; },
      single: () => insert ? insert() : Promise.resolve({ data: { id:'saved',eintrag_id:'saved',serie_id:'saved',serie_farbe:'blue',version:1 },error:null }) };
    return q;
  } };
  const context = vm.createContext({ console, structuredClone, document: { getElementById: id => nodes.get(id) || null, querySelectorAll: () => [] },
    ladeAktuelle: (_,id) => risk(id), risikoKopie: row => row ? { patient_id:row.patient_id } : null,
    risikoZeilen: () => [], befundRisikoHinweis: () => '', wagnerWert: v => v === '' || v == null ? null : Number(v),
    emit() {}, WAGNER_OPTIONEN:[], WAGNER_TEXT:{}, resolveSector: x => x });
  vm.runInContext(source, context);
  context.testCtx = { supabase:sb, ownerId:()=>'owner',userId:()=>'user',showToast:m=>messages.push(m) };
  vm.runInContext(`ctx=testCtx; globalThis.api={patientGewaehlt,speichern,neuerBefund,
    state:()=>({termine,befundeDesPatienten,risikoRow}),
    setEntry:id=>{currentEintragId=id;serieId=id;}};`,context);
  return { nodes,writes,messages,api:context.api, async select(id) {nodes.get('fbpPatient').value=id;return context.api.patientGewaehlt(id);},
    prepare(id='A') {nodes.get('fbpPatient').value=id;nodes.get('fbpTermin').value='__ohne__';nodes.get('fbpDatum').value='2026-10-17';nodes.get('fbpNotiz').value=id+' ONLY';} };
}

test('Fußbefund: spätes A-Laden überschreibt B weder in Terminen noch Befunden',{timeout:1500},async()=>{
  const a=deferred();const f=fixture({read:async(table,id)=>{if(id==='A')await a.promise;return {data:[{id:table+'-'+id,lead_id:id,erstellt_am:'2026-01-01',start_time:'2026-10-17T10:00:00Z'}],error:null};}});
  const old=f.select('A');await f.select('B');a.resolve();await old;
  assert.equal(f.api.state().termine[0].id,'bookings-B');
  assert.equal(f.api.state().befundeDesPatienten[0].lead_id,'B');
});
test('Fußbefund: während Patientenladen und nach Lesefehler kein INSERT',{timeout:1500},async()=>{
  const pending=deferred();const f=fixture({read:()=>pending.promise});f.prepare();const loading=f.select('B');
  f.nodes.get('fbpTermin').value='__ohne__';const saving=f.api.speichern();await flush();const before=f.writes.length;
  pending.resolve({data:null,error:{message:'synthetic read error'}});await loading;
  await saving;assert.equal(before,0);
  await f.api.speichern();assert.equal(f.writes.length,0);
});
test('Fußbefund: Wechsel während Risiko-Refresh bricht alten Schreiblauf ab',{timeout:1500},async()=>{
  const wait=deferred();let reads=0;const f=fixture({risk:async id=>{if(id==='A'&&++reads>1)await wait.promise;return {row:{patient_id:id},fehler:false};}});
  await f.select('A');f.prepare();const save=f.api.speichern();await f.select('B');f.prepare('B');f.api.setEntry('entry-B');wait.resolve();await save;
  assert.equal(f.writes.length,0);assert.equal(f.nodes.get('fbpNotiz').value,'B ONLY');
});
test('Fußbefund: Änderungen während Risiko-Refresh ändern nicht ursprünglichen Schreibsnapshot',{timeout:1500},async()=>{
  const wait=deferred();let reads=0;const f=fixture({risk:async id=>{if(++reads>1)await wait.promise;return {row:{patient_id:id},fehler:false};}});
  await f.select('A');f.prepare();const save=f.api.speichern();f.nodes.get('fbpNotiz').value='changed after click';f.api.setEntry('other-entry');wait.resolve();await save;
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].notiz,'A ONLY');assert.equal(f.writes[0].eintrag_id,null);
});
test('Fußbefund: verspätete Speicherantwort verändert B nicht; Doppelaufruf schreibt einmal',{timeout:1500},async()=>{
  const wait=deferred();const f=fixture({insert:()=>wait.promise});await f.select('A');f.prepare();
  const saving=f.api.speichern();await flush();const second=f.api.speichern();await flush();const writes=f.writes.length;
  await f.select('B');f.prepare('B');
  wait.resolve({data:{id:'save-A',eintrag_id:'entry-A',serie_id:'series-A',version:1},error:null});await saving;await second;
  assert.equal(writes,1);
  assert.equal(f.nodes.get('fbpPatient').value,'B');assert.equal(f.nodes.get('fbpNotiz').value,'B ONLY');
});
test('Fußbefund: Neu verwirft ausstehendes Patientenladen',{timeout:1500},async()=>{
  const wait=deferred();const f=fixture({read:async(table,id)=>{await wait.promise;return {data:[{id:table+'-'+id}],error:null};}});
  const loading=f.select('A');f.api.neuerBefund();wait.resolve();await loading;
  assert.equal(f.api.state().termine.length,0);assert.equal(f.api.state().befundeDesPatienten.length,0);
});
