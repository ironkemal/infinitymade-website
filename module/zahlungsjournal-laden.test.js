import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { erstelleZahlungsjournalLader } from './zahlungsjournal-laden.js';
function fixture() {
 const rows=[],requests=[],toasts=[];
 const body={set innerHTML(v){rows.length=0},appendChild(row){rows.push(row)},querySelectorAll(){return []}};
 const dom={beleglisteBody:body,beleglisteEmpty:{hidden:true},blFilterFrom:{value:''},blFilterTo:{value:''},blFilterType:{value:'all'},blFilterZahlart:{value:'all'}};
 const load=erstelleZahlungsjournalLader({document:{getElementById:id=>dom[id],createElement:()=>({style:{}})},supabase:{auth:{getSession:async()=>({data:{session:{access_token:'QA'}}})}},API:'/api',location:{origin:'https://qa.invalid'},fetch:url=>new Promise((resolve,reject)=>requests.push({url,resolve,reject})),escapeHtml:String,zahlartLabel:String,fmtEur:String,getUserId:()=> 'QA',showToast:(...args)=>toasts.push(args),triggerStorno(){}});
 return {load,rows,requests,toasts,dom};
}
const tick=()=>new Promise(setImmediate);
const row=(type,nr)=>({type,beleg_nr:nr,amount_eur:10,created_at:'2026-10-15T10:00:00Z'});
const response=rows=>({ok:true,json:async()=>rows});
test('Latest filter owns table when old response arrives last',async()=>{
 const f=fixture();const old=f.load();await tick();f.dom.blFilterType.value='zuzahlung';const current=f.load();await tick();
 assert.equal(f.requests[1].url.searchParams.get('type'),'zuzahlung');
 f.requests[1].resolve(response([row('zuzahlung',2)]));await current;
 f.requests[0].resolve(response([row('ausfall',1)]));await old;
 assert.equal(f.rows.length,1);assert.ok(f.rows[0].innerHTML.includes('Zuzahlung'));assert.ok(!f.rows[0].innerHTML.includes('Ausfall'));
});
test('Stale empty response cannot hide current table',async()=>{
 const f=fixture();const old=f.load();await tick();const current=f.load();await tick();f.requests[1].resolve(response([row('zuzahlung',2)]));await current;f.requests[0].resolve(response([]));await old;assert.equal(f.dom.beleglisteEmpty.hidden,true);assert.equal(f.rows.length,1);
});
test('Stale errors ignored; current network error reported',async()=>{
 const f=fixture();const old=f.load();await tick();const current=f.load();await tick();f.requests[0].reject(Error('old'));await old;assert.equal(f.toasts.length,0);f.requests[1].reject(Error('current'));await current;assert.equal(f.toasts.length,1);assert.match(f.toasts[0][0],/current/);
});
test('Current empty result shows empty state',async()=>{const f=fixture();const current=f.load();await tick();f.requests[0].resolve(response([]));await current;assert.equal(f.rows.length,0);assert.equal(f.dom.beleglisteEmpty.hidden,false)});


test('Journal Storno binds original ledger ID through button and dashboard POST', async () => {
  let click;
  let sent;
  const button = { dataset: { id: 'QA-original', nr: '7', val: '30', ref: 'QA', rx: '', pat: '' }, addEventListener(event, fn) { if (event === 'click') click = fn; } };
  const rendered = [];
  const body = { innerHTML: '', appendChild(row) { rendered.push(row); }, querySelectorAll() { return [button]; } };
  const dom = { beleglisteBody: body, beleglisteEmpty: { hidden: true } };
  const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: 'QA' } } }) } };
  const source = fs.readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
  const context = vm.createContext({ supabase, API: '/api', showInputModal: async () => 'Test', showToast() {}, loadBelegliste() {}, fetch: async (url, options) => { sent = JSON.parse(options.body); return { ok: true }; } });
  vm.runInContext(source.slice(source.indexOf('async function triggerStorno('), source.indexOf('// Wire filters & actions once DOM is ready / loaded')), context);
  const load = erstelleZahlungsjournalLader({ document: { getElementById: id => dom[id], createElement: () => ({ style: {} }) }, supabase, API: '/api', location: { origin: 'https://qa.invalid' }, fetch: async () => response([{ id: 'QA-original', ...row('zuzahlung', 7), amount_eur: 30 }]), escapeHtml: String, zahlartLabel: String, fmtEur: String, getUserId: () => 'QA', showToast() {}, triggerStorno: (...args) => context.triggerStorno(...args) });
  await load();
  assert.match(rendered[0].innerHTML, /data-id="QA-original"/);
  await click();
  assert.equal(sent.original_id, 'QA-original');
  assert.equal(sent.type, 'storno');
  assert.equal(sent.amount_eur, -30);
});

test('Bereits stornierter Originalbeleg bekommt keinen Storno-Knopf', async () => {
  const f = fixture();
  const current = f.load();
  await tick();
  f.requests[0].resolve(response([
    { ...row('zuzahlung', 1), id: 'a', bereits_storniert: true },
    { ...row('zuzahlung', 2), id: 'b', bereits_storniert: false },
    { ...row('storno', 3), id: 'c' },
  ]));
  await current;
  assert.ok(!f.rows[0].innerHTML.includes('bl-storno-btn'));
  assert.ok(f.rows[1].innerHTML.includes('bl-storno-btn'));
  assert.ok(!f.rows[2].innerHTML.includes('bl-storno-btn'));
});

test('P2-6: erstes Öffnen setzt laufenden Berlin-Monat; Nutzerfilter bleiben erhalten',async()=>{
  const f=fixture(); const loading=f.load();await tick();
  const heute=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin'}).format(new Date());
  assert.equal(f.dom.blFilterFrom.value,heute.slice(0,7)+'-01');
  assert.ok(f.dom.blFilterTo.value.startsWith(heute.slice(0,7)));
  f.requests[0].resolve(response([]));await loading;
  f.dom.blFilterFrom.value='2026-01-01';const next=f.load();await tick();
  assert.equal(f.requests[1].url.searchParams.get('from'),'2026-01-01');f.requests[1].resolve(response([]));await next;
});
test('P2-6: CSV öffnet Export mit Zeitraum und sichtbarer Rückmeldung',async()=>{
  const source=fs.readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
  const fn=source.slice(source.indexOf('function initBeleglisteUI()'),source.indexOf('// Mahnwesen (Dunning) UI'));
  let click,url;const toasts=[];
  const dom={blExportCsvBtn:{addEventListener:(name,fn)=>{click=fn;}},blFilterFrom:{value:'2026-11-01',addEventListener(){}},blFilterTo:{value:'2026-11-30',addEventListener(){}}};
  const c=vm.createContext({document:{getElementById:id=>dom[id]||null},loadBelegliste(){},supabase:{auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})}},API:'/api',location:{origin:'https://qa.invalid'},URL,window:{open:u=>{url=u;return {}; }},showToast:(...a)=>toasts.push(a)});
  vm.runInContext(fn+'\ninitBeleglisteUI()',c);await click();
  assert.equal(new URL(url).searchParams.get('from'),'2026-11-01');assert.ok(toasts.some(t=>/CSV-Export/.test(t[0])));
});
