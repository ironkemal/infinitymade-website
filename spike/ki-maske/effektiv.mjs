import {readFileSync} from 'node:fs';
import {evaluateCorpus} from './benchmark.mjs';
for(const file of ['korpus.json','korpus2.json']){
  const result=await evaluateCorpus(JSON.parse(readFileSync(new URL(file,import.meta.url))));
  console.log(JSON.stringify({file,...result.summary}));
  if(!result.summary.valid)process.exitCode=2;
}
