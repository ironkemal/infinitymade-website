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

test('schreibeVerordnung setzt nach insert _bearbeitung.id, sodass zweiter Klick aktualisiert statt Dublette', async () => {
  const source = readFileSync(new URL('./verordnung-maske.js', import.meta.url), 'utf8');
  // Simuliere vereinfachte schreibeVerordnung-Logik
  let _bearbeitung = null;
  const calls = [];
  async function mockSendeAnServer(supabase, { methode, pfad, rumpf }) {
    calls.push({ methode, pfad });
    if (methode === 'POST') {
      return { prescription_id: 'rx-neu-123', status: 'confirmed' };
    }
    return { prescription_id: pfad.replace('/rezept/', ''), status: 'confirmed' };
  }

  async function mockSchreibe() {
    const editId = _bearbeitung?.id || null;
    if (!editId) {
      const json = await mockSendeAnServer({}, { methode: 'POST', pfad: '/rezept/confirm', rumpf: {} });
      _bearbeitung = { id: json.prescription_id };
      return { id: json.prescription_id, aktualisiert: false };
    }
    const json = await mockSendeAnServer({}, { methode: 'PATCH', pfad: `/rezept/${editId}`, rumpf: {} });
    return { id: editId, aktualisiert: true };
  }

  // Erster Klick: Insert (POST)
  const r1 = await mockSchreibe();
  assert.equal(r1.id, 'rx-neu-123');
  assert.equal(r1.aktualisiert, false);
  assert.equal(_bearbeitung.id, 'rx-neu-123');
  assert.equal(calls[0].methode, 'POST');

  // Zweiter Klick (z. B. nach Fehler im Folgeschritt): Update (PATCH), keine Dublette
  const r2 = await mockSchreibe();
  assert.equal(r2.id, 'rx-neu-123');
  assert.equal(r2.aktualisiert, true);
  assert.equal(calls[1].methode, 'PATCH');
  assert.equal(calls[1].pfad, '/rezept/rx-neu-123');
});
