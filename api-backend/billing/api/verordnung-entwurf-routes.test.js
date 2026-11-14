// Exercise actual production handlers with synthetic IO, no DB or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * @param {string} file
 * @param {string} method
 * @param {string} route
 * @param {Record<string, any>} deps
 * @returns {any}
 */
function handler(file, method, route, deps) {
  const source=readFileSync(new URL(file,import.meta.url),'utf8');
  const start=source.indexOf(`router.${method}('${route}',`);
  const end=source.indexOf('\n});',start);
  assert.ok(start>=0 && end>start);
  /** @type {any} */
  let fn;
  const bindings={...deps,router:{[method](/** @type {any} */ _path,/** @type {any} */ callback){fn=callback;}}};
  new Function(...Object.keys(bindings),source.slice(start,end+4))(...Object.values(bindings));
  return fn;
}

function fixture() {
  /** @type {any[]} */ const writes=[];
  /** @type {string[]} */ const reads=[];
  /** @type {any[]} */ const errors=[];
  const db={auth:{getUser:async()=>({data:{user:{id:'synthetic-owner'}},error:null})},from(/** @type {string} */ table){
    /** @type {any} */
    const chain={select(){return this;},eq(){return this;},in(){return this;},single(){return this;},maybeSingle(){return this;},
      update(){writes.push(table);throw new Error('Unexpected write');},
      insert(){writes.push(table);throw new Error('Unexpected write');},
      then(/** @type {any} */ resolve,/** @type {any} */ reject){
        reads.push(table);
        /** @type {Record<string, any>} */
        const rows={profiles:{id:'synthetic-owner',role:'owner'},terapeut_zertifikat:{ik_nummer:'123456789'},
          kostentraeger:{ik:'987654321',name:'Synthetic'},therapist_certificates:[],
          prescriptions:[{id:'synthetic-rx',owner_id:'synthetic-owner',status:'parsed',therapie_bereich:'podo'}]};
        if(!(table in rows)) return Promise.reject(new Error(`Unexpected read ${table}`)).then(resolve,reject);
        return Promise.resolve({data:rows[table],error:null}).then(resolve,reject);
      }};
    return chain;
  }};
  /** @type {any} */
  const res={statusCode:200,status(/** @type {number} */ code){this.statusCode=code;return this;},json(/** @type {any} */ body){this.body=body;return this;}};
  return {db,writes,reads,errors,res,console:{error:(/** @type {any[]} */ ...args)=>errors.push(args)}};
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
  const db={from(/** @type {string} */ table){assert.equal(table,'prescriptions');return {
    select(){return this;},eq(){return this;},async maybeSingle(){return {data:{id:'synthetic-rx',owner_id:'synthetic-owner',status:'parsed',therapie_bereich:'podo'},error:null};},
    update(){f.writes.push(table);throw new Error('Unexpected write');}};}};
  const fn=handler('./verordnung-status.routes.js','patch','/verordnung/:id/abrechnungsstatus',{
    supabase:db,console:f.console,UEBERGAENGE:{abrechenbar:[]},
    resolveAuth:async()=>({tenantId:'synthetic-owner',user:{id:'synthetic-owner'},profile:{role:'owner'},token:'synthetic'}),
    praxenFuerPruefung:async()=>[],hatAbrechnungsRecht:async(/** @type {any} */ {auth,ownerId})=>auth.role==='owner'&&auth.userId===ownerId});
  await fn({params:{id:'synthetic-rx'},body:{status:'abrechenbar'}},f.res);
  assert.deepEqual(f.errors,[]);assert.equal(f.res.statusCode,409);
  assert.equal(f.res.body.code,'VERORDNUNG_ENTWURF');assert.deepEqual(f.writes,[]);
});

// guvenlik S-65: ein Angestellter OHNE Modulrecht 'abrechnung' ändert den Abrechnungsstatus nicht (403, vor jeder Änderung)
test('abrechnungsstatus: Angestellter ohne Recht abgewiesen, mit Recht kommt er bis zur Statusprüfung',async()=>{
  for(const [hat,erwartet] of /** @type {Array<[boolean, number]>} */ ([[false,403],[true,409]])){
    const f=fixture();
    const db={from(/** @type {string} */ table){assert.equal(table,'prescriptions');return {
      select(){return this;},eq(){return this;},async maybeSingle(){return {data:{id:'synthetic-rx',owner_id:'synthetic-owner',business_id:'synthetic-biz',status:'parsed',therapie_bereich:'podo'},error:null};},
      update(){f.writes.push(table);throw new Error('Unexpected write');}};}};
    /** @type {any} */ let gefragt=null;
    const fn=handler('./verordnung-status.routes.js','patch','/verordnung/:id/abrechnungsstatus',{
      supabase:db,console:f.console,UEBERGAENGE:{abrechenbar:[]},
      resolveAuth:async()=>({tenantId:'synthetic-owner',user:{id:'synthetic-employee'},profile:{role:'employee'},token:'synthetic'}),
      praxenFuerPruefung:async(/** @type {any} */ _db,/** @type {any} */ p)=>{gefragt=p;return ['synthetic-biz'];},
      hatAbrechnungsRecht:async()=>hat});
    await fn({params:{id:'synthetic-rx'},body:{status:'abrechenbar'}},f.res);
    assert.equal(f.res.statusCode,erwartet,`Recht=${hat}`);
    if(!hat){assert.equal(f.res.body.code,'KEINE_BERECHTIGUNG');}
    assert.deepEqual(f.writes,[]);
    assert.equal(gefragt.userId,'synthetic-employee');assert.equal(gefragt.businessId,'synthetic-biz');
  }
});
