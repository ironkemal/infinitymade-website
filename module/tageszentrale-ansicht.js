/**
 * module/tageszentrale-ansicht.js — Neues Schwarz-Weiß/Kühl-Dashboard für das Standard-Design
 * (:root:not([data-design="neu"]) #panel-overview).
 *
 * Grundsätze:
 * - Berührt [data-design="neu"] (#pxStartseite) nicht.
 * - Belässt alle bestehenden DOM-IDs und direkte Elternbeziehungen (#startAufgaben, #physioRezKpi,
 *   .today-section, .gaps-section) im #panel-overview-Container (wichtig für physio-demo-p01 & v602).
 * - Löst für Mitarbeiter keine zusätzlichen Supabase-Abfragen aus (v602-Garantie); Inhaber erhalten
 *   zusätzlich Handlungsbedarf (Anfragen/Warteliste/Berichte) und Abrechnungspuls (startseite-geld.js).
 * - Keine Emojis; 1-Klick-Lückenbuchung via prefillBookingModal, Feierabend-Vorschau auf morgen.
 */

import {
  berlinIsoTag,
  tageszeitGruss,
  datumLangDeutsch,
  dauerKurzText,
  buchungenFuerTagAufbereiten,
  lueckenFiltern,
  zeitleisteZusammenfuehren,
  handlungsbedarfZusammenfassen,
} from './tageszentrale-logik.js?v=20261120tz5';
import {
  addiereTageIso,
  fristenAuswerten,
  therapieberichteAufbereiten,
  anfragenAufbereiten,
  wartelisteAufbereiten,
} from './ueberblick-listen.js?v=20261121f01b';
import { ladeOffeneVerordnungenPaginiert, RX_FRISTEN_SELECT_VOLL } from './verordnung-fristen-laden.js?v=20261121f01';
import { ladeGeld, monatText } from './startseite-geld.js?v=20261121f02';
import { fmtEur } from './geld.js?v=20260909';
import { on } from './signal.js?v=20260813';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SVG = (d, s = 14) =>
  `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const ICO_PLUS = SVG('<path d="M12 5v14M5 12h14"/>');
const ICO_SCAN = SVG('<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>');
const ICO_USER = SVG('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M16 11h6"/>');
const ICO_DOC = SVG('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>');
const ICO_GRID = SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>', 13);
const ICO_CLOCK = SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 14);

const hatPanel = (panelName) => {
  const el = document.querySelector(`#sidebarNav [data-panel="${panelName}"]`);
  return !!el && !el.hidden && getComputedStyle(el).display !== 'none';
};

/**
 * Montiert die Tageszentrale direkt im Standard-Dashboard (#panel-overview).
 * Gibt das kompatible `startansicht`-Interface (`{ termine, neuLaden, abbauen }`) zurück.
 *
 * @param {{
 *   supabase: any,
 *   api: () => string,
 *   getOwnerId: () => string | null,
 *   getUserId: () => string | null,
 *   istOwner: () => boolean,
 *   getName: () => string,
 *   getTeam: () => Array<{ id: string, name: string }>,
 *   bizScope?: (q: any, typ?: string) => any,
 *   oeffneTerminNeu: (startIso?: string | null) => void,
 *   oeffneTerminAktion: (booking: any) => void,
 *   oeffnePatient: (leadId: string) => void,
 *   oeffnePatientNeu: () => void,
 *   oeffneRezeptNeu: () => void,
 *   oeffneVerordnung: (quelle: string, id: string) => void,
 *   wechslePanel: (panel: string) => void,
 *   oeffneKalenderTag: (tagIso: string) => void,
 * }} k
 */
