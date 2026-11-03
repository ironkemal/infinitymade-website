import test from 'node:test';
import assert from 'node:assert/strict';
import {getKiConfig,updateOwnerOptIn,requestKiTask,createKiSourceGuard,validateKiChallenge,refreshKiControls} from './ki-client.js';
const state={effective:true,mode:'direkt',mailReady:true,capabilities:{freeText:true,mailDraft:true,appointmentDraft:true}};
const wire={success:true,active:true,mode:'direkt',operatorReady:true,ownerActive:true,mailReady:true,capabilities:state.capabilities,optIn:{informationVersion:'2026-10-30-v1',decidedAt:'2026-10-08T12:00:00Z'}};
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
const challenge=()=>{const expiresAt=Date.now()+60000;return {challengeId:'a'.repeat(64)+'.'+expiresAt,expiresAt,candidates:[{id:'p1',text:'Synthetic Müller',type:'PERSON'}]};};
function taskDeps(overrides={}) {return {getKiConfig:async()=>state,getToken:async()=>'synthetic',fetchImpl:async()=>response({success:true,draft:{subject:'Synthetic'}}),...overrides};}
for(const [name,patch] of Object.entries({serveroff:{active:false},stringactive:{active:'true'},stringoperator:{operatorReady:'true'},stringowner:{ownerActive:'true'},unknownmode:{mode:'<script>'},aus:{mode:'aus'}})) {
 test(`configuration fail-closed: ${name}`,async()=>{assert.equal((await getKiConfig({getToken:async()=>'synthetic',fetchImpl:async()=>response({...wire,...patch})})).effective,false);});
}
test('nested owner metadata and explicit capabilities',async()=>{const cfg=await getKiConfig({getToken:async()=>'synthetic',fetchImpl:async()=>response(wire)});assert.equal(cfg.effective,true);assert.equal(cfg.informationVersion,wire.optIn.informationVersion);assert.equal(cfg.capabilities.freeText,true);});
test('employee reads minimal healthstate',async()=>{let url;const cfg=await getKiConfig({isOwner:()=>false,getToken:async()=>'synthetic',fetchImpl:async u=>{url=u;return response({ok:true,active:true,mode:'direkt',capabilities:state.capabilities});}});assert.match(url,/_healthstate$/);assert.equal(cfg.effective,true);});
test('network and HTTP errors never expose arbitrary text',async()=>{for(const fetchImpl of [async()=>{throw Error('PHI_SENTINEL');},async()=>response({error:'PHI_SENTINEL'},403)]){const cfg=await getKiConfig({getToken:async()=>'synthetic',fetchImpl});assert.equal(cfg.effective,false);assert.ok(!JSON.stringify(cfg).includes('PHI_SENTINEL'));}});
for(const options of [{enabled:'false'},{enabled:true,tenantId:'foreign'},{enabled:true,informationVersion:'old'}]) test(`invalid owner payload rejected before network ${JSON.stringify(options)}`,async()=>{let n=0;await assert.rejects(()=>updateOwnerOptIn(options,{getToken:async()=>'synthetic',fetchImpl:async()=>{n++;}}));assert.equal(n,0);});
test('owner false rejected and valid request sends only exact fields',async()=>{await assert.rejects(()=>updateOwnerOptIn({enabled:true},{isOwner:()=>false}));let sent;await updateOwnerOptIn({enabled:false},{getToken:async()=>'synthetic',fetchImpl:async(u,o)=>{sent=JSON.parse(o.body);return response({success:true});}});assert.deepEqual(sent,{enabled:false,informationVersion:'2026-10-30-v1'});});
test('unknown task and tenant input rejected with no fetch',async()=>{for(const [task,payload] of [['../config',{}],['b2c-draft',{tenantId:'other'}]]){let n=0;await assert.rejects(()=>requestKiTask(task,payload,taskDeps({fetchImpl:async()=>{n++;}})));assert.equal(n,0);}});
test('mail requires explicit freeText capability',async()=>{let n=0;await assert.rejects(()=>requestKiTask('b2c-draft',{},taskDeps({getKiConfig:async()=>({...state,capabilities:{mailDraft:true}}),fetchImpl:async()=>{n++;}})));assert.equal(n,0);});
test('appointment requires mail readiness even with active KI',async()=>{let n=0;await assert.rejects(()=>requestKiTask('appointment-confirm-draft',{},taskDeps({getKiConfig:async()=>({...state,mailReady:false}),fetchImpl:async()=>{n++;}})));assert.equal(n,0);});
test('task success must explicitly equal true',async()=>{await assert.rejects(()=>requestKiTask('series-rank',{},taskDeps({fetchImpl:async()=>response({draft:{}})})));});
test('cancel causes one local API call and no retry',async()=>{let n=0;await assert.rejects(()=>requestKiTask('b2c-draft',{},taskDeps({fetchImpl:async()=>{n++;return response({code:'KI_RUECKFRAGE',challenge:challenge()},409);},zeigeKiRueckfrageDialog:async()=>null})),{code:'KI_RUECKFRAGE_ABGEBROCHEN'});assert.equal(n,1);});
test('retry is single and uses fresh token',async()=>{let n=0,t=0;await assert.rejects(()=>requestKiTask('b2c-draft',{},taskDeps({getToken:async()=>`synthetic-${++t}`,fetchImpl:async(u,o)=>{n++;assert.equal(o.headers.Authorization,`Bearer synthetic-${n}`);return response({code:'KI_RUECKFRAGE',challenge:challenge()},409);},zeigeKiRueckfrageDialog:async()=>({choices:[{id:'p1',action:'maskieren'}]})})),{code:'KI_RETRY_LIMIT'});assert.equal(n,2);assert.equal(t,2);});
for(const [label,choices] of [['subset',[]],['duplicate',[{id:'p1',action:'maskieren'},{id:'p1',action:'maskieren'}]],['unknown',[{id:'other',action:'maskieren'}]]]) test(`choices reject ${label}`,async()=>{let n=0;await assert.rejects(()=>requestKiTask('b2c-draft',{},taskDeps({fetchImpl:async()=>{n++;return response({code:'KI_RUECKFRAGE',challenge:challenge()},409);},zeigeKiRueckfrageDialog:async()=>({choices})})),{code:'KI_CHOICES_INVALID'});assert.equal(n,1);});
test('missing fresh token blocks retry',async()=>{let n=0,t=0;await assert.rejects(()=>requestKiTask('b2c-draft',{},taskDeps({getToken:async()=>++t===1?'synthetic':null,fetchImpl:async()=>{n++;return response({code:'KI_RUECKFRAGE',challenge:challenge()},409);},zeigeKiRueckfrageDialog:async()=>({choices:[{id:'p1',action:'maskieren'}]})})),{code:'KI_AUTH_REQUIRED'});assert.equal(n,1);});
test('edit while getting fresh token blocks retry',async()=>{let n=0,t=0,dirty=false;await assert.rejects(()=>requestKiTask('b2c-draft',{},taskDeps({getToken:async()=>{if(++t===2)dirty=true;return 'synthetic';},isSourceEdited:()=>dirty,fetchImpl:async()=>{n++;return response({code:'KI_RUECKFRAGE',challenge:challenge()},409);},zeigeKiRueckfrageDialog:async()=>({choices:[{id:'p1',action:'maskieren'}]})})),{code:'KI_SOURCE_EDITED'});assert.equal(n,1);});
test('jeton opens the same masking challenge as direkt',async()=>{let opened=0;await assert.rejects(()=>requestKiTask('b2c-draft',{},taskDeps({getKiConfig:async()=>({...state,mode:'jeton'}),fetchImpl:async()=>response({code:'KI_RUECKFRAGE',challenge:challenge()},409),zeigeKiRueckfrageDialog:async()=>{opened++;return null;}})),{code:'KI_RUECKFRAGE_ABGEBROCHEN'});assert.equal(opened,1);});
test('source guard remembers edit then undo and programmatic changes, cleans listeners',()=>{const field=new EventTarget();field.value='first';const guard=createKiSourceGuard([field]);field.value='next';assert.equal(guard.isSourceEdited(),true);field.value='first';field.dispatchEvent(new Event('input'));assert.equal(guard.isSourceEdited(),true);guard.dispose();});
test('challenge strict bounds and expiry',()=>{const c=challenge();assert.equal(validateKiChallenge(c),true);for(const patch of [{expiresAt:Date.now()-1},{expiresAt:Date.now()+600000},{candidates:[...c.candidates,...c.candidates]},{challengeId:null}])assert.equal(validateKiChallenge({...c,...patch}),false);});

