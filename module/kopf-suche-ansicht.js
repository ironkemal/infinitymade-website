/** Patient-only adaptation of confirmed kopf-suche.js to the current shared picker.
 * The caller supplies the existing scoped cache/matcher/label/opener; no own query.
 * Current picker has refresh/close, not the older design checkout's invalidate API.
 */
import { attachPatientSearch } from '../patient-suche.js?v=20260906';

export function montierePatientensuche(k, aktiv) {
  const links = document.querySelector('.topbar .topbar-left');
  if (!links || !['ensureLeadsCache', 'patientMatchesQuery', 'displayNameWithBirth', 'oeffnePatient'].every(name => typeof k?.[name] === 'function')) return null;
  const erlaubt = () => aktiv() && !!document.querySelector('#sidebarNav .sidebar-item[data-panel="kunden"]:not([hidden])');
  const wrap = document.createElement('div'); wrap.className = 'px-suche'; wrap.setAttribute('role', 'search');
  wrap.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  const feld = document.createElement('input'); feld.type = 'search'; feld.id = 'pxSuche'; feld.className = 'px-suche-feld';
  feld.placeholder = 'Patient suchen'; feld.setAttribute('aria-label', 'Patient suchen (Name, Geburtsdatum oder Telefon)'); feld.setAttribute('aria-keyshortcuts', '/');
  const taste = document.createElement('kbd'); taste.className = 'px-suche-taste'; taste.textContent = '/'; taste.setAttribute('aria-hidden', 'true');
  wrap.append(feld, taste); links.append(wrap);
  const picker = attachPatientSearch(feld, {
    containerEl: wrap, emptyLimit: 8, emptyText: 'Keine Treffer im geladenen Bestand',
    loadLeads: async () => { if (!erlaubt()) return []; const rows = await k.ensureLeadsCache(); return erlaubt() ? [...(rows || [])] : []; },
    matches: (lead, query) => erlaubt() && k.patientMatchesQuery(lead, query),
    labelOf: lead => k.displayNameWithBirth(lead),
    onSelect: lead => { if (!erlaubt()) return; feld.value = ''; feld.blur(); k.oeffnePatient(lead.id); },
  });
  document.addEventListener('keydown', event => {
    if (!erlaubt() || !wrap.getClientRects().length || event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented || event.isComposing) return;
    const target = document.activeElement;
    if (target?.matches('input,textarea,select') || target?.isContentEditable) return;
    if ([...document.querySelectorAll('.modal-overlay,dialog[open]')].some(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')) return;
    event.preventDefault(); feld.focus();
  });
  return {
    wrap,
    aktualisieren() {
      wrap.hidden = !erlaubt();
      if (wrap.hidden) { picker.close(); feld.value = ''; wrap.querySelector('.patient-search-list')?.replaceChildren(); }
    },
    // An explicit source-cache invalidation can reuse the current public picker API.
    auffrischen: () => erlaubt() ? picker.refresh() : Promise.resolve(),
  };
}
