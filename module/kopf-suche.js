/**
 * kopf-suche.js — Suche in der Kopfleiste des neuen Designs (Redesign v2, PLAN-V2 V2.09).
 *
 * Nur im neuen Design (geladen über module/shell-neu.js), ab 900 px sichtbar.
 * v1 sucht Patienten: über den gemeinsamen Patienten-Picker (patient-suche.js — „Do NOT hand-roll
 * a patient picker again“) aus dem gemeinsamen Cache von dashboard.js (ensureLeadsCache → loadLeads,
 * schon mit bizScope 'patients'; keine dritte Lade-Variante, fonksiyon-ustasi 26.10.2026) und mit
 * patientMatchesQuery (Name, Geburtsdatum, Telefon). Neueste zuerst. Auswahl öffnet die
 * Patientenakte über window.openPatientDetail. V2.09b ergänzt vorläufig nur für
 * Inhaber Verordnung/Rechnung über kopf-dokumente.js und dieselben Detailrenderer.
 *
 * Rechte: Feld nur, wenn der Bereich „Patienten“ in der Leiste steht (dashboard.js entscheidet
 * Rolle/Plan/Sichtbarkeit); Daten kommen über RLS wie überall. Taste „/“ fokussiert das Feld,
 * außer beim Tippen in einem Eingabefeld oder bei offenem Dialog.
 */
import { attachPatientSearch } from '../patient-suche.js?v=20261028s249';
import { createDokumentSuche, dokumentScopeKey, dokumenteErlaubt } from './kopf-dokumente.js?v=20261029s252';
import { on } from './signal.js?v=20260813';

/** Reine Hilfe (testbar): soll „/“ die Suche fokussieren? */
export function schraegstrichFokussiert(e, aktiv) {
  if (!e || e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.defaultPrevented || e.isComposing) return false;
  const el = aktiv || null;
  if (el) {
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) return false;
  }
  return true;
}

const offenerDialog = () => !!document.querySelector('.modal-overlay:not([hidden]):not([style*="display: none"]), dialog[open]');
const patientenErlaubt = () => !!document.querySelector('#sidebarNav .sidebar-item[data-panel="kunden"]');

let feld = null;
let huelle = null;
let sync = () => {};

/** Sichtbar nur, wenn Patienten erlaubt sind; bei jedem Rendern der Leiste neu. */
export function sucheSichtbarkeit() {
  if (huelle) huelle.hidden = !patientenErlaubt();
  sync();
}

