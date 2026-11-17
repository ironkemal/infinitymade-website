import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('P3-1: Entfernen-Dialog nennt Person und Folgen ohne Entfernung auszulösen',async()=>{
 const s=readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
 const line=s.split('\n').find(l=>l.includes('const okRemove = await showConfirmModal'));
 let opts;await vm.runInNewContext('(async()=>{'+line+'})()', {m:{owner_first_name:'Test',owner_last_name:'Person'},t:()=> 'Entfernen',showConfirmModal:async o=>{opts=o;return false;}});
 for(const text of ['Test Person','Zugang','Termine','Patienten']) assert.ok(opts.message.includes(text),text);
});
