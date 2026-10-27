/**
 * startseite-neu.js — Startseite „Heute“ des neuen Designs (Redesign v2, PLAN-V2 V6.F01, E8/E12).
 *
 * Nur im neuen Design (geladen über module/shell-neu.js). Legt im Bereich „overview“ eine neue
 * Startseite an und blendet die alte Übersicht per CSS aus (sie läuft weiter im Hintergrund, damit
 * nichts in dashboard.js bricht). Raster nach E12: oben „Als Nächstes“ (breit) + „Zu erledigen“,
 * darunter „Termine heute“ (breit) + rechts „Verordnungen“ und „Freie Zeit“. Abrechnung und Woche
 * (nur Inhaber, Geld) folgen mit dem Startseiten-Endpunkt (V6.B).
 *
 * Datenwege in F01 — bewusst ohne neue Fachregeln:
 *  - Termine heute: eine schlanke bookings-Abfrage (Berliner Tagesgrenzen über termin-heute.js,
 *    nur owner_id wie loadScheduleBookings dashboard.js:1313; Angestellte nur eigene).
 *    Kopie-Kandidat zu loadScheduleBookings, im Neu-Design ersetzt sie die ausgeblendete alte Liste.
 *  - Verordnungen: die Zahlen, die loadPhysioRezKpis ohnehin in #rezKpi* schreibt (beobachtet).
 *  - Online-Anfragen: die Zahl der Leisten-Plakette #anfragenNavBadge (beobachtet).
 *  - Freie Behandlungszeit/Woche: B08-Endpunkte, serverseitig geprüfte Startzeugen/Rohbasis.
 *    Alte .gaps-section bleibt im ursprünglichen DOM für Alt-Design und bestehende Renderer.
 */
import { on } from './signal.js?v=20260813';
import { tagesgrenzen, uhrzeitBerlin } from './termin-heute.js?v=20261004m113';
import { API_BASE } from '../supabase-config.js';
import { geldKarteHtml, holeGeld } from './startseite-geld.js?v=20261027s240';
import { freieZeitHtml, wocheHtml, holeVerfuegbarkeit } from './startseite-verfuegbarkeit.js?v=20261027s237';
import { begruessung, heutigeTermine, alsNaechstes, abstandText, dauerMin, tageszeile, zuErledigen, terminAbfrage, fokusSelektor } from './startseite-rechnen.js?v=20261027s231';

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
let wurzel = null;
let zustand = { laden: true, fehler: false, liste: [], stand: null };
let laufNr = 0;
// V6.F03 Abrechnungskarte (nur Inhaber): eigener Zustand, höchstens einmal je Minute neu laden (Server-Rate-Limit).
let geld = { laden: false, fehler: false, daten: null, stand: 0 };
let mahnungen = { laden: false, fehler: false, daten: null };
let abrechnung = { laden: false, fehler: false, daten: null };
let geldLaedt = false;
let verf = { tag: { laden: false, daten: null }, woche: { laden: false, daten: null } };
let verfStand = 0, verfLaedt = false, verfErneut = false, verfScope = '';

/** B08 read-only Karten, role-scoped; niemals eine Client-Slotengine. */
async function ladeVerfuegbarkeitKarten({ erzwingen = false } = {}) {
  const k = kontext(), rolle = k?.rolle?.(), uid = k?.uid?.();
  if (!k?.supabase || !['owner', 'employee'].includes(rolle) || !uid) return;
  if (verfLaedt) { if (erzwingen) verfErneut = true; return; }
  const scope = `${rolle}:${uid}`;
  if (scope !== verfScope) { verfScope = scope; verfStand = 0; verf = { tag: { daten: null }, woche: { daten: null } }; }
  if (!erzwingen && Date.now() - verfStand < 60000) return;
  const modi = rolle === 'owner' ? ['tag', 'woche'] : ['tag'];
  verfLaedt = true;
  for (const modus of modi) verf[modus] = { ...verf[modus], laden: true, fehler: false };
  zeichne();
  await Promise.allSettled(modi.map(async modus => {
    let next;
    try { next = { laden: false, fehler: false, daten: await holeVerfuegbarkeit({ supabase: k.supabase, apiBase: API_BASE, modus, rolle }) }; }
    catch { next = { laden: false, fehler: true, daten: verf[modus].daten }; }
    if (`${k.rolle?.()}:${k.uid?.()}` === scope) { verf[modus] = next; zeichne(); }
  }));
  verfLaedt = false;
  if (`${k.rolle?.()}:${k.uid?.()}` !== scope) { verfScope = ''; verfStand = 0; zeichne(); return; }
  verfStand = Date.now(); zeichne();
  if (verfErneut) { verfErneut = false; ladeVerfuegbarkeitKarten({ erzwingen: true }); }
}

