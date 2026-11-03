import { brandingAus } from './branding.js?v=20261022q';
import { normalisiereSignatur, signaturHtml, signaturText, pruefeSignatur } from './mail-signatur.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function signaturEinstellungen(p) {
  const x = p?.mail_signatur_einstellungen;
  const vorlagen = Array.isArray(x?.vorlagen) ? x.vorlagen.slice(0,10).map(normalisiereSignatur).filter(Boolean) : [];
  return { vorlagen, standard_id: vorlagen.some(v=>v.id===x?.standard_id) ? x.standard_id : '' };
}
export function importiereMailVorlage(text, id) {
  if (typeof text !== 'string' || text.length > 16000) throw new Error('Vorlagendatei zu groß (maximal 16 KB).');
  const v=JSON.parse(text);
  if (!pruefeSignatur(v) || !v || !v.name?.trim()) throw new Error('Bitte eine strukturierte JSON-Fußzeile mit Vorlagenname wählen.');
  return normalisiereSignatur({...v,id});
}
export function vorlageAusProfil(p, id) {
  const b = brandingAus(p);
  return normalisiereSignatur({ id, name:'Neue Fußzeile', layout:'klassisch', praxis:b.name, kontakt:b.inhaber, adresse:[b.strasse,b.plzOrt].filter(Boolean).join('\n'),telefon:b.telefon,email:b.email,logoUrl:b.logoUrl });
}
/** Structured templates only; preview contains exclusively escaped renderer output. */
export function mountMailSignaturen({config,compose,getProfil,isOwner,speichern,uploadLogo,showToast}) {
  let state, selected='', composeId='', busy=false;
  const fields = {name:'Vorlagenname',praxis:'Praxis',kontakt:'Kontaktperson',adresse:'Anschrift',telefon:'Telefon',email:'E-Mail',website:'Website (https://)',zusatz:'Zusätzlicher Text'};
  const notify = msg => showToast?.(msg,'error');
  function lesen() {
    const old=state.vorlagen.find(v=>v.id===selected); if(!old)return;
    const next={...old}; for(const key of Object.keys(fields))next[key]=config.querySelector(`[data-feld="${key}"]`)?.value||'';
    next.layout=config.querySelector('[data-layout]')?.value||'klassisch';
    state.vorlagen=state.vorlagen.map(v=>v.id===selected?normalisiereSignatur(next):v);
  }
  function vorschau() {
    const v=state.vorlagen.find(v=>v.id===selected);
    config.querySelector('[data-vorschau]').innerHTML=v?signaturHtml(v):'<p>Noch keine Fußzeile angelegt.</p>';
  }
  function composeRender() {
    const stored=signaturEinstellungen(getProfil());
    if(!stored.vorlagen.some(v=>v.id===composeId))composeId='';
    compose.innerHTML=`<label for="mailSignaturAuswahl">Mail-Fußzeile</label><select class="form-select" id="mailSignaturAuswahl"><option value="">Ohne Fußzeile</option>${stored.vorlagen.map(v=>`<option value="${esc(v.id)}" ${v.id===composeId?'selected':''}>${esc(v.name)}</option>`).join('')}</select><div class="mail-signatur-vorschau" data-compose-preview></div><p class="form-hint">Vorlagen bearbeiten: Patientenpost → Konfiguration. Externe Logos können im E-Mail-Programm zunächst ausgeblendet sein.</p>`;
    function update(){const v=stored.vorlagen.find(v=>v.id===composeId);compose.querySelector('[data-compose-preview]').innerHTML=v?signaturHtml(v):'';compose.dataset.signaturText=signaturText(v);}
    compose.querySelector('select').onchange=e=>{composeId=e.target.value;update();};update();
  }
  function render() {
    const v=state.vorlagen.find(v=>v.id===selected), owner=isOwner();
    config.innerHTML=`<h3>Mail-Fußzeilen</h3><p class="form-hint">Eigene Vorlagen mit Logo und Kontaktdaten. Im Mailentwurf auswählen und vor dem Senden prüfen.</p><fieldset ${!owner||busy?'disabled':''}><label for="mailVorlage">Vorlage bearbeiten</label><div class="mail-signatur-aktionen"><select class="form-select" id="mailVorlage"><option value="">Vorlage wählen</option>${state.vorlagen.map(x=>`<option value="${esc(x.id)}" ${selected===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select><button type="button" class="btn-outline-sm" data-neu ${state.vorlagen.length>=10?'disabled':''}>Neue Vorlage</button><label class="btn-outline-sm">Vorlage importieren (JSON)<input type="file" accept="application/json,.json" data-import ${state.vorlagen.length>=10?'disabled':''}></label></div>${v?`<div class="mail-signatur-felder">${Object.entries(fields).map(([key,label])=>`<label>${label}${['adresse','zusatz'].includes(key)?`<textarea class="form-input" data-feld="${key}" rows="2" maxlength="${key==='zusatz'?2000:500}">${esc(v[key])}</textarea>`:`<input class="form-input" data-feld="${key}" value="${esc(v[key])}" maxlength="${({name:80,praxis:160,kontakt:160,telefon:80,email:254,website:500})[key]}" />`}</label>`).join('')}<label>Darstellung<select class="form-select" data-layout><option value="klassisch" ${v.layout==='klassisch'?'selected':''}>Klassisch</option><option value="kompakt" ${v.layout==='kompakt'?'selected':''}>Kompakt</option></select></label></div><div class="mail-signatur-aktionen"><label class="btn-outline-sm">Logo hochladen<input type="file" accept="image/png,image/jpeg,image/webp" data-logo></label><button type="button" class="btn-outline-sm" data-logo-entfernen>Logo entfernen</button><button type="button" class="btn-outline-sm" data-loeschen>Vorlage löschen</button></div><p class="form-hint">PNG, JPG oder WebP, maximal 4 MB. Logo wird öffentlich abrufbar gespeichert; keine Patientendaten hochladen.</p><label><input type="checkbox" data-standard ${state.standard_id===v.id?'checked':''}> Als Standard für neue Mailentwürfe</label>`:''}<p class="form-label">Vorschau der Fußzeile</p><div class="mail-signatur-vorschau" data-vorschau></div><button type="button" class="btn-primary" data-speichern>Fußzeilen speichern</button></fieldset>${!owner?'<p class="form-hint">Vorlagen verwaltet der Praxisinhaber.</p>':''}`;
    config.querySelector('#mailVorlage').onchange=e=>{selected=e.target.value;render();};
    config.querySelector('[data-neu]').onclick=()=>{lesen();const id=globalThis.crypto.randomUUID();state.vorlagen.push(vorlageAusProfil(getProfil(),id));selected=id;render();};
    config.querySelectorAll('[data-feld],[data-layout]').forEach(el=>el.oninput=()=>{lesen();vorschau();});
    config.querySelector('[data-import]').onchange=async e=>{if(!isOwner()||state.vorlagen.length>=10)return;const file=e.target.files?.[0];if(!file)return;try{if(file.size>16000)throw new Error('Vorlagendatei zu groß (maximal 16 KB).');lesen();const v=importiereMailVorlage(await file.text(),globalThis.crypto.randomUUID());state.vorlagen.push(v);selected=v.id;render();}catch(err){notify(err.message||'Vorlagendatei ungültig.');}};
    config.querySelector('[data-standard]')?.addEventListener('change',e=>{state.standard_id=e.target.checked?selected:'';});
    config.querySelector('[data-loeschen]')?.addEventListener('click',()=>{state.vorlagen=state.vorlagen.filter(x=>x.id!==selected);if(state.standard_id===selected)state.standard_id='';selected=state.vorlagen[0]?.id||'';render();});
    config.querySelector('[data-logo-entfernen]')?.addEventListener('click',()=>{lesen();state.vorlagen.find(x=>x.id===selected).logoUrl='';render();});
    config.querySelector('[data-logo]')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;lesen();const target=selected;busy=true;render();try{const url=await uploadLogo(file);const entry=state.vorlagen.find(x=>x.id===target);if(entry)entry.logoUrl=url;}catch(err){notify(err.message||'Logo konnte nicht hochgeladen werden.');}finally{busy=false;render();}});
    config.querySelector('[data-speichern]').onclick=async()=>{if(busy||!isOwner())return;lesen();if(state.vorlagen.some(v=>!v.name.trim())){notify('Bitte jeder Vorlage einen Namen geben.');return;}busy=true;render();try{await speichern(structuredClone(state));showToast?.('Mail-Fußzeilen gespeichert.');composeRender();}catch{notify('Fußzeilen konnten nicht gespeichert werden. Bitte Einrichtung prüfen und erneut versuchen.');}finally{busy=false;render();}};
    vorschau();
  }
  return {oeffnen(){state=signaturEinstellungen(getProfil());selected=state.vorlagen[0]?.id||'';render();},entwurf(){composeId=signaturEinstellungen(getProfil()).standard_id;composeRender();},auswahl(){return signaturEinstellungen(getProfil()).vorlagen.find(v=>v.id===composeId)||null;},text(){return signaturText(this.auswahl());}};
}
