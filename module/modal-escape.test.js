import test from 'node:test';
import assert from 'node:assert/strict';
import { installiereModalEscape } from './modal-escape.js';

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
