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
    onSelect: lead => { if (!erlaubt()) return; feld.value = ''; feld.blur(); oeffne(false); k.oeffnePatient(lead.id); },
  });
  // V2.12b (Melih 13.11.2026): Unter 900 px ist das Feld per CSS aus. Eine Lupe in der Kopfleiste klappt dasselbe Feld
  // (gleicher Picker, gleicher Cache, keine neue Abfrage) als Zeile unter der Kopfleiste auf. Ablauf wie kopf-menue.js:
  // Escape/Auswahl/Fokus raus schließt, Fokus zurück auf die Lupe. Sichtbar nur unter data-design="neu" (design/shell.css).
  const schmal = window.matchMedia('(max-width: 899px)');
  const knopf = document.createElement('button'); knopf.type = 'button'; knopf.className = 'px-suche-knopf'; knopf.hidden = true;
  knopf.setAttribute('aria-label', 'Patient suchen'); knopf.setAttribute('aria-controls', 'pxSuche'); knopf.setAttribute('aria-expanded', 'false');
  knopf.innerHTML = wrap.querySelector('svg').outerHTML.replace(/width="16" height="16"/, 'width="20" height="20"');
  links.append(knopf);
  function oeffne(an, fokusZurueck = false) {
    const war = wrap.hasAttribute('data-offen');
    wrap.toggleAttribute('data-offen', an); knopf.setAttribute('aria-expanded', String(an));
    if (!an && war) { picker.close(); if (fokusZurueck && knopf.getClientRects().length) knopf.focus(); }
  }
  knopf.addEventListener('click', () => { if (!erlaubt()) return; const an = !wrap.hasAttribute('data-offen'); oeffne(an); if (an) feld.focus(); });
  // Am Feld selbst lauschen: patient-suche.js stoppt Escape (stopPropagation), document sähe es nicht.
  feld.addEventListener('keydown', event => { if (event.key === 'Escape' && wrap.hasAttribute('data-offen')) oeffne(false, true); });
  wrap.addEventListener('focusout', event => { if (wrap.hasAttribute('data-offen') && !wrap.contains(event.relatedTarget) && event.relatedTarget !== knopf) oeffne(false); });
  schmal.addEventListener('change', () => oeffne(false));
  document.addEventListener('keydown', event => {
    const zu = !wrap.getClientRects().length, perKnopf = zu && schmal.matches && !!knopf.getClientRects().length;
    if (!erlaubt() || (zu && !perKnopf) || event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented || event.isComposing) return;
    const target = document.activeElement;
    if (target?.matches('input,textarea,select') || target?.isContentEditable) return;
    if ([...document.querySelectorAll('.modal-overlay,dialog[open]')].some(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden')) return;
    event.preventDefault(); if (perKnopf) oeffne(true); feld.focus();
  });
  return {
    wrap,
    aktualisieren() {
      wrap.hidden = !erlaubt(); knopf.hidden = wrap.hidden;
      if (wrap.hidden) { oeffne(false); picker.close(); feld.value = ''; wrap.querySelector('.patient-search-list')?.replaceChildren(); }
    },
    // An explicit source-cache invalidation can reuse the current public picker API.
    auffrischen: () => erlaubt() ? picker.refresh() : Promise.resolve(),
  };
}
