/**
 * module/ueberblick-ansicht.js — Praxis-Überblick (ruhiges, dichtes Praxis-Cockpit).
 *
 * Funktionen:
 *  - Durchgehendes 5-Spalten-Kennzahlenband (Termine heute · Fristen & Prüfbedarf ·
 *    Eingänge · Offene Posten bzw. Nicht erschienen · Team & Aufgaben)
 *  - Nächste 7 Tage: kompakte Balken-Auslastung mit exaktem Tagessprung in den Kalender
 *  - Rezept-Fristen & Berichte: Unterstrich-Tabs (Alle · Überfällig · ≤ 7 T. · 8–28 T. ·
 *    Abrechnung · Therapieberichte · Prüfbedarf für Absetzungen & offene OCR-Scans),
 *    Direkt-Anruf (`tel:`), Patientenakte & Rezept-Sprung
 *  - Vorgänge & Eingänge: Termin-Anfragen · Warteliste · Aufgaben (direkt abhakbar!) ·
 *    Offene Rechnungen (Inhaber, inkl. Direkt-Öffnen)
 *  - Rechte Spalte: Nicht erschienen (inkl. Direkt-Anruf) · Abwesenheiten (14/30 T.) ·
 *    Geburtstage (7/14/30 T.)
 *  - Kopfleiste: Live-Suche, Umschalter Praxis / Meine (bei Mehrbehandler-Praxen),
 *    automatische Aktualisierung über `signal.js`
 *
 * Null Emojis. Einmalige Event-Delegation, Rennbedingungs-Schutz (`laufNr`),
 * Mandanten- und Standort-Scope (`bizScope`) sowie strikte Rollen-/Sichtbarkeitsprüfung.
 */

import {
  addiereTageIso,
  wochenAuslastungAufbereiten,
  fristenAuswerten,
  therapieberichteAufbereiten,
  rezeptPruefbedarfAufbereiten,
  anfragenAufbereiten,
  wartelisteAufbereiten,
  aufgabenAufbereiten,
  rechnungenAufbereiten,
  geburtstageAufbereiten,
  abwesenheitenAufbereiten,
  abwesenheitKachelAuswerten,
  nichtErscheinerAufbereiten,
  suchePasst,
} from './ueberblick-listen.js?v=20261121f07';
import { ladeOffeneVerordnungenPaginiert, RX_FRISTEN_SELECT_VOLL } from './verordnung-fristen-laden.js?v=20261121f01';
import { alsBerlinDatum, berlinTagesgrenzen } from './berlin-datum.js';
import { fmtEur } from './geld.js?v=20260909';
import { on } from './signal.js?v=20260813';

const escStandard = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const HAKEN_SVG = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

/** @type {{
 *   heuteIso: string,
 *   geladenUm: string,
 *   geladenDatum: Date,
 *   laedt: boolean,
 *   istOwner: boolean,
 *   userId: string|null,
 *   hatTeam: boolean,
 *   scopeModus: 'praxis'|'meine',
 *   suche: string,
 *   fristTab: 'alle'|'ueberfaellig'|'bald'|'geplant'|'abrechnung'|'berichte'|'pruefbedarf',
 *   vorgangTab: 'anfragen'|'warteliste'|'aufgaben'|'rechnungen'|null,
 *   vorgangManuell: boolean,
 *   abwesenheitTage: 14|30,
 *   geburtstagTage: 7|14|30,
 *   wocheRoh: any[],
 *   wocheFehler: boolean,
 *   fristen: any[],
 *   berichte: any[],
 *   pruefbedarf: any[],
 *   fristenFehler: boolean,
 *   anfragen: any[],
 *   anfragenFehler: boolean,
 *   warteliste: any[],
 *   wartelisteFehler: boolean,
 *   aufgaben: any[],
 *   aufgabenFehler: boolean,
 *   rechnungen: { liste: any[], summeEur: number, ueberfaelligAnzahl: number },
 *   rechnungenFehler: boolean,
 *   noShows: any[],
 *   noShowsFehler: boolean,
 *   abwesenheitenRoh: any[],
 *   abwesenheitenFehler: boolean,
 *   geburtstageRoh: any[],
 *   geburtstageFehler: boolean,
 * }} */
const state = {
  heuteIso: '',
  geladenUm: '',
  geladenDatum: new Date(),
  laedt: false,
  istOwner: false,
  userId: null,
  hatTeam: false,
  scopeModus: 'praxis',
  suche: '',
  fristTab: 'alle',
  vorgangTab: null,
  vorgangManuell: false,
  abwesenheitTage: 14,
  geburtstagTage: 7,
  wocheRoh: [],
  wocheFehler: false,
  fristen: [],
  berichte: [],
  pruefbedarf: [],
  fristenFehler: false,
  anfragen: [],
  anfragenFehler: false,
  warteliste: [],
  wartelisteFehler: false,
  aufgaben: [],
  aufgabenFehler: false,
  rechnungen: { liste: [], summeEur: 0, ueberfaelligAnzahl: 0 },
  rechnungenFehler: false,
  noShows: [],
  noShowsFehler: false,
  abwesenheitenRoh: [],
  abwesenheitenFehler: false,
  geburtstageRoh: [],
  geburtstageFehler: false,
};

let laufNr = 0;
let aktiverKontext = null;
let signalTimer = null;
let signaleAktiv = false;
/** @type {{ ziel: string, fristTab?: string } | null} */
let ausstehenderFokus = null;

/**
 * Merkt einen Zielbereich im Überblick vor (z. B. Sprung von Dashboard „Fristen“
 * direkt zu `#ublDeadlinesSection` mit Tab „Alle“ und geleerter Suche, F-10).
 *
 * @param {'deadlines' | 'vorgaenge' | 'rechnungen' | 'noshows' | 'vacations'} ziel
 * @param {{ fristTab?: 'alle' | 'ueberfaellig' | 'bald' | 'geplant' | 'abrechnung' | 'berichte' | 'pruefbedarf' }} [opts]
 */
export function fokussiereUeberblickBereich(ziel, { fristTab } = {}) {
  ausstehenderFokus = { ziel, fristTab };
  if (fristTab) state.fristTab = fristTab;
  if (state.suche) {
    state.suche = '';
    if (typeof document !== 'undefined') {
      const sEl = /** @type {HTMLInputElement | null} */ (document.getElementById('ublSearch'));
      const cEl = document.getElementById('ublSearchClear');
      if (sEl) sEl.value = '';
      if (cEl) cEl.hidden = true;
    }
  }
}

function wendeAusstehendenFokusAn() {
  if (!ausstehenderFokus) return;
  const { ziel, fristTab } = ausstehenderFokus;
  ausstehenderFokus = null;
  if (fristTab && state.fristTab !== fristTab) {
    state.fristTab = fristTab;
    renderDeadlines();
  }
  const zielId = {
    deadlines: 'ublDeadlinesSection',
    vorgaenge: 'ublVorgaengeSection',
    rechnungen: 'ublVorgaengeSection',
    noshows: 'ublNoShowSection',
    vacations: 'ublVacationSection',
  }[ziel];
  const el = typeof document !== 'undefined' && zielId ? document.getElementById(zielId) : null;
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

const inLeiste = (panel) => !!document.querySelector(`#sidebarNav .sidebar-item[data-panel="${panel}"]`);
const nurMeine = () => state.scopeModus === 'meine' && !!state.userId;

function uhrzeitJetztBerlin() {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date());
}

function datumKopfBerlin() {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Berlin',
  }).format(new Date());
}

function skelettHtml(zeilen = 3) {
  return `<div class="ubl-skeleton-wrap">${Array.from({ length: zeilen }, (_, i) =>
    `<div class="ubl-skeleton${i === zeilen - 1 ? ' ubl-skeleton--short' : ''}"></div>`
  ).join('')}</div>`;
}

function leerHtml(text) {
  return `<div class="ubl-empty">${escStandard(text)}</div>`;
}

function gefilterteWoche() {
  const quelle = nurMeine()
    ? state.wocheRoh.filter(b => b.user_id === state.userId)
    : state.wocheRoh;
  return wochenAuslastungAufbereiten(quelle, state.heuteIso, state.geladenDatum);
}

