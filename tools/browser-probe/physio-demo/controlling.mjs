/** Browser-local synthetic status overview. No prices, queries, or billing clearance. */
import {aktiveSitzungszeilen} from '../../../module/sitzung-aktiv.js';
import {physioZaehler} from '../../../module/verordnung-uebersicht.js';

const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const LABELS={verordnungen:'Gespeicherte Physio-Verordnungen',bereit:'Davon Status „bereit“',sitzungen:'Aktive Sitzungszeilen',erbracht:'Davon dokumentiert',geplant:'Davon geplant',ungebunden:'Geplant ohne Termin'};
const ABRECHNUNG=new Set([null,'bereit','in_abrechnung','gesendet','accepted','rejected','paid','teilabsetzung','storniert','archiviert']);
const STATUS=new Set(['parsed','confirmed','in_therapy','completed','billed','cancelled']);
const scopeKey=k=>JSON.stringify([k?.rolle,k?.uid,k?.ownerId,k?.businessId,k?.patientsGemeinsam,k?.bereit]);
const scopeOk=k=>k?.bereit===true&&k.rolle==='owner'&&UUID.test(k.uid||'')&&k.uid===k.ownerId&&typeof k.patientsGemeinsam==='boolean'&&(k.businessId===null||UUID.test(k.businessId||''));
const leer=(status='unbekannt')=>({status,gesamtCent:null,zaehler:Object.fromEntries(Object.keys(LABELS).map(key=>[key,{anzahl:null,bekanntAnzahl:0,unbekanntAnzahl:1}])),gruende:['QUELLE_ODER_SCOPE_UNBEKANNT']});

/** Existing parent/patient scope; missing sources never mean zero. Counts are session rows, not treatment days. */
export function berechneDemoControlling(input={}) {
  const k=input.kontext;
  if(k?.rolle==='employee')return {status:'gesperrt',gesamtCent:null};
  if(!scopeOk(k))return leer();
  const tabellen=input.tabellen;
  if(!tabellen||['leads','prescriptions','prescription_sessions','bookings'].some(key=>!Array.isArray(tabellen[key])))return leer();
  const result=leer('ok');result.gruende=[];
  for(const c of Object.values(result.zaehler)){c.anzahl=0;c.unbekanntAnzahl=0;}
  const unklar=(keys,grund)=>{for(const key of keys){const c=result.zaehler[key];c.anzahl=null;c.unbekanntAnzahl++;}if(!result.gruende.includes(grund))result.gruende.push(grund);};
  const add=key=>{const c=result.zaehler[key];c.bekanntAnzahl++;if(c.anzahl!==null)c.anzahl++;};
  // Historical synthetic seed IDs are local identifiers, not production UUID validation evidence.
  const index=rows=>{const m=new Map();for(const row of rows){if(!row||typeof row.id!=='string'||!row.id)continue;m.set(row.id,m.has(row.id)?null:row);}return m;};
  const patients=index(tabellen.leads),parents=index(tabellen.prescriptions),bookings=index(tabellen.bookings),sessions=index(tabellen.prescription_sessions);
  const sessionKeys=['sitzungen','erbracht','geplant','ungebunden'];
  const erlaubt=p=>k.patientsGemeinsam||k.businessId===null||p.business_id===null||p.business_id===k.businessId;
  for(const rx of tabellen.prescriptions){
    if(rx?.owner_id!==k.ownerId)continue;
    if(rx.therapie_bereich&&rx.therapie_bereich!=='physio')continue;
    const patient=patients.get(rx.patient_id);
    if(!patient||patient.owner_id!==k.ownerId||(patient.business_id!==null&&!UUID.test(patient.business_id||''))||parents.get(rx.id)!==rx||rx.therapie_bereich!=='physio'){
      unklar(Object.keys(LABELS),'PATIENT_ODER_VERORDNUNGSZUORDNUNG_UNBEKANNT');continue;
    }
    if(!erlaubt(patient))continue;
    add('verordnungen');
    if(!STATUS.has(rx.status)||!ABRECHNUNG.has(rx.abrechnung_status))unklar(['bereit'],'REZEPTSTATUS_UNBEKANNT');
    else if(rx.abrechnung_status==='bereit')add('bereit');
    if(!Number.isSafeInteger(rx.anzahl_einheiten)||rx.anzahl_einheiten<1){unklar(sessionKeys,'SITZUNGSMENGE_UNBEKANNT');continue;}
    const valid=[];
    for(const s of tabellen.prescription_sessions.filter(s=>s?.prescription_id===rx.id)){
      const booking=s.booking_id?bookings.get(s.booking_id):null;
      if(sessions.get(s.id)!==s||!['planned','done','completed','cancelled'].includes(s.status)||!Number.isSafeInteger(s.session_number)||s.session_number<1||s.session_number>rx.anzahl_einheiten
        ||!Object.hasOwn(s,'booking_id')||(s.booking_id!==null&&(!booking||booking.owner_id!==k.ownerId||booking.lead_id!==rx.patient_id||(booking.business_id!==null&&!UUID.test(booking.business_id||''))||!erlaubt(booking)))
        ||(s.heilmittel_index!==0&&s.heilmittel_index!==null)){
        unklar(sessionKeys,'SITZUNGSZUORDNUNG_UNBEKANNT');continue;
      }
      valid.push({...s,bookings:booking});
    }
    const aktive=aktiveSitzungszeilen(valid);
    // Existing counter only after explicit quantity validation, never its fallback denominator.
    const count=physioZaehler({...rx,prescription_sessions:aktive});
    for(const s of aktive){add('sitzungen');if(s.status==='planned'){add('geplant');if(s.booking_id===null)add('ungebunden');}}
    for(let n=0;n<count.erbracht;n++)add('erbracht');
  }
  // Unattributable rows make completeness unknown; no orphan or foreign-owner count is exposed.
  if(tabellen.prescription_sessions.some(s=>!s||!parents.get(s.prescription_id)))unklar(sessionKeys,'SITZUNGSQUELLE_UNVOLLSTAENDIG');
  if(result.gruende.length)result.status='teilweise';
  return result;
}

