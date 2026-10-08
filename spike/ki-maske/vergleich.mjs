import {readFileSync} from 'node:fs';
import {maskPII} from '../../api-backend/ai/pii-mask.js';
import {evaluateCorpus} from './benchmark.mjs';
for(const file of ['korpus.json','korpus2.json']){
  const corpus=JSON.parse(readFileSync(new URL(file,import.meta.url)));
  for(const [version,options] of [['v1',{maskFn:maskPII,scanFn:()=>[]}],['v2',{}]]){
    const result=await evaluateCorpus(corpus,options);
    console.log(JSON.stringify({file,version,...result.summary}));
    if(!result.summary.valid)process.exitCode=2;
  }
}
