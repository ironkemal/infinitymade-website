/**
 * patient-suche.js — THE shared patient picker for the whole app.
 *
 * Extracted from the booking modal's picker (`bkCustomerSearch`), which was the
 * only one that had everything: arrow-key navigation, match highlighting,
 * "+ Neuer Kunde…", and the full search via `patientMatchesQuery` (name,
 * birth date in ISO *and* German notation, phone with 0170 ↔ +49170).
 *
 * Before this module there were five separate pickers that disagreed:
 *   • two used a browser <datalist> and could therefore NOT search by phone
 *     or birth date at all,
 *   • one silently cut the result list at 20 rows,
 *   • two forgot `bizScope()` and leaked patients across Standorte,
 *   • each queried a different column set, so the selected patient object had
 *     different fields depending on the screen.
 *
 * Do NOT hand-roll a patient picker again. Add a call site here instead —
 * one fix then fixes every screen.
 *
 * Usage:
 *   attachPatientSearch(inputEl, {
 *     loadLeads:  async () => [...],        // caller owns the query + bizScope
 *     matches:    patientMatchesQuery,      // shared matcher
 *     labelOf:    displayNameWithBirth,     // shared label
 *     onSelect:   lead => {...},
 *     onNew:      typedText => {...},       // optional "+ Neuer Kunde…"
 *   });
 */

'use strict';

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * @param {HTMLInputElement} inputEl
 * @param {object}   cfg
 * @param {Function} cfg.loadLeads  async () => Array — MUST already apply bizScope
 * @param {Function} cfg.matches    (lead, query) => boolean
 * @param {Function} cfg.labelOf    (lead) => string
 * @param {Function} cfg.onSelect   (lead) => void
 * @param {Function} [cfg.onNew]    (typedText) => void — enables "+ Neuer Kunde…"
 * @param {HTMLElement} [cfg.listEl]      existing <ul>; created next to the input if omitted
 * @param {HTMLElement} [cfg.containerEl] click-outside boundary
 * @param {number}   [cfg.emptyLimit]     rows shown when the field is empty (0 = all)
 * @param {string}   [cfg.newLabel]
 * @param {string}   [cfg.emptyText]
 * @returns {{refresh:Function, close:Function}}
 */
export function attachPatientSearch(inputEl, cfg = {}) {
  if (!inputEl) return { refresh() {}, close() {} };
  if (inputEl.dataset.patientSearchWired === '1') {
    return inputEl._patientSearchApi || { refresh() {}, close() {} };
  }
  inputEl.dataset.patientSearchWired = '1';

  const {
    loadLeads,
    matches   = () => true,
    labelOf   = l => `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.title || '',
    onSelect  = () => {},
    onNew     = null,
    emptyLimit = 0,
    newLabel   = '+ Neuer Kunde…',
    emptyText  = 'Keine Treffer',
  } = cfg;

  // ── list element ──────────────────────────────────────────────────────────
  let list = cfg.listEl || null;
  if (!list) {
    list = document.createElement('ul');
    // Bestehende Klasse aus dashboard.css wiederverwenden — nicht neu erfinden.
    list.className = 'patient-search-list';
    list.hidden = true;
    if (getComputedStyle(inputEl.parentElement).position === 'static') {
      inputEl.parentElement.style.position = 'relative';
    }
    inputEl.insertAdjacentElement('afterend', list);
  }
  const container = cfg.containerEl || list.parentElement || inputEl.parentElement;

  let leads = [];
  let activeIndex = -1;
  let loaded = false;

  async function ensureLoaded(force = false) {
    if (loaded && !force) return;
    try { leads = (await loadLeads()) || []; } catch (e) { console.warn('[patient-suche] load:', e); leads = []; }
    loaded = true;
  }

  function close() { list.hidden = true; activeIndex = -1; }

  function items() { return Array.from(list.querySelectorAll('li[data-id], li[data-action]')); }

  function setActive(i) {
    const els = items();
    activeIndex = i;
    els.forEach((el, n) => el.classList.toggle('active', n === i));
    if (els[i]) els[i].scrollIntoView({ block: 'nearest' });
  }

  function render(query) {
    const q = String(query || '').trim().toLowerCase();
    let filtered = q ? leads.filter(l => matches(l, q)) : leads;
    // Only the *empty* field is capped — a real query must never hide matches.
    if (!q && emptyLimit > 0) filtered = filtered.slice(0, emptyLimit);

    let html = onNew ? `<li class="cust-new-item" data-action="new">${escHtml(newLabel)}</li>` : '';

    if (!filtered.length) {
      html += `<li class="empty-item">${escHtml(emptyText)}</li>`;
    } else {
      const rx = q ? new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi') : null;
      html += filtered.map(l => {
        const safe = escHtml(labelOf(l));
        const hl = rx ? safe.replace(rx, '<span class="match-hl">$1</span>') : safe;
        return `<li data-id="${escHtml(l.id)}">${hl}</li>`;
      }).join('');
    }

    list.innerHTML = html;
    list.hidden = false;
    activeIndex = -1;
  }

  function pick(el) {
    if (!el) return;
    if (el.dataset.action === 'new') {
      close();
      if (onNew) onNew((inputEl.value || '').trim());
      return;
    }
    const lead = leads.find(l => String(l.id) === String(el.dataset.id));
    if (!lead) return;
    inputEl.value = labelOf(lead);
    close();
    onSelect(lead);
  }

  // ── events ────────────────────────────────────────────────────────────────
  inputEl.setAttribute('autocomplete', 'off');
  inputEl.removeAttribute('list');   // a stale <datalist> would open a 2nd popup

  inputEl.addEventListener('focus', async () => { await ensureLoaded(); render(inputEl.value); });
  inputEl.addEventListener('input', async () => { await ensureLoaded(); render(inputEl.value); });

  inputEl.addEventListener('keydown', (e) => {
    const els = items();
    if (!els.length || list.hidden) return;
    if (e.key === 'ArrowDown')      { e.preventDefault(); setActive(Math.min(activeIndex + 1, els.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
    else if (e.key === 'Enter')     { if (activeIndex >= 0) { e.preventDefault(); pick(els[activeIndex]); } }
    else if (e.key === 'Escape')    { e.stopPropagation(); close(); }   // don't also close the modal
  });

  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    e.preventDefault();               // fires before blur, keeps the list alive
    pick(li);
  });

  document.addEventListener('mousedown', (e) => {
    if (list.hidden) return;
    if (container && container.contains(e.target)) return;
    if (e.target === inputEl) return;
    close();
  });

  const api = {
    /** Re-read the leads (after creating a patient, or switching Standort). */
    async refresh() { await ensureLoaded(true); if (!list.hidden) render(inputEl.value); },
    close,
  };
  inputEl._patientSearchApi = api;
  return api;
}
