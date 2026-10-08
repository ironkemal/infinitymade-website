import {readFileSync,writeFileSync,createReadStream,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {evaluateCorpus,maskNERSpans,nerInput} from './benchmark.mjs';
const modelDir=process.env.M4_MODEL_DIR;
const entry=process.env.M4_TRANSFORMERS_ENTRY;
if(!modelDir||!entry)throw new Error('Explicit isolated M4_MODEL_DIR and M4_TRANSFORMERS_ENTRY required');
const manifest=JSON.parse(readFileSync(new URL('./model-manifest.json',import.meta.url)));
const runtimePackage=JSON.parse(readFileSync(resolve(dirname(entry),'../package.json')));
if(runtimePackage.name!==manifest.runtime.package||runtimePackage.version!==manifest.runtime.version)throw new Error('RUNTIME_VERSION_MISMATCH');
for(const f of manifest.files){
  const path=resolve(modelDir,f.file),hash=createHash('sha256');
  for await(const chunk of createReadStream(path)) hash.update(chunk);
  if(statSync(path).size!==f.bytes||hash.digest('hex')!==f.sha256)throw new Error('MODEL_HASH_MISMATCH '+f.file);
}
const {pipeline,env}=await import(pathToFileURL(resolve(entry)).href);
env.allowRemoteModels=false;env.allowLocalModels=true;
const t=performance.now();
const ner=await pipeline('token-classification',resolve(modelDir),{dtype:'q8',session_options:{intraOpNumThreads:1,interOpNumThreads:1}});
const report={timestamp:new Date().toISOString(),model:manifest.model,revision:manifest.revision,runtime:manifest.runtime,node:process.version,platform:process.platform,arch:process.arch,loadms:performance.now()-t,loadRSSBytes:process.memoryUsage().rss,remoteModels:false,corpora:{}};
try {
  for(const file of ['korpus.json','korpus2.json']){
    const raw=readFileSync(new URL(file,import.meta.url));
    report.corpora[file]={sha256:createHash('sha256').update(raw).digest('hex'),...await evaluateCorpus(JSON.parse(raw),{nerTransform:async masked=>{
      const input=nerInput(masked);
      const ids=ner.tokenizer(input,{truncation:false}).input_ids;
      const max=ner.model.config.max_position_embeddings;
      if(!Number.isInteger(max)||ids.dims.at(-1)>max)throw new Error('NER_INPUT_TOO_LONG');
      const tokens=await ner(input,{aggregation_strategy:'none',ignore_labels:[]});
      return maskNERSpans(masked,tokens);
    }})};
  }
}finally{await ner.dispose();}
report.peakRSSKB=process.resourceUsage().maxRSS;
report.finalRSSBytes=process.memoryUsage().rss;
report.decision=report.corpora['korpus2.json'].summary.historicalQualityGate?'QUALITY_PASS_BETRIEBSGATE_REQUIRED':'NO_NER_QUALITY_GATE';
if(process.env.M4_REPORT)writeFileSync(process.env.M4_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,corpora:Object.fromEntries(Object.entries(report.corpora).map(([k,v])=>[k,{sha256:v.sha256,summary:v.summary}]))},null,2));
if(Object.values(report.corpora).some(c=>!c.summary.valid))process.exitCode=2;
