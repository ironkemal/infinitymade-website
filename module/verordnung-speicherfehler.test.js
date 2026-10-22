import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Actual sender isolated from DOM imports; no credentials or HTTP.
function sender(fetch, session={access_token:'synthetic'}) {
  const source=readFileSync(new URL('./verordnung-maske.js',import.meta.url),'utf8');
  const start=source.indexOf('export async function sendeAnServer(');
  const end=source.indexOf('\nexport async function schreibeVerordnung(',start);
  const fn=new Function('fetch','_bruecke',source.slice(start,end).replace('export ','')+'\nreturn sendeAnServer;')(fetch,{apiBasis:'http://synthetic.invalid/api'});
  return ()=>fn({auth:{getSession:async()=>({data:{session}})}},{methode:'POST',pfad:'/rezept/confirm',rumpf:{parsed:{}}});
}

test('401 explains recovery, never returns success or retries a write',async()=>{
  let requests=0;
  const send=sender(async()=>{requests++;return {ok:false,status:401,json:async()=>({error:'Invalid token'})};});
  await assert.rejects(send,/Sitzung.*zweiten Tab.*Eingaben bleiben/);
  assert.equal(requests,1);
});

test('network failure and server errors never become a successful draft',async()=>{
  await assert.rejects(sender(async()=>{throw new Error('Network unavailable');}),/Network unavailable/);
  await assert.rejects(sender(async()=>({ok:false,status:500,json:async()=>({error:'Save failed'})})),/Save failed/);
});

test('successful sender preserves authoritative draft status',async()=>{
  const result=await sender(async()=>({ok:true,status:200,json:async()=>({success:true,prescription_id:'synthetic-rx',status:'parsed'})}))();
  assert.equal(result.status,'parsed');
});
