/**
 * module/ueberblick-ansicht.js — Neugestalteter Praxis-Überblick (Praxis-Radar).
 *
 * Ersetzt die früheren vier lose gestapelten Emoji-Karten aus dashboard.js:
 *  - 4-Spalten KPI-Leiste mit direktem Sprung & Filterfokus
 *  - Kompakte Praxis-Eingänge-Leiste (offene Termin-Anfragen, Warteliste, Therapieberichte)
 *  - Asymmetrischer 2-Spalten-Arbeitsbereich:
 *      Links:  Rezept-Fristen mit Segment-Filtern (Alle · Überfällig · ≤ 7 T. · 8–28 T. · Abrechnung),
 *              Dringlichkeits-Fortschritt und direktem Sprung in Patientenakte / Verordnung
 *      Rechts: Nicht-Erscheiner, Team-Abwesenheiten (14/30 Tage), Geburtstage (7/14/30 Tage)
 *  - Live-Suche über alle Bereiche, einmalige Event-Delegation, Rennbedingungs-Schutz (`laufNr`)
 *  - Null Emojis: ausschließlich feine monochrome SVG-Symbole und System-Farbvariablen
 */

import {
  fristenAuswerten,
  geburtstageAufbereiten,
  abwesenheitenAufbereiten,
  nichtErscheinerAufbereiten,
  suchePasst,
} from './ueberblick-listen.js?v=20261119ubl1';
import { alsBerlinDatum } from './berlin-datum.js';

const SVG = (pfad, groesse = 16) =>
  `<svg viewBox="0 0 24 24" width="${groesse}" height="${groesse}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pfad}</svg>`;

const ICON = {
  uhr: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  nutzerX: SVG('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M17 8l5 5M22 8l-5 5"/>'),
  kalenderOff: SVG('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9.5 14.5l5 5M14.5 14.5l-5 5"/>'),
  stern: SVG('<path d="M20 12v8H4v-8"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>'),
  haken: SVG('<path d="M20 6L9 17l-5-5"/>', 15),
  pfeilRechts: SVG('<path d="M9 6l6 6-6 6"/>', 14),
  info: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>', 15),
};

const escStandard = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** @type {{
 *   heuteIso: string,
 *   geladenUm: string,
 *   laedt: boolean,
 *   suche: string,
 *   fristFilter: 'alle'|'ueberfaellig'|'bald'|'geplant'|'abrechnung',
 *   abwesenheitTage: 14|30,
 *   geburtstagTage: 7|14|30,
 *   fristen: any[],
 *   fristenFehler: boolean,
 *   noShows: any[],
 *   noShowsFehler: boolean,
 *   abwesenheitenRoh: any[],
 *   abwesenheitenFehler: boolean,
 *   geburtstageRoh: any[],
 *   geburtstageFehler: boolean,
 *   eingang: { anfragen: number|null, warteliste: number|null, berichte: number|null },
 * }} */
const state = {
  heuteIso: '',
  geladenUm: '',
  laedt: false,
  suche: '',
  fristFilter: 'alle',
  abwesenheitTage: 14,
  geburtstagTage: 7,
  fristen: [],
  fristenFehler: false,
  noShows: [],
  noShowsFehler: false,
  abwesenheitenRoh: [],
  abwesenheitenFehler: false,
  geburtstageRoh: [],
  geburtstageFehler: false,
  eingang: { anfragen: null, warteliste: null, berichte: null },
};

let laufNr = 0;
let aktiverKontext = null;

const inLeiste = (panel) => !!document.querySelector(`#sidebarNav .sidebar-item[data-panel="${panel}"]`);

function uhrzeitJetztBerlin() {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date());
}

function skelettHtml(zeilen = 3) {
  return `<div class="ubl-skeleton-wrap">${Array.from({ length: zeilen }, (_, i) =>
    `<div class="ubl-skeleton${i === zeilen - 1 ? ' ubl-skeleton--short' : ''}"></div>`
  ).join('')}</div>`;
}

