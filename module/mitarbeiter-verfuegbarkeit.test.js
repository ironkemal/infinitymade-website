import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
test('Verfügbarkeit: entfernte Mitarbeiter fehlen, aktive und Altdaten bleiben', async () => {
  const source = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('async function loadHoursPanel()'), source.indexOf('async function renderHoursStandortSection', source.indexOf('async function loadHoursPanel()')));
  const rows = [{id:'aktiv',business_name:'Aktiv',is_active:true},{id:'alt',business_name:'Alt',is_active:null},{id:'entfernt',business_name:'Entfernt',is_active:false}];
  let filtered = rows;
  const query = { select(){return this;}, eq(){return this;}, not(key,op,value){ filtered=rows.filter(r=>r[key]!==value);return this; }, then(resolve){return Promise.resolve({data:filtered}).then(resolve);} };
  const select = { innerHTML: '' };
  await vm.runInNewContext(body + '\nloadHoursPanel()', { supabase:{from:()=>query},getOwnerId:()=> 'owner', currentProfile:{role:'owner'},currentSession:{user:{id:'owner',email:'owner@example.invalid'}},document:{getElementById:()=>select,querySelector:()=>null},renderHoursGrid:async()=>{},renderHoursStandortSection:async()=>{} });
  assert.match(select.innerHTML,/Aktiv/); assert.match(select.innerHTML,/Alt/); assert.doesNotMatch(select.innerHTML,/Entfernt/);
});