/** Auth/profile plus context checked on both sides of await. Employee gate precedes store access. */
export async function ladeDemoControlling({kontext,demo,timeoutMs=5000}) {
  const k=kontext();
  if(k?.rolle==='employee')return {status:'gesperrt',gesamtCent:null};
  if(!scopeOk(k))return leer();
  const key=scopeKey(k);
  let timer;
  try{
    const source=demo();
    const auth=await Promise.race([source.client.auth.getUser(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('DEMO_AUTH_TIMEOUT')),timeoutMs);})]);
    if(key!==scopeKey(kontext())||auth.error||auth.data?.user?.id!==k.uid||source.speicherFehler)return leer();
    const profile=source.tabellen.profiles?.find(p=>p.id===k.uid);
    if(profile?.role!=='owner'||profile.owner_id||profile.is_active===false)return leer();
    const tabellen=structuredClone(Object.fromEntries(['leads','prescriptions','prescription_sessions','bookings'].map(t=>[t,source.tabellen[t]])));
    if(key!==scopeKey(kontext()))return leer();
    return berechneDemoControlling({tabellen,kontext:k});
  }catch{return leer();}finally{clearTimeout(timer);}
}

export function demoControllingHtml(state,{id='demoControllingTitel'}={}) {
  if(state?.status==='gesperrt')return '';
  const rows=Object.entries(LABELS).map(([key,label])=>{
    const z=state?.zaehler?.[key];const text=Number.isSafeInteger(z?.anzahl)?String(z.anzahl):z?.bekanntAnzahl>0?`Teilmenge ${z.bekanntAnzahl} · weitere unbekannt`:'Unbekannt';
    return `<dt>${label}</dt><dd style="margin:0;text-align:right;font-variant-numeric:tabular-nums">${text}</dd>`;
  }).join('');
  return `<div class="px-karte-kopf"><div><h2 id="${id}">Rezept- und Sitzungsübersicht</h2><p>Aktueller Patientenbereich · nur lokale Testpraxis</p></div></div><div style="padding:0 20px 20px"><dl style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px 16px;margin:0">${rows}</dl><p class="px-geld-fuss">Betrag unbekannt – keine Berechnung. Status „bereit“ ist keine Versandfreigabe. Sitzungszeilen sind keine Behandlungstage.</p>${state?.status!=='ok'?'<p role="status">Quellen oder Zuordnungen unvollständig. Unbekannt bedeutet nicht null Fälle.</p>':''}<button type="button" class="btn-ghost" data-demo-controlling-refresh style="min-height:44px">Übersicht aktualisieren</button></div>`;
}

export function montiereDemoControlling({window:win,document:doc,kontext,demo}) {
  let state=leer(),key='',lauf=0,targets=[],stopped=false;
  const paint=()=>{
    for(const [n,target] of targets.entries()){
      const html=demoControllingHtml(state,{id:n?'demoControllingAbrechnungTitel':'demoControllingOverviewTitel'});
      target.setAttribute('aria-labelledby',n?'demoControllingAbrechnungTitel':'demoControllingOverviewTitel');
      target.hidden=state.status==='gesperrt';
      if(target.innerHTML!==html){const focus=target.contains(doc.activeElement)&&doc.activeElement?.hasAttribute('data-demo-controlling-refresh');target.innerHTML=html;if(focus)target.querySelector('[data-demo-controlling-refresh]')?.focus({preventScroll:true});}
    }
  };
  const refresh=async()=>{const nr=++lauf;state=kontext()?.rolle==='employee'?{status:'gesperrt'}:leer();paint();const data=await ladeDemoControlling({kontext,demo});if(nr!==lauf)return;state=data;paint();};
  const tick=()=>{
    if(stopped)return;
    const k=kontext(),next=scopeKey(k),overview=doc.querySelector('#panel-overview .px-k-geld'),panel=doc.getElementById('panel-abrechnung');
    let billing=panel?.querySelector('[data-demo-controlling]');
    if(panel&&!billing&&k?.rolle==='owner'){billing=doc.createElement('section');billing.className='card';billing.dataset.demoControlling='';panel.prepend(billing);}
    const nextTargets=[overview,billing].filter(Boolean);
    const changed=next!==key;const replaced=nextTargets.some((t,n)=>t!==targets[n])||nextTargets.length!==targets.length;
    targets=nextTargets;
    if(changed){key=next;state=k?.rolle==='employee'?{status:'gesperrt'}:leer();paint();void refresh();}
    else if(replaced||targets.some(t=>state.status!=='gesperrt'&&!t.querySelector('[data-demo-controlling-refresh]')))paint();
    win.requestAnimationFrame(tick);
  };
  const click=e=>{if(e.target.closest('[data-demo-controlling-refresh]'))void refresh();};
  doc.addEventListener('click',click);win.addEventListener('physio-demo:changed',refresh);tick();
  return ()=>{stopped=true;lauf++;doc.removeEventListener('click',click);win.removeEventListener('physio-demo:changed',refresh);};
}

if(typeof window!=='undefined'&&typeof document!=='undefined')window.addEventListener('DOMContentLoaded',()=>{
  montiereDemoControlling({window,document,kontext:()=>window.__physioControllingKontext?.(),demo:()=>window.__lokaleTestpraxis});
});
