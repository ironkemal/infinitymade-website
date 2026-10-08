/** Paper remains authoritative. One review inside the existing recipe mask. */
let state = null;
let teardown = null;
const g=id=>document.getElementById(id);
const critical=['rzDg','rzIcd','rzIcd2','rzHm','rzHmPosition','rzAnzahl','rzAusstDate','rzHausbesuch'];

export function entferneBarcodeBestaetigung() {
  teardown?.(); teardown=null; state=null;
  if(typeof document!=='undefined') g('rzBarcodeBestaetigungWrap')?.remove();
}
export function istBarcodeAktiv() {return !!state;}
export function markiereBarcodeMaskeVeraendert() {
  if(!state) return;
  state.korrigiert=true; state.bestaetigt=false;
  const cb=g('rzBarcodeBestaetigt'); if(cb) cb.checked=false;
}
export function barcodeErfassung() {
  return state ? {quelle:state.korrigiert?'barcode+korrigiert':'barcode',format:'PDF417',
    parser_version:'KBV-BFB-4.80-M13-10',bestaetigt:state.bestaetigt} : null;
}
export function pruefeBarcodeBestaetigung() {
  if(!state) return null;
  state.check?.();
  if(!state.bestaetigt) throw new Error('Bitte Angaben mit dem Papierrezept vergleichen und bestätigen.');
  return barcodeErfassung();
}

export function mountBarcodeBestaetigung({container,parsed={},hinweise=[],korrigiert=false}={}) {
  entferneBarcodeBestaetigung();
  const root=container || g('rzMaskeWrap');
  if(!root) throw new Error('Rezeptmaske nicht verfügbar.');
  state={korrigiert:!!korrigiert,bestaetigt:false};
  const wrap=document.createElement('section'); wrap.id='rzBarcodeBestaetigungWrap';
  wrap.style.cssText='padding:14px;margin-bottom:14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-card-solid);color:var(--text-main);';
  const title=document.createElement('strong'); title.textContent='Barcode gelesen — mit Papierrezept vergleichen';wrap.append(title);
  const fields=document.createElement('div');
  fields.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:12px;padding:14px 0;';
  const values=[];
  for(const label of ['Diagnosegruppe','ICD-10','Heilmittel / Anzahl','Ausstellungsdatum','Hausbesuch']) {
    const cell=document.createElement('div'); cell.style.cssText='min-width:0;overflow-wrap:anywhere;';
    const name=document.createElement('div'); name.textContent=label; name.style.cssText='font-size:12px;color:var(--text-muted);';
    const value=document.createElement('strong'); value.style.fontSize='16px';
    cell.append(name,value);fields.append(cell);values.push(value);
  }
  wrap.append(fields);
  for(const text of [...hinweise,'Barcode enthält keine Anschrift oder Unterschrift. Fehlende Angaben bitte am Papier prüfen.',
    'Handschriftliche Korrekturen benötigen Arztunterschrift und Datum auf dem Original.']) {
    const p=document.createElement('p');p.textContent=text;p.style.cssText='font-size:13px;color:var(--text-muted);';wrap.append(p);
  }
  function checkbox(id,text) {
    const label=document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer;';
    const input=document.createElement('input');input.type='checkbox';input.id=id;
    const caption=document.createElement('span');caption.textContent=text;label.append(input,caption);wrap.append(label);return input;
  }
  const hand=checkbox('rzBarcodePapierGeaendert','Papier handschriftlich geändert?');
  const confirm=checkbox('rzBarcodeBestaetigt','Angaben mit Papier verglichen');
  const p=parsed.rezept || {}, a=parsed.arzt || {};
  const initial={rzDg:p.diagnosegruppe,rzIcd:p.icd10,rzIcd2:p.icd10_2,rzHm:p.heilmittel,
    rzAnzahl:p.anzahl_einheiten,rzAusstDate:a.ausstellungsdatum,rzHausbesuch:p.hausbesuch};
  const val=id=>g(id) ? (id==='rzHausbesuch'?g(id).checked:g(id).value) : initial[id];
  const snapshot=()=>[
    ...critical.map(id=>id==='rzHausbesuch' ? !!val(id) : String(val(id) ?? '')),
    ...Array.from(root.querySelectorAll('input,select,textarea'))
      .filter(el=>!wrap.contains(el))
      .map(el=>[el.id,el.value,el.checked]),
  ];
  let accepted=null;
  let previous=snapshot();
  function refresh() {
    values[0].textContent=val('rzDg') || 'Bitte ergänzen';
    values[1].textContent=[val('rzIcd'),val('rzIcd2')].filter(Boolean).join(', ') || 'Bitte ergänzen';
    values[2].textContent=`${val('rzHm') || 'Bitte wählen'} · ${val('rzAnzahl') || '—'} Einheiten`;
    values[3].textContent=val('rzAusstDate') || 'Bitte ergänzen';
    values[4].textContent=val('rzHausbesuch') ? 'Ja' : 'Nein';
  }
  function changed(event) {
    if(wrap.contains(event.target)) return;
    markiereBarcodeMaskeVeraendert();accepted=null;previous=snapshot();refresh();
  }
  hand.addEventListener('change',()=>{markiereBarcodeMaskeVeraendert();accepted=null;});
  confirm.addEventListener('change',()=>{
    const selected=confirm.checked;
    check();
    confirm.checked=selected;state.bestaetigt=selected;accepted=selected?snapshot():null;
  });
  root.addEventListener('input',changed);root.addEventListener('change',changed);
  // Catalogue choices may change hidden position values without firing input.
  const check=()=>{
    const current=snapshot();
    if(JSON.stringify(current)!==JSON.stringify(previous)
      || (accepted && JSON.stringify(current)!==JSON.stringify(accepted))) {
      markiereBarcodeMaskeVeraendert();accepted=null;
    }
    previous=current;
    refresh();
  };
  const timer=setInterval(check,200);
  teardown=()=>{clearInterval(timer);root.removeEventListener('input',changed);root.removeEventListener('change',changed);};
  state.check=check;root.prepend(wrap);refresh();return wrap;
}