function leerHtml(text, ok = false) {
  return `<div class="ubl-empty${ok ? ' ubl-empty--ok' : ''}">
    <span class="ubl-empty-icon">${ok ? ICON.haken : ICON.info}</span>
    <span>${escStandard(text)}</span>
  </div>`;
}

function renderKopfSub() {
  const sub = document.getElementById('ublHeaderSub');
  if (!sub) return;
  if (state.laedt && !state.geladenUm) {
    sub.textContent = 'Praxisdaten werden aktualisiert …';
    return;
  }
  const abw = abwesenheitenAufbereiten(state.abwesenheitenRoh, state.heuteIso, state.abwesenheitTage);
  const ueberfaellig = state.fristen.filter(f => f.kategorie === 'ueberfaellig').length;
  const teile = [];
  if (state.geladenUm) teile.push(`Stand ${state.geladenUm} Uhr`);
  if (ueberfaellig > 0) teile.push(`${ueberfaellig} überfällige ${ueberfaellig === 1 ? 'Frist' : 'Fristen'}`);
  else teile.push(`${state.fristen.length} aktive ${state.fristen.length === 1 ? 'Frist' : 'Fristen'}`);
  teile.push(`${state.noShows.length} Nicht-Erscheiner`);
  teile.push(`${abw.length} ${abw.length === 1 ? 'Abwesenheit' : 'Abwesenheiten'}`);
  sub.textContent = teile.join(' · ');
}

function renderKpis() {
  const el = document.getElementById('ublKpiBar');
  if (!el) return;

  const ueberfaellig = state.fristen.filter(f => f.kategorie === 'ueberfaellig').length;
  const bald = state.fristen.filter(f => f.kategorie === 'bald').length;
  const abw = abwesenheitenAufbereiten(state.abwesenheitenRoh, state.heuteIso, state.abwesenheitTage);
  const aktivAbw = abw.filter(a => a.istAktiv).length;
  const geb = geburtstageAufbereiten(state.geburtstageRoh, state.heuteIso, state.geburtstagTage);
  const heuteGeb = geb.filter(g => g.istHeute).length;

  const fristTon = ueberfaellig > 0 ? ' is-danger' : bald > 0 ? ' is-accent' : '';
  const fristMeta = state.fristenFehler
    ? 'Nicht verfügbar'
    : ueberfaellig > 0
      ? `${ueberfaellig} überfällig${bald > 0 ? ` · ${bald} in ≤ 7 T.` : ''}`
      : bald > 0
        ? `${bald} in den nächsten 7 Tagen`
        : state.fristen.length > 0
          ? `${state.fristen.length} im Blick`
          : 'Alle Fristen im Plan';

  const noShowTon = state.noShows.length > 0 ? ' is-accent' : '';
  const noShowMeta = state.noShowsFehler
    ? 'Nicht verfügbar'
    : state.noShows.length > 0
      ? 'Nachfassen empfohlen'
      : 'Keine Ausfälle zuletzt';

  const abwTon = aktivAbw > 0 ? ' is-accent' : '';
  const abwMeta = state.abwesenheitenFehler
    ? 'Nicht verfügbar'
    : aktivAbw > 0
      ? `${aktivAbw} heute abwesend`
      : abw.length > 0
        ? `Geplant (${state.abwesenheitTage} Tage)`
        : 'Vollständiges Team';

  const gebTon = heuteGeb > 0 ? ' is-accent' : '';
  const gebMeta = state.geburtstageFehler
    ? 'Nicht verfügbar'
    : heuteGeb > 0
      ? `${heuteGeb} heute`
      : `Nächste ${state.geburtstagTage} Tage`;

  const zahl = (wert, fehler) => (state.laedt && !state.geladenUm ? '–' : fehler ? '–' : String(wert));

  el.innerHTML = `
    <button type="button" class="ubl-kpi${fristTon}" data-ubl-focus="deadlines">
      <span class="ubl-kpi-top"><span class="ubl-kpi-label">Rezept-Fristen</span><span class="ubl-kpi-icon">${ICON.uhr}</span></span>
      <span class="ubl-kpi-value">${zahl(state.fristen.length, state.fristenFehler)}</span>
      <span class="ubl-kpi-meta">${escStandard(fristMeta)}</span>
    </button>
    <button type="button" class="ubl-kpi${noShowTon}" data-ubl-focus="noshows">
      <span class="ubl-kpi-top"><span class="ubl-kpi-label">Nicht erschienen</span><span class="ubl-kpi-icon">${ICON.nutzerX}</span></span>
      <span class="ubl-kpi-value">${zahl(state.noShows.length, state.noShowsFehler)}</span>
      <span class="ubl-kpi-meta">${escStandard(noShowMeta)}</span>
    </button>
    <button type="button" class="ubl-kpi${abwTon}" data-ubl-focus="vacations">
      <span class="ubl-kpi-top"><span class="ubl-kpi-label">Abwesenheiten</span><span class="ubl-kpi-icon">${ICON.kalenderOff}</span></span>
      <span class="ubl-kpi-value">${zahl(abw.length, state.abwesenheitenFehler)}</span>
      <span class="ubl-kpi-meta">${escStandard(abwMeta)}</span>
    </button>
    <button type="button" class="ubl-kpi${gebTon}" data-ubl-focus="birthdays">
      <span class="ubl-kpi-top"><span class="ubl-kpi-label">Geburtstage</span><span class="ubl-kpi-icon">${ICON.stern}</span></span>
      <span class="ubl-kpi-value">${zahl(geb.length, state.geburtstageFehler)}</span>
      <span class="ubl-kpi-meta">${escStandard(gebMeta)}</span>
    </button>
  `;
}

