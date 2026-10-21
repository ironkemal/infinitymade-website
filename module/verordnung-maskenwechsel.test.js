import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('Alte maskeEinbetten-Fortsetzung überschreibt neuere Bearbeitung nicht',async()=>{
  const source=fs.readFileSync(new URL('./verordnung-maske.js',import.meta.url),'utf8');
  const start=source.indexOf('export async function maskeEinbetten(');
  const end=source.indexOf('\n/**',source.indexOf('  return true;\n}',start));
  const code=source.slice(start,end).replace('export ','');
  let resolveA;const a=new Promise(r=>{resolveA=r;});const filled=[];
  const wrap={parentElement:null,dataset:{},addEventListener(){}};
  const c=vm.createContext({console,document:{getElementById:id=>id==='rzMaskeWrap'?wrap:null},
    _bruecke:{fuellePatient:id=>id==='A'?a:Promise.resolve(true)},_bearbeitung:null,
    entferneBarcodeBestaetigung(){},erbrachteEinheiten:()=>0,schreibRiegel:()=>null,
    verdrahteLeiste(){},hinweisSetzen(){},setzeSperre(){},podoMaskeNachziehen(){},
    ladeOffeneRechnung:async()=>false,fuelleMuster13:rx=>filled.push(rx.id)});
  vm.runInContext(code,c);
  const host={appendChild(el){el.parentElement=this;}};
  const old=c.maskeEinbetten({host,rx:{id:'rx-A',patient_id:'A'}});
  assert.equal(await c.maskeEinbetten({host,rx:{id:'rx-B',patient_id:'B'}}),true);
  resolveA(true);assert.equal(await old,false);assert.deepEqual(filled,['rx-B']);
});

test('Patientenkopf-Speichersperre wird auch vom tatsächlichen Dashboard-Speicherhandler respektiert',async()=>{
  const source=fs.readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
  const start=source.indexOf('async function saveRezept() {'),end=source.indexOf('\n}\n',start)+3;
  const nodes=new Map([['rzPatientId',{value:'A'}],['rzSaveBtn',{dataset:{patientLoading:'1'},disabled:true}]]);
  const c=vm.createContext({document:{getElementById:id=>nodes.get(id)},getOwnerId:()=>'owner',istPatientNeu:()=>false,
    pruefeAenderungErlaubt:()=>null,showToast(){}});
  vm.runInContext(source.slice(start,end),c);
  await c.saveRezept();assert.equal(nodes.get('rzSaveBtn').dataset.laeuft,undefined);
});