for (const [patch, code] of [
  [{mode:'aus'}, 'KI_DEAKTIVIERT'],
  [{operatorReady:false,active:false}, 'KI_BETREIBER_FREIGABE_FEHLT'],
  [{ownerActive:false,active:false}, 'KI_EINWILLIGUNG_FEHLT'],
  [{mailReady:false,capabilities:{freeText:true,mailDraft:false}}, 'KI_MAIL_NICHT_FREIGEGEBEN'],
  [{capabilities:{freeText:false,mailDraft:true}}, 'KI_FREITEXT_NICHT_FREIGEGEBEN'],
]) test(`mail status explains gate without exposing server reason: ${code}`,async()=>{
  const cfg=await getKiConfig({getToken:async()=>'synthetic',fetchImpl:async()=>response({...wire,...patch,disabledReason:'PRIVATE_SENTINEL'})});
  assert.equal(cfg.disabledReason,code);
  assert.ok(cfg.disabledReasonText.length>20);
  assert.ok(!JSON.stringify(cfg).includes('PRIVATE_SENTINEL'));
  assert.equal(cfg.capabilities.mailDraft,false);
});
test('invalid success response cannot advertise active mail',async()=>{
  const cfg=await getKiConfig({getToken:async()=>'synthetic',fetchImpl:async()=>response({...wire,success:false,disabledReason:'PRIVATE_SENTINEL'})});
  assert.equal(cfg.effective,false);
  assert.equal(cfg.capabilities.mailDraft,false);
  assert.ok(!JSON.stringify(cfg).includes('PRIVATE_SENTINEL'));
});

