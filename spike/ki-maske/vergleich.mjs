import { messe } from './messen.mjs';
import { messeAdapter, maskiere } from './maske-v2.mjs';
import { maskPII } from '../../api-backend/ai/pii-mask.js';
import { readFileSync } from 'node:fs';
const log = console.log; 
for (const k of ['korpus.json','korpus2.json']) {
  for (const [n,f] of [['v1',maskPII],['v2',messeAdapter]]) {
    console.log = ()=>{}; const r = messe(f,{corpusPath:'./'+k, quiet:true}); console.log = log;
    log(k, n, JSON.stringify(r?.gesamt ?? r?.summary ?? Object.keys(r||{})));
  }
}
// Falschalarme + Überschwärzung
const K2 = JSON.parse(readFileSync('./korpus2.json','utf8'));
let block=0, neg=0;
for (const c of K2) {
  const r = maskiere(c.text,{entities:c.entities, mandantNamen:c.entities.filter(e=>e.type==='NAME').map(e=>e.value)});
  if (!c.pii_truth.length) { neg++; log('\nNEG', c.id, '\n  in :', c.text, '\n  out:', r.masked, '\n  befunde:', JSON.stringify(r.befunde)); }
  if (r.befunde.length) block++;
}
log('\nblockiert (befunde>0):', block, '/', K2.length, ' negativfaelle:', neg);
