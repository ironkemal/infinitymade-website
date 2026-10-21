import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { wartelisteZeitfensterGueltig as valid } from './warteliste-zeitfenster.js';
test('Optional bounds and proper ranges accepted', () => { for(const args of [[null,null],['',''],['08:00',null],[null,'18:00'],['08:00','18:00'],['08:00:01','08:00:02']]) assert.equal(valid(...args),true); });
test('Reverse, equal and malformed bounds rejected', () => { for(const args of [['18:00','10:00'],['10:00','10:00'],['24:00',null],['8:00','18:00'],['12:60','18:00'],['08:00:60','18:00'],[42,null],[' 08:00','18:00']]) assert.equal(valid(...args),false); });
const source = readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
function decl(name) { const start = source.indexOf('async function '+name+'('); return source.slice(start,source.indexOf('\n}\n',start)+2); }
test('Actual Warteliste picker clears hidden id on typing, keeps explicit selection',async()=> {
 const input={dataset:{},addEventListener(type,fn){this[type]=fn;}}, hidden={value:'A'};
 let cfg; const doc={getElementById:id=>id==='wlPatientSearch'?input:id==='wlPatientId'?hidden:{}};
 const q={select(){return this;},eq(){return this;},order(){return Promise.resolve({data:[]});}};
 const context=vm.createContext({document:doc,getOwnerId:()=> 'owner',supabase:{from:()=>q},bizScope:q=>q,attachPatientSearch:(el,c)=>{cfg=c;},patientMatchesQuery(){},displayNameWithBirth(){}});
 vm.runInContext(decl('initWlPatientAutocomplete')+'\nglobalThis.init = initWlPatientAutocomplete;',context);
 await context.init(); input.input(); assert.equal(hidden.value,''); cfg.onSelect({id:'B'}); assert.equal(hidden.value,'B');
});
test('Actual Warteliste save rejects invalid range before insert and update',async()=>{
 const start=source.indexOf('function initWlModal()'); const fn=source.slice(start,source.indexOf('\n}\n',start)+2);
 for(const entryId of ['', 'entry']) {
 let save,writes=0; const dom={wlAddBtn:{addEventListener(){}},wlDeleteBtn:{addEventListener(){}},wlSaveBtn:{addEventListener:(type,f)=>{save=f;}},wlEntryId:{value:entryId},wlPatientId:{value:'A'},wlService:{value:''},wlTimeFrom:{value:'18:00'},wlTimeTo:{value:'10:00'},wlPriority:{value:'1'},wlNotes:{value:''}};
 const context=vm.createContext({document:{getElementById:id=>dom[id],querySelectorAll:()=>[]},openNewWlEntry(){},getOwnerId:()=> 'owner',showToast(){},wartelisteZeitfensterGueltig:valid,supabase:{from(){writes++;throw Error('Unexpected write');}}});
 vm.runInContext(fn+'\ninitWlModal();',context); await save(); assert.equal(writes,0);
 }
});

test('Editing first initializes actual patient picker and services before showing existing row', async () => {
  const dom = Object.fromEntries(['wlModal', 'wlEntryId', 'wlModalTitle', 'wlDeleteBtn', 'wlPatientSearch', 'wlPatientList', 'wlPatientId', 'wlPatientWrap', 'wlService', 'wlTimeFrom', 'wlTimeTo', 'wlPriority', 'wlNotes'].map(id => [id, {
    value: '', hidden: true, dataset: {}, addEventListener(type, fn) { this[type] = fn; },
  }]));
  let picker, servicesLoaded = 0;
  const row = { lead_id: 'A', leads: { first_name: 'Test', last_name: 'Patient' }, service_id: 'service-A' };
  const query = { select() { return this; }, eq() { return this; }, order() { return Promise.resolve({ data: [{ id: 'A' }] }); }, single() { return Promise.resolve({ data: row }); } };
  const context = vm.createContext({
    window: {}, document: { getElementById: id => dom[id], querySelectorAll: () => [] },
    getOwnerId: () => 'owner', supabase: { from: () => query }, bizScope: q => q,
    attachPatientSearch: (input, config) => { picker = config; }, patientMatchesQuery() {}, displayNameWithBirth() {},
    populateWlServices: async () => { servicesLoaded++; }, showToast() {},
  });
  const start = source.indexOf('window.openWlEntry = async function(id)');
  const handler = source.slice(start, source.indexOf('\n};', start) + 3);
  vm.runInContext(decl('initWlPatientAutocomplete') + '\n' + handler, context);
  await context.window.openWlEntry('entry-A');
  assert.equal(servicesLoaded, 1);
  assert.equal(dom.wlModal.hidden, false);
  assert.equal(dom.wlPatientId.value, 'A');
  assert.equal(dom.wlService.value, 'service-A');
  dom.wlPatientSearch.input();
  assert.equal(dom.wlPatientId.value, '');
  picker.onSelect({ id: 'B' });
  assert.equal(dom.wlPatientId.value, 'B');
});

test('Patient load failure still clears hidden patient id immediately on typing', async () => {
  const input = { dataset: {}, addEventListener(type, fn) { this[type] = fn; } }, hidden = { value: 'A' };
  let rejectRead, toasts = 0;
  const pending = new Promise((resolve, reject) => { rejectRead = reject; });
  const query = { select() { return this; }, eq() { return this; }, order() { return pending; } };
  const context = vm.createContext({
    document: { getElementById: id => id === 'wlPatientSearch' ? input : id === 'wlPatientId' ? hidden : {} },
    getOwnerId: () => 'owner', supabase: { from: () => query }, bizScope: q => q,
    showToast: () => { toasts++; },
  });
  vm.runInContext(decl('initWlPatientAutocomplete') + '\nglobalThis.init = initWlPatientAutocomplete;', context);
  const loading = context.init();
  input.input();
  assert.equal(hidden.value, '');
  rejectRead(new Error('synthetic load failure'));
  await loading;
  hidden.value = 'B'; input.input();
  assert.equal(hidden.value, '');
  assert.equal(toasts, 1);
});
