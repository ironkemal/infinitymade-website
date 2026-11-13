/** Authgebundener Viewadapter der bestätigten Startgestaltung. Keine Datenabfragen.
 * Nur Renderinseln ersetzen Markup; alle aktuellen Aufgaben/KPI/Gaps/Schedule-Knoten
 * werden mit Rückkehrankern bewegt. Eigentum ihrer Handler bleibt beim Bestand.
 */
import { begruessung, heutigeTermine, alsNaechstes, abstandText, dauerMin, tageszeile, zuErledigen } from './startseite-darstellung.js?v=20261113f601';
import { uhrzeitBerlin } from './termin-heute.js?v=20261004m113';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SVG = (p, w = 18) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  pfeil: SVG('<path d="M9 6l6 6-6 6"/>', 16),
  rechts: SVG('<path d="M5 12h14M13 6l6 6-6 6"/>', 16),
  kalender: SVG('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  akte: SVG('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'),
  haus: SVG('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>', 14),
  warn: SVG('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
  uhr: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  post: SVG('<path d="M4 4h16v16H4z"/><path d="M4 7l8 6 8-6"/>'),
  haken: SVG('<path d="M20 6L9 17l-5-5"/>'),
};
const TODO_ICON = { 'vo-ueberfaellig': ICON.warn, 'vo-bald': ICON.uhr, anfragen: ICON.post };


let kontext = () => null;
let zustand = { laden: true, fehler: false, liste: [], stand: null };
const inLeiste = panel => document.querySelector(`#sidebarNav .sidebar-item[data-panel="${panel}"]`);
const zahlAus = id => { const e = document.getElementById(id); const n = Number(e?.textContent); return e && Number.isFinite(n) ? n : null; };
const voKpiDa = () => { const e = document.getElementById('physioRezKpi'); return !!e && e.dataset.pxStatus === 'ok' && e.style.display !== 'none' && !e.hidden; };
const istOwner = () => kontext()?.rolle?.() === 'owner';
const berlinStunde = d => Number(new Intl.DateTimeFormat('de-DE', {hour:'numeric',hourCycle:'h23',timeZone:'Europe/Berlin'}).formatToParts(d).find(x=>x.type==='hour')?.value);
const datumLang = d => new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Berlin'}).format(d);
const leistung = b => b.services?.title || 'Termin';
function kopfHtml() {
  const jetzt = new Date();
  const zeile = zustand.laden ? 'Termine werden geladen …' : zustand.fehler ? 'Termine konnten nicht geladen werden' : tageszeile(zustand.liste);
  return `<div class="px-start-kopf"><h1>${esc(begruessung(berlinStunde(jetzt)))}</h1>
    <p>${esc(datumLang(jetzt))} · ${esc(zeile)}</p></div>`;
}

function fehlerHtml(text) {
  return `<div class="px-karte-zustand"><p>${esc(text)}</p><button type="button" class="px-knopf px-knopf--zweit" data-aktion="neu-laden">Erneut versuchen</button></div>`;
}

function naechstesHtml() {
  let inhalt;
  if (zustand.laden) inhalt = '<div class="px-karte-zustand"><div class="px-skelett"></div><div class="px-skelett px-skelett--kurz"></div></div>';
  else if (zustand.fehler) inhalt = fehlerHtml('Der nächste Termin konnte nicht geladen werden.');
  else {
    const { termin, danach } = alsNaechstes(zustand.liste);
    if (!termin) {
      inhalt = `<div class="px-naechstes-kopf"><div class="px-zeile"><h2>Als Nächstes</h2></div>
        <p class="px-naechstes-leer">${zustand.liste.length ? 'Heute stehen keine weiteren Termine an.' : 'Heute stehen keine Termine an.'}</p></div>
        <div class="px-naechstes-rumpf"><div class="px-aktionen"><button type="button" class="px-knopf" data-aktion="kalender">${ICON.kalender}<span>Zum Kalender</span></button></div></div>`;
    } else {
      const d = dauerMin(termin);
      const sub = [esc(leistung(termin)), d ? `${d} Min` : '', termin.hausbesuch ? `${ICON.haus}Hausbesuch` : ''].filter(Boolean).map((x) => `<span>${x}</span>`).join('');
      const danachHtml = danach.length
        ? `<div class="px-danach"><h3>Danach</h3><ul>${danach.map((b) => `<li><span class="t">${esc(uhrzeitBerlin(b.start_time))}</span><span class="n">${esc(b.customer_name || 'Ohne Namen')} · ${esc(leistung(b))}</span>${b.hausbesuch ? '<span class="px-pille">Hausbesuch</span>' : '<span></span>'}</li>`).join('')}</ul></div>`
        : '<div class="px-danach"><h3>Danach</h3><p class="px-leise">Keine weiteren Termine heute.</p></div>';
      inhalt = `<div class="px-naechstes-kopf">
          <div class="px-zeile"><h2>Als Nächstes</h2><span class="px-pille px-pille--voll">${esc(abstandText(termin))}</span></div>
          <div class="px-naechstes-haupt"><span class="zeit">${esc(uhrzeitBerlin(termin.start_time))}</span><span class="name">${esc(termin.customer_name || 'Ohne Namen')}</span></div>
          <div class="px-naechstes-sub">${sub}</div>
        </div>
        <div class="px-naechstes-rumpf">
          <div class="px-aktionen">
            <button type="button" class="px-knopf" data-aktion="kalender">${ICON.kalender}<span>Im Kalender öffnen</span></button>
            ${termin.lead_id ? `<button type="button" class="px-knopf px-knopf--zweit" data-aktion="akte" data-lead="${esc(termin.lead_id)}">${ICON.akte}<span>Patientenakte</span></button>` : ''}
          </div>
          ${danachHtml}
        </div>`;
    }
  }
  return `<section class="px-karte px-k-next" aria-label="Als Nächstes">${inhalt}</section>`;
}

function todoHtml() {
  const badge = document.getElementById('anfragenNavBadge');
  const anfrageZahl = badge?.dataset.pxStatus === 'ok' && /^\d+$/.test(badge.dataset.pxCount || '') ? Number(badge.dataset.pxCount) : null;
  const quellen = {
    anfragen: inLeiste('anfragen') && Number.isSafeInteger(anfrageZahl) ? anfrageZahl : null,
    voUeberfaellig: inLeiste('verordnungen') && voKpiDa() ? zahlAus('rezKpiOverdue') : null,
    voBald: inLeiste('verordnungen') && voKpiDa() ? zahlAus('rezKpiSoon') : null,
  };
  const zeilen = zuErledigen(quellen);
  // Nur berechtigte Quellen verlangen; jede muss erfolgreich bekannt sein.
  const relevant = [...(inLeiste('anfragen') ? [quellen.anfragen] : []), ...(inLeiste('verordnungen') ? [quellen.voUeberfaellig, quellen.voBald] : [])];
  const bekannt = relevant.length > 0 && relevant.every(n => n !== null);
  const unvollstaendig = relevant.some(n => n === null);
  // Unbekannt bleibt sichtbar (nie als 0), aber benannt statt pauschal (podoloji 13.11.2026).
  const fehlt = [inLeiste('anfragen') && quellen.anfragen === null ? 'Online-Anfragen' : '', inLeiste('verordnungen') && (quellen.voUeberfaellig === null || quellen.voBald === null) ? 'Verordnungsfristen' : ''].filter(Boolean);
  const rumpf = zeilen.length
    ? `<div class="px-todo">${zeilen.map((z) => {
      const ziel = inLeiste(z.ziel) ? z.ziel : '';
      return `<button type="button" class="px-todo-zeile px-ton-${z.ton}" ${ziel ? `data-ziel="${ziel}"` : 'disabled'}>
        <span class="kachel">${TODO_ICON[z.id] || ''}</span>
        <span class="text"><b>${esc(z.titel)}</b><small>${esc(z.text)}</small></span>
        <span class="zahl">${z.zahl}</span><span class="pfeil">${ziel ? ICON.pfeil : ''}</span></button>`;
    }).join('')}</div>${unvollstaendig ? `<div class="px-karte-zustand"><p>Nicht verfügbar: ${esc(fehlt.join(', '))}.</p></div>` : ''}`
    : bekannt
      ? `<div class="px-karte-zustand px-karte-zustand--ruhig">${ICON.haken}<p>Nichts offen. Gute Arbeit.</p></div>`
      : '<div class="px-karte-zustand"><p>Hinweise sind gerade nicht verfügbar.</p></div>';
  // V6.F02 (E8): der frühere „Überblick“ (Fristen, No-Shows, Abwesenheiten, Geburtstage) ist von hier aus erreichbar.
  const mehr = inLeiste('ueberblick')
    ? `<div class="px-karte-fuss"><button type="button" class="px-fuss-knopf" data-ziel="ueberblick">Fristen, No-Shows und Abwesenheiten ${ICON.rechts}</button></div>` : '';
  return `<section class="px-karte px-k-todo" aria-labelledby="pxTodoTitel">
    <div class="px-karte-kopf"><div><h2 id="pxTodoTitel">Zu erledigen</h2><p>Was heute Aufmerksamkeit braucht</p></div></div>${rumpf}${mehr}</section>`;
}

function listeHtml() {
  let rumpf;
  if (zustand.laden) rumpf = '<div class="px-karte-zustand"><div class="px-skelett"></div><div class="px-skelett"></div><div class="px-skelett px-skelett--kurz"></div></div>';
  else if (zustand.fehler) rumpf = fehlerHtml('Die Termine von heute konnten nicht geladen werden.');
  else if (!zustand.liste.length) rumpf = '<div class="px-karte-zustand px-karte-zustand--ruhig"><p>Heute sind keine Termine eingetragen.</p></div>';
  else {
    const l = zustand.liste;
    const vorbei = l.filter((b) => b.zustand === 'vorbei').length;
    const hb = l.filter((b) => b.hausbesuch).length;
    const naechster = alsNaechstes(l).termin;
    // „vorbei“ klingt nach „behandelt“, auch bei Nichterscheinen (podoloji 13.11.2026): nur zählen, was noch kommt.
    const meta = [`${l.length - vorbei} noch offen`, hb ? `${hb} ${hb === 1 ? 'Hausbesuch' : 'Hausbesuche'}` : ''].filter(Boolean).join(' · ');
    rumpf = `<div class="px-summe"><div><b>Gesamt</b><small>${esc(meta)}</small></div><span class="zahl">${l.length}</span></div>
      <ul class="px-termine">${l.map((b) => {
        const ende = b === naechster ? '<span class="px-pille px-pille--voll">als Nächstes</span>'
          : b.zustand === 'laeuft' ? '<span class="px-pille">läuft</span>'
          : b.hausbesuch ? '<span class="px-pille">Hausbesuch</span>' : '';
        const klick = (b.lead_id ? `data-aktion="akte" data-lead="${esc(b.lead_id)}"` : 'disabled') + (b.id ? ` data-termin="${esc(b.id)}"` : '');
        return `<li><button type="button" class="px-termin${b.zustand === 'vorbei' ? ' ist-vorbei' : ''}${b === naechster ? ' ist-naechster' : ''}" ${klick}>
          <span class="t">${esc(uhrzeitBerlin(b.start_time))}</span>
          <span class="mitte"><span class="n">${esc(b.customer_name || 'Ohne Namen')}${b.hausbesuch ? ICON.haus : ''}</span><span class="s">${esc(leistung(b))}</span></span>
          <span class="ende">${ende}</span></button></li>`;
      }).join('')}</ul>`;
  }
  const datum = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' }).format(new Date());
  return `<section class="px-karte px-k-list" aria-labelledby="pxListeTitel">
    <div class="px-karte-kopf"><div><h2 id="pxListeTitel">Termine heute</h2><p>${esc(datum)}${istOwner() ? '' : ' · nur Ihre Termine'}</p></div></div>
    ${rumpf}
    <div class="px-karte-fuss"><button type="button" class="px-fuss-knopf" data-aktion="kalender">Zum Kalender ${ICON.rechts}</button></div></section>`;
}

export function montiereStartansicht(k) {
 const panel = document.getElementById('panel-overview');
 if (!panel || panel.dataset.pxStartAdapter || !k?.uid?.() || !['owner','employee'].includes(k.rolle?.())) return null;
 const boundScope = k.scope?.() || `${k.rolle()}:${k.uid()}`;
 panel.dataset.pxStartAdapter = '1'; kontext = () => k;
 const root = document.createElement('div'); root.id = 'pxStartseite'; root.className = 'px-start'; root.hidden = true;
 // Slots werden nur einmal angelegt. Insbesondere der Aufgabenslot ist keine Renderinsel.
 root.innerHTML = '<div data-start-insel="kopf"></div><div class="px-start-raster"><div data-start-insel="next" style="display:contents"></div><div data-start-insel="todo" style="display:contents"></div><section class="px-karte px-k-list"><div data-start-insel="liste" style="display:contents"></div><details class="px-start-bestand"><summary>Kalenderansicht und Filter</summary><div data-start-slot="kalender"></div></details></section><section class="px-karte px-k-vo"><div class="px-karte-kopf"><h2>Verordnungen</h2></div><div data-start-slot="vo"></div><p class="px-karte-zustand" data-start-vo-unbekannt>Verordnungszahlen sind noch nicht verfügbar.</p></section><section class="px-karte px-k-frei"><div class="px-karte-kopf"><h2>Freie Zeit</h2></div><div class="px-frei-ziel" data-start-slot="frei"></div></section><div class="px-start-aufgaben" data-start-slot="aufgaben"></div></div>';
 if(istOwner()){
  const finance=document.createElement('section');finance.className='px-karte px-k-geld';
  finance.innerHTML='<div class="px-karte-kopf"><h2>Abrechnung</h2></div><div class="px-karte-zustand"><p>Finanzübersicht ist hier noch nicht verfügbar.</p></div><div class="px-karte-fuss"><button type="button" class="px-fuss-knopf" data-ziel="rechnungen">Rechnungen öffnen</button><button type="button" class="px-fuss-knopf" data-ziel="belegliste">Belegliste öffnen</button><button type="button" class="px-fuss-knopf" data-ziel="statistik">Statistik öffnen</button></div>';
  root.querySelector('.px-start-raster').append(finance);
 }
 const moves = [ ['#startAufgaben','aufgaben'], ['#physioRezKpi','vo'], ['.gaps-section','frei'], ['.today-section','kalender'] ].map(([sel,slot])=>{
  const node=panel.querySelector(sel); if(!node)return null;
  const anchor=document.createComment('start-original:'+slot); node.before(anchor);
  return {node,anchor,slot};
 }).filter(Boolean);
 const replaced=[...panel.children].filter(n=>n.matches('.panel-header,#welcomeOverview,#todayKpiBlock'));
 panel.prepend(root);
 const insel = (name,html) => { const e=root.querySelector(`[data-start-insel="${name}"]`); if(e.innerHTML!==html)e.innerHTML=html; };
 function redraw() {
  if(root.hidden)return;
  const focus=document.activeElement, key=focus?.dataset?.termin || focus?.dataset?.aktion || focus?.dataset?.ziel;
  const own = ['owner','employee'].includes(k.rolle?.()) && !!k.uid?.() && (k.scope?.() || `${k.rolle()}:${k.uid()}`) === boundScope;
  if(!own){toggle(false);return;}
  insel('kopf',kopfHtml()); insel('next',naechstesHtml()); insel('todo',todoHtml());
  // Die bestätigte Listenkarte wird in ihre eigene Insel entpackt, nie um aktuelle Slots herum.
  const temp=document.createElement('template'); temp.innerHTML=listeHtml();
  insel('liste',temp.content.firstElementChild.innerHTML);
  root.querySelector('[data-start-vo-unbekannt]').hidden=voKpiDa();
  if(focus && !focus.isConnected && key){const target=[...root.querySelectorAll('[data-termin],[data-aktion],[data-ziel]')].find(e=>e.dataset.termin===key||e.dataset.aktion===key||e.dataset.ziel===key);target?.focus({preventScroll:true});}
 }
 function toggle(neu = document.documentElement.dataset.design === 'neu') {
  root.hidden=!neu;
  for(const m of moves){if(neu)root.querySelector(`[data-start-slot="${m.slot}"]`).append(m.node);else m.anchor.after(m.node);}
  for(const n of replaced)neu?n.setAttribute('data-px-start-ersetzt',''):n.removeAttribute('data-px-start-ersetzt');
  redraw();
 }
 root.addEventListener('click', e=>{
  const b=e.target.closest('[data-aktion],[data-ziel]');if(!b||b.disabled)return;
  if(b.dataset.aktion==='neu-laden')k.neuLaden?.();
  else if(b.dataset.aktion==='akte')k.akte?.(b.dataset.lead);
  else {const target=b.dataset.ziel || (b.dataset.aktion==='kalender'?'calendar':null);if(target && inLeiste(target))k.springe?.(target);}
 });
 const obs=new MutationObserver(redraw);
 for(const id of ['physioRezKpi','anfragenNavBadge']){const node=document.getElementById(id);if(node)obs.observe(node,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-px-status','data-px-count','style','hidden']});}
 const nav=document.getElementById('sidebarNav');
 if(nav)new MutationObserver(()=>{const badge=document.getElementById('anfragenNavBadge');if(badge)obs.observe(badge,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-px-status','data-px-count','style','hidden']});redraw();}).observe(nav,{childList:true,subtree:true});
 setInterval(()=>{if(root.hidden || !panel.classList.contains('active'))return;const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin'}).format(new Date());if(zustand.tag && zustand.tag!==today)zustand={...zustand,laden:false,fehler:true,liste:[],stand:null};else zustand.liste=heutigeTermine(zustand.liste,{uid:k.uid(),nurEigene:!istOwner()});redraw();},60000);
 new MutationObserver(()=>toggle()).observe(document.documentElement,{attributes:true,attributeFilter:['data-design']});
 window.addEventListener('beforeprint',()=>toggle(false));window.addEventListener('afterprint',()=>toggle());
 toggle();
 return { termine({bookings=[],error=null,laden=false,date=new Date()}={}) {
  // Nur der vollständige heutige Snapshot des vorhandenen Loaders. Andere Tage nie als heute ausgeben.
  const heute = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin'});
  zustand={laden,tag:heute.format(date),fehler:!!error || heute.format(date)!==heute.format(new Date()),liste:heutigeTermine(bookings,{uid:k.uid(),nurEigene:!istOwner()}),stand:laden?null:new Date()};redraw();
 }, aktualisieren:redraw };
}