function gefilterteNoShows() {
  return nurMeine() ? state.noShows.filter(n => n.userId === state.userId) : state.noShows;
}

function gefilterteAbwesenheiten(tage = state.abwesenheitTage) {
  const alle = abwesenheitenAufbereiten(state.abwesenheitenRoh, state.heuteIso, tage);
  return nurMeine() ? alle.filter(a => a.employeeId === state.userId) : alle;
}

function gefilterteAufgaben() {
  return nurMeine() ? state.aufgaben.filter(a => a.erstelltVon === state.userId) : state.aufgaben;
}

function verfuegbareVorgangTabs() {
  const tabs = [];
  if (state.istOwner && inLeiste('anfragen')) tabs.push('anfragen');
  if (inLeiste('warteliste')) tabs.push('warteliste');
  tabs.push('aufgaben');
  if (state.istOwner && inLeiste('rechnungen')) tabs.push('rechnungen');
  return tabs;
}

function waehleVorgangTab() {
  const verfuegbar = verfuegbareVorgangTabs();
  if (state.vorgangManuell && state.vorgangTab && verfuegbar.includes(state.vorgangTab)) {
    return state.vorgangTab;
  }
  const aufg = gefilterteAufgaben();
  const anzahlFuer = {
    anfragen: state.anfragen.length,
    warteliste: state.warteliste.length,
    aufgaben: aufg.length,
    rechnungen: state.rechnungen.liste.length,
  };
  const mitDaten = verfuegbar.find(t => anzahlFuer[/** @type {keyof typeof anzahlFuer} */ (t)] > 0);
  state.vorgangTab = /** @type {any} */ (mitDaten || verfuegbar[0] || 'aufgaben');
  return state.vorgangTab;
}

function renderScopeToggle() {
  const wrap = document.getElementById('ublScopeToggle');
  if (!wrap) return;
  wrap.hidden = !state.hatTeam || !state.userId;
  wrap.querySelectorAll('[data-ubl-scope]').forEach(btn => {
    const aktiv = btn.getAttribute('data-ubl-scope') === state.scopeModus;
    btn.classList.toggle('is-active', aktiv);
    btn.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
  });
}

function renderKopfSub() {
  const sub = document.getElementById('ublHeaderSub');
  if (!sub) return;
  const datum = datumKopfBerlin();
  if (state.laedt && !state.geladenUm) {
    sub.textContent = `${datum} · Daten werden geladen …`;
    return;
  }
  const teile = [datum];
  if (nurMeine()) teile.push('Nur meine Einträge');
  if (state.geladenUm) teile.push(`Stand ${state.geladenUm} Uhr`);
  sub.textContent = teile.join(' · ');
}

function renderMetricBar() {
  const el = document.getElementById('ublKpiBar');
  if (!el) return;

  const initLoad = state.laedt && !state.geladenUm;
  const val = (v, fehler) => (initLoad || fehler ? '–' : String(v));

  // 1. Termine heute
  const w = state.wocheFehler ? null : gefilterteWoche();
  let heuteStatus = 'Keine Termine';
  if (w && w.heuteGesamt > 0) {
    heuteStatus = w.heuteOffen > 0 ? `${w.heuteOffen} offen` : 'Alle erledigt';
  }
  const heuteSub = state.wocheFehler
    ? 'Nicht verfügbar'
    : w
      ? [
          heuteStatus,
          w.heuteHausbesuche > 0 ? `${w.heuteHausbesuche} Hausbesuch${w.heuteHausbesuche === 1 ? '' : 'e'}` : `${w.gesamt7} in 7 T.`,
        ].join(' · ')
      : '—';

  // 2. Rezept-Fristen & Prüfbedarf (Rot NUR bei echten Überfälligkeiten oder Absetzungen)
  const ueberfaellig = state.fristen.filter(f => f.kategorie === 'ueberfaellig').length;
  const bald = state.fristen.filter(f => f.kategorie === 'bald').length;
  const absetzungen = state.pruefbedarf.filter(p => p.art === 'absetzung').length;
  const fristTon = ueberfaellig > 0 || absetzungen > 0 ? ' is-danger' : '';
  const fristSub = state.fristenFehler
    ? 'Nicht verfügbar'
    : [
        ueberfaellig > 0 ? `${ueberfaellig} überfällig` : bald > 0 ? `${bald} in ≤ 7 T.` : 'Im Plan',
        state.pruefbedarf.length > 0
          ? `${state.pruefbedarf.length} Prüfbedarf`
          : state.berichte.length > 0
            ? `${state.berichte.length} ${state.berichte.length === 1 ? 'Bericht' : 'Berichte'}`
            : '',
      ].filter(Boolean).join(' · ');

  // 3. Eingänge (Anfragen + Warteliste)
  const hatAnf = state.istOwner && inLeiste('anfragen');
  const hatWl = inLeiste('warteliste');
  const aufg = gefilterteAufgaben();
  const eingangGesamt = (hatAnf ? state.anfragen.length : 0) + (hatWl ? state.warteliste.length : 0);
  const eingangTeile = [];
  if (hatAnf) eingangTeile.push(`${state.anfragen.length} Anfragen`);
  if (hatWl) eingangTeile.push(`${state.warteliste.length} Warteliste`);
  const eingangSub = eingangTeile.length ? eingangTeile.join(' · ') : `${aufg.length} offene Aufgaben`;
  const eingangWert = eingangTeile.length ? eingangGesamt : aufg.length;
  const eingangLabel = eingangTeile.length ? 'Eingänge' : 'Aufgaben';

  // 4. Offene Posten (Inhaber mit Rechnungen) oder Nicht erschienen
  const noShows = gefilterteNoShows();
  const zeigtFinanz = state.istOwner && inLeiste('rechnungen');
  const m4Label = zeigtFinanz ? 'Offene Posten' : 'Nicht erschienen';
  const m4Val = zeigtFinanz
    ? (initLoad || state.rechnungenFehler ? '–' : fmtEur(state.rechnungen.summeEur))
    : val(noShows.length, state.noShowsFehler);
  const m4Sub = zeigtFinanz
    ? (state.rechnungenFehler
      ? 'Nicht verfügbar'
      : state.rechnungen.liste.length === 0
        ? 'Keine offenen Rechnungen'
        : `${state.rechnungen.liste.length} offen${state.rechnungen.ueberfaelligAnzahl > 0 ? ` · ${state.rechnungen.ueberfaelligAnzahl} > 14 T.` : ''}`)
    : (state.noShowsFehler ? 'Nicht verfügbar' : noShows.length > 0 ? 'Nachfassen empfohlen' : 'Keine Ausfälle');
  const m4Focus = zeigtFinanz ? 'rechnungen' : 'noshows';

  // 5. Abwesenheiten (fester 14-Tage-Zeitraum, entkoppelt vom Listenfilter; F-07 / 9.6)
  const abw14 = gefilterteAbwesenheiten(14);
  const ueberfAufg = aufg.filter(a => a.ueberfaellig).length;
  const abwKachel = abwesenheitKachelAuswerten(abw14, {
    aufgabenAnzahl: aufg.length,
    ueberfAufgaben: ueberfAufg,
    aufgabenFehler: state.aufgabenFehler,
    abwesenheitenFehler: state.abwesenheitenFehler,
  });
  const m5Val = val(abwKachel.anzahl, state.abwesenheitenFehler);
  const m5Sub = abwKachel.untertitel;

  el.innerHTML = `
    <button type="button" class="ubl-metric" data-ubl-cal-date="${escStandard(state.heuteIso)}">
      <span class="ubl-metric-lbl">Termine heute</span>
      <span class="ubl-metric-val">${val(w?.heuteGesamt ?? 0, state.wocheFehler)}</span>
      <span class="ubl-metric-sub">${escStandard(heuteSub)}</span>
    </button>
    <button type="button" class="ubl-metric${fristTon}" data-ubl-focus="deadlines">
      <span class="ubl-metric-lbl">Rezept-Fristen</span>
      <span class="ubl-metric-val">${val(state.fristen.length, state.fristenFehler)}</span>
      <span class="ubl-metric-sub">${escStandard(fristSub)}</span>
    </button>
    <button type="button" class="ubl-metric" data-ubl-focus="vorgaenge">
      <span class="ubl-metric-lbl">${escStandard(eingangLabel)}</span>
      <span class="ubl-metric-val">${val(eingangWert, false)}</span>
      <span class="ubl-metric-sub">${escStandard(eingangSub)}</span>
    </button>
    <button type="button" class="ubl-metric" data-ubl-focus="${m4Focus}">
      <span class="ubl-metric-lbl">${escStandard(m4Label)}</span>
      <span class="ubl-metric-val">${escStandard(m4Val)}</span>
      <span class="ubl-metric-sub">${escStandard(m4Sub)}</span>
    </button>
    <button type="button" class="ubl-metric" data-ubl-focus="vacations">
      <span class="ubl-metric-lbl">Abwesenheiten (14 T.)</span>
      <span class="ubl-metric-val">${escStandard(m5Val)}</span>
      <span class="ubl-metric-sub">${escStandard(m5Sub)}</span>
    </button>
  `;
}