function controlsFixture() {
  const nodes=[];
  function node() {
    const el={id:'',style:{},children:[],listeners:{},attrs:{},disabled:false,
      setAttribute(k,v){this.attrs[k]=v;},
      addEventListener(k,fn){this.listeners[k]=fn;},
      appendChild(child){this.children.push(child);},
      insertBefore(child){this.children.push(child);},
      click(){this.listeners.click?.();},
    };
    Object.defineProperty(el,'textContent',{get(){return this.text || '';},set(v){this.text=v;this.children=[];}});
    nodes.push(el);return el;
  }
  const doc={getElementById:id=>nodes.find(n=>n.id===id),createElement:node,querySelector:()=>settings};
  const settings=node();let opened=0;settings.listeners.click=()=>opened++;
  for(const prefix of ['', 'b2c']) {
    const parent=node(), row=node();row.parentElement=parent;
    for(const suffix of ['Input','SendBtn','VoiceBtn']) {
      const el=node();el.id=prefix ? `${prefix}Ai${suffix}` : `ai${suffix}`;el.parentElement=row;
    }
  }
  return {doc,opened:()=>opened};
}
test('controls show accessible gate reason, settings action and clear stale status when ready',async()=>{
  const {doc,opened}=controlsFixture();
  const deps={document:doc,getToken:async()=>'synthetic',fetchImpl:async()=>response({...wire,ownerActive:false,active:false})};
  await refreshKiControls(deps);
  for(const id of ['aiInput','b2cAiInput']) {
    const input=doc.getElementById(id),status=doc.getElementById(`${id}Status`);
    assert.equal(input.disabled,true);
    assert.equal(status.attrs.role,'status');
    assert.equal(input.attrs['aria-describedby'],status.id);
    assert.match(status.textContent,/Einwilligung/);
    status.children[0].click();
  }
  assert.equal(opened(),2);
  await refreshKiControls({...deps,fetchImpl:async()=>response(wire)});
  for(const id of ['aiInput','b2cAiInput']) {
    assert.equal(doc.getElementById(id).disabled,false);
    const status=doc.getElementById(`${id}Status`);
    assert.match(status.textContent,/bereit/);
    assert.equal(status.children.length,0);
  }
});
test('late refresh cannot re-enable controls after newer disabled result',async()=>{
  const {doc}=controlsFixture();let finish,started;
  const waiting=new Promise(r=>{started=r;});
  const deps={document:doc,getToken:async()=>'synthetic'};
  const old=refreshKiControls({...deps,fetchImpl:async()=>{started();return new Promise(r=>{finish=r;});}});
  await waiting;
  await refreshKiControls({...deps,fetchImpl:async()=>response({...wire,ownerActive:false,active:false})});
  finish(response(wire));await old;
  assert.equal(doc.getElementById('aiInput').disabled,true);
  assert.match(doc.getElementById('aiInputStatus').textContent,/Einwilligung/);
});