/** Einmal einhängen. `kontext` liefert { ensureLeadsCache, patientMatchesQuery, displayNameWithBirth } oder null. */
export function verdrahteSuche(kontext) {
  if (feld) return;
  const links = document.querySelector('.topbar .topbar-left');
  if (!links || typeof kontext !== 'function') return;

  huelle = document.createElement('div');
  huelle.className = 'px-suche';
  huelle.setAttribute('role', 'search');
  huelle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  feld = document.createElement('input');
  feld.type = 'search';
  feld.id = 'pxSuche';
  feld.className = 'px-suche-feld';
  feld.placeholder = 'Patient suchen';
  feld.setAttribute('aria-label', 'Patient suchen (Name, Geburtsdatum oder Telefon)');
  feld.setAttribute('aria-keyshortcuts', '/');
  const taste = document.createElement('kbd');
  taste.className = 'px-suche-taste';
  taste.textContent = '/';
  taste.setAttribute('aria-hidden', 'true');
  huelle.append(feld, taste);
  const auswahl = document.createElement('select');
  auswahl.className = 'px-suche-art';
  auswahl.setAttribute('aria-label', 'Suchbereich');
  auswahl.innerHTML = '<option value="patient">Patient</option><option value="verordnung">Verordnung</option><option value="rechnung">Rechnung</option>';
  huelle.insertBefore(auswahl, feld);
  const hinweis = document.createElement('span');
  hinweis.className = 'px-suche-hinweis';
  hinweis.id = 'pxSucheHinweis';
  hinweis.setAttribute('role', 'status');
  feld.setAttribute('aria-describedby', hinweis.id);
  huelle.append(hinweis);
  links.appendChild(huelle);
  const dokKontext = () => ({ ...kontext()?.handlungsbedarfKontext?.(),
    verordnungenErlaubt: !!document.querySelector('#sidebarNav .sidebar-item[data-panel="verordnungen"]'),
    rechnungenErlaubt: !!document.querySelector('#sidebarNav .sidebar-item[data-panel="rechnungen"]') });
  const dokumente = createDokumentSuche({ kontext: dokKontext });
  let art = 'patient', standKey = '', picker;
  const cacheKey = () => `${art}:${dokumentScopeKey(dokKontext())}`;
  const leeren = () => { dokumente.invalide(); picker?.invalidate(); feld.value = ''; hinweis.textContent = ''; };
  sync = () => {
    const k = dokKontext(), key = cacheKey();
    auswahl.hidden = k?.rolle !== 'owner';
    if (auswahl.hidden && art !== 'patient') { art = 'patient'; auswahl.value = art; feld.placeholder = 'Patient suchen'; feld.setAttribute('aria-label', 'Patient suchen (Name, Geburtsdatum oder Telefon)'); }
    if (standKey !== key) { standKey = key; leeren(); }
  };
  auswahl.addEventListener('change', () => {
    art = auswahl.value; leeren(); standKey = cacheKey();
    feld.placeholder = art === 'patient' ? 'Patient suchen' : `${art === 'rechnung' ? 'Rechnung' : 'Verordnung'} suchen`;
    feld.setAttribute('aria-label', art === 'patient' ? 'Patient suchen (Name, Geburtsdatum oder Telefon)' : `${feld.placeholder} (Nummer oder Patientenname)`);
    feld.focus();
  });
  on('startseite:kontextwechsel', () => { leeren(); sync(); });
  sucheSichtbarkeit();

  picker = attachPatientSearch(feld, {
    containerEl: huelle,
    emptyLimit: 8,
    emptyText: 'Keine Treffer im geladenen Bestand',
    cacheKey,
    canShow: row => row.art ? row.art === art && row.scopeKey === dokumentScopeKey(dokKontext()) && dokumenteErlaubt(dokKontext(), art) : art === 'patient',
    // Kopie, damit der Picker die gemeinsame Liste nie verändert.
    loadLeads: async () => {
      if (art === 'patient') return [...((await kontext()?.ensureLeadsCache?.()) || [])];
      const key = cacheKey(); hinweis.textContent = 'Dokumente werden geladen…';
      const r = await dokumente.laden(art);
      if (key !== cacheKey()) return [];
      hinweis.textContent = r.status === 'ok' ? 'Geladener Teilbestand · neueste Dokumente. Weitere im jeweiligen Bereich.'
        : r.status === 'unbekannt' ? 'Dokumentensuche derzeit nicht verfügbar: Scope nicht bestätigt.' : 'Dokumente konnten nicht geladen werden. Suchbereich erneut wählen.';
      return r.zeilen;
    },
    matches: (lead, q) => lead.art ? lead.label.toLocaleLowerCase('de').includes(q) : kontext()?.patientMatchesQuery?.(lead, q) ?? true,
    labelOf: (lead) => lead.art ? lead.label : kontext()?.displayNameWithBirth?.(lead)
      ?? (`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.title || ''),
    onSelect: (lead) => {
      feld.value = '';
      feld.blur();
      if (lead.art) { dokumente.oeffnen(lead).then(r => { if (r.status !== 'ok') hinweis.textContent = 'Dokument nicht geöffnet. Suche erneut laden.'; }); return; }
      if (typeof window.openPatientDetail === 'function') window.openPatientDetail(lead.id);
    },
  });

  document.addEventListener('keydown', (e) => {
    if (huelle.hidden || offenerDialog()) return;
    if (!schraegstrichFokussiert(e, document.activeElement)) return;
    e.preventDefault();
    feld.focus();
  });
  feld.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !feld.value) feld.blur();
  });
}
