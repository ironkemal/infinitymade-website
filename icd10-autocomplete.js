/**
 * icd10-autocomplete.js — Shared ICD-10 autocomplete helper
 * ES module. Attaches a dropdown to any text input backed by Supabase icd10_titles.
 *
 * Usage:
 *   import { icd10Autocomplete } from './icd10-autocomplete.js?v=20260720';
 *   icd10Autocomplete(document.getElementById('myInput'), supabaseClient, { chapters: [...], multi: true, codeOnly: true });
 */

'use strict';

/**
 * Attaches ICD-10 autocomplete behaviour to an input element.
 *
 * @param {HTMLInputElement} inputEl  - The text input to enhance.
 * @param {object}           sbClient - An initialised @supabase/supabase-js client.
 * @param {object}           [opts]   - Optional configuration parameters.
 */
export function icd10Autocomplete(inputEl, sbClient, opts = {}) {
  if (!inputEl || !sbClient) return;
  const { chapters = null, multi = false, codeOnly = false } = opts;

  // ── Create dropdown container ─────────────────────────────────────────────
  const dropdown = document.createElement('div');
  dropdown.className = 'icd10-dropdown';
  dropdown.setAttribute('role', 'listbox');
  dropdown.setAttribute('aria-label', 'ICD-10 Vorschläge');

  // Attach to body to escape overflow:hidden / overflow-y:auto on modal containers.
  // Position is updated each time the dropdown is shown.
  document.body.appendChild(dropdown);

  function positionDropdown() {
    const rect = inputEl.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top  = (rect.bottom + 2) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let activeIndex = -1;
  let currentItems = [];   // [{code, titel}, ...]
  let debounceTimer = null;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function closeDropdown() {
    dropdown.innerHTML = '';
    activeIndex = -1;
    currentItems = [];
    dropdown.style.display = 'none';
  }

  // Hide immediately on init
  dropdown.style.display = 'none';

  function setActive(index) {
    const items = dropdown.querySelectorAll('.icd10-dropdown-item');
    items.forEach((el, i) => el.classList.toggle('active', i === index));
    activeIndex = index;
  }

  function selectItem(item) {
    const textToInsert = codeOnly ? item.code : `${item.code} – ${item.titel}`;
    if (multi) {
      const parts = inputEl.value.split(',');
      parts[parts.length - 1] = ' ' + textToInsert;
      inputEl.value = parts.join(',').replace(/^ /, '');
    } else {
      inputEl.value = textToInsert;
    }
    closeDropdown();
    // Dispatch a native input event so existing listeners (e.g. form validation) react
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function renderItems(items) {
    dropdown.innerHTML = '';
    activeIndex = -1;
    currentItems = items;

    if (!items.length) { dropdown.style.display = 'none'; return; }

    positionDropdown();
    dropdown.style.display = 'block';

    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'icd10-dropdown-item';
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', 'false');
      el.innerHTML =
        `<span class="icd-code">${escHtml(item.code)}</span>` +
        `<span class="icd-title">${escHtml(item.titel)}</span>`;

      el.addEventListener('mousedown', (e) => {
        // mousedown fires before blur; prevent blur from closing dropdown first
        e.preventDefault();
        selectItem(item);
      });
      el.addEventListener('mouseenter', () => setActive(i));

      dropdown.appendChild(el);
    });
  }

  async function search(query) {
    let q = query;
    if (multi) {
      const seg = query.split(',').pop();
      q = seg;
    }
    q = q.trim();
    if (q.length < 2) { closeDropdown(); return; }

    try {
      let data = [];
      if (chapters) {
        const chapterOr = chapters.map(c => `and(code.gte.${c.gte},code.lt.${c.lt})`).join(',');
        const [byCode, byTitle] = await Promise.all([
          sbClient.from('icd10_titles').select('code, titel').or(chapterOr).ilike('code', `%${q}%`).limit(8),
          sbClient.from('icd10_titles').select('code, titel').or(chapterOr).ilike('titel', `%${q}%`).limit(8),
        ]);
        if (byCode.error) {
          console.warn('[icd10-autocomplete] Supabase error (byCode):', byCode.error.message);
        }
        if (byTitle.error) {
          console.warn('[icd10-autocomplete] Supabase error (byTitle):', byTitle.error.message);
        }

        const seen = new Set();
        const merged = [...(byCode.data || []), ...(byTitle.data || [])]
          .filter(r => seen.has(r.code) ? false : seen.add(r.code));

        if (merged.length > 0) {
          data = merged;
        } else {
          // Fallback to the previous global .or(code.ilike/titel.ilike)-Query
          const res = await sbClient
            .from('icd10_titles')
            .select('code, titel')
            .or(`code.ilike.%${q}%,titel.ilike.%${q}%`)
            .limit(10);
          if (res.error) {
            console.warn('[icd10-autocomplete] Supabase error (fallback):', res.error.message);
          } else {
            data = res.data || [];
          }
        }
      } else {
        const res = await sbClient
          .from('icd10_titles')
          .select('code, titel')
          .or(`code.ilike.%${q}%,titel.ilike.%${q}%`)
          .limit(10);
        if (res.error) {
          console.warn('[icd10-autocomplete] Supabase error:', res.error.message);
          return;
        }
        data = res.data || [];
      }
      renderItems(data);
    } catch (err) {
      console.warn('[icd10-autocomplete] fetch error:', err);
    }
  }

  // Simple HTML escape — codes/titles are plain text but be safe
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  inputEl.setAttribute('autocomplete', 'off');
  inputEl.setAttribute('aria-autocomplete', 'list');
  inputEl.setAttribute('aria-haspopup', 'listbox');

  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => search(inputEl.value), 220);
  });

  inputEl.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.icd10-dropdown-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && currentItems[activeIndex]) {
        e.preventDefault();
        selectItem(currentItems[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  inputEl.addEventListener('blur', () => {
    // Small delay so a mousedown on a dropdown item can fire first
    setTimeout(closeDropdown, 150);
  });
}
