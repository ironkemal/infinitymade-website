import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const dashboard=readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
const anam=readFileSync(new URL('../module/anamnese.js',import.meta.url),'utf8');
test('echter Panelname notizen nutzt bestehendes notes-Recht',()=>{
  const source=dashboard.slice(dashboard.indexOf('const SIDEBAR_TO_MODULE ='),dashboard.indexOf('\nasync function renderSidebar'));
  const c=vm.createContext({}); vm.runInContext(source+';globalThis.map=SIDEBAR_TO_MODULE;',c);
  assert.equal(c.map.notizen,'notes');
});
function fixture({allowed=true,data=[{id:'A'}],error=null,response}={}) {
  const calls=[], selected=[]; const sel={innerHTML:'ALT',value:''}; let scoped=0;
  let key='OWNER:BIZ';
  const q={select(){return q;},eq(){return q;},order(){return q;},then(ok){return Promise.resolve(response||{data,error}).then(ok);}};
  const c=vm.createContext({ d:{supabase:{from(t){calls.push(t);return q;}},getOwnerId:()=> 'OWNER',getScopeKey:()=> key,
    darfAnamnese:()=>allowed,bizScope(query,cat){assert.equal(cat,'patients');scoped++;return query;},displayNameWithBirth:()=> 'Synthetisch',showToast(){}},
    $:()=>sel,esc:String,vorwahl:'A',ladeNr:0,geladeneNr:null,
    zeichneFormular(){},resetForm:()=>{c.ladeNr++;},fuelleFormular:async id=>selected.push(id) });
  const start=anam.indexOf('export async function loadAnamnese()'),end=anam.indexOf('// ── Physio:',start);
  vm.runInContext(anam.slice(start,end).replace('export ',''),c);
  return {c,calls,selected,sel,setScope(v){key=v;},setAllowed(v){allowed=v;},get scoped(){return scoped;}};
}
test('Anamnese-Liste verwendet vorhandenen Patienten-Standortfilter',async()=>{
  const f=fixture();await f.c.loadAnamnese();assert.equal(f.scoped,1);assert.deepEqual(f.selected,['A']);
});
test('Anamnese-Vorwahl außerhalb geladener Liste erzeugt keinen Formularread',async()=>{
  const f=fixture({data:[{id:'B'}]});await f.c.loadAnamnese();assert.deepEqual(f.selected,[]);
});
test('Anamnese ohne Modulrecht erzeugt keinen Patientenread',async()=>{
  const f=fixture({allowed:false});await f.c.loadAnamnese();assert.deepEqual(f.calls,[]);assert.deepEqual(f.selected,[]);
});
test('Anamnese-Quellenfehler erzeugt keinen Vorwahl-Read',async()=>{
  const f=fixture({data:null,error:{message:'synthetic'}});await f.c.loadAnamnese();assert.deepEqual(f.selected,[]);
});
for(const wechsel of ['scope','recht']) test(`Anamnese: ${wechsel} während Patientenread verwirft Antwort`,async()=>{
  let resolve;const response=new Promise(r=>{resolve=r;});const f=fixture({response});
  const run=f.c.loadAnamnese();if(wechsel==='scope')f.setScope('ANDERER_OWNER:ANDERER_STANDORT');else f.setAllowed(false);
  resolve({data:[{id:'A'}]});await run;assert.deepEqual(f.selected,[]);assert.doesNotMatch(f.sel.innerHTML,/Synthetisch/);
});