function renderEingangStrip() {
  const el = document.getElementById('ublEingangStrip');
  if (!el) return;

  const chips = [];
  if (inLeiste('anfragen') && state.eingang.anfragen !== null) {
    chips.push({ panel: 'anfragen', label: 'Offene Termin-Anfragen', zahl: state.eingang.anfragen });
  }
  if (inLeiste('warteliste') && state.eingang.warteliste !== null) {
    chips.push({ panel: 'warteliste', label: 'Warteliste', zahl: state.eingang.warteliste });
  }
  if (inLeiste('verordnungen') && state.eingang.berichte !== null) {
    chips.push({ panel: 'verordnungen', label: 'Offene Therapieberichte', zahl: state.eingang.berichte });
  }

  if (!chips.length) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }

  el.hidden = false;
  el.innerHTML = `<span class="ubl-eingang-prefix">Praxis-Eingänge</span>` + chips.map(c => `
    <button type="button" class="ubl-eingang-chip${c.zahl > 0 ? ' has-items' : ''}" data-ubl-panel="${escStandard(c.panel)}">
      <span>${escStandard(c.label)}</span>
      <span class="ubl-eingang-num">${c.zahl}</span>
    </button>
  `).join('');
}

function renderDeadlines() {
  const listEl = document.getElementById('ublDeadlinesList');
  const filterEl = document.getElementById('ublDeadlineFilters');
  const countEl = document.getElementById('ublDeadlinesCount');
  const footEl = document.getElementById('ublDeadlinesFoot');
  const linkEl = document.getElementById('ublDeadlinesAllLink');
  if (!listEl) return;

  if (linkEl) linkEl.hidden = !inLeiste('verordnungen');

  const durchSuche = state.fristen.filter(f =>
    suchePasst(state.suche, [f.patientName, f.artLabel, f.kontextMeta, f.stichtagDe, f.fristLabel])
  );

  const zaehler = {
    alle: durchSuche.length,
    ueberfaellig: durchSuche.filter(f => f.kategorie === 'ueberfaellig').length,
    bald: durchSuche.filter(f => f.kategorie === 'bald').length,
    geplant: durchSuche.filter(f => f.kategorie === 'geplant').length,
    abrechnung: durchSuche.filter(f => f.kategorie === 'abrechnung').length,
  };

  if (countEl) {
    countEl.textContent = String(state.fristen.length);
    countEl.classList.toggle('is-danger', zaehler.ueberfaellig > 0);
  }

  if (filterEl) {
    const tabs = [
      { id: 'alle', label: 'Alle', n: zaehler.alle },
      { id: 'ueberfaellig', label: 'Überfällig', n: zaehler.ueberfaellig, danger: zaehler.ueberfaellig > 0 },
      { id: 'bald', label: '≤ 7 Tage', n: zaehler.bald },
      { id: 'geplant', label: '8–28 Tage', n: zaehler.geplant },
      { id: 'abrechnung', label: 'Abrechnung', n: zaehler.abrechnung },
    ];
    filterEl.innerHTML = tabs.map(t => `
      <button type="button"
        class="ubl-tab${state.fristFilter === t.id ? ' is-active' : ''}${t.danger ? ' is-danger-dot' : ''}"
        data-ubl-frist-filter="${t.id}"
        aria-pressed="${state.fristFilter === t.id ? 'true' : 'false'}">
        <span>${t.label}</span>
        <span class="ubl-tab-count">${t.n}</span>
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

  const sichtbar = state.fristFilter === 'alle'
    ? durchSuche
    : durchSuche.filter(f => f.kategorie === state.fristFilter);

  if (!sichtbar.length) {
    const text = state.suche.trim()
      ? 'Keine Rezept-Fristen passend zur Suche.'
      : state.fristFilter !== 'alle'
        ? 'In dieser Kategorie liegen aktuell keine Fristen.'
        : 'Keine dringenden Fristen. Alle laufenden Verordnungen sind im Plan.';
    listEl.innerHTML = leerHtml(text, !state.suche.trim());
    if (footEl) footEl.hidden = true;
    return;
  }

  const kannVerordnung = inLeiste('verordnungen');
  const esc = aktiverKontext?.escapeHtml || escStandard;

  listEl.innerHTML = sichtbar.map(f => {
    const badgeKlasse = f.schwere === 'danger'
      ? 'ubl-badge ubl-badge--danger'
      : f.schwere === 'warning'
        ? 'ubl-badge ubl-badge--accent'
        : 'ubl-badge';
    const progressKlasse = f.schwere === 'danger'
      ? 'ubl-progress is-danger'
      : f.schwere === 'warning'
        ? 'ubl-progress is-warning'
        : 'ubl-progress';
    const nameHtml = f.patientId
      ? `<button type="button" class="ubl-name-btn" data-ubl-patient="${esc(f.patientId)}">${esc(f.patientName)}</button>`
      : `<span class="ubl-name-plain">${esc(f.patientName)}</span>`;
    const metaZeile = [f.artLabel, f.kontextMeta].filter(Boolean).join(' · ');

    return `
      <div class="ubl-row ubl-row--${f.schwere}">
        <div class="ubl-row-main">
          <div class="ubl-row-text">
            <div class="ubl-row-title-line">
              ${nameHtml}
              ${f.dringend ? '<span class="ubl-badge ubl-badge--danger">Dringend</span>' : ''}
              ${f.anzahl > 1 ? `<span class="ubl-badge">${f.anzahl} Verordnungen</span>` : ''}
            </div>
            <div class="ubl-sub">${esc(metaZeile)}</div>
          </div>
        </div>
        <div class="ubl-row-side">
          <div class="ubl-deadline-meta">
            <span class="${badgeKlasse}">${esc(f.fristLabel)}</span>
            <span class="ubl-date-sub">bis ${esc(f.stichtagDe)}</span>
            <span class="${progressKlasse}" aria-hidden="true"><span style="width:${f.fortschrittProzent}%"></span></span>
          </div>
          <div class="ubl-row-actions">
            ${f.patientId ? `<button type="button" class="ubl-act-btn" data-ubl-patient="${esc(f.patientId)}">Akte</button>` : ''}
            ${kannVerordnung && f.rxId ? `<button type="button" class="ubl-act-btn" data-ubl-rx="${esc(f.rxId)}" data-ubl-quelle="${esc(f.quelle)}">Rezept</button>` : ''}
          </div>
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

function renderNoShows() {
  const listEl = document.getElementById('ublNoShowList');
  const countEl = document.getElementById('ublNoShowCount');
  const linkEl = document.getElementById('ublNoShowCalLink');
  if (!listEl) return;

  if (linkEl) linkEl.hidden = !inLeiste('calendar');

  const gefiltert = state.noShows.filter(n =>
    suchePasst(state.suche, [n.name, n.datumDe, n.leistung, n.vorText])
  );

  if (countEl) countEl.textContent = String(state.noShows.length);

  if (state.laedt && !state.geladenUm) {
    listEl.innerHTML = skelettHtml(2);
    return;
  }

  if (state.noShowsFehler) {
    listEl.innerHTML = leerHtml('Nicht-Erscheiner konnten gerade nicht geladen werden.');
    return;
  }

  if (!gefiltert.length) {
    listEl.innerHTML = leerHtml(
      state.suche.trim() ? 'Keine Nicht-Erscheiner passend zur Suche.' : 'Niemand ist zuletzt nicht erschienen.',
      !state.suche.trim()
    );
    return;
  }

  const esc = aktiverKontext?.escapeHtml || escStandard;
  listEl.innerHTML = gefiltert.map(n => {
    const subTeile = [
      n.datumDe + (n.zeitDe ? ` · ${n.zeitDe} Uhr` : ''),
      n.leistung,
    ].filter(Boolean).join(' · ');
    const nameHtml = n.leadId
      ? `<button type="button" class="ubl-name-btn" data-ubl-patient="${esc(n.leadId)}">${esc(n.name)}</button>`
      : `<span class="ubl-name-plain">${esc(n.name)}</span>`;
    return `
      <div class="ubl-row">
        <div class="ubl-row-main">
          <span class="ubl-avatar" aria-hidden="true">${esc(n.initialen)}</span>
          <div class="ubl-row-text">
            <div class="ubl-row-title-line">
              ${nameHtml}
              ${n.vorText ? `<span class="ubl-badge">${esc(n.vorText)}</span>` : ''}
            </div>
            <div class="ubl-sub">${esc(subTeile)}</div>
          </div>
        </div>
        ${n.leadId ? `<div class="ubl-row-actions"><button type="button" class="ubl-act-btn" data-ubl-patient="${esc(n.leadId)}">Akte</button></div>` : ''}
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

  const liste = abwesenheitenAufbereiten(state.abwesenheitenRoh, state.heuteIso, state.abwesenheitTage);
  const gefiltert = liste.filter(v =>
    suchePasst(state.suche, [v.name, v.typLabel, v.zeitraum, v.statusLabel])
  );

  if (countEl) countEl.textContent = String(liste.length);

  if (state.laedt && !state.geladenUm) {
    listEl.innerHTML = skelettHtml(2);
    return;
  }

  if (state.abwesenheitenFehler) {
    listEl.innerHTML = leerHtml('Abwesenheiten konnten gerade nicht geladen werden.');
    return;
  }

  if (!gefiltert.length) {
    listEl.innerHTML = leerHtml(
      state.suche.trim()
        ? 'Keine Abwesenheiten passend zur Suche.'
        : `Keine laufenden oder geplanten Abwesenheiten (${state.abwesenheitTage} Tage).`,
      !state.suche.trim()
    );
    return;
  }

  const esc = aktiverKontext?.escapeHtml || escStandard;
  listEl.innerHTML = gefiltert.map(v => {
    const typKlasse = v.typKey === 'krank' ? 'ubl-badge ubl-badge--danger' : 'ubl-badge';
    const statusKlasse = v.istAktiv ? 'ubl-badge ubl-badge--accent' : 'ubl-badge';
    return `
      <div class="ubl-row">
        <div class="ubl-row-main">
          <span class="ubl-avatar${v.istAktiv ? ' is-today' : ''}" aria-hidden="true">${esc(v.initialen)}</span>
          <div class="ubl-row-text">
            <div class="ubl-row-title-line">
              <span class="ubl-name-plain">${esc(v.name)}</span>
              <span class="${typKlasse}">${esc(v.typLabel)}</span>
            </div>
            <div class="ubl-sub">${esc(v.zeitraum)}</div>
          </div>
        </div>
        <div class="ubl-row-side">
          <span class="${statusKlasse}">${esc(v.statusLabel)}</span>
        </div>
      </div>
    `;
  }).join('');
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
  const gefiltert = liste.filter(g =>
    suchePasst(state.suche, [g.name, g.datumKurz, g.abstandLabel])
  );

  if (countEl) countEl.textContent = String(liste.length);

  if (state.laedt && !state.geladenUm) {
    listEl.innerHTML = skelettHtml(2);
    return;
  }

  if (state.geburtstageFehler) {
    listEl.innerHTML = leerHtml('Geburtstage konnten gerade nicht geladen werden.');
    return;
  }

  if (!gefiltert.length) {
    listEl.innerHTML = leerHtml(
      state.suche.trim()
        ? 'Keine Geburtstage passend zur Suche.'
        : `Keine Geburtstage in den nächsten ${state.geburtstagTage} Tagen.`
    );
    return;
  }

  const esc = aktiverKontext?.escapeHtml || escStandard;
  listEl.innerHTML = gefiltert.map(g => {
    const nameHtml = g.patientId
      ? `<button type="button" class="ubl-name-btn" data-ubl-patient="${esc(g.patientId)}">${esc(g.name)}</button>`
      : `<span class="ubl-name-plain">${esc(g.name)}</span>`;
    const sub = g.alterWird ? `${g.datumKurz} · wird ${g.alterWird} Jahre` : g.datumKurz;
    return `
      <div class="ubl-row">
        <div class="ubl-row-main">
          <span class="ubl-avatar${g.istHeute ? ' is-today' : ''}" aria-hidden="true">${esc(g.initialen)}</span>
          <div class="ubl-row-text">
            <div class="ubl-row-title-line">${nameHtml}</div>
            <div class="ubl-sub">${esc(sub)}</div>
          </div>
        </div>
        <div class="ubl-row-side">
          <span class="ubl-badge${g.istHeute ? ' ubl-badge--accent' : ''}">${esc(g.abstandLabel)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderAlles() {
  renderKopfSub();
  renderKpis();
  renderEingangStrip();
  renderDeadlines();
  renderNoShows();
  renderVacations();
  renderBirthdays();
}

function verdrahteEinmal() {
  const panel = document.getElementById('panel-ueberblick');
  if (!panel || panel.dataset.ublVerdrahtet === '1') return;
  panel.dataset.ublVerdrahtet = '1';

  const refreshBtn = document.getElementById('ueberblickRefreshBtn');
  refreshBtn?.addEventListener('click', () => {
    if (aktiverKontext) ladeUeberblickAnsicht(aktiverKontext);
  });

  const searchInput = /** @type {HTMLInputElement|null} */ (document.getElementById('ublSearchInput'));
  const searchClear = document.getElementById('ublSearchClear');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.suche = searchInput.value;
      if (searchClear) searchClear.hidden = !state.suche;
      renderDeadlines();
      renderNoShows();
      renderVacations();
      renderBirthdays();
    });
  }
  searchClear?.addEventListener('click', () => {
    state.suche = '';
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    searchClear.hidden = true;
    renderDeadlines();
    renderNoShows();
    renderVacations();
    renderBirthdays();
  });

  panel.addEventListener('click', (ev) => {
    const target = /** @type {HTMLElement|null} */ (ev.target instanceof Element ? ev.target : null);
    if (!target) return;

    const filterBtn = target.closest('[data-ubl-frist-filter]');
    if (filterBtn) {
      const f = filterBtn.getAttribute('data-ubl-frist-filter');
      if (f === 'alle' || f === 'ueberfaellig' || f === 'bald' || f === 'geplant' || f === 'abrechnung') {
        state.fristFilter = f;
        renderDeadlines();
      }
      return;
    }

    const abwBtn = target.closest('[data-ubl-abw-tage]');
    if (abwBtn) {
      const t = Number(abwBtn.getAttribute('data-ubl-abw-tage'));
      if (t === 14 || t === 30) {
        state.abwesenheitTage = t;
        renderKopfSub();
        renderKpis();
        renderVacations();
      }
      return;
    }

    const gebBtn = target.closest('[data-ubl-geb-tage]');
    if (gebBtn) {
      const t = Number(gebBtn.getAttribute('data-ubl-geb-tage'));
      if (t === 7 || t === 14 || t === 30) {
        state.geburtstagTage = t;
        renderKpis();
        renderBirthdays();
      }
      return;
    }

    const focusBtn = target.closest('[data-ubl-focus]');
    if (focusBtn) {
      const ziel = focusBtn.getAttribute('data-ubl-focus');
      const map = {
        deadlines: 'ublDeadlinesSection',
        noshows: 'ublNoShowSection',
        vacations: 'ublVacationSection',
        birthdays: 'ublBirthdaysSection',
      };
      if (ziel === 'deadlines') {
        const hatUeberfaellig = state.fristen.some(f => f.kategorie === 'ueberfaellig');
        state.fristFilter = hatUeberfaellig && state.fristFilter !== 'ueberfaellig' ? 'ueberfaellig' : 'alle';
        renderDeadlines();
      }
      const zielId = ziel ? map[/** @type {keyof typeof map} */ (ziel)] : null;
      if (zielId) {
        document.getElementById(zielId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

    const panelBtn = target.closest('[data-ubl-panel]');
    if (panelBtn) {
      const p = panelBtn.getAttribute('data-ubl-panel');
      if (p) aktiverKontext?.wechslePanel?.(p);
    }
  });
}

async function ladeAbwesenheitenRoh(supabase, ownerId, heuteIso) {
  const { data: emps, error: empErr } = await supabase
    .from('profiles')
    .select('id, business_name, email')
    .or(`id.eq.${ownerId},owner_id.eq.${ownerId}`);
  if (empErr) throw empErr;
  const empIds = (emps || []).map(e => e.id);
  if (!empIds.length) return [];

  const { data, error } = await supabase
    .from('time_offs')
    .select('id, start_date, end_date, type, profiles!employee_id(business_name, email)')
    .in('employee_id', empIds)
    .gte('end_date', `${heuteIso}T00:00:00`)
    .order('start_date', { ascending: true })
    .limit(40);

  if (!error && Array.isArray(data)) return data;

  const { data: rawData, error: rawError } = await supabase
    .from('time_offs')
    .select('id, start_date, end_date, type, employee_id')
    .in('employee_id', empIds)
    .gte('end_date', `${heuteIso}T00:00:00`)
    .order('start_date', { ascending: true })
    .limit(40);
  if (rawError) throw rawError;
  const empMap = Object.fromEntries((emps || []).map(e => [e.id, e]));
  return (rawData || []).map(v => ({ ...v, profiles: empMap[v.employee_id] || null }));
}

/**
 * Lädt alle Daten des Praxis-Überblicks parallel und aktualisiert die Ansicht.
 *
 * @param {object} ctx
 * @param {any} ctx.supabase
 * @param {() => string} ctx.getOwnerId
 * @param {(q: any, cat: string) => any} [ctx.bizScope]
 * @param {(s: string) => string} [ctx.escapeHtml]
 * @param {(leadId: string) => void} [ctx.oeffnePatient]
 * @param {(quelle: string, rxId: string) => void} [ctx.oeffneVerordnung]
 * @param {(panelId: string) => void} [ctx.wechslePanel]
 */
export async function ladeUeberblickAnsicht(ctx) {
  aktiverKontext = ctx;
  verdrahteEinmal();

  const { supabase, getOwnerId, bizScope } = ctx;
  const ownerId = getOwnerId?.();
  if (!ownerId || !supabase) return;

  const meineNr = ++laufNr;
  const heuteIso = alsBerlinDatum(new Date());
  state.heuteIso = heuteIso;
  state.laedt = true;

  const refreshBtn = document.getElementById('ueberblickRefreshBtn');
  refreshBtn?.classList.add('is-loading');
  renderAlles();

  const scope = (q, cat) => (typeof bizScope === 'function' ? bizScope(q, cat) : q);

  const rxPromise = scope(
    supabase
      .from('prescriptions')
      .select('id, patient_id, ausstellungsdatum, behandlungsbeginn, status, is_dringend, heilmittel, diagnosegruppe, therapie_bereich, bericht_angefordert, bericht_status, leads!patient_id(id, first_name, last_name)')
      .eq('owner_id', ownerId)
      .not('status', 'in', '(completed,billed,rejected)')
      .order('ausstellungsdatum', { ascending: true })
      .limit(150),
    'patients'
  );

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
      .select('id, start_time, customer_name, lead_id, services(title)')
      .eq('owner_id', ownerId)
      .eq('status', 'no_show')
      .order('start_time', { ascending: false })
      .limit(10),
    'patients'
  );

  const abwPromise = ladeAbwesenheitenRoh(supabase, ownerId, heuteIso);

  const anfragenPromise = inLeiste('anfragen')
    ? supabase
        .from('booking_requests')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', ownerId)
        .eq('status', 'pending')
    : Promise.resolve({ count: null, error: null });

  const wartelistePromise = inLeiste('warteliste')
    ? supabase
        .from('warteliste')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', ownerId)
        .eq('status', 'waiting')
    : Promise.resolve({ count: null, error: null });

  const [rxRes, gebRes, noShowRes, abwRes, anfRes, wlRes] = await Promise.allSettled([
    rxPromise,
    gebPromise,
    noShowPromise,
    abwPromise,
    anfragenPromise,
    wartelistePromise,
  ]);

  if (meineNr !== laufNr) return;

  if (rxRes.status === 'fulfilled' && !rxRes.value?.error) {
    const rows = rxRes.value?.data || [];
    state.fristen = fristenAuswerten(rows, heuteIso);
    state.fristenFehler = false;
    state.eingang.berichte = rows.filter(r => r.bericht_angefordert && r.bericht_status === 'offen').length;
  } else {
    state.fristen = [];
    state.fristenFehler = true;
    state.eingang.berichte = null;
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
    state.abwesenheitenRoh = abwRes.value || [];
    state.abwesenheitenFehler = false;
  } else {
    state.abwesenheitenRoh = [];
    state.abwesenheitenFehler = true;
  }

  state.eingang.anfragen =
    anfRes.status === 'fulfilled' && !anfRes.value?.error && typeof anfRes.value?.count === 'number'
      ? anfRes.value.count
      : null;

  state.eingang.warteliste =
    wlRes.status === 'fulfilled' && !wlRes.value?.error && typeof wlRes.value?.count === 'number'
      ? wlRes.value.count
      : null;

  state.laedt = false;
  state.geladenUm = uhrzeitJetztBerlin();
  refreshBtn?.classList.remove('is-loading');
  renderAlles();
}
