import { pipeline } from '@huggingface/transformers';
import { readFileSync } from 'node:fs';
import { maskiere } from './maske-v2.mjs';
import { checkLeak } from './messen.mjs';
const MODEL = process.argv[2] || 'Xenova/bert-base-multilingual-cased-ner-hrl';
const t0=Date.now();
const ner = await pipeline('token-classification', MODEL, { dtype: 'q8' });
console.log('load ms', Date.now()-t0, 'rss MB', Math.round(process.memoryUsage().rss/1e6));
async function personen(text){
  const out = await ner(text, { aggregation_strategy: 'simple', ignore_labels: ['O'] });
  // merge subword tokens manually
  const ents=[]; let cur=null;
  for (const o of out) {
    const lab=(o.entity_group||o.entity||'').replace(/^[BI]-/,'');
    const w=o.word;
    if (!['PER','ORG','LOC'].includes(lab)) { cur=null; continue; }
    if (w.startsWith('##') && cur) { cur.w+=w.slice(2); continue; }
    if (cur && cur.lab===lab && (o.entity||'').startsWith('I-')) { cur.w+=' '+w; continue; }
    cur={lab,w}; ents.push(cur);
  }
  return ents.filter(e=>e.w.length>=3);
}
for (const f of ['./korpus.json','./korpus2.json']) {
  const K=JSON.parse(readFileSync(f,'utf8')); let tot=0,sent=0,fp=0,ms=0; const rest=[];
  for (const c of K){
    let r = maskiere(c.text,{entities:c.entities,mandantNamen:c.entities.filter(e=>e.type==='NAME').map(e=>e.value)});
    const t=Date.now(); const ents=await personen(r.masked); ms+=Date.now()-t;
    let m=r.masked; for (const e of ents) if(!/⟦/.test(e.w)) m=m.split(e.w).join('⟦NER_'+e.lab+'⟧');
    if (!c.pii_truth.length && m!==r.masked) { fp++; console.log('FP',c.id,ents.map(e=>e.lab+':'+e.w).join(', ')); }
    const blocked=r.befunde.length>0;
    for (const p of c.pii_truth){ tot++; const l=checkLeak(p,m); if(l&&l.isLeak&&!blocked){sent++; rest.push(c.id+' '+p.type+' "'+p.value+'"');} }
  }
  console.log(f,{tot,sent,pct:(100*sent/tot).toFixed(1)+'%',fpNegativ:fp,msProFall:Math.round(ms/K.length)}); console.log(rest.join('\n'));
}
