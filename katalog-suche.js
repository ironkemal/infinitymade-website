/**
 * katalog-suche.js — THE shared catalogue search for the whole app.
 *
 * Two catalogues, ONE dropdown implementation:
 *
 *   Diagnosen    → RPC search_diagnosen()
 *                  • ICD-10-GM 2026            (icd10_titles,      16.905 Kodes)
 *                  • Heilmittelkatalog-Gruppen (diagnosegruppen,   DF/NF/QF/UI1/UI2,
 *                    WS, EX, ZN, PN, AT, GE, LY, CS, SO1-SO5, SB1-SB3, EN1-EN3,
 *                    PS1-PS4, ST1-ST4, SP1-SP6, RE1, RE2, SF, SC)
 *
 *   Heilmittel   → RPC search_heilmittel()
 *                  • heilmittel_katalog, erzeugt aus den Abrechnungs-Codedateien.
 *                    Filtert Gültigkeitsdatum, abgelöste Positionen und die
 *                    Diagnosegruppen-Bindung — das konnte vorher kein Feld.
 *
 * Do NOT hand-roll a picker anywhere else. Every field goes through
 * `attachDiagnoseSearch` / `attachHeilmittelSearch`, so one fix fixes all of them.
 * (Formerly: 5 diagnosis implementations and 4 Heilmittel lists that disagreed.)
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   Fachbereiche
   ═══════════════════════════════════════════════════════════════════════════ */

export const BEREICHE = ['physiotherapy', 'podologie', 'logopaedie', 'ergotherapie'];

