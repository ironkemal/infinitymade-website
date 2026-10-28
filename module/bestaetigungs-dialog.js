/** Existing confirm modal. Optional extra action returns 'zusatz'; legacy calls stay boolean. */
const active=new WeakMap();
export function zeigeBestaetigungsDialog({title='Bestätigen',message='',confirmText='Bestätigen',
  cancelText='Abbrechen',variant='primary',zusatzText=null,fokusBinden=false}={},deps={}) {
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
    const vorher=doc.activeElement;
    const fokusTaste=e=>{
      if(e.key!=='Tab') return;
      const knoepfe=[close,extra,cancel,ok].filter(el=>el&&!el.hidden&&!el.disabled);
      const index=knoepfe.indexOf(doc.activeElement);
      e.preventDefault();
      knoepfe[(index+(e.shiftKey?-1:1)+knoepfe.length)%knoepfe.length]?.focus();
    };
    titleEl.innerHTML=title;textEl.textContent=message;
    ok.textContent=confirmText;cancel.textContent=cancelText;
    cancel.hidden=cancelText===null;
    ok.className=variant==='danger'?'btn-danger':'btn-primary';
    let extra=null;
    if(zusatzText) {
      extra=doc.createElement('button');extra.type='button';extra.className='btn-outline-sm';
      extra.dataset && (extra.dataset.confirmZusatz='true');extra.textContent=zusatzText;cancel.before(extra);
    }
    let done=false;
    const observer=new Observer(()=>{if(modal.hidden) cleanup(false);});
    const cleanup=value=>{
      if(done) return;done=true;observer.disconnect();active.delete(modal);
      ok.onclick=cancel.onclick=close.onclick=null;
      if(fokusBinden) { modal.removeEventListener('keydown',fokusTaste);delete modal.dataset.abschluss; }
      if(extra) { extra.onclick=null;extra.remove(); } cancel.hidden=false;
      deps.closeModal('confirmModal');
      if(fokusBinden&&vorher?.isConnected) vorher.focus();
      resolve(value);
    };
    active.set(modal,cleanup);
    ok.onclick=()=>cleanup(true);cancel.onclick=close.onclick=()=>cleanup(false);
    if(extra) extra.onclick=()=>cleanup('zusatz');
    deps.openModal('confirmModal');
    if(fokusBinden) { modal.dataset.abschluss='true';modal.addEventListener('keydown',fokusTaste);ok.focus(); }
    observer.observe(modal,{attributes:true,attributeFilter:['hidden']});
  });
}
