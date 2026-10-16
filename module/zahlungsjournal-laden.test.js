import test from 'node:test';
import assert from 'node:assert/strict';
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
 assert.equal(f.rows.length,1);assert.ok(f.rows[0].innerHTML.includes('zuzahlung'));assert.ok(!f.rows[0].innerHTML.includes('ausfall'));
});
test('Stale empty response cannot hide current table',async()=>{
 const f=fixture();const old=f.load();await tick();const current=f.load();await tick();f.requests[1].resolve(response([row('zuzahlung',2)]));await current;f.requests[0].resolve(response([]));await old;assert.equal(f.dom.beleglisteEmpty.hidden,true);assert.equal(f.rows.length,1);
});
test('Stale errors ignored; current network error reported',async()=>{
 const f=fixture();const old=f.load();await tick();const current=f.load();await tick();f.requests[0].reject(Error('old'));await old;assert.equal(f.toasts.length,0);f.requests[1].reject(Error('current'));await current;assert.equal(f.toasts.length,1);assert.match(f.toasts[0][0],/current/);
});
test('Current empty result shows empty state',async()=>{const f=fixture();const current=f.load();await tick();f.requests[0].resolve(response([]));await current;assert.equal(f.rows.length,0);assert.equal(f.dom.beleglisteEmpty.hidden,false)});
