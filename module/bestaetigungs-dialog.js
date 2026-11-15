/** Existing confirm modal, including cancellation through generic close/Escape.
 *  Optional third button (`extraText`, V7.03p): `#confirmModalExtra`, resolves 'extra'.
 *  Without `extraText` (or without the button in the page) everything stays boolean as before. */
const active=new WeakMap();
export function zeigeBestaetigungsDialog({title='Bestätigen',message='',confirmText='Bestätigen',
  cancelText='Abbrechen',variant='primary',extraText='',extraVariant='ghost'}={},deps={}) {
  const doc=deps.document || globalThis.document;
  const Observer=deps.MutationObserver || globalThis.MutationObserver;
  const modal=doc.getElementById('confirmModal');
  active.get(modal)?.(false);
  return new Promise(resolve=>{
    const titleEl=doc.getElementById('confirmModalTitle');
    const textEl=doc.getElementById('confirmModalText');
    const ok=doc.getElementById('confirmModalOk');
    const cancel=doc.getElementById('confirmModalCancel');
    const extra=doc.getElementById('confirmModalExtra') || null;
    const close=doc.querySelector('#confirmModal .modal-close');
    const mitExtra=!!(extraText && extra);
    titleEl.innerHTML=title;textEl.textContent=message;
    ok.textContent=confirmText;cancel.textContent=cancelText;
    ok.className=variant==='danger'?'btn-danger':'btn-primary';
    if(extra) {
      extra.hidden=!mitExtra;extra.textContent=mitExtra?extraText:'';
      extra.className=extraVariant==='primary'?'btn-primary':'btn-ghost';
    }
    // design/seiten.css: Abschlussknöpfe brechen um und bleiben 44 px hoch (nur mit drittem Knopf).
    if(mitExtra&&modal.dataset) modal.dataset.abschluss='true';
    let done=false;
    const observer=new Observer(()=>{if(modal.hidden) cleanup(false);});
    const cleanup=value=>{
      if(done) return;done=true;observer.disconnect();active.delete(modal);
      ok.onclick=cancel.onclick=close.onclick=null;
      if(extra) { extra.onclick=null;extra.hidden=true; }
      if(modal.dataset) delete modal.dataset.abschluss;
      deps.closeModal('confirmModal');resolve(value);
    };
    active.set(modal,cleanup);
    ok.onclick=()=>cleanup(true);cancel.onclick=close.onclick=()=>cleanup(false);
    if(mitExtra) extra.onclick=()=>cleanup('extra');
    deps.openModal('confirmModal');
    observer.observe(modal,{attributes:true,attributeFilter:['hidden']});
  });
}
