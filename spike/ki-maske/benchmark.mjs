import {checkLeak} from './messen.mjs';
import {maskiere, scanneReste} from './maske-v2.mjs';

export function nerInput(text) {
  return text.replace(/⟦[A-Za-z0-9_]+⟧/g, token=>' '.repeat(token.length));
}

// Align the complete stream incl O: Transformers supplies no character offsets.
export function maskNERSpans(text, tokens) {
  if (!Array.isArray(tokens)) throw new Error('INVALID_NER_OUTPUT');
  const input=nerInput(text), spans=[];
  let cursor=0, active=null, previous=0;
  for (const token of tokens) {
    if (!token || typeof token.word!=='string' || !Number.isFinite(token.score) || !Number.isInteger(token.index) || token.index<=previous || typeof token.entity!=='string') throw new Error('INVALID_NER_TOKEN');
    previous=token.index;
    const word=token.word.replace(/^##/,'');
    if (!word || word==='[UNK]') throw new Error('UNALIGNABLE_NER_TOKEN');
    while (/\s/u.test(input[cursor]||'') && cursor<input.length) cursor++;
    if (!input.startsWith(word,cursor)) throw new Error('UNALIGNABLE_NER_TOKEN');
    const start=cursor,end=cursor+word.length;
    cursor=end;
    const label=token.entity.replace(/^[BI]-/,'');
    if (!['PER','ORG','LOC'].includes(label)) { active=null;continue; }
    if (active && active.label===label && (token.entity.startsWith('I-') || token.word.startsWith('##')) && !/\S/u.test(input.slice(active.end,start))) active.end=end;
    else {active={start,end,label};spans.push(active);}
  }
  if (/\S/u.test(input.slice(cursor))) throw new Error('TRUNCATED_NER_OUTPUT');
  let masked='',pos=0;
  const map=new Map();
  for (const [i,span] of spans.entries()) {
    const token=`⟦NER_${span.label}_${i+1}⟧`;
    if (text.includes(token)) throw new Error('NER_PLACEHOLDER_COLLISION');
    map.set(token,text.slice(span.start,span.end));
    masked+=text.slice(pos,span.start)+token;pos=span.end;
  }
  masked+=text.slice(pos);
  return {masked,unmask:s=>s.replace(/⟦NER_[A-Z]+_\d+⟧/g,t=>map.get(t)??t)};
}

export async function evaluateCorpus(corpus,{maskFn=maskiere,nerTransform,scanFn=scanneReste}={}) {
  if (!Array.isArray(corpus) || !corpus.length) throw new Error('INVALID_CORPUS');
  const summary={cases:corpus.length,totalTruth:0,rawLeaks:0,effectiveLeaks:0,sentTruth:0,blockedCases:0,negativeCases:0,negativeFP:0,roundtripFailures:0,errors:0};
  const cases=[],timings=[];
  for (const c of corpus) {
    if (typeof c.text!=='string' || !Array.isArray(c.entities) || !Array.isArray(c.pii_truth)) throw new Error('INVALID_CORPUS_CASE');
    for (const p of c.pii_truth) if(typeof p.value!=='string'||!p.value.trim()||typeof p.type!=='string') throw new Error('INVALID_TRUTH');
    const names=c.entities.filter(e=>e.type==='NAME').map(e=>e.value);
    const row={id:c.id,truth:c.pii_truth.length,rawLeaks:0,effectiveLeaks:0,blocked:false,negativeFP:false,roundtrip:false,leakTypes:[],error:null};
    summary.totalTruth+=row.truth;
    if(!row.truth)summary.negativeCases++;
    const t=performance.now();
    try {
      const r=await maskFn(c.text,{entities:c.entities,mandantNamen:names});
      if(!r||typeof r.masked!=='string'||(c.text.trim()&&!r.masked.trim())||typeof r.unmask!=='function')throw new Error('INVALID_MASK_OUTPUT');
      const n=nerTransform ? await nerTransform(r.masked) : {masked:r.masked,unmask:s=>s};
      if(!n||typeof n.masked!=='string'||(c.text.trim()&&!n.masked.trim())||typeof n.unmask!=='function')throw new Error('INVALID_NER_OUTPUT');
      const findings=scanFn(n.masked,names);
      if(!Array.isArray(findings))throw new Error('INVALID_SCANNER_OUTPUT');
      row.blocked=findings.length>0;
      row.roundtrip=r.unmask(n.unmask(n.masked))===c.text;
      if(!row.roundtrip) {summary.roundtripFailures++;row.blocked=true;}
      row.negativeFP=!row.truth&&(n.masked!==c.text||row.blocked);
      for(const p of c.pii_truth)if(checkLeak(p,n.masked).isLeak){row.rawLeaks++;row.leakTypes.push(p.type);}
      row.effectiveLeaks=row.blocked?0:row.rawLeaks;
      if(!row.blocked)summary.sentTruth+=row.truth;
    }catch(e){row.blocked=true;row.error=/^[A-Z_]+$/.test(e.message)?e.message:'PROCESSING_ERROR';summary.errors++;row.negativeFP=!row.truth;}
    timings.push(performance.now()-t);
    summary.rawLeaks+=row.rawLeaks;summary.effectiveLeaks+=row.effectiveLeaks;
    if(row.blocked)summary.blockedCases++;
    if(row.negativeFP)summary.negativeFP++;
    cases.push(row);
  }
  summary.effectiveLeakRate=summary.totalTruth?summary.effectiveLeaks/summary.totalTruth:null;
  summary.sentLeakRate=summary.sentTruth?summary.effectiveLeaks/summary.sentTruth:null;
  summary.blockRate=summary.blockedCases/summary.cases;
  const sorted=timings.slice().sort((a,b)=>a-b);
  summary.p50ms=sorted[Math.ceil(sorted.length*.5)-1];summary.p95ms=sorted[Math.ceil(sorted.length*.95)-1];
  summary.valid=summary.errors===0&&summary.roundtripFailures===0;
  summary.historicalQualityGate=summary.valid&&summary.sentTruth>0&&summary.totalTruth===139&&summary.negativeCases===7&&summary.effectiveLeaks<=2&&summary.negativeFP<=1;
  return {summary,cases};
}