function renderWeekStrip() {
  const bodyEl = document.getElementById('ublWeekBody');
  const sumEl = document.getElementById('ublWeekSum');
  const calLink = document.getElementById('ublWeekCalLink');
  if (!bodyEl) return;

  if (calLink) calLink.hidden = !inLeiste('calendar');

  if (state.laedt && !state.geladenUm) {
    bodyEl.innerHTML = skelettHtml(2);
    return;
  }

  if (state.wocheFehler) {
    if (sumEl) sumEl.textContent = '';
    bodyEl.innerHTML = leerHtml('Terminauslastung konnte gerade nicht geladen werden.');
    return;
  }

  const { tage, gesamt7, hausbesuche7 } = gefilterteWoche();
  if (sumEl) {
    sumEl.textContent = `${gesamt7} ${gesamt7 === 1 ? 'Termin' : 'Termine'}${hausbesuche7 > 0 ? ` · ${hausbesuche7} HB` : ''}`;
  }

  bodyEl.innerHTML = `<div class="ubl-week-body">${tage.map(t => {
    const klassen = [
      'ubl-day',
      t.istHeute ? 'is-today' : '',
      t.istWochenende ? 'is-weekend' : '',
      t.anzahl === 0 ? 'is-zero' : '',
    ].filter(Boolean).join(' ');
    const label = t.istHeute ? 'Heute' : `${t.wochentag} ${t.tagKurz}`;
    const titel = `${t.wochentag} ${t.tagKurz}: ${t.anzahl} Termine${t.hausbesuche > 0 ? `, davon ${t.hausbesuche} Hausbesuche` : ''} — klicken für Tagesansicht`;
    return `
      <button type="button" class="${klassen}" data-ubl-cal-date="${escStandard(t.tagIso)}" title="${escStandard(titel)}">
        <span class="ubl-day-num">${t.anzahl}</span>
        <span class="ubl-day-track" aria-hidden="true">
          ${t.prozent > 0 ? `<span class="ubl-day-bar" style="height:${t.prozent}%"></span>` : ''}
        </span>
        <span class="ubl-day-lbl">${escStandard(label)}</span>
      </button>
    `;
  }).join('')}</div>`;
}

