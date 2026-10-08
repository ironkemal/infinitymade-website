// Execute the production handlers without importing server.js (which starts
// Express). Only external IO and the validation engine are replaced. Provenance,
// prescription field mapping and access decisions use the actual implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validiereBarcodeErfassung, computedMitErfassung } from './rezept-erfassung.js';
import { heilmittelPositionAufloesen, kartenIkNormalisieren, artFelderAusRezept,
  rezeptartWechselPruefen, bgFelderAusRezept, bgAenderungGesperrt } from './rezept-felder.js';
import { statusAusAbrechnungStatus } from '../billing/utils/einreichbar.js';
import { normalisiereGeschlecht } from './geschlecht.js';

const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const provenance = { quelle:'barcode', format:'PDF417', parser_version:'KBV-BFB-4.80-M13-10', bestaetigt:true };
const freshComputed = { gueltig_bis:'2026-12-01', total_bonuses_eur:0 };

function productionHandler(method, route, dependencies) {
  const start = source.indexOf(`app.${method}('${route}',`);
  assert.ok(start >= 0, `Production route missing: ${method} ${route}`);
  const end = source.indexOf('\n});', start);
  assert.ok(end > start, 'Production handler closing boundary missing');
  let captured;
  const bindings = {
    ...dependencies,
    app:{ [method]:(registeredRoute, middleware, handler) => {
      assert.equal(registeredRoute, route);
      assert.equal(typeof middleware, 'function');
      captured = handler;
    } },
    requireAuthAI:() => {},
  };
  new Function(...Object.keys(bindings), source.slice(start, end + '\n});'.length))(...Object.values(bindings));
  assert.equal(typeof captured, 'function');
  return captured;
}

function fixture({ existing, foreignPatient=false } = {}) {
  const writes = [], reads = [], doctors = [], validationInputs = [], unexpectedErrors = [];
  const supabase = { from(table) {
    const query = { table, operation:'select', filters:[] };
    const chain = {
      select() { return this; },
      insert(value) { query.operation='insert';query.value=value;writes.push(query);return this; },
      update(value) { query.operation='update';query.value=value;writes.push(query);return this; },
      eq(key, value) { query.filters.push([key,value]);return this; },
      ilike() { return this; }, limit() { return this; }, or() { return this; }, in() { return this; },
      single() { return this; }, maybeSingle() { return this; },
      then(resolve, reject) {
        try {
          let data;
          if(query.operation==='select') {
            reads.push(query);
            if(table==='prescriptions') data=existing ?? null;
            else if(table==='leads') data=foreignPatient ? null : {id:'synthetic-patient'};
            else throw new Error(`Unexpected read: ${table}`);
          } else if(table==='leads') data={id:'synthetic-patient'};
          else if(table==='prescriptions') data=query.operation==='insert' ? {id:'synthetic-rx'} : [{id:'synthetic-rx'}];
          else if(table==='prescription_validations') data=null;
          else throw new Error(`Unexpected write: ${table}`);
          return Promise.resolve({data,error:null}).then(resolve,reject);
        } catch(error) {return Promise.reject(error).then(resolve,reject);}
      },
    };
    return chain;
  } };
  const dependencies = {
    supabase, validiereBarcodeErfassung, computedMitErfassung,
    heilmittelPositionAufloesen, kartenIkNormalisieren, artFelderAusRezept,
    rezeptartWechselPruefen, bgFelderAusRezept, bgAenderungGesperrt,
    statusAusAbrechnungStatus, normalisiereGeschlecht,
    kostentraegerIkAufloesen:async()=>null,
    resolveOrCreateArzt:async(_db, tenantId, input, options)=>{
      doctors.push({tenantId,input,options});return {id:'synthetic-doctor'};
    },
    validateRezept:input=>{
      validationInputs.push(input);
      return {ok:true,computed:{...freshComputed},warnings:[],blockers:[]};
    },
    console:{error:(...args)=>unexpectedErrors.push(args)},
  };
  async function invoke(method, body) {
    const handler=productionHandler(method, method==='post'?'/api/rezept/confirm':'/api/rezept/:id', dependencies);
    const response={statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}};
    await handler({auth:{tenantId:'synthetic-tenant',userId:'synthetic-user'},params:{id:'synthetic-rx'},body}, response);
    assert.deepEqual(unexpectedErrors, [], 'Handler must not hide a missing stub or crash behind HTTP 500');
    return response;
  }
  return {invoke,writes,reads,doctors,validationInputs};
}

