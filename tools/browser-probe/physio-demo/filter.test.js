import test from 'node:test';
import assert from 'node:assert/strict';
import {oderPraedikat} from './filter.mjs';

const vergleiche=(r,k,op,v)=>{
  const got=r[k];
  if(op==='eq')return String(got)===String(v);
  if(op==='neq')return got!==v;
  if(op==='is')return v===null?got==null:got===v;
  if(op==='in')return v.map(String).includes(String(got));
  if(op==='ilike')return new RegExp('^'+String(v).replaceAll('%','.*')+'$','i').test(String(got??''));
  throw new Error('Unerwarteter Operator '+op);
};
const passt=(ausdruck,zeile)=>oderPraedikat(ausdruck,vergleiche)(zeile);

test('Patiententermine: fremder Termin fällt raus, Alttermin ohne lead_id nur über Telefon',()=>{
  const a='lead_id.eq.1,and(lead_id.is.null,customer_phone.eq."+49 1,5")';
  assert.equal(passt(a,{lead_id:1}),true);
  assert.equal(passt(a,{lead_id:2,customer_phone:'+49 1,5'}),false);
  assert.equal(passt(a,{lead_id:null,customer_phone:'+49 1,5'}),true);
  assert.equal(passt(a,{lead_id:null,customer_phone:'+49 2'}),false);
});

test('Standort und NULL-Bereich wie in den Lesewegen',()=>{
  assert.equal(passt('business_id.eq.a,business_id.is.null',{business_id:null}),true);
  assert.equal(passt('business_id.eq.a,business_id.is.null',{business_id:'b'}),false);
  assert.equal(passt('therapie_bereich.is.null,therapie_bereich.neq.podo',{therapie_bereich:'physio'}),true);
  assert.equal(passt('therapie_bereich.is.null,therapie_bereich.neq.podo',{therapie_bereich:'podo'}),false);
});

test('in-Liste, Negation, verschachteltes not.and, ilike mit Sternchen',()=>{
  assert.equal(passt('id.in.(1,2),name.eq.x',{id:2}),true);
  assert.equal(passt('id.not.in.(1,2)',{id:2}),false);
  assert.equal(passt('not.and(a.eq.1,b.eq.2)',{a:1,b:2}),false);
  assert.equal(passt('not.and(a.eq.1,b.eq.2)',{a:1,b:3}),true);
  assert.equal(passt('name.ilike.*mus*',{name:'Ben Muster'}),true);
});

test('Unbekannte Syntax bleibt erkennbar statt still alles zu treffen',()=>{
  for(const a of ['','kein_filter','a.cs.{1}','and(a.eq.1','a.in.1,2','a.eq."offen'])assert.equal(oderPraedikat(a,vergleiche),null,a);
});
