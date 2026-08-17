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
 *
 * Fachbereichs-Filter: `attachDiagnoseSearch(..., { strict: true })` blendet
 * fachfremde Diagnosen ganz aus, statt sie unter einen Trenner zu schieben.
 * Aktiv für Podologie. Vorgesehen für JEDEN Fachbereich, jeweils sobald sein
 * Feinschliff an der Reihe ist (Physio · Ergo · Logopädie) — dafür genügt das
 * `strict: true` in der Feld-Definition, am Modul ist nichts mehr zu tun.
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
  // Leere Query ist erlaubt: die RPC liefert dann die Diagnosegruppen des
  // Fachbereichs (nie ICD — 16.905 Kodes ohne Suchbegriff sind keine Auswahl).
  const q = String(query || '').trim();
  if (!sb) return [];
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
 * Das generische Dropdown. Exportiert, damit verwandte Picker (arzt-suche.js)
 * es benutzen statt eines nachgebauten — eine Implementierung, ein Fix.
 *
 * @param {HTMLInputElement} inputEl
 * @param {object} cfg
 * @param {(q:string)=>Promise<Array|{items:Array,note?:string}>} cfg.fetchItems
 *        `note` wird angezeigt, wenn `items` leer ist — sonst klappt das
 *        Dropdown wortlos zu und wirkt kaputt.
 * @param {(item:any)=>string}         cfg.toText      value written into the input
 * @param {(item:any)=>string}         cfg.renderItem  innerHTML of one row
 * @param {(a:any,b:any)=>boolean}    [cfg.needsSeparator] insert the "other" divider between a and b
 * @param {string}                    [cfg.separatorLabel]
 * @param {boolean}                   [cfg.multi]
 * @param {number}                    [cfg.minChars]
 * @param {Function}                  [cfg.onSelect]
 * @param {string}                    [cfg.ariaLabel]
 */
