import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('P2-3: Rechnungsnavigation setzt Liste vor erneutem Laden',()=>{
  const s=readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
  const zeile=s.split('\n').find(l=>l.includes("if (id === 'rechnungen')"));
  const calls=[];vm.runInNewContext(zeile,{id:'rechnungen',zeigeRechnungsModus:m=>calls.push(m),loadRechnungen:()=>calls.push('laden')});
  assert.deepEqual(calls,['liste','laden']);
});