function body(erfassung=provenance) {
  return {erfassung,patient_neu:true,parsed:{
    patient:{first_name:'Synthetic',last_name:'Fixture',geburtsdatum:'1975-03-08'},
    arzt:{ausstellungsdatum:'2026-10-07'},
    rezept:{therapiebereich:'podo',heilmittel:'Hornhautabtragung',anzahl_einheiten:6,diagnosegruppe:'DF',icd10:'E11.74'},
  }};
}

test('Production POST rejects unconfirmed or excessive provenance before any write', async () => {
  for(const erfassung of [{...provenance,bestaetigt:false},{...provenance,patient:'Do not persist'}]) {
    const f=fixture();const res=await f.invoke('post',body(erfassung));
    assert.equal(res.statusCode,400);assert.match(res.body.error,/Papier/);
    assert.deepEqual(f.writes,[]);assert.deepEqual(f.doctors,[]);assert.deepEqual(f.reads,[]);
    assert.deepEqual(f.validationInputs,[]);
  }
});

test('Production POST persists validated provenance beside fresh computed values', async () => {
  const f=fixture();const res=await f.invoke('post',body());
  assert.equal(res.statusCode,200);assert.equal(res.body.success,true);
  const row=f.writes.find(q=>q.table==='prescriptions').value;
  assert.deepEqual(row.computed,{...freshComputed,erfassung:provenance});
  assert.equal(row.owner_id,'synthetic-tenant');assert.equal(row.heilmittel_position,'78010');
  assert.equal(row.patient_id,'synthetic-patient');assert.equal(row.image_storage_path,null);
  assert.equal(f.doctors[0].options.quelle,'import');
  assert.equal(f.writes.filter(q=>q.table==='prescription_validations').length,1);
});

test('Production PATCH retains corrected provenance and replaces stale calculation', async () => {
  const old={id:'synthetic-rx',owner_id:'synthetic-tenant',rezeptart:'kassen',
    computed:{erfassung:{...provenance},gueltig_bis:'2000-01-01',obsolete_calculation:'remove me'}};
  const f=fixture({existing:old});const request=body();
  const res=await f.invoke('patch',request);
  assert.equal(res.statusCode,200);assert.equal(res.body.success,true);
  const write=f.writes.find(q=>q.table==='prescriptions');
  assert.deepEqual(write.value.computed,{...freshComputed,erfassung:{...provenance,quelle:'barcode+korrigiert'}});
  assert.deepEqual(write.filters,[['id','synthetic-rx'],['owner_id','synthetic-tenant']]);
  assert.equal(f.doctors[0].options.quelle,'import');
  assert.equal(old.computed.erfassung.quelle,'barcode');
  assert.equal(f.writes.filter(q=>q.table==='prescription_validations').length,1);
});

test('Production PATCH rejects foreign tenant before doctor or prescription writes', async () => {
  const f=fixture({existing:{id:'synthetic-rx',owner_id:'another-tenant',computed:{erfassung:provenance}}});
  const res=await f.invoke('patch',body());
  assert.equal(res.statusCode,403);assert.deepEqual(f.writes,[]);assert.deepEqual(f.doctors,[]);
  assert.deepEqual(f.validationInputs,[]);
});

test('Production POST rejects a foreign patient before doctor or prescription writes', async () => {
  const f=fixture({foreignPatient:true});const request={...body(),patient_id:'foreign-patient'};
  const res=await f.invoke('post',request);
  assert.equal(res.statusCode,403);assert.deepEqual(f.writes,[]);assert.deepEqual(f.doctors,[]);
  assert.deepEqual(f.reads[0].filters,[['id','foreign-patient'],['owner_id','synthetic-tenant']]);
});

test('Production PATCH rejects unconfirmed metadata before doctor or prescription writes', async () => {
  const f=fixture({existing:{id:'synthetic-rx',owner_id:'synthetic-tenant'}});
  const res=await f.invoke('patch',body({...provenance,bestaetigt:false}));
  assert.equal(res.statusCode,400);assert.deepEqual(f.writes,[]);assert.deepEqual(f.doctors,[]);
});

test('Production PATCH of stored barcode rejects missing fresh confirmation before writes', async () => {
  const f=fixture({existing:{id:'synthetic-rx',owner_id:'synthetic-tenant',computed:{erfassung:provenance}}});
  const request=body();delete request.erfassung;
  const res=await f.invoke('patch',request);
  assert.equal(res.statusCode,400);assert.match(res.body.error,/erneut/);
  assert.deepEqual(f.writes,[]);assert.deepEqual(f.doctors,[]);
});
