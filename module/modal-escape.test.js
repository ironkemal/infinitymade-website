import test from 'node:test';
import assert from 'node:assert/strict';
import { installiereModalEscape, installiereModalFokus } from './modal-escape.js';

function fixture({modals=[],panelOpen=false}={}) {
  const listeners=new Map(),closed=[];
  const root={
    addEventListener(type,listener){
      if(!listeners.has(type)) listeners.set(type,new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type,listener){listeners.get(type)?.delete(listener);},
    querySelectorAll(selector){assert.equal(selector,'.modal-overlay');return modals;},
  };
  const teardown=installiereModalEscape({root,closeModal:id=>closed.push(id),istSeitenpanelOffen:()=>panelOpen});
  const key=value=>{for(const listener of [...(listeners.get('keydown') || [])]) listener({key:value});};
  return {root,listeners,closed,key,teardown};
}

test('Escape closes last visible dialog and preserves underlying dialog and side panel',()=>{
  const f=fixture({modals:[{id:'rezeptModal',hidden:false},{id:'confirmModal',hidden:false}],panelOpen:true});
  f.key('Escape');assert.deepEqual(f.closed,['confirmModal']);f.teardown();
});

test('Escape skips hidden dialogs before and after visible dialog',()=>{
  const f=fixture({modals:[{id:'hidden-before',hidden:true},{id:'rezeptModal',hidden:false},{id:'hidden-after',hidden:true}]});
  f.key('Escape');assert.deepEqual(f.closed,['rezeptModal']);f.teardown();
});

test('Repeated Escape follows current nested-dialog visibility',()=>{
  const recipe={id:'rezeptModal',hidden:false},confirmation={id:'confirmModal',hidden:false};
  const f=fixture({modals:[recipe,confirmation]});
  f.key('Escape');confirmation.hidden=true;f.key('Escape');recipe.hidden=true;f.key('Escape');
  assert.deepEqual(f.closed,['confirmModal','rezeptModal']);f.teardown();
});

test('Escape closes side panel only when no dialog is visible',()=>{
  const f=fixture({modals:[{id:'hidden-dialog',hidden:true}],panelOpen:true});
  f.key('Escape');assert.deepEqual(f.closed,['bkActionModal']);f.teardown();
});

test('Escape with no visible dialog and closed side panel does nothing',()=>{
  for(const modals of [[],[{id:'hidden-dialog',hidden:true}]]) {
    const f=fixture({modals});f.key('Escape');assert.deepEqual(f.closed,[]);f.teardown();
  }
});

test('Other keys never close dialog or side panel',()=>{
  const f=fixture({modals:[{id:'confirmModal',hidden:false}],panelOpen:true});
  for(const value of ['Enter','Tab','Esc','escape','ArrowLeft','']) f.key(value);
  assert.deepEqual(f.closed,[]);f.teardown();
});

test('Teardown removes own listener and preserves unrelated key handler',()=>{
  const f=fixture({modals:[{id:'confirmModal',hidden:false}],panelOpen:true});
  let otherCalls=0;const other=()=>{otherCalls++;};f.root.addEventListener('keydown',other);
  assert.equal(f.listeners.get('keydown').size,2);
  f.teardown();f.teardown();f.key('Escape');
  assert.equal(f.listeners.get('keydown').size,1);assert.equal(otherCalls,1);assert.deepEqual(f.closed,[]);
});

function fokusFixture() {
  let notify, listener, disconnected=false;
  const attrs={};
  const root={body:{},activeElement:null};
  const el=(id,{hidden=false,disabled=false}={})=>({id,isConnected:true,hidden,disabled,tabIndex:0,
    closest(){return this.hidden?{}:null;},getClientRects(){return this.hidden?[]:[{}];},
    matches(){return this.disabled;},focus(){root.activeElement=this;}});
  const launch=el('launch'),fallback=el('fallback'),name=el('name'),last=el('last'),hidden=el('hidden',{hidden:true}),disabled=el('disabled',{disabled:true});
  const targets=[name,hidden,disabled,last];
  const modal={id:'modal',hidden:true,contains:target=>targets.includes(target),
    querySelectorAll:()=>targets,querySelector:()=>({setAttribute:(k,v)=>{attrs[k]=v;}}),
    addEventListener:(k,f)=>{listener=f;},removeEventListener:()=>{listener=null;}};
  const nested={id:'nested',hidden:true};
  root.getElementById=id=>({modal,name,fallback,modalTitle:{}}[id]);
  root.querySelectorAll=()=>[modal,nested];root.activeElement=launch;
  class Observer {constructor(fn){notify=fn;}observe(){}disconnect(){disconnected=true;}}
  const teardown=installiereModalFokus({root,id:'modal',startId:'name',rueckfallId:'fallback',Observer});
  const key=shiftKey=>{let prevented=false;listener({key:'Tab',shiftKey,preventDefault(){prevented=true;}});return prevented;};
  return {root,modal,nested,launch,name,last,fallback,attrs,key,teardown,get disconnected(){return disconnected;},
    open(){modal.hidden=false;notify();},close(){modal.hidden=true;notify();}};
}

test('Modal focus opens on field, wraps only visible enabled controls and returns to launcher',()=>{
  const f=fokusFixture();f.open();assert.equal(f.root.activeElement,f.name);
  assert.deepEqual(f.attrs,{role:'dialog','aria-modal':'true','aria-labelledby':'modalTitle'});
  assert.equal(f.key(true),true);assert.equal(f.root.activeElement,f.last);
  assert.equal(f.key(false),true);assert.equal(f.root.activeElement,f.name);
  assert.equal(f.key(false),false);f.close();assert.equal(f.root.activeElement,f.launch);
  f.teardown();assert.equal(f.disconnected,true);
});

test('Modal focus falls back when launcher is removed and does not steal focus from another destination',()=>{
  const f=fokusFixture();f.open();f.launch.isConnected=false;f.close();assert.equal(f.root.activeElement,f.fallback);
  f.launch.isConnected=true;f.root.activeElement=f.launch;f.open();f.root.activeElement=f.fallback;f.close();
  assert.equal(f.root.activeElement,f.fallback);
});

test('Underlying modal never wraps Tab while nested modal is visible',()=>{
  const f=fokusFixture();f.open();f.nested.hidden=false;f.root.activeElement=f.last;
  assert.equal(f.key(false),false);assert.equal(f.root.activeElement,f.last);
});

test('Missing modal installs no observer',()=>{
  const teardown=installiereModalFokus({root:{getElementById:()=>null},id:'absent',Observer:class {constructor(){throw Error('observer');}}});
  assert.equal(typeof teardown,'function');teardown();
});
