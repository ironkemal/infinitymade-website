import test from 'node:test';
import assert from 'node:assert/strict';
import { zeigeBestaetigungsDialog } from './bestaetigungs-dialog.js';

function fixture() {
  const subscriptions=new Set(), observers=[];
  let hidden=true;
  const modal={get hidden(){return hidden;},set hidden(value){
    hidden=value;
    for(const observer of [...subscriptions]) queueMicrotask(()=>{
      if(subscriptions.has(observer)) observer.callback([{attributeName:'hidden',target:modal}]);
    });
  }};
  const ids=['confirmModalTitle','confirmModalText','confirmModalOk','confirmModalCancel'];
  const elements=new Map(ids.map(id=>[id,{onclick:null,textContent:'',innerHTML:'',className:''}]));
  elements.set('confirmModal',modal);
  const close={onclick:null};
  class Observer {
    constructor(callback){this.callback=callback;this.disconnected=0;observers.push(this);}
    observe(target,options){assert.equal(target,modal);assert.deepEqual(options,{attributes:true,attributeFilter:['hidden']});subscriptions.add(this);}
    disconnect(){this.disconnected++;subscriptions.delete(this);}
  }
  const deps={document:{getElementById:id=>elements.get(id),querySelector:selector=>{
    assert.equal(selector,'#confirmModal .modal-close');return close;
  }},MutationObserver:Observer,
    openModal:id=>{assert.equal(id,'confirmModal');modal.hidden=false;},
    closeModal:id=>{assert.equal(id,'confirmModal');modal.hidden=true;},
  };
  return {modal,elements,close,observers,subscriptions,deps,
    show:options=>zeigeBestaetigungsDialog(options,deps)};
}

function assertClean(f) {
  assert.equal(f.subscriptions.size,0);
  assert.equal(f.elements.get('confirmModalOk').onclick,null);
  assert.equal(f.elements.get('confirmModalCancel').onclick,null);
  assert.equal(f.close.onclick,null);
  assert.ok(f.observers.every(observer=>observer.disconnected===1));
}

test('Generic modal close / Escape resolves false and clears observer/listeners',async()=>{
  const f=fixture();const result=f.show({title:'Synthetic warning'});
  assert.equal(f.modal.hidden,false);assert.equal(f.subscriptions.size,1);
  f.deps.closeModal('confirmModal');
  assert.equal(await result,false);assertClean(f);
});

test('Explicit confirmation resolves true and copies dialog labels',async()=>{
  const f=fixture();const result=f.show({title:'Synthetic',message:'Test message',
    confirmText:'Proceed',cancelText:'Cancel',variant:'danger'});
  assert.equal(f.elements.get('confirmModalTitle').innerHTML,'Synthetic');
  assert.equal(f.elements.get('confirmModalText').textContent,'Test message');
  assert.equal(f.elements.get('confirmModalOk').textContent,'Proceed');
  assert.equal(f.elements.get('confirmModalOk').className,'btn-danger');
  assert.equal(f.elements.get('confirmModalCancel').textContent,'Cancel');
  f.elements.get('confirmModalOk').onclick();
  assert.equal(await result,true);assertClean(f);
});

test('Cancel button and close X each resolve false',async()=>{
  for(const action of ['cancel','close']) {
    const f=fixture();const result=f.show();
    (action==='cancel'?f.elements.get('confirmModalCancel'):f.close).onclick();
    assert.equal(await result,false);assertClean(f);
  }
});

test('Opening another dialog cancels predecessor without removing new listeners',async()=>{
  const f=fixture();const first=f.show({title:'First'});const second=f.show({title:'Second'});
  assert.equal(await first,false);
  assert.equal(f.modal.hidden,false);assert.equal(f.subscriptions.size,1);
  assert.equal(f.elements.get('confirmModalTitle').innerHTML,'Second');
  f.elements.get('confirmModalOk').onclick();
  assert.equal(await second,true);assertClean(f);
});

test('Stale button callback cannot settle twice or close successor',async()=>{
  const f=fixture();const first=f.show();const stale=f.elements.get('confirmModalOk').onclick;
  f.elements.get('confirmModalCancel').onclick();assert.equal(await first,false);
  const second=f.show({title:'Next'});stale();
  assert.equal(f.modal.hidden,false);assert.equal(f.subscriptions.size,1);
  f.elements.get('confirmModalOk').onclick();assert.equal(await second,true);assertClean(f);
});