const inLeiste = (panel) => document.querySelector(`#sidebarNav .sidebar-item[data-panel="${panel}"]`);
const geheZu = (panel) => inLeiste(panel)?.click();
const zahlAus = (id) => {
  const el = document.getElementById(id);
  if (!el || el.style.display === 'none') return null;
  const n = parseInt(el.textContent, 10);
  return Number.isFinite(n) ? n : null;
};
/** Verordnungszahlen gelten nur, wenn loadPhysioRezKpis den Block sichtbar geschaltet hat. */
const voKpiDa = () => { const k = document.getElementById('physioRezKpi'); return !!k && k.style.display !== 'none' && !k.hidden; };
const istOwner = () => kontext()?.rolle?.() === 'owner';
// formatToParts: de-DE formatiert die Stunde allein als „10 Uhr“.
const berlinStunde = (d) => Number(new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Berlin' }).formatToParts(d).find((x) => x.type === 'hour')?.value);
const datumLang = (d) => new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' }).format(d);
const leistung = (b) => b.services?.title || 'Termin';

async function ladeTermine() {
  const k = kontext();
  const grenzen = tagesgrenzen(new Date());
  if (!k?.supabase || !grenzen) throw new Error('Kontext fehlt');
  const q = terminAbfrage(k.supabase.from('bookings'), {
    rolle: k.rolle?.(), uid: k.uid?.(), ownerId: k.getOwnerId(), von: grenzen.von, bisExklusiv: grenzen.bisExklusiv,
  });
  if (!q) throw new Error('Rolle oder Benutzer unbekannt');
  const { data, error } = await q;
  if (error) throw error;
  return heutigeTermine(data || [], { jetzt: new Date(), uid: k.uid?.(), nurEigene: !istOwner() });
}

/** Geld-Block laden (nur Inhaber). Fehler bleiben in der Karte, die übrige Startseite läuft weiter. */
async function ladeGeldKarte({ erzwingen = false } = {}) {
  const k = kontext();
  if (!istOwner() || !k?.supabase || geldLaedt) return;
  if (!erzwingen && Date.now() - geld.stand < 60000) return;
  geldLaedt = true;
  geld = { ...geld, laden: true, fehler: false };
  mahnungen = { ...mahnungen, laden: true, fehler: false };
  abrechnung = { ...abrechnung, laden: true, fehler: false };
  if (!geld.daten) zeichne();
  try {
    await Promise.allSettled(['geld', 'mahnungen', 'abrechnung'].map(async blockName => {
      let daten, fehler = false;
      try { daten = await holeGeld({ supabase: k.supabase, apiBase: API_BASE, blockName }); }
      catch { fehler = true; }
      const vorher = blockName === 'geld' ? geld : blockName === 'mahnungen' ? mahnungen : abrechnung;
      const next = { laden: false, fehler, daten: fehler ? vorher.daten : daten };
      if (blockName === 'geld') geld = { ...next, stand: Date.now() };
      else if (blockName === 'mahnungen') mahnungen = next;
      else abrechnung = next;
      zeichne();
    }));
  } finally { geldLaedt = false; }
}

export async function aktualisieren() {
  if (!wurzel) return;
  const nr = ++laufNr;
  zustand = { ...zustand, laden: !zustand.stand, fehler: false };
  zeichne();
  ladeGeldKarte();
  ladeVerfuegbarkeitKarten();
  try {
    const liste = await ladeTermine();
    if (nr !== laufNr) return;
    zustand = { laden: false, fehler: false, liste, stand: new Date() };
  } catch (e) {
    if (nr !== laufNr) return;
    console.warn('[startseite] Termine nicht ladbar:', e);
    zustand = { ...zustand, laden: false, fehler: true };
  }
  zeichne();
}

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
        <p class="px-naechstes-leer">${zustand.liste.length ? 'Für heute sind alle Termine vorbei.' : 'Heute stehen keine Termine an.'}</p></div>
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
  const quellen = {
    anfragen: inLeiste('anfragen') ? zahlAus('anfragenNavBadge') : null,
    voUeberfaellig: voKpiDa() ? zahlAus('rezKpiOverdue') : null,
    voBald: voKpiDa() ? zahlAus('rezKpiSoon') : null,
  };
  const zeilen = zuErledigen(quellen);
  // „Nichts offen“ nur, wenn wirklich Zahlen da sind — sonst keine falsche Entwarnung.
  const bekannt = quellen.voUeberfaellig !== null || quellen.voBald !== null;
  const rumpf = zeilen.length
    ? `<div class="px-todo">${zeilen.map((z) => {
      const ziel = inLeiste(z.ziel) ? z.ziel : '';
      return `<button type="button" class="px-todo-zeile px-ton-${z.ton}" ${ziel ? `data-ziel="${ziel}"` : 'disabled'}>
        <span class="kachel">${TODO_ICON[z.id] || ''}</span>
        <span class="text"><b>${esc(z.titel)}</b><small>${esc(z.text)}</small></span>
        <span class="zahl">${z.zahl}</span><span class="pfeil">${ziel ? ICON.pfeil : ''}</span></button>`;
    }).join('')}</div>`
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
    const meta = [vorbei ? `${vorbei} vorbei` : '', `${l.length - vorbei} offen`, hb ? `${hb} ${hb === 1 ? 'Hausbesuch' : 'Hausbesuche'}` : ''].filter(Boolean).join(' · ');
    rumpf = `<div class="px-summe"><div><b>Gesamt</b><small>${esc(meta)}</small></div><span class="zahl">${l.length}</span></div>
      <ul class="px-termine">${l.map((b) => {
        const ende = b === naechster ? '<span class="px-pille px-pille--voll">als Nächstes</span>'
          : b.zustand === 'laeuft' ? '<span class="px-pille">läuft</span>'
          : b.hausbesuch ? '<span class="px-pille">Hausbesuch</span>'
          : b.zustand === 'vorbei' ? '<span class="px-leise">vorbei</span>' : '';
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

function voHtml() {
  if (!voKpiDa()) return '';
  const werte = [
    ['Überfällig', zahlAus('rezKpiOverdue'), 'bad'],
    ['Läuft ab ≤ 7 Tage', zahlAus('rezKpiSoon'), 'warn'],
    ['In Behandlung', zahlAus('rezKpiActive'), ''],
  ];
  const ziel = inLeiste('verordnungen');
  return `<section class="px-karte px-k-vo" aria-labelledby="pxVoTitel">
    <div class="px-karte-kopf"><div><h2 id="pxVoTitel">Verordnungen</h2><p>Gültigkeit im Blick</p></div></div>
    <div class="px-minis">${werte.map(([t, v, ton]) => `<div class="px-mini${ton && v ? ` px-ton-${ton}` : ''}"><span class="zahl">${v ?? '–'}</span><span class="lbl">${esc(t)}</span></div>`).join('')}</div>
    ${ziel ? `<div class="px-karte-fuss"><button type="button" class="px-fuss-knopf" data-aktion="gehe" data-ziel="verordnungen">Alle Verordnungen ${ICON.rechts}</button></div>` : ''}
  </section>`;
}

/** Schlüssel für das fokussierte Element, damit es nach dem Neuzeichnen wiedergefunden wird
 *  (Codex-Befunde V6.F01, V6.F01b): stabile Identität ohne Zustandsklassen + Karte als Rückfall. */
function fokusSchluessel(el) {
  if (!el || !wurzel?.contains(el) || el === wurzel) return null;
  const sel = fokusSelektor({ tag: el.tagName, klasse: el.className, daten: el.dataset || {} });
  if (!sel) return null;
  const gleiche = [...wurzel.querySelectorAll(sel)];
  const karte = [...(el.closest('section.px-karte')?.classList || [])].find((k) => k.startsWith('px-k-'));
  return { sel, nr: Math.max(0, gleiche.indexOf(el)), karte };
}

function zeichne() {
  if (!wurzel) return;
  const fokus = fokusSchluessel(document.activeElement);
  zeichneInnen();
  if (fokus) {
    // Rückfall, wenn das Element weg ist: erstes bedienbares Element derselben Karte, sonst die Karte.
    const karte = fokus.karte ? wurzel.querySelector(`section.${fokus.karte}`) : null;
    const ziel = wurzel.querySelectorAll(fokus.sel)[fokus.nr] || wurzel.querySelector(fokus.sel)
      || karte?.querySelector('button:not([disabled]), a[href]');
    if (ziel) ziel.focus({ preventScroll: true });
    else if (karte) { karte.tabIndex = -1; karte.focus({ preventScroll: true }); }
  }
}

function zeichneInnen() {
  const offen = new Set([...wurzel.querySelectorAll('details[open][data-person]')].map(el => el.dataset.person));
  const k = kontext(), scopePasst = verfScope === `${k?.rolle?.()}:${k?.uid?.()}`;
  wurzel.innerHTML = `${kopfHtml()}<div class="px-start-raster${istOwner() ? '' : ' ist-team'}">
    ${naechstesHtml()}${todoHtml()}${istOwner() ? geldKarteHtml(geld, mahnungen, abrechnung) : ''}${listeHtml()}${voHtml()}
    ${freieZeitHtml(scopePasst ? verf.tag : {}, { eigeneUid: istOwner() ? null : k?.uid?.(), behandlerName: k?.behandlerName, serviceName: k?.serviceName })}
    ${istOwner() ? wocheHtml(scopePasst ? verf.woche : {}) : ''}</div>`;
  for (const el of wurzel.querySelectorAll('details[data-person]')) el.open = offen.has(el.dataset.person);
}

function klick(e) {
  const el = e.target.closest('[data-aktion], [data-ziel]');
  if (!el || !wurzel.contains(el) || el.disabled) return;
  const aktion = el.dataset.aktion;
  if (aktion === 'kalender') geheZu('calendar');
  else if (aktion === 'akte' && typeof window.openPatientDetail === 'function') window.openPatientDetail(el.dataset.lead);
  else if (aktion === 'neu-laden') aktualisieren();
  else if (aktion === 'geld-neu') ladeGeldKarte({ erzwingen: true });
  else if (aktion === 'verf-neu') ladeVerfuegbarkeitKarten({ erzwingen: true });
  else if (el.dataset.ziel) geheZu(el.dataset.ziel);
}

/** Einmal einhängen. `k` liefert { supabase, getOwnerId, rolle(), uid() } oder null. */
export function verdrahteStartseite(k) {
  if (wurzel || typeof k !== 'function') return;
  const panel = document.getElementById('panel-overview');
  if (!panel) return;
  kontext = k;
  wurzel = document.createElement('div');
  wurzel.id = 'pxStartseite';
  wurzel.className = 'px-start';
  panel.prepend(wurzel);
  document.documentElement.classList.add('px-startseite-bereit');
  wurzel.addEventListener('click', klick);

  // Zahlen, die dashboard.js nachträglich schreibt, sofort übernehmen (ohne neue Abfrage).
  let warte = 0;
  const nachziehen = () => { cancelAnimationFrame(warte); warte = requestAnimationFrame(zeichne); };
  for (const id of ['physioRezKpi', 'anfragenNavBadge']) {
    const el = document.getElementById(id);
    if (el) new MutationObserver(nachziehen).observe(el, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'hidden'] });
  }
  on('nav:gerendert', () => {
    const b = document.getElementById('anfragenNavBadge');
    if (b && !b.dataset.pxBeobachtet) { b.dataset.pxBeobachtet = '1'; new MutationObserver(nachziehen).observe(b, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style'] }); }
    nachziehen();
  });
  on('bookings:changed', () => { ladeVerfuegbarkeitKarten({ erzwingen: true }); aktualisieren(); });
  on('panel:changed', (d) => { if (d?.id === 'overview') aktualisieren(); });
  // Uhr: „in 15 Min“ und Zustände minütlich nachführen (ohne neue Abfrage).
  setInterval(() => {
    if (!document.getElementById('panel-overview')?.classList.contains('active')) return;
    ladeVerfuegbarkeitKarten();
    if (zustand.laden || zustand.fehler) return;
    zustand = { ...zustand, liste: heutigeTermine(zustand.liste, { jetzt: new Date() }) };
    zeichne();
  }, 60000);
  aktualisieren();
}
