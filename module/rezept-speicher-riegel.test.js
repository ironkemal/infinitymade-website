import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beginRezeptSpeicherlauf } from './rezept-speicher-riegel.js';
import { zeigeBestaetigungsDialog } from './bestaetigungs-dialog.js';

// A minimal DOM contract keeps these race tests below the browser layer. No
// timers, network, global document changes or data shared between tests.
function mask() {
  const values={rzPatientId:'synthetic-patient',rzArztName:'Synthetic physician',
    rzLanr:'123456789',rzBsnr:'987654321',rzIcd:'E11.74',rzIcd2:'',rzDg:'DF',
    rzHm:'Hornhautabtragung',rzAnzahl:'6',rzAusstDate:'2026-10-07',
    rzTherapieBereich:'podo',rzPatKasseIk:'104212059'};
  const elements=new Map(Object.entries(values).map(([id,value])=>[id,
    {id,value,checked:false,tagName:'INPUT',type:'text',disabled:false,readOnly:false,dataset:{}}]));
  for(const id of ['rzDringend','rzUnterschrift','rzBarcodeBestaetigt']) elements.set(id,
    {id,value:'on',checked:id!=='rzDringend',tagName:'INPUT',type:'checkbox',disabled:false,readOnly:false,dataset:{}});
  const file={id:'synthetic-file',value:'',checked:false,tagName:'INPUT',type:'file',files:[],disabled:false,readOnly:false};
  elements.set(file.id,file);
  const button={id:'rzSaveBtn',tagName:'BUTTON',disabled:false,dataset:{}};elements.set(button.id,button);
  const otherButton={id:'synthetic-disabled-button',tagName:'BUTTON',disabled:true,readOnly:true};elements.set(otherButton.id,otherButton);
  const modal={hidden:false};const checkMark={className:'m13-chk checked'};
  const root={dataset:{rezeptart:'kassen'},inert:false,parentElement:modal,isConnected:true,
    closest:()=>modal,
    querySelectorAll(selector) {
      if(selector==='.m13-chk') return [checkMark];
      const names=selector.split(',').map(s=>s.trim().toUpperCase());
      return [...elements.values()].filter(el=>names.includes(el.tagName));
    },
  };
  elements.set('rzMaskeWrap',root);elements.set('rezeptModal',modal);
  return {root,modal,elements,file,button,otherButton,checkMark,
    document:{getElementById:id=>elements.get(id) ?? null}};
}

test('Save lock disables controls and restores original states, including disabled controls',()=>{
  const m=mask();m.elements.get('rzIcd').readOnly=true;
  const lock=beginRezeptSpeicherlauf(m.root);
  assert.equal(m.root.inert,true);
  assert.ok(m.root.querySelectorAll('input,select,textarea,button').every(el=>el.disabled));
  assert.doesNotThrow(()=>lock.pruefe());
  lock.freigeben();lock.freigeben();
  assert.equal(m.root.inert,false);assert.equal(m.button.disabled,false);
  assert.equal(m.otherButton.disabled,true);assert.equal(m.otherButton.readOnly,true);
  assert.equal(m.elements.get('rzIcd').readOnly,true);
  assert.throws(()=>lock.pruefe(),/Speicherns geändert/);
});

test('Save lock rejects value, checkbox, file, recipe type and class changes',()=>{
  const mutations=[
    m=>{m.elements.get('rzAnzahl').value='7';},
    m=>{m.elements.get('rzUnterschrift').checked=false;},
    m=>{m.file.files=[{name:'synthetic.pdf',size:100,lastModified:1}];},
    m=>{m.root.dataset.rezeptart='privat';},
    m=>{m.checkMark.className='m13-chk';},
  ];
  for(const mutate of mutations){const m=mask();const lock=beginRezeptSpeicherlauf(m.root);
    mutate(m);assert.throws(()=>lock.pruefe(),/Speicherns geändert/);lock.freigeben();}
});

test('Save lock rejects detached, moved and closed masks',()=>{
  for(const mutate of [m=>{m.root.isConnected=false;},m=>{m.root.parentElement={};},m=>{m.modal.hidden=true;}]) {
    const m=mask();const lock=beginRezeptSpeicherlauf(m.root);
    mutate(m);assert.throws(()=>lock.pruefe(),/Speicherns geändert/);lock.freigeben();
  }
});

function deferred() {let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}