function renderDeadlines() {
  const listEl = document.getElementById('ublDeadlinesList');
  const filterEl = document.getElementById('ublDeadlineFilters');
  const countEl = document.getElementById('ublDeadlinesCount');
  const footEl = document.getElementById('ublDeadlinesFoot');
  const linkEl = document.getElementById('ublDeadlinesAllLink');
  if (!listEl) return;

  if (linkEl) linkEl.hidden = !inLeiste('verordnungen');

  const fristenSuche = state.fristen.filter(f =>
    suchePasst(state.suche, [f.patientName, f.artLabel, f.kontextMeta, f.stichtagDe, f.fristLabel])
  );
  const berichteSuche = state.berichte.filter(b =>
    suchePasst(state.suche, [b.patientName, b.kontextMeta, b.ausgestelltDe, 'Therapiebericht'])
  );
  const pruefSuche = state.pruefbedarf.filter(p =>
    suchePasst(state.suche, [p.patientName, p.etikett, p.hinweis, p.kontextMeta, p.ausgestelltDe])
  );

  const z = {
    alle: fristenSuche.length,
    ueberfaellig: fristenSuche.filter(f => f.kategorie === 'ueberfaellig').length,
    bald: fristenSuche.filter(f => f.kategorie === 'bald').length,
    geplant: fristenSuche.filter(f => f.kategorie === 'geplant').length,
    abrechnung: fristenSuche.filter(f => f.kategorie === 'abrechnung').length,
    berichte: berichteSuche.length,
    pruefbedarf: pruefSuche.length,
  };
  const hatAbsetzung = pruefSuche.some(p => p.art === 'absetzung');

  if (countEl) {
    countEl.textContent = String(z.alle);
    countEl.classList.toggle('is-danger', z.ueberfaellig > 0 || hatAbsetzung);
  }

  if (filterEl) {
    const tabs = [
      { id: 'alle', label: 'Alle', n: z.alle },
      { id: 'ueberfaellig', label: 'Überfällig', n: z.ueberfaellig, danger: z.ueberfaellig > 0 },
      { id: 'bald', label: '≤ 7 T.', n: z.bald },
      { id: 'geplant', label: '8–28 T.', n: z.geplant },
      { id: 'abrechnung', label: 'Abrechnung', n: z.abrechnung },
      { id: 'berichte', label: 'Berichte', n: z.berichte },
      { id: 'pruefbedarf', label: 'Prüfung', n: z.pruefbedarf, danger: hatAbsetzung },
    ];
    filterEl.innerHTML = tabs.map(t => `
      <button type="button"
        role="tab"
        class="ubl-tab${state.fristTab === t.id ? ' is-active' : ''}${t.danger ? ' is-danger-n' : ''}"
        data-ubl-frist-filter="${t.id}"
        aria-selected="${state.fristTab === t.id ? 'true' : 'false'}">
        <span>${t.label}</span>
        <span class="ubl-tab-n">${t.n}</span>
      </button>
    `).join('');
  }

  if (state.laedt && !state.geladenUm) {
    listEl.innerHTML = skelettHtml(4);
    if (footEl) footEl.hidden = true;
    return;
  }

  if (state.fristenFehler) {
    listEl.innerHTML = leerHtml('Rezept-Fristen konnten gerade nicht geladen werden.');
    if (footEl) footEl.hidden = true;
    return;
  }

  const kannVerordnung = inLeiste('verordnungen');
  const esc = aktiverKontext?.escapeHtml || escStandard;

  if (state.fristTab === 'pruefbedarf') {
    if (!pruefSuche.length) {
      listEl.innerHTML = leerHtml(
        state.suche.trim() ? 'Kein Prüfbedarf passend zur Suche.' : 'Keine offenen Scans oder Absetzungen.'
      );
      if (footEl) footEl.hidden = true;
      return;
    }
    listEl.innerHTML = pruefSuche.map(p => {
      const nameHtml = p.patientId
        ? `<button type="button" class="ubl-name-btn" data-ubl-patient="${esc(p.patientId)}">${esc(p.patientName)}</button>`
        : `<span class="ubl-name-plain">${esc(p.patientName)}</span>`;
      const aktionen = [
        p.patientId ? `<button type="button" class="ubl-link" data-ubl-patient="${esc(p.patientId)}">Akte</button>` : '',
        kannVerordnung && p.rxId ? `<button type="button" class="ubl-link" data-ubl-rx="${esc(p.rxId)}" data-ubl-quelle="${esc(p.quelle)}">Rezept</button>` : '',
      ].filter(Boolean).join('<span class="ubl-dot-sep" aria-hidden="true">·</span>');
      return `
        <div class="ubl-row">
          <div class="ubl-row-main">
            <div class="ubl-row-top">
              <span class="ubl-dot${p.schwere === 'danger' ? ' ubl-dot--danger' : ' ubl-dot--warn'}" aria-hidden="true"></span>
              ${nameHtml}
              <span class="ubl-tag${p.schwere === 'danger' ? ' ubl-tag--danger' : ''}">${esc(p.etikett)}</span>
            </div>
            <div class="ubl-meta">${esc(p.kontextMeta)}</div>
          </div>
          <div class="ubl-row-right">
            <div class="ubl-val-col">
              <span class="ubl-val-primary${p.schwere === 'danger' ? ' is-danger' : ''}">${esc(p.hinweis)}</span>
              <span class="ubl-val-sub">vom ${esc(p.ausgestelltDe)}</span>
            </div>
            ${aktionen ? `<div class="ubl-links">${aktionen}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
    if (footEl) {
      footEl.hidden = false;
      footEl.innerHTML = `<span>${pruefSuche.length} ${pruefSuche.length === 1 ? 'Verordnung' : 'Verordnungen'} mit Prüfbedarf</span><span>Absetzungen & unbestätigte OCR-Scans</span>`;
    }
    return;
  }

  if (state.fristTab === 'berichte') {
    if (!berichteSuche.length) {
      listEl.innerHTML = leerHtml(
        state.suche.trim() ? 'Keine Therapieberichte passend zur Suche.' : 'Keine offenen Therapieberichte angefordert.'
      );
      if (footEl) footEl.hidden = true;
      return;
    }
    listEl.innerHTML = berichteSuche.map(b => {
      const nameHtml = b.patientId
        ? `<button type="button" class="ubl-name-btn" data-ubl-patient="${esc(b.patientId)}">${esc(b.patientName)}</button>`
        : `<span class="ubl-name-plain">${esc(b.patientName)}</span>`;
      const aktionen = [
        b.patientId ? `<button type="button" class="ubl-link" data-ubl-patient="${esc(b.patientId)}">Akte</button>` : '',
        kannVerordnung && b.rxId ? `<button type="button" class="ubl-link" data-ubl-rx="${esc(b.rxId)}" data-ubl-quelle="${esc(b.quelle)}">Rezept</button>` : '',
      ].filter(Boolean).join('<span class="ubl-dot-sep" aria-hidden="true">·</span>');
      return `
        <div class="ubl-row">
          <div class="ubl-row-main">
            <div class="ubl-row-top">
              ${nameHtml}
              <span class="ubl-tag ubl-tag--accent">Bericht offen</span>
            </div>
            <div class="ubl-meta">${esc(b.kontextMeta)}</div>
          </div>
          <div class="ubl-row-right">
            <div class="ubl-val-col">
              <span class="ubl-val-primary">Angefordert</span>
              <span class="ubl-val-sub">vom ${esc(b.ausgestelltDe)}</span>
            </div>
            ${aktionen ? `<div class="ubl-links">${aktionen}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
    if (footEl) {
      footEl.hidden = false;
      footEl.innerHTML = `<span>${berichteSuche.length} ${berichteSuche.length === 1 ? 'offener Therapiebericht' : 'offene Therapieberichte'}</span><span>Vor Abrechnung freigeben</span>`;
    }
    return;
  }

  const sichtbar = state.fristTab === 'alle'
    ? fristenSuche
    : fristenSuche.filter(f => f.kategorie === state.fristTab);

  if (!sichtbar.length) {
    const text = state.suche.trim()
      ? 'Keine Rezept-Fristen passend zur Suche.'
      : state.fristTab !== 'alle'
        ? 'In dieser Kategorie liegen aktuell keine Fristen.'
        : 'Keine dringenden Fristen. Alle laufenden Verordnungen sind im Plan.';
    listEl.innerHTML = leerHtml(text);
    if (footEl) footEl.hidden = true;
    return;
  }

  listEl.innerHTML = sichtbar.map(f => {
    const dotHtml = f.schwere === 'danger'
      ? '<span class="ubl-dot ubl-dot--danger" aria-hidden="true"></span>'
      : f.schwere === 'warning'
        ? '<span class="ubl-dot ubl-dot--warn" aria-hidden="true"></span>'
        : '';
    const valKlasse = f.schwere === 'danger' ? ' is-danger' : '';
    const nameHtml = f.patientId
      ? `<button type="button" class="ubl-name-btn" data-ubl-patient="${esc(f.patientId)}">${esc(f.patientName)}</button>`
      : `<span class="ubl-name-plain">${esc(f.patientName)}</span>`;
    const metaZeile = [f.artLabel, f.kontextMeta].filter(Boolean).join(' · ');
    const zeigeAnruf = f.telefon && (f.schwere === 'danger' || f.schwere === 'warning');
    const aktionen = [
      zeigeAnruf ? `<a class="ubl-link" href="${esc(f.telefon.href)}" title="Anrufen: ${esc(f.telefon.anzeige)}">Anrufen</a>` : '',
      f.patientId ? `<button type="button" class="ubl-link" data-ubl-patient="${esc(f.patientId)}">Akte</button>` : '',
      kannVerordnung && f.rxId ? `<button type="button" class="ubl-link" data-ubl-rx="${esc(f.rxId)}" data-ubl-quelle="${esc(f.quelle)}">Rezept</button>` : '',
    ].filter(Boolean).join('<span class="ubl-dot-sep" aria-hidden="true">·</span>');
    // Höchstens ein Etikett je Zeile (E12)
    const etikett = f.dringend
      ? '<span class="ubl-tag">Dringend</span>'
      : f.anzahl > 1
        ? `<span class="ubl-tag">${f.anzahl}×</span>`
        : '';

    return `
      <div class="ubl-row">
        <div class="ubl-row-main">
          <div class="ubl-row-top">
            ${dotHtml}
            ${nameHtml}
            ${etikett}
          </div>
          <div class="ubl-meta">${esc(metaZeile)}</div>
        </div>
        <div class="ubl-row-right">
          <div class="ubl-val-col">
            <span class="ubl-val-primary${valKlasse}">${esc(f.fristLabel)}</span>
            <span class="ubl-val-sub">bis ${esc(f.stichtagDe)}</span>
          </div>
          ${aktionen ? `<div class="ubl-links">${aktionen}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (footEl) {
    const gesamtRezepte = sichtbar.reduce((s, f) => s + f.anzahl, 0);
    footEl.hidden = false;
    footEl.innerHTML = `<span>${sichtbar.length} ${sichtbar.length === 1 ? 'Eintrag' : 'Einträge'} (${gesamtRezepte} ${gesamtRezepte === 1 ? 'Verordnung' : 'Verordnungen'})</span><span>HeilM-RL § 15 · 14/28 Tage Beginnfrist</span>`;
  }
}

function renderVorgaenge() {
  const tabsEl = document.getElementById('ublVorgaengeTabs');
  const listEl = document.getElementById('ublVorgaengeList');
  const linkEl = document.getElementById('ublVorgaengeLink');
  if (!tabsEl || !listEl) return;

  const verfuegbar = verfuegbareVorgangTabs();
  const aktiv = waehleVorgangTab();

  const anfSuche = state.anfragen.filter(a => suchePasst(state.suche, [a.name, a.wunsch, a.art, a.leistung]));
  const wlSuche = state.warteliste.filter(w => suchePasst(state.suche, [w.name, w.leistung, w.prioLabel]));
  const aufgSuche = gefilterteAufgaben().filter(a => suchePasst(state.suche, [a.text, a.patientName, a.faelligLabel]));
  const rechSuche = state.rechnungen.liste.filter(r => suchePasst(state.suche, [r.nummer, r.patientName, r.datumDe]));

  const metaTabs = {
    anfragen: { label: 'Termin-Anfragen', n: anfSuche.length, panel: 'anfragen', linkText: 'Alle Anfragen' },
    warteliste: { label: 'Warteliste', n: wlSuche.length, panel: 'warteliste', linkText: 'Zur Warteliste' },
    aufgaben: { label: 'Aufgaben', n: aufgSuche.length, panel: 'overview', linkText: 'Zum Dashboard' },
    rechnungen: { label: 'Offene Rechnungen', n: rechSuche.length, panel: 'rechnungen', linkText: 'Alle Rechnungen' },
  };

  tabsEl.innerHTML = verfuegbar.map(id => {
    const m = metaTabs[/** @type {keyof typeof metaTabs} */ (id)];
    const warn = id === 'aufgaben' && aufgSuche.some(a => a.ueberfaellig);
    return `
      <button type="button"
        role="tab"
        class="ubl-tab${aktiv === id ? ' is-active' : ''}${warn ? ' is-danger-n' : ''}"
        data-ubl-vorgang-tab="${id}"
        aria-selected="${aktiv === id ? 'true' : 'false'}">
        <span>${m.label}</span>
        <span class="ubl-tab-n">${m.n}</span>
      </button>
    `;
  }).join('');

  const aktivMeta = metaTabs[/** @type {keyof typeof metaTabs} */ (aktiv)];
  if (linkEl && aktivMeta) {
    linkEl.hidden = !inLeiste(aktivMeta.panel);
    linkEl.setAttribute('data-ubl-panel', aktivMeta.panel);
    const span = linkEl.querySelector('span');
    if (span) span.textContent = aktivMeta.linkText;
  }

  if (state.laedt && !state.geladenUm) {
    listEl.innerHTML = skelettHtml(3);
    return;
  }

  const esc = aktiverKontext?.escapeHtml || escStandard;

  if (aktiv === 'anfragen') {
    if (state.anfragenFehler) { listEl.innerHTML = leerHtml('Termin-Anfragen konnten nicht geladen werden.'); return; }
    if (!anfSuche.length) {
      listEl.innerHTML = leerHtml(state.suche.trim() ? 'Keine Anfragen passend zur Suche.' : 'Keine offenen Online-Terminanfragen.');
      return;
    }
    listEl.innerHTML = anfSuche.slice(0, 6).map(a => `
      <div class="ubl-row">
        <div class="ubl-row-main">
          <div class="ubl-row-top">
            <span class="ubl-name-plain">${esc(a.name)}</span>
            ${a.art ? `<span class="ubl-tag">${esc(a.art)}</span>` : ''}
          </div>
          <div class="ubl-meta">${esc([a.wunsch, a.leistung].filter(Boolean).join(' · '))}</div>
        </div>
        <div class="ubl-row-right">
          <div class="ubl-val-col">
            <span class="ubl-val-sub">${esc(a.alterLabel || 'Offen')}</span>
          </div>
          <div class="ubl-links">
            <button type="button" class="ubl-link" data-ubl-panel="anfragen">Prüfen</button>
          </div>
        </div>
      </div>
    `).join('');
    return;
  }

  if (aktiv === 'warteliste') {
    if (state.wartelisteFehler) { listEl.innerHTML = leerHtml('Warteliste konnte nicht geladen werden.'); return; }
    if (!wlSuche.length) {
      listEl.innerHTML = leerHtml(state.suche.trim() ? 'Keine Wartelisten-Einträge passend zur Suche.' : 'Aktuell wartet niemand auf der Warteliste.');
      return;
    }
    listEl.innerHTML = wlSuche.slice(0, 6).map(w => {
      const nameHtml = w.leadId
        ? `<button type="button" class="ubl-name-btn" data-ubl-patient="${esc(w.leadId)}">${esc(w.name)}</button>`
        : `<span class="ubl-name-plain">${esc(w.name)}</span>`;
      const prioTag = w.prio >= 3 ? '<span class="ubl-tag ubl-tag--danger">Dringend</span>' : w.prio === 2 ? '<span class="ubl-tag ubl-tag--accent">Erhöht</span>' : '';
      return `
        <div class="ubl-row">
          <div class="ubl-row-main">
            <div class="ubl-row-top">${nameHtml}${prioTag}</div>
            <div class="ubl-meta">${esc(w.leistung || 'Allgemeiner Terminwunsch')}</div>
          </div>
          <div class="ubl-row-right">
            <div class="ubl-val-col"><span class="ubl-val-sub">${esc(w.wartetLabel)}</span></div>
            ${w.leadId ? `<div class="ubl-links"><button type="button" class="ubl-link" data-ubl-patient="${esc(w.leadId)}">Akte</button></div>` : ''}
          </div>
        </div>
      `;
    }).join('');
    return;
  }

  if (aktiv === 'aufgaben') {
    if (state.aufgabenFehler) { listEl.innerHTML = leerHtml('Aufgaben konnten nicht geladen werden.'); return; }
    if (!aufgSuche.length) {
      listEl.innerHTML = leerHtml(state.suche.trim() ? 'Keine Aufgaben passend zur Suche.' : 'Keine offenen Praxis-Aufgaben.');
      return;
    }
    listEl.innerHTML = aufgSuche.slice(0, 6).map(a => `
      <div class="ubl-row">
        <div class="ubl-task-lead">
          ${a.id ? `<button type="button" class="ubl-check" data-ubl-aufgabe-done="${esc(a.id)}" aria-label="Aufgabe erledigen: ${esc(a.text)}" title="Als erledigt markieren">${HAKEN_SVG}</button>` : ''}
          <div class="ubl-row-main">
            <div class="ubl-row-top">
              <span class="ubl-name-plain">${esc(a.text)}</span>
            </div>
            ${a.patientName ? `<div class="ubl-meta">Patient: ${esc(a.patientName)}</div>` : ''}
          </div>
        </div>
        <div class="ubl-row-right">
          <div class="ubl-val-col">
            <span class="ubl-val-primary${a.ueberfaellig ? ' is-danger' : ''}">${esc(a.faelligLabel)}</span>
          </div>
          ${a.leadId ? `<div class="ubl-links"><button type="button" class="ubl-link" data-ubl-patient="${esc(a.leadId)}">Akte</button></div>` : ''}
        </div>
      </div>
    `).join('');
    return;
  }

  if (aktiv === 'rechnungen') {
    if (state.rechnungenFehler) { listEl.innerHTML = leerHtml('Offene Rechnungen konnten nicht geladen werden.'); return; }
    if (!rechSuche.length) {
      listEl.innerHTML = leerHtml(state.suche.trim() ? 'Keine Rechnungen passend zur Suche.' : 'Keine offenen Rechnungen.');
      return;
    }
    listEl.innerHTML = rechSuche.slice(0, 6).map(r => `
      <div class="ubl-row">
        <div class="ubl-row-main">
          <div class="ubl-row-top">
            ${r.ueberfaellig ? '<span class="ubl-dot ubl-dot--warn" aria-hidden="true"></span>' : ''}
            <span class="ubl-name-plain">${esc(r.patientName)}</span>
            <span class="ubl-tag">${esc(r.nummer)}</span>
          </div>
          <div class="ubl-meta">${esc(r.datumDe)} · ${esc(r.offenLabel)}</div>
        </div>
        <div class="ubl-row-right">
          <div class="ubl-val-col">
            <span class="ubl-val-primary">${esc(fmtEur(r.betrag))}</span>
          </div>
          ${r.id ? `<div class="ubl-links"><button type="button" class="ubl-link" data-ubl-inv="${esc(r.id)}">Öffnen</button></div>` : ''}
        </div>
      </div>
    `).join('');
  }
}

function renderNoShows() {
  const listEl = document.getElementById('ublNoShowList');
  const countEl = document.getElementById('ublNoShowCount');
  const linkEl = document.getElementById('ublNoShowCalLink');
  if (!listEl) return;

  if (linkEl) linkEl.hidden = !inLeiste('calendar');

  const basis = gefilterteNoShows();
  const gefiltert = basis.filter(n =>
    suchePasst(state.suche, [n.name, n.datumDe, n.leistung, n.vorText])
  );

  if (countEl) countEl.textContent = String(gefiltert.length);

  if (state.laedt && !state.geladenUm) { listEl.innerHTML = skelettHtml(2); return; }
  if (state.noShowsFehler) { listEl.innerHTML = leerHtml('Nicht-Erscheiner konnten nicht geladen werden.'); return; }
  if (!gefiltert.length) {
    listEl.innerHTML = leerHtml(state.suche.trim() ? 'Keine Treffer.' : 'Keine versäumten Termine zuletzt.');
    return;
  }

  const esc = aktiverKontext?.escapeHtml || escStandard;
  listEl.innerHTML = gefiltert.slice(0, 6).map(n => {
    const nameHtml = n.leadId
      ? `<button type="button" class="ubl-name-btn" data-ubl-patient="${esc(n.leadId)}">${esc(n.name)}</button>`
      : `<span class="ubl-name-plain">${esc(n.name)}</span>`;
    const aktionen = [
      n.telefon ? `<a class="ubl-link" href="${esc(n.telefon.href)}" title="Anrufen: ${esc(n.telefon.anzeige)}">Anrufen</a>` : '',
      n.leadId ? `<button type="button" class="ubl-link" data-ubl-patient="${esc(n.leadId)}">Akte</button>` : '',
    ].filter(Boolean).join('<span class="ubl-dot-sep" aria-hidden="true">·</span>');
    return `
      <div class="ubl-row">
        <div class="ubl-row-main">
          <div class="ubl-row-top">${nameHtml}</div>
          <div class="ubl-meta">${esc(n.leistung || n.datumDe)}</div>
        </div>
        <div class="ubl-row-right">
          <div class="ubl-val-col">
            <span class="ubl-val-primary">${esc(n.vorText || n.datumDe)}</span>
            <span class="ubl-val-sub">${esc(n.datumDe)}${n.zeitDe ? ` · ${esc(n.zeitDe)}` : ''}</span>
          </div>
          ${aktionen ? `<div class="ubl-links">${aktionen}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderVacations() {
  const listEl = document.getElementById('ublVacationList');
  const countEl = document.getElementById('ublVacationCount');
  const linkEl = document.getElementById('ublVacationTeamLink');
  if (!listEl) return;

  if (linkEl) linkEl.hidden = !inLeiste('team');

  document.querySelectorAll('#panel-ueberblick [data-ubl-abw-tage]').forEach(btn => {
    const aktiv = Number(btn.getAttribute('data-ubl-abw-tage')) === state.abwesenheitTage;
    btn.classList.toggle('is-active', aktiv);
    btn.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
  });

  const liste = gefilterteAbwesenheiten();
  const gefiltert = liste.filter(v => suchePasst(state.suche, [v.name, v.typLabel, v.zeitraum, v.statusLabel]));

  if (countEl) countEl.textContent = String(gefiltert.length);

  if (state.laedt && !state.geladenUm) { listEl.innerHTML = skelettHtml(2); return; }
  if (state.abwesenheitenFehler) { listEl.innerHTML = leerHtml('Abwesenheiten konnten nicht geladen werden.'); return; }
  if (!gefiltert.length) {
    listEl.innerHTML = leerHtml(
      state.suche.trim() ? 'Keine Treffer.' : `Keine Abwesenheiten in den nächsten ${state.abwesenheitTage} Tagen.`
    );
    return;
  }

  const esc = aktiverKontext?.escapeHtml || escStandard;
  listEl.innerHTML = gefiltert.map(v => `
    <div class="ubl-row">
      <div class="ubl-row-main">
        <div class="ubl-row-top">
          ${v.istAktiv ? `<span class="ubl-dot${v.typKey === 'krank' ? ' ubl-dot--danger' : ''}" aria-hidden="true"></span>` : ''}
          <span class="ubl-name-plain">${esc(v.name)}</span>
          <span class="ubl-tag${v.typKey === 'krank' ? ' ubl-tag--danger' : ''}">${esc(v.typLabel)}</span>
        </div>
        <div class="ubl-meta">${esc(v.zeitraum)}</div>
      </div>
      <div class="ubl-row-right">
        <div class="ubl-val-col">
          <span class="ubl-val-primary${v.istAktiv ? ' is-accent' : ''}">${esc(v.statusLabel)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function renderBirthdays() {
  const listEl = document.getElementById('ublBirthdaysList');
  const countEl = document.getElementById('ublBirthdaysCount');
  if (!listEl) return;

  document.querySelectorAll('#panel-ueberblick [data-ubl-geb-tage]').forEach(btn => {
    const aktiv = Number(btn.getAttribute('data-ubl-geb-tage')) === state.geburtstagTage;
    btn.classList.toggle('is-active', aktiv);
    btn.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
  });

  const liste = geburtstageAufbereiten(state.geburtstageRoh, state.heuteIso, state.geburtstagTage);
  const gefiltert = liste.filter(g => suchePasst(state.suche, [g.name, g.datumKurz, g.abstandLabel]));

  if (countEl) countEl.textContent = String(gefiltert.length);

  if (state.laedt && !state.geladenUm) { listEl.innerHTML = skelettHtml(2); return; }
  if (state.geburtstageFehler) { listEl.innerHTML = leerHtml('Geburtstage konnten nicht geladen werden.'); return; }
  if (!gefiltert.length) {
    listEl.innerHTML = leerHtml(
      state.suche.trim() ? 'Keine Treffer.' : `Keine Geburtstage in den nächsten ${state.geburtstagTage} Tagen.`
    );
    return;
  }

  const esc = aktiverKontext?.escapeHtml || escStandard;
  listEl.innerHTML = gefiltert.map(g => {
    const nameHtml = g.patientId
      ? `<button type="button" class="ubl-name-btn" data-ubl-patient="${esc(g.patientId)}">${esc(g.name)}</button>`
      : `<span class="ubl-name-plain">${esc(g.name)}</span>`;
    return `
      <div class="ubl-row">
        <div class="ubl-row-main">
          <div class="ubl-row-top">
            ${g.istHeute ? '<span class="ubl-dot" aria-hidden="true"></span>' : ''}
            ${nameHtml}
          </div>
          <div class="ubl-meta">${g.alterWird ? `wird ${g.alterWird} Jahre` : esc(g.datumKurz)}</div>
        </div>
        <div class="ubl-row-right">
          <div class="ubl-val-col">
            <span class="ubl-val-primary${g.istHeute ? ' is-accent' : ''}">${esc(g.abstandLabel)}</span>
            <span class="ubl-val-sub">${esc(g.datumKompakt)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAlles() {
  renderScopeToggle();
  renderKopfSub();
  renderMetricBar();
  renderWeekStrip();
  renderDeadlines();
  renderVorgaenge();
  renderNoShows();
  renderVacations();
  renderBirthdays();
}

async function erledigeAufgabe(id, btn) {
  const ctx = aktiverKontext;
  const ownerId = ctx?.getOwnerId?.();
  if (!ctx?.supabase || !ownerId || !id) return;

  const vorher = [...state.aufgaben];
  if (btn) btn.disabled = true;
  state.aufgaben = state.aufgaben.filter(a => a.id !== id);
  renderMetricBar();
  renderVorgaenge();

  const { error } = await ctx.supabase
    .from('praxis_aufgaben')
    .update({
      erledigt_at: new Date().toISOString(),
      erledigt_von: state.userId || null,
    })
    .eq('id', id)
    .eq('owner_id', ownerId);

  if (error) {
    state.aufgaben = vorher;
    renderMetricBar();
    renderVorgaenge();
    ctx.showToast?.('Aufgabe konnte nicht abgeschlossen werden.', 'error');
    return;
  }
  ctx.showToast?.('Aufgabe erledigt.', 'success');
  document.dispatchEvent(new Event('praxura:uebersicht'));
}

function planeLiveAktualisierung() {
  const panel = document.getElementById('panel-ueberblick');
  if (!panel?.classList.contains('active') || !aktiverKontext) return;
  clearTimeout(signalTimer);
  signalTimer = setTimeout(() => {
    if (document.getElementById('panel-ueberblick')?.classList.contains('active') && aktiverKontext) {
      ladeUeberblickAnsicht(aktiverKontext);
    }
  }, 250);
}

function verdrahteEinmal() {
  const panel = document.getElementById('panel-ueberblick');
  if (!panel || panel.dataset.ublVerdrahtet === '1') return;
  panel.dataset.ublVerdrahtet = '1';

  if (!signaleAktiv) {
    signaleAktiv = true;
    on('bookings:changed', planeLiveAktualisierung);
    on('verordnungen:changed', planeLiveAktualisierung);
    on('leads:changed', planeLiveAktualisierung);
    on('team:changed', planeLiveAktualisierung);
  }

  document.getElementById('ueberblickRefreshBtn')?.addEventListener('click', () => {
    if (aktiverKontext) ladeUeberblickAnsicht(aktiverKontext);
  });

  const searchInput = /** @type {HTMLInputElement|null} */ (document.getElementById('ublSearchInput'));
  const searchClear = document.getElementById('ublSearchClear');
  const sucheAnwenden = () => {
    renderDeadlines();
    renderVorgaenge();
    renderNoShows();
    renderVacations();
    renderBirthdays();
  };
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.suche = searchInput.value;
      if (searchClear) searchClear.hidden = !state.suche;
      sucheAnwenden();
    });
  }
  searchClear?.addEventListener('click', () => {
    state.suche = '';
    if (searchInput) { searchInput.value = ''; searchInput.focus(); }
    searchClear.hidden = true;
    sucheAnwenden();
  });

  panel.addEventListener('click', (ev) => {
    const target = /** @type {HTMLElement|null} */ (ev.target instanceof Element ? ev.target : null);
    if (!target) return;

    const scopeBtn = target.closest('[data-ubl-scope]');
    if (scopeBtn) {
      const m = scopeBtn.getAttribute('data-ubl-scope');
      if (m === 'praxis' || m === 'meine') {
        state.scopeModus = m;
        renderAlles();
      }
      return;
    }

    const doneBtn = /** @type {HTMLButtonElement|null} */ (target.closest('[data-ubl-aufgabe-done]'));
    if (doneBtn) {
      const id = doneBtn.getAttribute('data-ubl-aufgabe-done');
      if (id) erledigeAufgabe(id, doneBtn);
      return;
    }

    const calDateBtn = target.closest('[data-ubl-cal-date]');
    if (calDateBtn) {
      const tagIso = calDateBtn.getAttribute('data-ubl-cal-date');
      if (tagIso && typeof aktiverKontext?.oeffneKalenderTag === 'function') {
        aktiverKontext.oeffneKalenderTag(tagIso);
      } else {
        aktiverKontext?.wechslePanel?.('calendar');
      }
      return;
    }

    const filterBtn = target.closest('[data-ubl-frist-filter]');
    if (filterBtn) {
      const f = filterBtn.getAttribute('data-ubl-frist-filter');
      if (f === 'alle' || f === 'ueberfaellig' || f === 'bald' || f === 'geplant' || f === 'abrechnung' || f === 'berichte' || f === 'pruefbedarf') {
        state.fristTab = f;
        renderDeadlines();
      }
      return;
    }

    const vorgangBtn = target.closest('[data-ubl-vorgang-tab]');
    if (vorgangBtn) {
      const t = vorgangBtn.getAttribute('data-ubl-vorgang-tab');
      if (t === 'anfragen' || t === 'warteliste' || t === 'aufgaben' || t === 'rechnungen') {
        state.vorgangTab = t;
        state.vorgangManuell = true;
        renderVorgaenge();
      }
      return;
    }

    const abwBtn = target.closest('[data-ubl-abw-tage]');
    if (abwBtn) {
      const t = Number(abwBtn.getAttribute('data-ubl-abw-tage'));
      if (t === 14 || t === 30) {
        state.abwesenheitTage = t;
        renderVacations();
      }
      return;
    }

    const gebBtn = target.closest('[data-ubl-geb-tage]');
    if (gebBtn) {
      const t = Number(gebBtn.getAttribute('data-ubl-geb-tage'));
      if (t === 7 || t === 14 || t === 30) {
        state.geburtstagTage = t;
        renderBirthdays();
      }
      return;
    }

    const focusBtn = target.closest('[data-ubl-focus]');
    if (focusBtn) {
      const ziel = focusBtn.getAttribute('data-ubl-focus');
      if (ziel === 'deadlines') {
        const hatUeberf = state.fristen.some(f => f.kategorie === 'ueberfaellig');
        const hatAbsetzung = state.pruefbedarf.some(p => p.art === 'absetzung');
        if (hatUeberf && state.fristTab !== 'ueberfaellig') state.fristTab = 'ueberfaellig';
        else if (hatAbsetzung && state.fristTab !== 'pruefbedarf') state.fristTab = 'pruefbedarf';
        else state.fristTab = 'alle';
        renderDeadlines();
        document.getElementById('ublDeadlinesSection')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (ziel === 'vorgaenge') {
        document.getElementById('ublVorgaengeSection')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (ziel === 'rechnungen') {
        state.vorgangTab = 'rechnungen';
        state.vorgangManuell = true;
        renderVorgaenge();
        document.getElementById('ublVorgaengeSection')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (ziel === 'noshows') {
        document.getElementById('ublNoShowSection')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (ziel === 'vacations') {
        document.getElementById('ublVacationSection')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return;
    }

    const patBtn = target.closest('[data-ubl-patient]');
    if (patBtn) {
      const leadId = patBtn.getAttribute('data-ubl-patient');
      if (leadId) aktiverKontext?.oeffnePatient?.(leadId);
      return;
    }

    const rxBtn = target.closest('[data-ubl-rx]');
    if (rxBtn) {
      const rxId = rxBtn.getAttribute('data-ubl-rx');
      const quelle = rxBtn.getAttribute('data-ubl-quelle') || 'physio';
      if (rxId) aktiverKontext?.oeffneVerordnung?.(quelle, rxId);
      return;
    }

    const invBtn = target.closest('[data-ubl-inv]');
    if (invBtn) {
      const invId = invBtn.getAttribute('data-ubl-inv');
      if (invId) aktiverKontext?.oeffneRechnung?.(invId);
      return;
    }

    const panelBtn = target.closest('[data-ubl-panel]');
    if (panelBtn) {
      const p = panelBtn.getAttribute('data-ubl-panel');
      if (p) aktiverKontext?.wechslePanel?.(p);
    }
  });
}

async function ladeAbwesenheitenUndTeam(supabase, ownerId, heuteIso) {
  const { data: emps, error: empErr } = await supabase
    .from('profiles')
    .select('id, business_name, email')
    .or(`id.eq.${ownerId},owner_id.eq.${ownerId}`);
  if (empErr) throw empErr;
  const empList = emps || [];
  const empIds = empList.map(e => e.id);
  if (!empIds.length) return { teamGroesse: 0, zeilen: [] };

  const { data, error } = await supabase
    .from('time_offs')
    .select('id, employee_id, start_date, end_date, type, profiles!employee_id(id, business_name, email)')
    .in('employee_id', empIds)
    .gte('end_date', `${heuteIso}T00:00:00`)
    .order('start_date', { ascending: true })
    .limit(40);

  if (!error && Array.isArray(data)) return { teamGroesse: empList.length, zeilen: data };

  const { data: rawData, error: rawError } = await supabase
    .from('time_offs')
    .select('id, start_date, end_date, type, employee_id')
    .in('employee_id', empIds)
    .gte('end_date', `${heuteIso}T00:00:00`)
    .order('start_date', { ascending: true })
    .limit(40);
  if (rawError) throw rawError;
  const empMap = Object.fromEntries(empList.map(e => [e.id, e]));
  return {
    teamGroesse: empList.length,
    zeilen: (rawData || []).map(v => ({ ...v, profiles: empMap[v.employee_id] || null })),
  };
}

/**
 * Lädt alle Daten des Praxis-Überblicks parallel und aktualisiert die Ansicht.
 *
 * @param {object} ctx
 * @param {any} ctx.supabase
 * @param {() => string} ctx.getOwnerId
 * @param {() => string|null|undefined} [ctx.getUserId]
 * @param {() => boolean} [ctx.istOwner]
 * @param {(q: any, cat: string) => any} [ctx.bizScope]
 * @param {(s: string) => string} [ctx.escapeHtml]
 * @param {(msg: string, typ?: string) => void} [ctx.showToast]
 * @param {(leadId: string) => void} [ctx.oeffnePatient]
 * @param {(quelle: string, rxId: string) => void} [ctx.oeffneVerordnung]
 * @param {(invId: string) => void} [ctx.oeffneRechnung]
 * @param {(tagIso: string) => void} [ctx.oeffneKalenderTag]
 * @param {(panelId: string) => void} [ctx.wechslePanel]
 */
export async function ladeUeberblickAnsicht(ctx) {
  aktiverKontext = ctx;
  verdrahteEinmal();

  const { supabase, getOwnerId, bizScope } = ctx;
  const ownerId = getOwnerId?.();
  if (!ownerId || !supabase) return;

  const meineNr = ++laufNr;
  const jetzt = new Date();
  const heuteIso = alsBerlinDatum(jetzt);
  const endeTagIso = addiereTageIso(heuteIso, 6) || heuteIso;
  const startGrenze = berlinTagesgrenzen(heuteIso)?.von || `${heuteIso}T00:00:00Z`;
  const endGrenze = berlinTagesgrenzen(endeTagIso)?.bisExklusiv || `${addiereTageIso(heuteIso, 7)}T00:00:00Z`;

  state.heuteIso = heuteIso;
  state.geladenDatum = jetzt;
  state.istOwner = typeof ctx.istOwner === 'function' ? !!ctx.istOwner() : true;
  state.userId = typeof ctx.getUserId === 'function' ? (ctx.getUserId() || null) : null;
  state.laedt = true;

  const refreshBtn = document.getElementById('ueberblickRefreshBtn');
  refreshBtn?.classList.add('is-loading');
  renderAlles();

  const scope = (q, cat) => (typeof bizScope === 'function' ? bizScope(q, cat) : q);

  const wochePromise = scope(
    supabase
      .from('bookings')
      .select('id, user_id, start_time, status, hausbesuch')
      .eq('owner_id', ownerId)
      .gte('start_time', startGrenze)
      .lt('start_time', endGrenze)
      .neq('status', 'cancelled')
      .limit(400),
    'patients'
  );

  const rxPromise = ladeOffeneVerordnungenPaginiert(supabase, {
    ownerId,
    select: RX_FRISTEN_SELECT_VOLL,
    bizScope,
  });

  const gebPromise = scope(
    supabase
      .from('leads')
      .select('id, first_name, last_name, geburtsdatum')
      .eq('owner_id', ownerId)
      .not('geburtsdatum', 'is', null),
    'patients'
  );

  const noShowPromise = scope(
    supabase
      .from('bookings')
      .select('id, user_id, start_time, customer_name, customer_phone, lead_id, leads!lead_id(id, phone, handy), services(title)')
      .eq('owner_id', ownerId)
      .eq('status', 'no_show')
      .order('start_time', { ascending: false })
      .limit(10),
    'patients'
  );

  const abwPromise = ladeAbwesenheitenUndTeam(supabase, ownerId, heuteIso);

  const anfragenPromise = (state.istOwner && inLeiste('anfragen'))
    ? supabase
        .from('booking_requests')
        .select('id, preferred_date, preferred_time, payment_type, behandlungsart, created_at, patients!patient_id(vorname, nachname)')
        .eq('owner_id', ownerId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(15)
    : Promise.resolve({ data: [], error: null });

  const wartelistePromise = inLeiste('warteliste')
    ? supabase
        .from('warteliste')
        .select('id, lead_id, priority, created_at, leads!lead_id(id, first_name, last_name), services(title)')
        .eq('owner_id', ownerId)
        .eq('status', 'waiting')
        .order('priority', { ascending: false })
        .limit(15)
    : Promise.resolve({ data: [], error: null });

  const aufgabenPromise = scope(
    supabase
      .from('praxis_aufgaben')
      .select('id, lead_id, erstellt_von, text, faellig_am, created_at, leads!lead_id(id, first_name, last_name)')
      .eq('owner_id', ownerId)
      .is('erledigt_at', null)
      .order('faellig_am', { ascending: true })
      .limit(15),
    'activities'
  );

  const rechnungenPromise = (state.istOwner && inLeiste('rechnungen'))
    ? scope(
        supabase
          .from('invoices')
          .select('id, invoice_number, patient_name, lead_id, status, payment_status, issued_at, brutto_gesamt, total_patient')
          .eq('owner_id', ownerId)
          .eq('status', 'sent')
          .neq('payment_status', 'paid')
          .is('storno_von', null)
          .order('issued_at', { ascending: true })
          .limit(40),
        'finance'
      )
    : Promise.resolve({ data: [], error: null });

  const [wocheRes, rxRes, gebRes, noShowRes, abwRes, anfRes, wlRes, aufgRes, rechRes] = await Promise.allSettled([
    wochePromise,
    rxPromise,
    gebPromise,
    noShowPromise,
    abwPromise,
    anfragenPromise,
    wartelistePromise,
    aufgabenPromise,
    rechnungenPromise,
  ]);

  if (meineNr !== laufNr) return;

  if (wocheRes.status === 'fulfilled' && !wocheRes.value?.error) {
    state.wocheRoh = wocheRes.value?.data || [];
    state.wocheFehler = false;
  } else {
    state.wocheRoh = [];
    state.wocheFehler = true;
  }

  if (rxRes.status === 'fulfilled' && !rxRes.value?.error) {
    const rows = rxRes.value?.data || [];
    state.fristen = fristenAuswerten(rows, heuteIso);
    state.berichte = therapieberichteAufbereiten(rows);
    state.pruefbedarf = rezeptPruefbedarfAufbereiten(rows);
    state.fristenFehler = false;
  } else {
    state.fristen = [];
    state.berichte = [];
    state.pruefbedarf = [];
    state.fristenFehler = true;
  }

  if (gebRes.status === 'fulfilled' && !gebRes.value?.error) {
    state.geburtstageRoh = gebRes.value?.data || [];
    state.geburtstageFehler = false;
  } else {
    state.geburtstageRoh = [];
    state.geburtstageFehler = true;
  }

  if (noShowRes.status === 'fulfilled' && !noShowRes.value?.error) {
    state.noShows = nichtErscheinerAufbereiten(noShowRes.value?.data || [], heuteIso);
    state.noShowsFehler = false;
  } else {
    state.noShows = [];
    state.noShowsFehler = true;
  }

  if (abwRes.status === 'fulfilled') {
    state.hatTeam = (abwRes.value?.teamGroesse || 0) > 1;
    state.abwesenheitenRoh = abwRes.value?.zeilen || [];
    state.abwesenheitenFehler = false;
  } else {
    state.hatTeam = false;
    state.abwesenheitenRoh = [];
    state.abwesenheitenFehler = true;
  }

  if (anfRes.status === 'fulfilled' && !anfRes.value?.error) {
    state.anfragen = anfragenAufbereiten(anfRes.value?.data || [], heuteIso);
    state.anfragenFehler = false;
  } else {
    state.anfragen = [];
    state.anfragenFehler = true;
  }

  if (wlRes.status === 'fulfilled' && !wlRes.value?.error) {
    state.warteliste = wartelisteAufbereiten(wlRes.value?.data || [], heuteIso);
    state.wartelisteFehler = false;
  } else {
    state.warteliste = [];
    state.wartelisteFehler = true;
  }

  if (aufgRes.status === 'fulfilled' && !aufgRes.value?.error) {
    state.aufgaben = aufgabenAufbereiten(aufgRes.value?.data || [], heuteIso);
    state.aufgabenFehler = false;
  } else {
    state.aufgaben = [];
    state.aufgabenFehler = true;
  }

  if (rechRes.status === 'fulfilled' && !rechRes.value?.error) {
    state.rechnungen = rechnungenAufbereiten(rechRes.value?.data || [], heuteIso);
    state.rechnungenFehler = false;
  } else {
    state.rechnungen = { liste: [], summeEur: 0, ueberfaelligAnzahl: 0 };
    state.rechnungenFehler = true;
  }

  state.laedt = false;
  state.geladenUm = uhrzeitJetztBerlin();
  refreshBtn?.classList.remove('is-loading');
  renderAlles();
  wendeAusstehendenFokusAn();
}