export function attachAutocomplete(inputEl, cfg) {
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
  // Zustände für das erneute Öffnen eines bereits gefüllten Feldes (siehe unten).
  let ignoriereEingabe = false;   // input-Ereignis, das selectItem selbst auslöst
  let markierungOffen  = false;   // focus hat gerade den ganzen Wert markiert
  let geradeFokussiert = false;   // trennt den Fokus-Klick vom zweiten Klick

  /**
   * Der Kode-Teil eines bereits übernommenen Wertes:
   * "L60.0 – Unguis incarnatus" → "L60.0".
   * Rückfall für Felder, deren leere Abfrage nichts liefert (ICD): dort zeigt
   * der Klick dann die Nachbarn des gewählten Kodes statt eines leeren Menüs.
   */
  function codeTeil(wert) {
    const s = String(wert || '').trim();
    if (!s) return '';
    return (s.split(/\s[–—-]\s/)[0] || '').trim() || s;
  }

  /**
   * Klick in ein Feld, in dem schon etwas steht.
   *
   * Vorher wurde mit dem VOLLEN Feldinhalt gesucht ("L60.0 – Unguis incarnatus"),
   * und danach suchte niemand — das Dropdown blieb wortlos zu. Man musste den
   * gewählten Wert erst von Hand löschen, um überhaupt wieder eine Liste zu
   * sehen. Genau das entfällt hier: der Klick zeigt die Auswahlliste, das
   * Tippen filtert sie, und der alte Wert ist markiert, wird also vom ersten
   * Tastendruck ersetzt.
   */
  async function oeffneAuswahl() {
    const seq = ++requestSeq;
    const abholen = async (q) => {
      const r = await fetchItems(q);
      return Array.isArray(r) ? { items: r, note: '' } : { items: r?.items || [], note: r?.note || '' };
    };
    let res;
    try { res = await abholen(''); }
    catch (e) { console.warn('[katalog-suche] Auswahl:', e); return; }
    if (seq !== requestSeq) return;

    const rest = codeTeil(inputEl.value);
    if (!res.items.length && !res.note && rest) {
      try { res = await abholen(rest); }
      catch (e) { console.warn('[katalog-suche] Auswahl (Rückfall):', e); return; }
      if (seq !== requestSeq) return;
    }
    renderItems(res.items, res.note);
  }

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
    // Das eigene input-Ereignis darf die Suche nicht erneut anwerfen — sonst
    // stünde 180 ms nach der Auswahl wieder ein Dropdown offen.
    ignoriereEingabe = true;
    inputEl.dispatchEvent(new Event('input',  { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    ignoriereEingabe = false;
    if (onSelect) { try { onSelect(item); } catch (e) { console.warn('[katalog-suche] onSelect:', e); } }
  }

  function renderItems(items, note = '') {
    dropdown.innerHTML = '';
    activeIndex = -1;
    currentItems = items;
    // Leere Liste heisst normalerweise "nichts gefunden", da genügt Zuklappen.
    // Wurde aber gefiltert (strict), muss dastehen WARUM — ein wortlos leeres
    // Dropdown liest sich wie ein kaputtes Suchfeld.
    if (!items.length && !note) { dropdown.style.display = 'none'; return; }
    if (!items.length) {
      positionDropdown();
      dropdown.style.display = 'block';
      const hint = document.createElement('div');
      hint.className = 'icd10-dropdown-sep';
      hint.style.position = 'static';   // kein sticky, es ist die einzige Zeile
      hint.textContent = note;
      dropdown.appendChild(hint);
      return;
    }

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
    const result = await fetchItems(q);
    if (seq !== requestSeq) return;     // a newer keystroke already won
    // fetchItems darf entweder ein Array liefern oder { items, note } — die
    // Notiz erscheint, wenn die Liste durch Filtern leer geblieben ist.
    if (Array.isArray(result)) renderItems(result);
    else renderItems(result?.items || [], result?.note || '');
  }

  inputEl.setAttribute('autocomplete', 'off');
  inputEl.setAttribute('aria-autocomplete', 'list');
  inputEl.setAttribute('aria-haspopup', 'listbox');
  // A stale <datalist> would render a second, unfiltered dropdown on top of ours.
  inputEl.removeAttribute('list');

  inputEl.addEventListener('input', () => {
    if (ignoriereEingabe) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => search(inputEl.value), 180);
  });

  // minChars: 0 heisst "Klick genuegt" — dann auch bei leerem Feld suchen.
  // Steht schon ein Wert im Feld, öffnet der Klick die Auswahl (oeffneAuswahl)
  // statt nach dem fertigen Text zu suchen, und markiert ihn zugleich.
  inputEl.addEventListener('focus', () => {
    geradeFokussiert = true;
    setTimeout(() => { geradeFokussiert = false; }, 400);
    if (multi) {
      if (inputEl.value.trim() || minChars === 0) search(inputEl.value);
      return;
    }
    if (inputEl.value) {
      markierungOffen = true;
      try { inputEl.select(); } catch { /* select() gibt es nicht auf jedem Feldtyp */ }
    }
    if (inputEl.value.trim() || minChars === 0) oeffneAuswahl();
  });

  // Der Klick, der den Fokus setzt, würde die Markierung sofort wieder aufheben.
  inputEl.addEventListener('mouseup', e => {
    if (!markierungOffen) return;
    markierungOffen = false;
    e.preventDefault();
  });

  // Zweiter Klick ins bereits fokussierte Feld (oder nach Escape): erneut öffnen.
  inputEl.addEventListener('click', () => {
    if (geradeFokussiert || dropdown.style.display === 'block') return;
    if (multi) search(inputEl.value);
    else if (inputEl.value.trim() || minChars === 0) oeffneAuswahl();
  });

  inputEl.addEventListener('keydown', e => {
    if (!dropdown.querySelectorAll('.icd10-dropdown-item').length) return;
    if (e.key === 'ArrowDown')      { e.preventDefault(); setActive(Math.min(activeIndex + 1, currentItems.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
    else if (e.key === 'Enter')     { if (activeIndex >= 0 && currentItems[activeIndex]) { e.preventDefault(); selectItem(currentItems[activeIndex]); } }
    else if (e.key === 'Escape')    { closeDropdown(); }
  });
  inputEl.addEventListener('blur', () => { markierungOffen = false; setTimeout(closeDropdown, 150); });
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
 *                        multi, codeOnly, limit, strict, onSelect
 */
export function attachDiagnoseSearch(inputEl, sb, opts = {}) {
  if (!inputEl || !sb) return;
  // limit 50: "E" trifft in der Podologie allein 155 gültige ICD-Kodes. Mit 25
  // brach die Liste mitten in E10.x ab, bevor der Nutzer weitertippen konnte.
  // Im strict-Modus (siehe unten) sind es 100 — die Obergrenze der RPC —, weil
  // dort keine Zeile mehr an fachfremde Kodes verloren geht.
  // nurCodes: () => string[]  — optionale Allowlist für Diagnosegruppen.
  const { multi = false, codeOnly = false, kind = 'both', strict = false, onSelect = null } = opts;
  const limit = opts.limit ?? (strict ? 100 : 50);
  const resolveBereich = typeof opts.bereich === 'function' ? opts.bereich : () => opts.bereich ?? null;

  /*
   * Zwei Modi, eine Implementierung:
   *
   *   strict:false (Vorgabe)  Eigener Fachbereich oben, alles andere unter dem
   *                           Trenner "Andere Fachbereiche" — sichtbar, nur
   *                           nachrangig. So verhielt sich das Feld seit jeher.
   *
   *   strict:true             Nur der eigene Fachbereich. Kein Trenner, keine
   *                           fachfremden Kodes. Eine Podologin wählt nie
   *                           "M54.5 Kreuzschmerz"; die Zeile ist reines
   *                           Rauschen und ein Fehlgriff kostet eine Absetzung.
   *
   * ZIEL: strict wird pro Fachbereich scharf geschaltet, sobald dessen
   * Feinschliff dran ist — Podologie zuerst (siehe CLAUDE.md, "Vertikal-
   * sortierung"), danach Physio · Ergo · Logopädie mit demselben Schalter.
   * `icd_sector_ranges` ist für alle vier Bereiche gepflegt, es fehlt also
   * nur das `strict: true` an der jeweiligen Feld-Definition.
   *
   * Gefiltert wird im Client, nicht in der RPC — search_diagnosen() sortiert
   * bereits `in_sector desc` als erstes Kriterium. Die ersten N Zeilen sind
   * damit dieselben, die ein serverseitiger Filter liefern würde; wir sparen
   * uns eine zweite RPC-Signatur.
   */
  // Ohne aufgelösten Fachbereich liefert die RPC in_sector=false für JEDEN
  // ICD-Kode. Strikt filtern hiesse dann: leere Liste. Also fällt der Modus
  // in diesem Fall bewusst auf die alte Rangfolge zurück.
  const strictNow = () => strict && !!normalizeBereich(resolveBereich());

  attachAutocomplete(inputEl, {
    ariaLabel: 'Diagnose-Vorschläge',
    multi, onSelect,
    // Diagnosegruppen sind eine kurze, feste Auswahl (Podologie 5, Physio 28):
    // ein Klick ins leere Feld listet sie. ICD-Felder brauchen weiter ein Zeichen.
    minChars: opts.minChars ?? (kind === 'dg' ? 0 : 1),
    fetchItems: async q => {
      let rows = await searchDiagnosen(sb, q, { bereich: resolveBereich(), kind, limit });
      // `nurCodes` engt die Diagnosegruppen auf die ein, die zum bereits
      // eingegebenen ICD-Kode passen (Podologie: L60.0 lässt nur UI1/UI2 zu).
      // Liefert die Funktion nichts, wird nicht eingeengt — eine leere Liste
      // wäre schlimmer als eine lange.
      const erlaubt = typeof opts.nurCodes === 'function' ? opts.nurCodes() : null;
      if (erlaubt?.length) {
        const gefiltert = rows.filter(it => it.kind !== 'dg' || erlaubt.includes(it.code));
        if (gefiltert.length) rows = gefiltert;
      }
      if (!strictNow()) return rows;
      const own = rows.filter(it => it.in_sector);
      // Nur gefiltert und nichts übrig? Dann sagen, dass es Treffer GAB, sie
      // aber nicht zum Fachbereich gehören. Sonst sucht die Nutzerin den
      // Fehler bei sich ("M54 gibt es doch") statt beim Fachbereich.
      if (own.length || !rows.length) return own;
      return { items: own, note: 'Keine Diagnose Ihres Fachbereichs — kein Treffer für diesen Text' };
    },
    toText: it => (codeOnly ? it.code : `${it.code} – ${it.titel}`),
    renderItem: it =>
      `<span class="icd-code">${esc(it.code)}</span>` +
      `<span class="icd-title">${esc(it.titel)}</span>` +
      (it.kind === 'dg' ? `<span class="icd-badge">Diagnosegruppe</span>` : ''),
    // Own Fachbereich on top, everything else below a divider — ranked, never
    // hidden. Im strict-Modus gibt es nichts zu trennen, dann entfällt er.
    needsSeparator: (prev, cur) => !strictNow() && prev.in_sector && !cur.in_sector,
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
