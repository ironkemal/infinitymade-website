import { maskiere } from './maske-v2.mjs';
import { checkLeak } from './messen.mjs';
import { readFileSync } from 'node:fs';
for (const f of ['korpus.json','korpus2.json']) {
const K = JSON.parse(readFileSync(f,'utf8'));
let tot=0, leakSent=0, leakBlocked=0; const byType={}; const sent=[];
for (const c of K) {
  const r = maskiere(c.text,{entities:c.entities, mandantNamen:c.entities.filter(e=>e.type==='NAME').map(e=>e.value)});
  const blocked = r.befunde.length>0;
  for (const t of c.pii_truth) { tot++; const l = checkLeak(t, r.masked); const leaked = !!(l && l.isLeak);
    if (leaked) { if (blocked) leakBlocked++; else { leakSent++; byType[t.type]=(byType[t.type]||0)+1; sent.push(`${c.id} ${t.type} "${t.value}"`);} } }
}
console.log(f, {tot, leakBlocked, leakSent, pct:(100*leakSent/tot).toFixed(1)+'%', byType}); if (f==='korpus2.json') console.log(sent.join('\n'));
}
