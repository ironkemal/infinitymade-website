/** One save run owns one unchanged mask, including patient and paper review. */
export function beginRezeptSpeicherlauf(root) {
  if(!root) throw new Error('Rezeptmaske nicht verfügbar.');
  const fields=()=>Array.from(root.querySelectorAll('input,select,textarea'));
  const parent=root.parentElement;
  const modal=root.closest?.('.modal-overlay');
  const hidden=modal?.hidden;
  const snapshot=()=>JSON.stringify([
    root.dataset.rezeptart,
    fields().map(el=>[el.id,el.value,el.checked,
      el.type==='file'?Array.from(el.files || []).map(f=>[f.name,f.size,f.lastModified]):null]),
    Array.from(root.querySelectorAll('.m13-chk')).map(el=>el.className),
  ]);
  const before=snapshot();
  const controls=Array.from(root.querySelectorAll('input,select,textarea,button'));
  const previous=controls.map(el=>({el,disabled:el.disabled,readOnly:el.readOnly}));
  const inert=root.inert;
  controls.forEach(el=>{el.disabled=true;});root.inert=true;
  let released=false;
  return {
    pruefe() {
      if(released || root.isConnected===false || root.parentElement!==parent
        || modal?.hidden!==hidden || snapshot()!==before) {
        throw new Error('Angaben während des Speicherns geändert. Bitte erneut prüfen und speichern.');
      }
    },
    freigeben() {
      if(released) return;
      for(const {el,disabled,readOnly} of previous) {
        el.disabled=disabled;
        if(readOnly!==undefined) el.readOnly=readOnly;
      }
      root.inert=inert;released=true;
    },
  };
}