/** Normalises whatever the app calls a sector into a value the RPCs understand. */
export function normalizeBereich(sector) {
  const s = String(sector || '').toLowerCase().trim();
  if (!s) return null;
  if (BEREICHE.includes(s)) return s;
  if (s.startsWith('physio')) return 'physiotherapy';
  if (s.startsWith('podo'))   return 'podologie';
  if (s.startsWith('logo') || s.startsWith('sprach')) return 'logopaedie';
  if (s.startsWith('ergo'))   return 'ergotherapie';
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Datenzugriff — die einzigen beiden Stellen, die die RPCs aufrufen
   ═══════════════════════════════════════════════════════════════════════════ */

/** @returns {Promise<Array<{kind,code,titel,bereich,terminal,in_sector,rank}>>} */
export async function searchDiagnosen(sb, query, opts = {}) {
  const { bereich = null, kind = 'both', limit = 25 } = opts;
  const q = String(query || '').trim();
  if (!q || !sb) return [];
  const { data, error } = await sb.rpc('search_diagnosen', {
    p_q: q, p_bereich: normalizeBereich(bereich), p_kind: kind, p_limit: limit,
  });
  if (error) { console.warn('[katalog-suche] search_diagnosen:', error.message); return []; }
  return data || [];
}

/**
 * Heilmittel/Positionen. Empty query = full filtered list (for <select>).
 * @returns {Promise<Array<{code,bereich,label,kuerzel,kategorie,preis_eur,zuzahlung_eur,dauer,max_pro_tag,max_pro_termin,notiz}>>}
 */
export async function searchHeilmittel(sb, query, opts = {}) {
  const { bereich = null, diagnosegruppe = null, datum = null, limit = 100 } = opts;
  if (!sb) return [];
  const { data, error } = await sb.rpc('search_heilmittel', {
    p_q: String(query || '').trim() || null,
    p_bereich: normalizeBereich(bereich),
    p_diagnosegruppe: diagnosegruppe || null,
    p_datum: datum || null,
    p_limit: limit,
  });
  if (error) { console.warn('[katalog-suche] search_heilmittel:', error.message); return []; }
  return data || [];
}

/** <option>-Liste für ein Heilmittel-<select>. */
export function heilmittelOptionsHtml(rows, selected = '', placeholder = '— Heilmittel —') {
  const esc = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<option value="">${esc(placeholder)}</option>` + rows.map(r =>
    `<option value="${esc(r.code)}"${r.code === selected ? ' selected' : ''}>`
    + `${esc(r.code)} – ${esc(r.label)}</option>`
  ).join('');
}

/* ═══════════════════════════════════════════════════════════════════════════
   Generisches Dropdown — genau EINE Implementierung
   ═══════════════════════════════════════════════════════════════════════════ */

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * @param {HTMLInputElement} inputEl
 * @param {object} cfg
 * @param {(q:string)=>Promise<Array>} cfg.fetchItems
 * @param {(item:any)=>string}         cfg.toText      value written into the input
 * @param {(item:any)=>string}         cfg.renderItem  innerHTML of one row
 * @param {(a:any,b:any)=>boolean}    [cfg.needsSeparator] insert the "other" divider between a and b
 * @param {string}                    [cfg.separatorLabel]
 * @param {boolean}                   [cfg.multi]
 * @param {number}                    [cfg.minChars]
 * @param {Function}                  [cfg.onSelect]
 * @param {string}                    [cfg.ariaLabel]
 */
function attachAutocomplete(inputEl, cfg) {
  if (!inputEl) return;
  if (inputEl.dataset.katalogWired === '1') return;
  inputEl.dataset.katalogWired = '1';
  inputEl.dataset.diagnoseWired = '1';   // Rückwärtskompatibilität

  const {
    fetchItems, toText, renderItem,
    needsSeparator = null, separatorLabel = 'Weitere',
    multi = false, minChars = 1, onSelect = null,
    ariaLabel = 'Vorschläge',
  } = cfg;

  // Panels like the Podologie billing view re-render with innerHTML, which
  // throws away the input but not its body-level dropdown. Sweep orphans.
  document.querySelectorAll('.icd10-dropdown').forEach(d => {
    if (d._owner && !d._owner.isConnected) d.remove();
  });

  // Attached to <body> to escape overflow:hidden / overflow-y:auto on modals.
  const dropdown = document.createElement('div');
  dropdown.className = 'icd10-dropdown';
  dropdown.setAttribute('role', 'listbox');
  dropdown.setAttribute('aria-label', ariaLabel);
  dropdown.style.display = 'none';
  dropdown._owner = inputEl;
  document.body.appendChild(dropdown);

  function positionDropdown() {
    const r = inputEl.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top   = (r.bottom + 2) + 'px';
    dropdown.style.left  = r.left + 'px';
    dropdown.style.width = Math.max(r.width, 320) + 'px';
  }

  let activeIndex = -1, currentItems = [], debounceTimer = null, requestSeq = 0;

  function closeDropdown() {
    dropdown.innerHTML = '';
    activeIndex = -1; currentItems = [];
    dropdown.style.display = 'none';
  }

  function setActive(i) {
    const els = dropdown.querySelectorAll('.icd10-dropdown-item');
    els.forEach((el, n) => {
      const on = n === i;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    activeIndex = i;
    if (i >= 0 && els[i]) els[i].scrollIntoView({ block: 'nearest' });
  }

  function selectItem(item) {
    const text = toText(item);
    if (multi) {
      const parts = inputEl.value.split(',');
      parts[parts.length - 1] = ' ' + text;
      inputEl.value = parts.join(',').replace(/^ /, '');
    } else {
      inputEl.value = text;
    }
    closeDropdown();
    inputEl.dispatchEvent(new Event('input',  { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    if (onSelect) { try { onSelect(item); } catch (e) { console.warn('[katalog-suche] onSelect:', e); } }
  }

  function renderItems(items) {
    dropdown.innerHTML = '';
    activeIndex = -1;
    currentItems = items;
    if (!items.length) { dropdown.style.display = 'none'; return; }

    positionDropdown();
    dropdown.style.display = 'block';

    let dividerDone = false;
    items.forEach((item, i) => {
      if (!dividerDone && needsSeparator && i > 0 && needsSeparator(items[i - 1], item)) {
        dividerDone = true;
        const sep = document.createElement('div');
        sep.className = 'icd10-dropdown-sep';
        sep.textContent = separatorLabel;
        dropdown.appendChild(sep);
      }
      const el = document.createElement('div');
      el.className = 'icd10-dropdown-item' + (item.kind === 'dg' ? ' is-dg' : '');
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', 'false');
      el.innerHTML = renderItem(item);
      el.addEventListener('mousedown', e => { e.preventDefault(); selectItem(item); });
      el.addEventListener('mouseenter', () => setActive(i));
      dropdown.appendChild(el);
    });
  }

  async function search(rawValue) {
    let q = multi ? rawValue.split(',').pop() : rawValue;
    q = q.trim();
    // A single character is intentionally enough: "Q" must list QF and the
    // Q-codes; "N" must list the N-Diagnosegruppen.
    if (q.length < minChars) { closeDropdown(); return; }
    const seq = ++requestSeq;
    const items = await fetchItems(q);
    if (seq !== requestSeq) return;     // a newer keystroke already won
    renderItems(items);
  }

  inputEl.setAttribute('autocomplete', 'off');
  inputEl.setAttribute('aria-autocomplete', 'list');
  inputEl.setAttribute('aria-haspopup', 'listbox');
  // A stale <datalist> would render a second, unfiltered dropdown on top of ours.
  inputEl.removeAttribute('list');

  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => search(inputEl.value), 180);
  });
  inputEl.addEventListener('focus', () => { if (inputEl.value.trim()) search(inputEl.value); });
  inputEl.addEventListener('keydown', e => {
    if (!dropdown.querySelectorAll('.icd10-dropdown-item').length) return;
    if (e.key === 'ArrowDown')      { e.preventDefault(); setActive(Math.min(activeIndex + 1, currentItems.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
    else if (e.key === 'Enter')     { if (activeIndex >= 0 && currentItems[activeIndex]) { e.preventDefault(); selectItem(currentItems[activeIndex]); } }
    else if (e.key === 'Escape')    { closeDropdown(); }
  });
  inputEl.addEventListener('blur', () => setTimeout(closeDropdown, 150));
  window.addEventListener('scroll', () => {
    if (dropdown.style.display === 'block') positionDropdown();
  }, true);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Die beiden öffentlichen Felder-Helfer
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * ICD-10 und/oder Diagnosegruppen an ein Textfeld hängen.
 * @param {object} [opts] bereich (string|Function), kind 'icd'|'dg'|'both',
 *                        multi, codeOnly, limit, onSelect
 */
export function attachDiagnoseSearch(inputEl, sb, opts = {}) {
  if (!inputEl || !sb) return;
  const { multi = false, codeOnly = false, kind = 'both', limit = 25, onSelect = null } = opts;
  const resolveBereich = typeof opts.bereich === 'function' ? opts.bereich : () => opts.bereich ?? null;

  attachAutocomplete(inputEl, {
    ariaLabel: 'Diagnose-Vorschläge',
    multi, onSelect,
    fetchItems: q => searchDiagnosen(sb, q, { bereich: resolveBereich(), kind, limit }),
    toText: it => (codeOnly ? it.code : `${it.code} – ${it.titel}`),
    renderItem: it =>
      `<span class="icd-code">${esc(it.code)}</span>` +
      `<span class="icd-title">${esc(it.titel)}</span>` +
      (it.kind === 'dg' ? `<span class="icd-badge">Diagnosegruppe</span>` : ''),
    // Own Fachbereich on top, everything else below a divider — ranked, never hidden.
    needsSeparator: (prev, cur) => prev.in_sector && !cur.in_sector,
    separatorLabel: 'Andere Fachbereiche',
  });
}

/**
 * Heilmittel/Positionen an ein Textfeld hängen.
 * @param {object} [opts] bereich, diagnosegruppe, datum (alle string|Function),
 *                        codeOnly, multi, limit, onSelect
 */
export function attachHeilmittelSearch(inputEl, sb, opts = {}) {
  if (!inputEl || !sb) return;
  const { multi = false, codeOnly = false, limit = 100, onSelect = null } = opts;
  const fn = v => (typeof v === 'function' ? v : () => v ?? null);
  const getBereich = fn(opts.bereich);
  const getDg      = fn(opts.diagnosegruppe);
  const getDatum   = fn(opts.datum);

  attachAutocomplete(inputEl, {
    ariaLabel: 'Heilmittel-Vorschläge',
    multi, onSelect,
    minChars: 0,                      // leeres Feld zeigt die gültige Gesamtliste
    fetchItems: q => searchHeilmittel(sb, q, {
      bereich: getBereich(), diagnosegruppe: getDg(), datum: getDatum(), limit,
    }),
    toText: it => (codeOnly ? it.code : `${it.code} – ${it.label}`),
    renderItem: it =>
      `<span class="icd-code">${esc(it.kuerzel || it.code)}</span>` +
      `<span class="icd-title">${esc(it.label)}</span>` +
      (it.preis_eur != null
        ? `<span class="icd-badge">${Number(it.preis_eur).toFixed(2).replace('.', ',')} €</span>`
        : ''),
  });
}
