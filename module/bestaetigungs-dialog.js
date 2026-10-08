/** Existing confirm modal, including cancellation through generic close/Escape. */
const active=new WeakMap();
export function zeigeBestaetigungsDialog({title='Bestätigen',message='',confirmText='Bestätigen',
  cancelText='Abbrechen',variant='primary'}={},deps={}) {
  const doc=deps.document || globalThis.document;
  const Observer=deps.MutationObserver || globalThis.MutationObserver;
  const modal=doc.getElementById('confirmModal');
  active.get(modal)?.(false);
  return new Promise(resolve=>{
    const titleEl=doc.getElementById('confirmModalTitle');
    const textEl=doc.getElementById('confirmModalText');
    const ok=doc.getElementById('confirmModalOk');
    const cancel=doc.getElementById('confirmModalCancel');
    const close=doc.querySelector('#confirmModal .modal-close');
    titleEl.innerHTML=title;textEl.textContent=message;
    ok.textContent=confirmText;cancel.textContent=cancelText;
    ok.className=variant==='danger'?'btn-danger':'btn-primary';
    let done=false;
    const observer=new Observer(()=>{if(modal.hidden) cleanup(false);});
    const cleanup=value=>{
      if(done) return;done=true;observer.disconnect();active.delete(modal);
      ok.onclick=cancel.onclick=close.onclick=null;
      deps.closeModal('confirmModal');resolve(value);
    };
    active.set(modal,cleanup);
    ok.onclick=()=>cleanup(true);cancel.onclick=close.onclick=()=>cleanup(false);
    deps.openModal('confirmModal');
    observer.observe(modal,{attributes:true,attributeFilter:['hidden']});
  });
}
