import {runMigrations} from './migrate.js';
import {writeFileSync} from 'node:fs';
const results=[];
for(let i=0;i<2;i++){
 const r=await runMigrations({databaseUrl:process.env.PROOF_DB_URL,verzeichnis:'/tmp/praxura-p/migrations',appVersion:'local-proof-0115',log:()=>{}});
 results.push(r); console.log(JSON.stringify({lauf:i+1,status:r.status,angewandt:r.angewandt?.length,letzte:r.angewandt?.at(-1)?.name,fehler:r.fehler,zaehler:r.zaehler}));
 if(r.status==='fehler')break;
}
writeFileSync('/tmp/praxura-p/result.json',JSON.stringify(results,null,2));
