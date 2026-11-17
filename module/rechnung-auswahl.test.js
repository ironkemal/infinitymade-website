import test from 'node:test';
import assert from 'node:assert/strict';
import { mountLeistungsart } from './rechnung-steuer.js';
test('P2-2a: offene Leistungsart wählt nichts und verändert keine Steuerwerte',()=>{
  const radios=[{value:'medizinisch',checked:true},{value:'kosmetisch',checked:true}];
  const wrap={hidden:false,dataset:{},querySelectorAll:()=>radios};const hint={textContent:''};
  global.document={getElementById:id=>id==='invLeistungsartWrap'?wrap:hint};
  let updates=0; mountLeistungsart({profile:{steuer_status:'regel'},vorschlag:'offen',getLines:()=>[],onChange:()=>updates++});
  assert.ok(radios.every(r=>!r.checked));assert.equal(updates,0);assert.match(hint.textContent,/wählen/);
  radios[1].checked=true;radios[1].onchange();assert.equal(updates,1);
});
