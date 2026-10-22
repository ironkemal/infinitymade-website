// Exercise actual production handlers with synthetic IO, no DB or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function handler(file, method, route, deps) {
  const source=readFileSync(new URL(file,import.meta.url),'utf8');
  const start=source.indexOf(`router.${method}('${route}',`);
  const end=source.indexOf('\n});',start);
  assert.ok(start>=0 && end>start);
  let fn;
  const bindings={...deps,router:{[method](_path,callback){fn=callback;}}};
  new Function(...Object.keys(bindings),source.slice(start,end+4))(...Object.values(bindings));
  return fn;
}

function fixture() {
  const writes=[], reads=[], errors=[];
  const db={auth:{getUser:async()=>({data:{user:{id:'synthetic-owner'}},error:null})},from(table){
    const chain={select(){return this;},eq(){return this;},in(){return this;},single(){return this;},maybeSingle(){return this;},
      update(){writes.push(table);throw new Error('Unexpected write');},
      insert(){writes.push(table);throw new Error('Unexpected write');},
      then(resolve,reject){
        reads.push(table);
        const rows={profiles:{id:'synthetic-owner',role:'owner'},terapeut_zertifikat:{ik_nummer:'123456789'},
          kostentraeger:{ik:'987654321',name:'Synthetic'},therapist_certificates:[],
          prescriptions:[{id:'synthetic-rx',owner_id:'synthetic-owner',status:'parsed',therapie_bereich:'podo'}]};
        if(!(table in rows)) return Promise.reject(new Error(`Unexpected read ${table}`)).then(resolve,reject);
        return Promise.resolve({data:rows[table],error:null}).then(resolve,reject);
      }};
    return chain;
  }};
  const res={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  return {db,writes,reads,errors,res,console:{error:(...args)=>errors.push(args)}};
}

for(const route of ['/abrechnung/create','/abrechnung/create-podologie']) {
  test(`${route}: draft rejected before validation overrides, DTA, or writes`,async()=>{
    const f=fixture();
    const fn=handler('./abrechnung.routes.js','post',route,{supabase:f.db,console:f.console,
      ladeAnnahmestelle:async()=>({ok:true,ik:'987654321'}),abrechnungscodeFuer:()=> '21'});
    await fn({headers:{authorization:'Bearer synthetic'},body:{kostentraegerIk:'987654321',
      prescriptionIds:['synthetic-rx'],verordnungIds:['synthetic-rx'],sperrenIgnoriert:['synthetic-rx'],sperrenGrund:'Override'}},f.res);
    assert.deepEqual(f.errors,[]);assert.equal(f.res.statusCode,409);
    assert.equal(f.res.body.code,'VERORDNUNG_ENTWURF');assert.deepEqual(f.writes,[]);
    assert.equal(f.reads.at(-1),'prescriptions');
  });
}

test('manual billing release cannot lift a prescription draft',async()=>{
  const f=fixture();
  const db={from(table){assert.equal(table,'prescriptions');return {
    select(){return this;},eq(){return this;},async maybeSingle(){return {data:{id:'synthetic-rx',owner_id:'synthetic-owner',status:'parsed',therapie_bereich:'podo'},error:null};},
    update(){f.writes.push(table);throw new Error('Unexpected write');}};}};
  const fn=handler('./verordnung-status.routes.js','patch','/verordnung/:id/abrechnungsstatus',{
    supabase:db,console:f.console,resolveAuth:async()=>({tenantId:'synthetic-owner'}),UEBERGAENGE:{abrechenbar:[]}});
  await fn({params:{id:'synthetic-rx'},body:{status:'abrechenbar'}},f.res);
  assert.deepEqual(f.errors,[]);assert.equal(f.res.statusCode,409);
  assert.equal(f.res.body.code,'VERORDNUNG_ENTWURF');assert.deepEqual(f.writes,[]);
});
