/**
 * kopf-suche.js — Suche in der Kopfleiste des neuen Designs (Redesign v2, PLAN-V2 V2.09).
 *
 * Nur im neuen Design (geladen über module/shell-neu.js), ab 1025 px sichtbar.
 * v1 sucht Patienten: über den gemeinsamen Patienten-Picker (patient-suche.js — „Do NOT hand-roll
 * a patient picker again“) aus dem gemeinsamen Cache von dashboard.js (ensureLeadsCache → loadLeads,
 * schon mit bizScope 'patients'; keine dritte Lade-Variante, fonksiyon-ustasi 26.10.2026) und mit
 * patientMatchesQuery (Name, Geburtsdatum, Telefon). Neueste zuerst. Auswahl öffnet die
 * Patientenakte über window.openPatientDetail. Verordnung und Rechnung folgen, sobald ihre Öffner
 * aus dashboard.js erreichbar sind (STATUS §6, V2.09).
 *
 * Rechte: Feld nur, wenn der Bereich „Patienten“ in der Leiste steht (dashboard.js entscheidet
 * Rolle/Plan/Sichtbarkeit); Daten kommen über RLS wie überall. Taste „/“ fokussiert das Feld,
 * außer beim Tippen in einem Eingabefeld oder bei offenem Dialog.
 */
import { attachPatientSearch } from '../patient-suche.js?v=20260906';

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

/** Sichtbar nur, wenn Patienten erlaubt sind; bei jedem Rendern der Leiste neu. */
export function sucheSichtbarkeit() {
  if (huelle) huelle.hidden = !patientenErlaubt();
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
  links.appendChild(huelle);
  sucheSichtbarkeit();

  attachPatientSearch(feld, {
    containerEl: huelle,
    emptyLimit: 8,
    emptyText: 'Kein Patient gefunden',
    // Kopie, damit der Picker die gemeinsame Liste nie verändert.
    loadLeads: async () => [...((await kontext()?.ensureLeadsCache?.()) || [])],
    matches: (lead, q) => kontext()?.patientMatchesQuery?.(lead, q) ?? true,
    labelOf: (lead) => kontext()?.displayNameWithBirth?.(lead)
      ?? (`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.title || ''),
    onSelect: (lead) => {
      feld.value = '';
      feld.blur();
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