export function montiereTageszentrale(k) {
  const panel = document.getElementById('panel-overview');
  if (!panel || document.documentElement.getAttribute('data-design') === 'neu') {
    return { termine() {}, neuLaden() {}, abbauen() {} };
  }

  // Aufräumen, falls bereits montiert
  for (const id of ['tzHead', 'tzColLeft', 'tzHero', 'tzPlan', 'tzBedarf', 'tzGeld']) {
    document.getElementById(id)?.remove();
  }

  panel.dataset.tz = '1';

  const makeEl = (tag, id, cls) => {
    const el = document.createElement(tag);
    el.id = id;
    el.className = cls;
    return el;
  };

  const headEl = makeEl('header', 'tzHead', 'tz-head');
  const colLeftEl = makeEl('div', 'tzColLeft', 'tz-col-left');
  const heroEl = makeEl('section', 'tzHero', 'tz-hero');
  const planEl = makeEl('section', 'tzPlan', 'tz-card tz-plan');
  const bedarfEl = makeEl('section', 'tzBedarf', 'tz-card tz-bedarf');
  const geldEl = makeEl('section', 'tzGeld', 'tz-card tz-geld');
  bedarfEl.hidden = true;
  geldEl.hidden = true;
  colLeftEl.append(heroEl, planEl);

  // Reihenfolge als direkte Kinder von #panel-overview (bestehende Knoten wie #startAufgaben,
  // #physioRezKpi und .today-section behalten ihre Elternbeziehung parentElement.id === 'panel-overview'!).
  panel.prepend(headEl, colLeftEl, bedarfEl, geldEl);

  const state = {
    laden: true,
    fehler: false,
    date: new Date(),
    zielIso: berlinIsoTag(),
    bookings: /** @type {Array<any>} */ ([]),
    behandlerFilter: 'all',
    nurLuecken: false,
    rasterOffen: false,
    lueckenFehler: false,
    luecken: /** @type {Array<{ start: string, end: string, startMin: number, endMin: number, min: number }>} */ ([]),
    lueckenMin: 0,
    morgenGeprueftIso: '',
    morgenDaten: /** @type {{ iso: string, anzahl: number, erster: any } | null} */ (null),
    bedarf: /** @type {ReturnType<typeof handlungsbedarfZusammenfassen> | null} */ (null),
    geld: /** @type {any} */ (null),
    bookingById: new Map(),
  };

  let geldCtrl = null;
  let bedarfGeladen = false;
  let geldGeladen = false;
  let bedarfStartMs = 0;

  const teamMap = () => {
    const m = new Map();
    for (const t of k.getTeam?.() || []) {
      if (t?.id && t?.name) m.set(t.id, t.name);
    }
    return m;
  };

  const leseLueckenAusDom = () => {
    const list = document.getElementById('gapsList');
    if (!list) return;
    if (list.querySelector('.gaps-loading') || (list.dataset.dateIso && list.dataset.dateIso !== state.zielIso)) {
      state.lueckenFehler = false;
      state.luecken = [];
      state.lueckenMin = 0;
      return;
    }
    const fehlerEl = list.querySelector('.gap-fehler');
    if (fehlerEl || /nicht geladen/.test(list.textContent || '')) {
      state.lueckenFehler = true;
      state.luecken = [];
      state.lueckenMin = 0;
      return;
    }
    state.lueckenFehler = false;
    const rohe = [...list.querySelectorAll('.gap-card-time')].map((el) => {
      const teile = String(el.textContent || '').split('-').map((s) => s.trim());
      return { start: teile[0] || '', end: teile[1] || '' };
    });
    const heuteIso = berlinIsoTag();
    const erg = lueckenFiltern(rohe, {
      istHeute: state.zielIso === heuteIso,
      istVergangenheit: state.zielIso < heuteIso,
    });
    state.luecken = erg.luecken;
    state.lueckenMin = erg.gesamtMin;
  };

  const pruefeMorgenFallsAbend = async (heuteIso) => {
    if (!k.istOwner?.() || !k.supabase || state.morgenGeprueftIso === heuteIso) return;
    state.morgenGeprueftIso = heuteIso;
    const ownerId = k.getOwnerId?.();
    if (!ownerId) return;
    try {
      const morgenIso = addiereTageIso(heuteIso, 1);
      const { data, error } = await k.supabase
        .from('bookings')
        .select('id,user_id,start_time,end_time,customer_name,status,hausbesuch,lead_id,group_parent_id,services(title)')
        .eq('owner_id', ownerId)
        .gte('start_time', `${morgenIso}T00:00:00`)
        .lte('start_time', `${morgenIso}T23:59:59`)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: true })
        .limit(30);
      if (error) return;
      const auf = buchungenFuerTagAufbereiten(data || [], {
        heuteIso,
        zielIso: morgenIso,
        teamMap: teamMap(),
        istOwner: true,
      });
      state.morgenDaten = { iso: morgenIso, anzahl: auf.gesamt, erster: auf.alle[0] || null };
      renderHead();
      renderHero();
      renderPlan();
    } catch {
      // Stiller Rückfall ohne Fehlerbanner
    }
  };

  const ladeOwnerHandlungsbedarf = async () => {
    if (!k.istOwner?.() || !k.supabase) {
      bedarfEl.hidden = true;
      return;
    }
    const ownerId = k.getOwnerId?.();
    if (!ownerId) return;
    bedarfGeladen = true;
    bedarfStartMs = Date.now();
    const heuteIso = berlinIsoTag();

    try {
      const [rxRes, anfRes, wlRes] = await Promise.all([
        hatPanel('verordnungen')
          ? ladeOffeneVerordnungenPaginiert(k.supabase, {
              ownerId,
              select: RX_FRISTEN_SELECT_VOLL,
              bizScope: k.bizScope,
            })
          : Promise.resolve({ data: [] }),
        hatPanel('anfragen')
          ? k.supabase
              .from('booking_requests')
              .select('id,preferred_date,preferred_time,payment_type,behandlungsart,created_at,patients!patient_id(vorname,nachname)')
              .eq('owner_id', ownerId)
              .eq('status', 'pending')
              .order('created_at', { ascending: false })
              .limit(15)
          : Promise.resolve({ data: [] }),
        hatPanel('warteliste')
          ? k.supabase
              .from('warteliste')
              .select('id,lead_id,priority,created_at,leads!lead_id(id,first_name,last_name),services(title)')
              .eq('owner_id', ownerId)
              .eq('status', 'waiting')
              .order('priority', { ascending: false })
              .limit(15)
          : Promise.resolve({ data: [] }),
      ]);

      const rx = rxRes?.data || [];
      const fristen = fristenAuswerten(rx, heuteIso);
      const berichte = therapieberichteAufbereiten(rx);
      const anfragen = anfragenAufbereiten(anfRes?.data || [], heuteIso);
      const warteliste = wartelisteAufbereiten(wlRes?.data || [], heuteIso);
      state.bedarf = handlungsbedarfZusammenfassen({ fristen, berichte, anfragen, warteliste });
      renderBedarf();
    } catch {
      bedarfEl.hidden = true;
    }
  };

  const ladeOwnerGeld = async () => {
    if (!k.istOwner?.() || !hatPanel('rechnungen')) {
      geldEl.hidden = true;
      return;
    }
    const apiBase = k.api?.();
    if (!apiBase || !k.supabase) return;
    geldGeladen = true;
    if (geldCtrl) geldCtrl.abort();
    geldCtrl = new AbortController();
    const erg = await ladeGeld({ supabase: k.supabase, apiBase, signal: geldCtrl.signal });
    if (erg.status === 'abgebrochen') return;
    state.geld = erg;
    renderGeld();
  };

  const renderHead = () => {
    const heuteIso = berlinIsoTag();
    const istHeute = state.zielIso === heuteIso;
    const auf = buchungenFuerTagAufbereiten(state.bookings, {
      heuteIso,
      zielIso: state.zielIso,
      teamMap: teamMap(),
      eigeneId: k.getUserId?.(),
      istOwner: k.istOwner?.(),
    });
    const name = (k.getName?.() || document.getElementById('welcomeText')?.textContent || '').trim();
    const gruss = `${tageszeitGruss()}${name ? `, ${name}` : ''}`;
    const scanBtn = document.getElementById('rezeptScanBtn');
    const scanSichtbar = !!scanBtn && scanBtn.style.display !== 'none' && !scanBtn.hidden;
    const patSichtbar = hatPanel('patients');
    const voSichtbar = hatPanel('verordnungen');

    let sub = `${esc(datumLangDeutsch(state.date))}`;
    if (!state.laden && !state.fehler) {
      if (istHeute && auf.offen === 0 && state.morgenDaten?.anzahl) {
        sub = `Heute abgeschlossen · <strong>Morgen ${state.morgenDaten.anzahl} Termin${state.morgenDaten.anzahl === 1 ? '' : 'e'}</strong>`;
      } else {
        const hb = auf.hausbesuche > 0 ? ` (${auf.hausbesuche} Hausbesuch${auf.hausbesuche === 1 ? '' : 'e'})` : '';
        const frei = !state.lueckenFehler && state.lueckenMin > 0 ? ` · <strong>${esc(dauerKurzText(state.lueckenMin))}</strong> buchbar frei` : '';
        sub += ` · <strong>${auf.gesamt} Termin${auf.gesamt === 1 ? '' : 'e'}</strong>${hb}${frei}`;
      }
    }

    headEl.innerHTML = `
      <div class="tz-head-copy">
        <h2 class="tz-title">${esc(gruss)}</h2>
        <p class="tz-sub">${sub}</p>
      </div>
      <div class="tz-actions">
        <button type="button" class="tz-btn tz-btn--primary" data-tz-act="neu-termin">${ICO_PLUS}<span>Neuer Termin</span></button>
        ${scanSichtbar ? `<button type="button" class="tz-btn" data-tz-act="scan">${ICO_SCAN}<span>Rezept scannen</span></button>` : ''}
        ${patSichtbar ? `<button type="button" class="tz-btn" data-tz-act="neu-patient">${ICO_USER}<span>Patient</span></button>` : ''}
        ${voSichtbar ? `<button type="button" class="tz-btn" data-tz-act="neu-vo">${ICO_DOC}<span>Verordnung</span></button>` : ''}
      </div>
    `;
  };

  const renderHero = () => {
    const heuteIso = berlinIsoTag();
    const istHeute = state.zielIso === heuteIso;
    const auf = buchungenFuerTagAufbereiten(state.bookings, {
      heuteIso,
      zielIso: state.zielIso,
      teamMap: teamMap(),
      eigeneId: k.getUserId?.(),
      istOwner: k.istOwner?.(),
    });

    if (state.laden) {
      heroEl.innerHTML = `
        <div class="tz-hero-kicker"><span class="tz-live-pill"><span class="tz-live-dot"></span>Tagesplan wird geladen …</span></div>
        <div class="tz-hero-body"><div><div class="tz-hero-name">Einen Moment bitte</div></div></div>
      `;
      return;
    }

    const fokus = auf.aktuell || auf.naechster;
    if (fokus) {
      const pill = fokus.laeuft
        ? `Läuft · noch ${fokus.restMin} Min`
        : istHeute && fokus.inMin !== null
          ? `Als Nächstes · in ${fokus.inMin >= 60 ? dauerKurzText(fokus.inMin) : `${fokus.inMin} Min`}`
          : `Erster Termin · ${new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }).format(state.date)}`;
      const rechts = [fokus.behandler, fokus.hausbesuch ? 'Hausbesuch' : '', fokus.vo].filter(Boolean).join(' · ');
      const meta = [fokus.leistung, `${fokus.dauerMin} Min`].filter(Boolean).join(' · ');
      heroEl.innerHTML = `
        <div class="tz-hero-kicker">
          <span class="tz-live-pill"><span class="tz-live-dot"></span>${esc(pill)}</span>
          ${rechts ? `<span class="tz-hero-room">${esc(rechts)}</span>` : ''}
        </div>
        <div class="tz-hero-body">
          <div class="tz-hero-info">
            <div class="tz-hero-time">${esc(fokus.startHhMm)} – ${esc(fokus.endHhMm)}</div>
            <h3 class="tz-hero-name">${esc(fokus.patient)}</h3>
            <div class="tz-hero-meta">${esc(meta)}</div>
          </div>
          <div class="tz-hero-cta">
            <button type="button" class="tz-hero-btn tz-hero-btn--solid" data-tz-booking="${esc(fokus.id)}">Behandlung öffnen</button>
            ${fokus.leadId ? `<button type="button" class="tz-hero-btn" data-tz-patient="${esc(fokus.leadId)}">Patientenakte</button>` : ''}
          </div>
        </div>
        ${auf.gesamt > 0 ? `
          <div class="tz-hero-prog">
            <span class="tz-hero-prog-lbl">Tagesfortschritt <strong>${auf.erledigt} / ${auf.gesamt}</strong></span>
            <div class="tz-hero-bar"><div class="tz-hero-bar-fill" style="width:${auf.prozent}%"></div></div>
            <span class="tz-hero-prog-lbl"><strong>${auf.prozent} %</strong></span>
          </div>
        ` : ''}
      `;
      return;
    }

    // Feierabend / keine offenen Termine mehr
    if (istHeute && state.morgenDaten?.erster) {
      const m = state.morgenDaten.erster;
      const mTag = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${state.morgenDaten.iso}T12:00:00`));
      heroEl.innerHTML = `
        <div class="tz-hero-kicker">
          <span class="tz-live-pill tz-live-pill--calm"><span class="tz-live-dot"></span>Feierabend · Vorschau auf morgen</span>
          <span class="tz-hero-room">${esc(mTag)} · ${state.morgenDaten.anzahl} Termin${state.morgenDaten.anzahl === 1 ? '' : 'e'}</span>
        </div>
        <div class="tz-hero-body">
          <div class="tz-hero-info">
            <div class="tz-hero-time">Erster Termin · ${esc(m.startHhMm)} – ${esc(m.endHhMm)}</div>
            <h3 class="tz-hero-name">${esc(m.patient)}</h3>
            <div class="tz-hero-meta">${esc([m.leistung, m.hausbesuch ? 'Hausbesuch' : '', m.behandler].filter(Boolean).join(' · '))}</div>
          </div>
          <div class="tz-hero-cta">
            <button type="button" class="tz-hero-btn tz-hero-btn--solid" data-tz-act="morgen">Morgen öffnen</button>
            <button type="button" class="tz-hero-btn" data-tz-act="kalender">Kalender</button>
          </div>
        </div>
      `;
      return;
    }

    heroEl.innerHTML = `
      <div class="tz-hero-kicker">
        <span class="tz-live-pill tz-live-pill--calm"><span class="tz-live-dot"></span>${istHeute ? (auf.gesamt > 0 ? 'Alle heutigen Termine erledigt' : 'Keine offenen Termine heute') : 'Keine Termine geplant'}</span>
        ${auf.gesamt > 0 ? `<span class="tz-hero-room">${auf.erledigt} / ${auf.gesamt} abgeschlossen</span>` : ''}
      </div>
      <div class="tz-hero-body">
        <div class="tz-hero-info">
          <h3 class="tz-hero-name">${auf.gesamt > 0 ? 'Feierabend im Tagesplan' : 'Tag ist aktuell frei'}</h3>
          <div class="tz-hero-meta">${!state.lueckenFehler && state.lueckenMin > 0 ? `${esc(dauerKurzText(state.lueckenMin))} buchbare Zeit verfügbar.` : 'Neuen Termin anlegen oder nächsten Tag prüfen.'}</div>
        </div>
        <div class="tz-hero-cta">
          <button type="button" class="tz-hero-btn tz-hero-btn--solid" data-tz-act="neu-termin">Termin anlegen</button>
          <button type="button" class="tz-hero-btn" data-tz-act="morgen">Nächster Tag</button>
        </div>
      </div>
    `;
  };

  const renderPlan = () => {
    const heuteIso = berlinIsoTag();
    const istHeute = state.zielIso === heuteIso;
    const auf = buchungenFuerTagAufbereiten(state.bookings, {
      heuteIso,
      zielIso: state.zielIso,
      teamMap: teamMap(),
      eigeneId: k.getUserId?.(),
      istOwner: k.istOwner?.(),
    });
    state.bookingById = new Map(auf.alle.map((e) => [String(e.id), e.raw]));

    if (state.behandlerFilter !== 'all' && !auf.behandlerChips.some((c) => c.id === state.behandlerFilter)) {
      state.behandlerFilter = 'all';
    }

    const titel = istHeute
      ? 'Tagesplan'
      : new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }).format(state.date);
    const zaehler = [
      auf.offen > 0 ? `${auf.offen} offen` : `${auf.gesamt} Termine`,
      !state.lueckenFehler && state.luecken.length > 0 ? `${state.luecken.length} Lücke${state.luecken.length === 1 ? '' : 'n'}` : '',
    ].filter(Boolean).join(' · ');

    const chipsHtml = `
      <div class="tz-chip-row">
        <button type="button" class="tz-chip ${!state.nurLuecken && state.behandlerFilter === 'all' ? 'is-on' : ''}" data-tz-filter="all">Alle (${auf.gesamt})</button>
        ${auf.behandlerChips.length > 1
          ? auf.behandlerChips.map((c, idx) => `
            <button type="button" class="tz-chip ${!state.nurLuecken && state.behandlerFilter === c.id ? 'is-on' : ''}" data-tz-filter="${esc(c.id)}">
              <span class="tz-dot" style="background:${idx % 2 === 0 ? 'var(--tz-ink)' : 'var(--tz-accent)'}"></span>${esc(c.name)} (${c.count})
            </button>`).join('')
          : ''}
        ${!state.lueckenFehler && state.luecken.length > 0
          ? `<button type="button" class="tz-chip tz-chip--gap ${state.nurLuecken ? 'is-on' : ''}" data-tz-gaps-only="1">Nur Lücken (${state.luecken.length})</button>`
          : ''}
      </div>
    `;

    const zeilen = zeitleisteZusammenfuehren(auf.alle, state.luecken, {
      behandlerFilter: state.behandlerFilter,
      nurLuecken: state.nurLuecken,
    });

    let bodyHtml = '';
    if (state.laden) {
      bodyHtml = '<div class="tz-empty">Termine werden geladen …</div>';
    } else if (state.fehler) {
      bodyHtml = '<div class="tz-empty">Termine konnten gerade nicht geladen werden.</div>';
    } else if (zeilen.length === 0) {
      bodyHtml = `<div class="tz-empty">
        <span>${state.nurLuecken ? 'Keine buchbaren Lücken für diesen Tag.' : (istHeute ? 'Keine Termine für heute eingetragen.' : 'Keine Termine an diesem Tag.')}</span>
        ${istHeute && state.morgenDaten?.anzahl ? `<button type="button" class="tz-mini-btn" data-tz-act="morgen">Morgen ansehen (${state.morgenDaten.anzahl}) ›</button>` : ''}
      </div>`;
    } else {
      bodyHtml = zeilen.map((z) => {
        if (z.typ === 'luecke') {
          const l = z.daten;
          return `<div class="tz-gap-row">
            <div class="tz-gap-left">
              ${ICO_CLOCK}
              <span><strong>${esc(l.start)} – ${esc(l.end)}</strong> · ${esc(dauerKurzText(l.min))} frei</span>
            </div>
            <button type="button" class="tz-gap-btn" data-tz-book-gap="${esc(`${state.zielIso}T${l.start}`)}">+ Buchen</button>
          </div>`;
        }
        const t = z.daten;
        const statusTxt = t.laeuft
          ? '<span class="tz-st tz-st--accent">· Läuft</span>'
          : t.abgeschlossen || t.vorbei
            ? `<span class="tz-st tz-st--ok">· ${t.noShow ? 'Nicht erschienen' : 'Erledigt'}</span>`
            : t.inMin !== null && t.inMin <= 90
              ? `<span class="tz-st">· in ${t.inMin} Min</span>`
              : t.hausbesuch
                ? '<span class="tz-st">· Hausbesuch</span>'
                : '';
        const meta = [t.leistung, t.vo, t.hausbesuch && !(t.inMin === null || t.inMin > 90) ? 'Hausbesuch' : '', t.behandler].filter(Boolean).join(' · ');
        const actionHtml = t.laeuft
          ? `<button type="button" class="tz-row-act" data-tz-booking="${esc(t.id)}">Öffnen</button>`
          : t.leadId
            ? `<button type="button" class="tz-row-act tz-row-act--ghost" data-tz-patient="${esc(t.leadId)}">Akte ›</button>`
            : `<button type="button" class="tz-row-act tz-row-act--ghost" data-tz-booking="${esc(t.id)}">Details ›</button>`;
        return `<div class="tz-tl-row ${t.laeuft ? 'is-now' : t.vorbei ? 'is-past' : ''}" data-tz-booking="${esc(t.id)}">
          <div class="tz-tl-time">${esc(t.startHhMm)}<span class="tz-tl-dur">${t.dauerMin} Min</span></div>
          <div class="tz-tl-main">
            <div class="tz-tl-pat">${esc(t.patient)} ${statusTxt}</div>
            <div class="tz-tl-meta">${esc(meta)}</div>
          </div>
          ${actionHtml}
        </div>`;
      }).join('');
    }

    const fehlerHinweis = state.lueckenFehler
      ? '<div class="tz-warn-foot">Freie Zeiten konnten nicht geladen werden.</div>'
      : '';

    planEl.innerHTML = `
      <div class="tz-card-head">
        <div class="tz-card-title-wrap">
          <h3 class="tz-card-title">${esc(titel)}</h3>
          <span class="tz-card-count">${esc(zaehler)}</span>
        </div>
        <div class="tz-head-tools">
          <button type="button" class="tz-mini-btn tz-mini-btn--ico" data-tz-step="prev" aria-label="Vorheriger Tag">‹</button>
          <button type="button" class="tz-mini-btn" data-tz-step="today">Heute</button>
          <button type="button" class="tz-mini-btn tz-mini-btn--ico" data-tz-step="next" aria-label="Nächster Tag">›</button>
          <button type="button" class="tz-mini-btn ${state.rasterOffen ? 'is-active' : ''}" data-tz-act="raster">${ICO_GRID}<span>Raster</span></button>
        </div>
      </div>
      ${chipsHtml}
      <div class="tz-tl-body">${bodyHtml}</div>
      ${fehlerHinweis}
    `;
  };

  const renderBedarf = () => {
    if (!k.istOwner?.() || !state.bedarf) {
      bedarfEl.hidden = true;
      return;
    }
    const { counts, eintraege } = state.bedarf;
    bedarfEl.hidden = false;
    const zeilenHtml = eintraege.length
      ? eintraege.map((e) => {
          const dotColor = e.schwere === 'danger' ? 'var(--tz-danger)' : e.schwere === 'accent' ? 'var(--tz-accent)' : 'var(--tz-border-strong)';
          return `<div class="tz-act-row">
            <div class="tz-act-left">
              <div class="tz-act-top"><span class="tz-dot" style="background:${dotColor}"></span>${esc(e.titel)}</div>
              <div class="tz-act-sub">${esc(e.sub)}</div>
            </div>
            <button type="button" class="tz-row-act" data-tz-need="${esc(e.aktion)}" data-tz-id="${esc(e.id)}" data-tz-quelle="${esc(e.quelle || '')}" data-tz-lead="${esc(e.leadId || '')}">${esc(e.cta)}</button>
          </div>`;
        }).join('')
      : '<div class="tz-empty tz-empty--sm">Aktuell kein dringender Handlungsbedarf.</div>';

    bedarfEl.innerHTML = `
      <div class="tz-card-head">
        <div class="tz-card-title-wrap">
          <h3 class="tz-card-title">Handlungsbedarf</h3>
          <span class="tz-card-count">${counts.gesamt} offen</span>
        </div>
        <button type="button" class="tz-mini-link" data-tz-act="ueberblick">Überblick ›</button>
      </div>
      <div class="tz-kpi-strip">
        <button type="button" class="tz-kpi-cell" data-tz-act="ueberblick-fristen">
          <span class="tz-kpi-n ${counts.fristenUeberfaellig > 0 ? 'is-danger' : ''}">${counts.fristen}</span>
          <span class="tz-kpi-l">Fristen</span>
        </button>
        <button type="button" class="tz-kpi-cell" data-tz-panel="anfragen">
          <span class="tz-kpi-n ${counts.anfragen > 0 ? 'is-accent' : ''}">${counts.anfragen}</span>
          <span class="tz-kpi-l">Anfragen</span>
        </button>
        <button type="button" class="tz-kpi-cell" data-tz-panel="warteliste">
          <span class="tz-kpi-n">${counts.warteliste}</span>
          <span class="tz-kpi-l">Warteliste</span>
        </button>
        <button type="button" class="tz-kpi-cell" data-tz-panel="ueberblick">
          <span class="tz-kpi-n">${counts.berichte}</span>
          <span class="tz-kpi-l">Berichte</span>
        </button>
      </div>
      <div>${zeilenHtml}</div>
    `;
  };

  const renderGeld = () => {
    if (!k.istOwner?.() || !state.geld || state.geld.status !== 'ok' || !state.geld.daten) {
      geldEl.hidden = true;
      return;
    }
    const d = state.geld.daten;
    const monat = monatText(d.monat);
    const fmt = (v) => (v === null ? '–' : fmtEur(v));
    geldEl.hidden = false;
    geldEl.innerHTML = `
      <div class="tz-card-head">
        <div class="tz-card-title-wrap">
          <h3 class="tz-card-title">Abrechnung${monat ? ` · ${esc(monat)}` : ''}</h3>
        </div>
        <button type="button" class="tz-mini-link" data-tz-panel="statistik">Auswertungen ›</button>
      </div>
      <div class="tz-pulse">
        <button type="button" class="tz-pulse-cell" data-tz-panel="statistik" title="Alle Zahlungen laut Zahlungsjournal (alle Standorte), Stornos abgezogen">
          <span class="tz-pulse-lbl">Kassiert</span>
          <span class="tz-pulse-val">${esc(fmt(d.kassiert))}</span>
          <span class="tz-pulse-sub">Monat laufend · Journal</span>
        </button>
        <button type="button" class="tz-pulse-cell" data-tz-panel="rechnungen">
          <span class="tz-pulse-lbl">Zuzahlung</span>
          <span class="tz-pulse-val">${esc(fmt(d.zuzahlungen?.summe ?? null))}</span>
          <span class="tz-pulse-sub">${d.zuzahlungen?.anzahl ?? '–'} offen</span>
        </button>
        <button type="button" class="tz-pulse-cell" data-tz-panel="rechnungen">
          <span class="tz-pulse-lbl">Offen gesamt</span>
          <span class="tz-pulse-val">${esc(fmt(d.offenGesamt))}</span>
          <span class="tz-pulse-sub">${d.mahnungenOffen ? `${d.mahnungenOffen} Mahnung${d.mahnungenOffen === 1 ? '' : 'en'}` : 'Belegliste'}</span>
        </button>
      </div>
    `;
  };

  const onClick = (ev) => {
    const target = /** @type {HTMLElement | null} */ (ev.target instanceof HTMLElement ? ev.target : null);
    if (!target) return;

    const gapBtn = target.closest('[data-tz-book-gap]');
    if (gapBtn) {
      ev.stopPropagation();
      k.oeffneTerminNeu?.(gapBtn.getAttribute('data-tz-book-gap'));
      return;
    }

    const patBtn = target.closest('[data-tz-patient]');
    if (patBtn) {
      ev.stopPropagation();
      const id = patBtn.getAttribute('data-tz-patient');
      if (id) k.oeffnePatient?.(id);
      return;
    }

    const bkBtn = target.closest('[data-tz-booking]');
    if (bkBtn) {
      const id = bkBtn.getAttribute('data-tz-booking');
      const bk = id ? state.bookingById.get(id) : null;
      if (bk) k.oeffneTerminAktion?.(bk);
      return;
    }

    const filterBtn = target.closest('[data-tz-filter]');
    if (filterBtn) {
      state.nurLuecken = false;
      state.behandlerFilter = filterBtn.getAttribute('data-tz-filter') || 'all';
      renderPlan();
      return;
    }

    if (target.closest('[data-tz-gaps-only]')) {
      state.nurLuecken = !state.nurLuecken;
      renderPlan();
      return;
    }

    const stepBtn = target.closest('[data-tz-step]');
    if (stepBtn) {
      const s = stepBtn.getAttribute('data-tz-step');
      if (s === 'prev') document.getElementById('gapsPrev')?.click();
      else if (s === 'next') document.getElementById('gapsNext')?.click();
      else if (s === 'today') document.getElementById('gapsToday')?.click();
      return;
    }

    const panelBtn = target.closest('[data-tz-panel]');
    if (panelBtn) {
      const p = panelBtn.getAttribute('data-tz-panel');
      if (p) k.wechslePanel?.(p);
      return;
    }

    const needBtn = target.closest('[data-tz-need]');
    if (needBtn) {
      const art = needBtn.getAttribute('data-tz-need');
      const id = needBtn.getAttribute('data-tz-id') || '';
      const quelle = needBtn.getAttribute('data-tz-quelle') || 'physio';
      const lead = needBtn.getAttribute('data-tz-lead') || '';
      if (art === 'rezept' && id) k.oeffneVerordnung?.(quelle, id);
      else if (art === 'patient' && (lead || id)) k.oeffnePatient?.(lead || id);
      else if (art === 'anfrage') {
        if (typeof /** @type {any} */ (k).oeffneAnfrage === 'function') /** @type {any} */ (k).oeffneAnfrage(id);
        else k.wechslePanel?.('anfragen');
      } else if (art === 'warteliste') {
        if (typeof /** @type {any} */ (k).oeffneWarteliste === 'function') /** @type {any} */ (k).oeffneWarteliste(id);
        else k.wechslePanel?.('warteliste');
      }
      return;
    }

    const actBtn = target.closest('[data-tz-act]');
    if (!actBtn) return;
    const act = actBtn.getAttribute('data-tz-act');
    if (act === 'neu-termin') k.oeffneTerminNeu?.(null);
    else if (act === 'scan') document.getElementById('rezeptScanBtn')?.click();
    else if (act === 'neu-patient') k.oeffnePatientNeu?.();
    else if (act === 'neu-vo') k.oeffneRezeptNeu?.();
    else if (act === 'ueberblick') k.wechslePanel?.('ueberblick');
    else if (act === 'ueberblick-fristen') {
      if (typeof /** @type {any} */ (k).oeffneUeberblickFristen === 'function') /** @type {any} */ (k).oeffneUeberblickFristen();
      else k.wechslePanel?.('ueberblick');
    }
    else if (act === 'kalender') k.oeffneKalenderTag?.(state.zielIso);
    else if (act === 'morgen') {
      document.getElementById('gapsNext')?.click();
    } else if (act === 'raster') {
      state.rasterOffen = !state.rasterOffen;
      panel.dataset.tzRaster = state.rasterOffen ? '1' : '0';
      renderPlan();
    }
  };

  panel.addEventListener('click', onClick);

  const gapsObs = new MutationObserver(() => {
    leseLueckenAusDom();
    renderHead();
    renderHero();
    renderPlan();
  });
  const gapsEl = document.getElementById('gapsList');
  if (gapsEl) gapsObs.observe(gapsEl, { childList: true, subtree: true, characterData: true });

  const welcomeObs = new MutationObserver(() => renderHead());
  const welcomeEl = document.getElementById('welcomeText');
  if (welcomeEl) welcomeObs.observe(welcomeEl, { childList: true, subtree: true, characterData: true });

  // Bei späterem Umschalten auf data-design="neu" sauber abbauen
  const designObs = new MutationObserver(() => {
    if (document.documentElement.getAttribute('data-design') === 'neu') abbauen();
  });
  designObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-design'] });

  const offVo = on('verordnungen:changed', () => {
    state.morgenGeprueftIso = '';
    void ladeOwnerHandlungsbedarf();
    void ladeOwnerGeld();
  });
  const offBk = on('bookings:changed', () => {
    state.morgenGeprueftIso = '';
    if (k.istOwner?.()) void ladeOwnerHandlungsbedarf();
  });
  const onUebersicht = () => {
    state.morgenGeprueftIso = '';
    if (Date.now() - bedarfStartMs > 800) {
      bedarfGeladen = false;
      geldGeladen = false;
      void ladeOwnerHandlungsbedarf();
      void ladeOwnerGeld();
    }
    leseLueckenAusDom();
    renderHead();
    renderHero();
    renderPlan();
  };
  document.addEventListener('praxura:uebersicht', onUebersicht);

  const tickTimer = setInterval(() => {
    if (!panel.classList.contains('active') || state.laden) return;
    leseLueckenAusDom();
    renderHead();
    renderHero();
    renderPlan();
  }, 60000);

  const abbauen = () => {
    panel.removeEventListener('click', onClick);
    document.removeEventListener('praxura:uebersicht', onUebersicht);
    offVo();
    offBk();
    clearInterval(tickTimer);
    gapsObs.disconnect();
    welcomeObs.disconnect();
    designObs.disconnect();
    if (geldCtrl) geldCtrl.abort();
    delete panel.dataset.tz;
    delete panel.dataset.tzRaster;
    headEl.remove();
    colLeftEl.remove();
    bedarfEl.remove();
    geldEl.remove();
  };

  // Initialer Stand
  leseLueckenAusDom();
  renderHead();
  renderHero();
  renderPlan();

  return {
    termine(info = {}) {
      if (info.date instanceof Date) {
        state.date = info.date;
        state.zielIso = berlinIsoTag(info.date);
      }
      if (info.laden) {
        state.laden = true;
        renderHero();
        renderPlan();
        return;
      }
      state.laden = false;
      state.fehler = !!info.error;
      state.bookings = Array.isArray(info.bookings) ? info.bookings : [];
      leseLueckenAusDom();
      renderHead();
      renderHero();
      renderPlan();

      const heuteIso = berlinIsoTag();
      if (state.zielIso === heuteIso) {
        const auf = buchungenFuerTagAufbereiten(state.bookings, {
          heuteIso,
          zielIso: heuteIso,
          teamMap: teamMap(),
          eigeneId: k.getUserId?.(),
          istOwner: k.istOwner?.(),
        });
        if (auf.offen === 0) void pruefeMorgenFallsAbend(heuteIso);
      }
      if (!bedarfGeladen) void ladeOwnerHandlungsbedarf();
      if (!geldGeladen) void ladeOwnerGeld();
    },
    neuLaden() {
      bedarfGeladen = false;
      geldGeladen = false;
      void ladeOwnerHandlungsbedarf();
      void ladeOwnerGeld();
    },
    abbauen,
  };
}
