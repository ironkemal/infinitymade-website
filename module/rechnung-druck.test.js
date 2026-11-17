import test from 'node:test';
import assert from 'node:assert/strict';
import { fuelleBelegPositionen } from './rechnung-druck.js';
for (const [name,inv,preise] of [
  ['Altbeleg ohne Rezept',{ invoice_type:null,kassenzuzahlung:10,total_patient:12.96 },true],
  ['Privat mit Altwert',{invoice_type:'privat',prescription_id:'rx',kassenzuzahlung:10},true],
  ['GKV mit Rezept',{invoice_type:'gkv',prescription_id:'rx',kassenzuzahlung:10},false],
]) test(`P2-1d ${name}: Preise ${preise}`,()=>{
  const nodes=new Map(); global.document={getElementById:id=>{if(!nodes.has(id)) nodes.set(id,{style:{},textContent:'',innerHTML:''});return nodes.get(id);}};
  const r=fuelleBelegPositionen({...inv,line_items:[{title:'Testleistung',quantity:2,unit_price:14.8}]},{formatEur:n=>String(n),escapeHtml:s=>s,aggregateInvLines:x=>x});
  assert.equal(r,preise);assert.equal(nodes.get('invvThEinzel').style.display,preise?'':'none');
  assert.equal(nodes.get('invvTotal').textContent,String(inv.total_patient||0));
});