function dashboardFixture({confirmed=true,delayWarnings=false,onDoctor,showConfirmation}={}) {
  const m=mask();m.elements.get('rzBarcodeBestaetigt').checked=confirmed;
  const counts={doctor:0,persist:0};const toasts=[],errors=[];
  const entered=deferred(),warnings=deferred();
  const bindings={document:m.document,getOwnerId:()=> 'synthetic-tenant',istPatientNeu:()=>false,
    pruefeAenderungErlaubt:()=>null,beginRezeptSpeicherlauf,
    pruefeBarcodeBestaetigung:()=>{
      if(!m.elements.get('rzBarcodeBestaetigt').checked) throw new Error('Bitte mit Papier vergleichen.');
      return {quelle:'barcode',bestaetigt:true};
    },
    showToast:(text,kind)=>toasts.push({text,kind}),
    resolveArzt:async()=>{counts.doctor++;onDoctor?.(m);return {arzt_id:'synthetic-doctor'};},
    toastArztErgebnis:()=>{},nurIcdKode:value=>value,
    behandlungsbeginnFrist:()=> '2026-12-01',bgHinweiseAusMaske:()=>[],maskeIstKasse:()=>true,
    podoArztHinweise:()=>({hinweise:[],satz:''}),kartenIkHinweise:()=>[],
    icdSpeicherHinweise:async()=>{entered.resolve();return delayWarnings?warnings.promise:[];},
    icdMehrAlsEinKodeJeFeld:()=>false,t:key=>key,showConfirmModal:showConfirmation || (async()=>true),
    supabase:{},lsCollect:()=>[],
    schreibeVerordnung:async()=>{counts.persist++;return {id:'synthetic-rx',aktualisiert:true};},
    fuehrtSitzungsbuch:()=>false,getSector:()=> 'podo',
    ladeLhbNachweisHoch:async()=>({ok:true}),currentSession:{user:{id:'synthetic-user'}},
    verordnungPatientenAbgleich:async()=>{},rzPatientCache:[],emit:()=>{},
    pruefeMaske:async()=>{},loadBkVerordnungen:()=>{},
    console:{error:(...args)=>errors.push(args),warn:()=>{}},
  };
  const source=readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
  const start=source.indexOf('async function saveRezept() {');
  const end=source.indexOf('\n}\n',start)+3;
  assert.ok(start>=0 && end>start,'Production saveRezept boundary missing');
  const save=new Function(...Object.keys(bindings),`${source.slice(start,end)}\nreturn saveRezept;`)(...Object.values(bindings));
  return {...m,save,counts,toasts,errors,entered,warnings};
}

test('Actual dashboard save rejects unconfirmed barcode before doctor and prescription writes',async()=>{
  const f=dashboardFixture({confirmed:false});await f.save();
  assert.deepEqual(f.counts,{doctor:0,persist:0});
  assert.ok(f.toasts.some(t=>/Papier/.test(t.text)));
  assert.equal(f.button.disabled,false);assert.equal(f.button.dataset.laeuft,undefined);
});

test('Actual dashboard save rejects mutation during async warnings even after renewed paper confirmation',async()=>{
  const f=dashboardFixture({delayWarnings:true});const running=f.save();
  await f.entered.promise;
  assert.equal(f.root.inert,true);assert.equal(f.elements.get('rzAnzahl').disabled,true);
  assert.equal(f.counts.doctor,0);
  f.elements.get('rzAnzahl').value='7';
  f.elements.get('rzBarcodeBestaetigt').checked=false;
  f.elements.get('rzBarcodeBestaetigt').checked=true;
  f.warnings.resolve([]);await running;
  assert.deepEqual(f.counts,{doctor:0,persist:0});
  assert.ok(f.toasts.some(t=>/Speicherns geändert/.test(t.text)));
  assert.equal(f.root.inert,false);assert.equal(f.elements.get('rzAnzahl').disabled,false);
  assert.equal(f.button.disabled,false);assert.equal(f.button.dataset.laeuft,undefined);
});

test('Actual dashboard save checks mask again after async doctor resolution',async()=>{
  const f=dashboardFixture({onDoctor:m=>{m.elements.get('rzAnzahl').value='7';}});await f.save();
  assert.deepEqual(f.counts,{doctor:1,persist:0});
  assert.ok(f.toasts.some(t=>/Speicherns geändert/.test(t.text)));
  assert.equal(f.root.inert,false);assert.equal(f.button.dataset.laeuft,undefined);
});

test('Actual dashboard unchanged save persists once and releases all controls',async()=>{
  const f=dashboardFixture();await f.save();
  assert.deepEqual(f.counts,{doctor:1,persist:1});assert.deepEqual(f.errors,[]);
  assert.equal(f.root.inert,false);assert.equal(f.button.disabled,false);
  assert.equal(f.otherButton.disabled,true);assert.equal(f.button.dataset.laeuft,undefined);
});

test('Actual dashboard warning closed through generic modal close releases mask without writes',async()=>{
  const opened=deferred();let observed=false,callback;
  const modal={hidden:true};
  const nodes=new Map(['confirmModalTitle','confirmModalText','confirmModalOk','confirmModalCancel']
    .map(id=>[id,{onclick:null,textContent:'',innerHTML:''}]));
  nodes.set('confirmModal',modal);const close={onclick:null};
  const deps={document:{getElementById:id=>nodes.get(id),querySelector:()=>close},
    MutationObserver:class {
      constructor(fn){callback=fn;}
      observe(){observed=true;opened.resolve();}
      disconnect(){observed=false;}
    },
    openModal:()=>{modal.hidden=false;},
    closeModal:()=>{modal.hidden=true;if(observed) queueMicrotask(()=>{if(observed) callback();});},
  };
  const f=dashboardFixture({showConfirmation:options=>zeigeBestaetigungsDialog(options,deps)});
  f.elements.get('rzHm').value='';
  const saving=f.save();await opened.promise;
  assert.equal(f.root.inert,true);assert.deepEqual(f.counts,{doctor:0,persist:0});
  deps.closeModal('confirmModal');await saving;
  assert.deepEqual(f.counts,{doctor:0,persist:0});assert.deepEqual(f.errors,[]);
  assert.equal(f.root.inert,false);assert.equal(f.button.disabled,false);
  assert.equal(f.button.dataset.laeuft,undefined);assert.equal(observed,false);
  assert.equal(nodes.get('confirmModalOk').onclick,null);assert.equal(close.onclick,null);
});
