import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCorpus,maskNERSpans,nerInput} from './benchmark.mjs';
const tokens=(items)=>items.map(([word,entity],i)=>({word,entity,score:.9,index:i+1}));
const one=(text,truth=[])=>[{id:'owned-unit',text,entities:[],pii_truth:truth}];
const identity=text=>({masked:text,unmask:s=>s,befunde:[{old:true}]});

test('NER masks only labeled repeated occurrence and composes subwords',()=>{
  const text='Anna Anna Müller kommt.';
  const r=maskNERSpans(text,tokens([['Anna','B-PER'],['Anna','O'],['Mü','B-PER'],['##ller','I-PER'],['kommt','O'],['.','O']]));
  assert.equal(r.masked,'⟦NER_PER_1⟧ Anna ⟦NER_PER_2⟧ kommt.');
  assert.equal(r.unmask(r.masked),text);
});
test('Unicode and protected placeholders keep exact positions',()=>{
  const text='⟦NAME_abc_1⟧ Éva Li';
  assert.equal(nerInput(text).length,text.length);
  const r=maskNERSpans(text,tokens([['Éva','B-PER'],['Li','B-PER']]));
  assert.equal(r.masked,'⟦NAME_abc_1⟧ ⟦NER_PER_1⟧ ⟦NER_PER_2⟧');
  assert.equal(r.unmask(r.masked),text);
});
test('truncated, unknown, invalid and omitted tokens fail closed',()=>{
  assert.throws(()=>maskNERSpans('Anna kommt',tokens([['Anna','PER']])),/TRUNCATED/);
  assert.throws(()=>maskNERSpans('Anna',tokens([['[UNK]','PER']])),/UNALIGNABLE/);
  assert.throws(()=>maskNERSpans('Anna kommt',tokens([['kommt','O']])),/UNALIGNABLE/);
  assert.throws(()=>maskNERSpans('Anna',[{word:'Anna',entity:'PER',index:1,score:NaN}]),/INVALID/);
});
test('whole pipeline negative FP includes baseline masking and new blocking',async()=>{
  const a=await evaluateCorpus(one('Klinischer Begriff'),{maskFn:()=>({masked:'⟦NAME_a_1⟧',unmask:()=> 'Klinischer Begriff'}),scanFn:()=>[]});
  assert.equal(a.summary.negativeFP,1);
  const b=await evaluateCorpus(one('Klinischer Begriff'),{maskFn:identity,scanFn:()=>[{suspicious:true}]});
  assert.equal(b.summary.negativeFP,1);
});
test('scanner reruns on postNER output rather than old findings',async()=>{
  let scanned;
  const r=await evaluateCorpus(one('Anna',[{type:'NAME',value:'Anna'}]),{maskFn:identity,nerTransform:t=>maskNERSpans(t,tokens([['Anna','B-PER']])),scanFn:t=>{scanned=t;return [];}});
  assert.equal(scanned,'⟦NER_PER_1⟧');
  assert.equal(r.summary.blockedCases,0);
  assert.equal(r.summary.effectiveLeaks,0);
  assert.equal(r.summary.roundtripFailures,0);
});
test('blocked truth is not counted as sent; effective and raw remain distinct',async()=>{
  const corpus=[...one('Anna',[{type:'NAME',value:'Anna'}]),{id:'second',text:'Li',entities:[],pii_truth:[{type:'NAME',value:'Li'}]}];
  const r=await evaluateCorpus(corpus,{maskFn:identity,scanFn:t=>t==='Anna'?[{}]:[]});
  assert.equal(r.summary.totalTruth,2);assert.equal(r.summary.sentTruth,1);
  assert.equal(r.summary.rawLeaks,2);assert.equal(r.summary.effectiveLeaks,1);
  assert.equal(r.summary.sentLeakRate,1);assert.equal(r.summary.effectiveLeakRate,.5);
});
test('invalid/empty output never gives valid zero-leak success',async()=>{
  for(const bad of [undefined,{masked:''},{masked:' ',unmask:s=>s},{masked:42,unmask:s=>s}]){
    const r=await evaluateCorpus(one('Anna',[{type:'NAME',value:'Anna'}]),{maskFn:()=>bad});
    assert.equal(r.summary.valid,false);assert.equal(r.summary.errors,1);assert.equal(r.summary.blockedCases,1);
  }
});
test('corrupt restoration blocks dispatch and invalidates gate',async()=>{
  const r=await evaluateCorpus(one('Anna',[{type:'NAME',value:'Anna'}]),{maskFn:()=>({masked:'⟦NAME_a_1⟧',unmask:()=> 'wrong'})});
  assert.equal(r.summary.roundtripFailures,1);assert.equal(r.summary.sentTruth,0);assert.equal(r.summary.valid,false);
});
test('all blocked positive cases cannot pass historical quality gate',async()=>{
  const corpus=Array.from({length:139},(_,i)=>({id:`positive-${i}`,text:'Anna',entities:[],pii_truth:[{value:'Anna',type:'NAME'}]}));
  for(let i=0;i<7;i++)corpus.push({id:`negative-${i}`,text:'klinisch',entities:[],pii_truth:[]});
  const r=await evaluateCorpus(corpus,{maskFn:identity,scanFn:t=>t==='Anna'?[{}]:[]});
  assert.equal(r.summary.effectiveLeaks,0);assert.equal(r.summary.sentTruth,0);assert.equal(r.summary.historicalQualityGate,false);
});
test('processing errors have content-free artifact codes',async()=>{
  const r=await evaluateCorpus(one('synthetic'),{maskFn:()=>{throw new Error('provider echoed sensitive text');}});
  assert.equal(r.cases[0].error,'PROCESSING_ERROR');assert.equal(r.summary.valid,false);
});
