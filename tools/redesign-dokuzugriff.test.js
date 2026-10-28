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

function formularFixture({phase='formular',wechsel='scope',fb='physio',erlaubt=true}={}) {
  let scope='OWNER:BIZ', allowed=erlaubt, resolve;
  const pending=new Promise(r=>{resolve=r;});
  const elemente=new Map(); const el=id=>{
    if(!elemente.has(id))elemente.set(id,{style:{},value:'',disabled:true,hidden:true,textContent:'',innerHTML:''});
    return elemente.get(id);
  };
  const reads=[];
  const c=vm.createContext({d:{getScopeKey:()=>scope,darfAnamnese:()=>allowed,
    getOwnerId:()=> 'OWNER',getAerzte:()=>[],loadAerzte:()=>phase==='arzt'?pending:Promise.resolve(),showToast(){}},
    $:el,ladeNr:0,geladeneNr:null,aktuelleRow:null,aktuellerPatient:null,vorschlaege:{},
    alsISODatum:()=> 'RESET',fachbereich:()=>fb,zeichneFormular(){},leerePhysio(){},aktualisiereKopf(){},
    ladeRxKontext:async()=>{},
    ladeAktuelle:async()=>{reads.push('formular');return phase==='formular'?pending:{row:null,fehler:null};},
    ladeAltrisiken:async()=>{reads.push('risiken');return pending;},verordnenderArzt:async()=>null,
    fuellePhysio(){},formular:()=>({}),rohAusRow:()=>({}),schreibeForm(){},liesForm:()=>({}),
    aktualisiereSichtbarkeit(){},istKiosk:()=>false,zeigeVorschlaege(){},vorschlaegeAusRisiken:()=>({synthetisch:true})});
  vm.runInContext(anam.slice(anam.indexOf('function resetForm()'),anam.indexOf('\nfunction fuellePhysio(')),c);
  vm.runInContext(anam.slice(anam.indexOf('async function fuelleFormular('),anam.indexOf('\nasync function speichere(')),c);
  return {c,el,reads,resolve,wechsel(){if(wechsel==='scope')scope='ANDERER_SCOPE';else allowed=false;}};
}
for(const phase of ['arzt','formular','vorschlag'])for(const wechsel of ['scope','recht']) {
  test(`Anamnese-Formular: ${wechsel} während ${phase} verwirft Folgeantwort`,async()=>{
    const f=formularFixture({phase,wechsel,fb:phase==='vorschlag'?'podo':'physio'});
    const run=f.c.fuelleFormular('A');
    for(let i=0;i<8;i++)await Promise.resolve();
    f.wechsel();f.resolve(phase==='formular'?{row:{aufnahmedatum:'SYNTHETISCH'},fehler:null}:{risiken:{}});
    await run;
    assert.equal(f.c.geladeneNr,null);
    assert.equal(f.c.aktuellerPatient,null);
    assert.equal(f.el('anamSaveBtn').disabled,true);
    assert.equal(f.el('anamAufnahme').value,'RESET');
    if(phase==='arzt')assert.deepEqual(f.reads,[]);
  });
}
test('Anamnese-Formular ohne Recht startet keine Folgeabfrage',async()=>{
  const f=formularFixture({erlaubt:false});const run=f.c.fuelleFormular('A');
  f.resolve({row:null,fehler:null});await run;assert.deepEqual(f.reads,[]);
});
for(const fb of ['physio','podo'])test(`Anamnese-Formular normaler ${fb}-Pfad bleibt bedienbar`,async()=>{
  const f=formularFixture({fb});const run=f.c.fuelleFormular('A');
  f.resolve({row:{aufnahmedatum:'SYNTHETISCH'},fehler:null});await run;
  assert.equal(f.c.aktuellerPatient,'A');assert.equal(f.c.geladeneNr,f.c.ladeNr);
  assert.equal(f.el('anamSaveBtn').disabled,false);
});
for(const wechsel of ['scope','recht','kein-wechsel','vorher-verweigert']) {
  test(`Anamnese-Verordnungskontext: ${wechsel}`,async()=>{
    let scope='OWNER:BIZ',allowed=wechsel!=='vorher-verweigert',resolve,reads=0;
    const response=new Promise(r=>{resolve=r;});
    const elemente=new Map();const el=id=>{
      if(!elemente.has(id))elemente.set(id,{style:{display:'none'},innerHTML:'',textContent:''});
      return elemente.get(id);
    };
    const q={select(){return q;},eq(){return q;},in(){return q;},order(){return q;},limit(){return q;},maybeSingle(){return response;}};
    const c=vm.createContext({d:{getScopeKey:()=>scope,darfAnamnese:()=>allowed,
      isPraxisSector:()=>true,getSector:()=> 'physiotherapie',supabase:{from(){reads++;return q;}}},
      $:el,ladeNr:1,esc:String,datumDe:String});
    vm.runInContext(anam.slice(anam.indexOf('async function ladeRxKontext('),anam.indexOf('/** Hausarzt-Vorbelegung:')),c);
    const run=c.ladeRxKontext('A',1,scope);
    if(wechsel==='scope')scope='ANDERER_SCOPE';if(wechsel==='recht')allowed=false;
    resolve({data:{rezept_typ:'standard',status:'confirmed',heilmittel:'SYNTHETISCH',prescription_sessions:[]}});
    await run;
    if(wechsel==='kein-wechsel'){assert.equal(reads,1);assert.equal(el('anamRxContext').style.display,'');}
    else {assert.equal(el('anamRxContext').style.display,'none');assert.equal(el('anamRxHeading').textContent,'');}
    if(wechsel==='vorher-verweigert')assert.equal(reads,0);
  });
}
