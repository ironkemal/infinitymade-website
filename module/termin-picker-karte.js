/**
 * termin-picker-karte.js — Wiederverwendbare 3-Spalten-Terminkarte (Praxura)
 *
 * Aufbau (ohne Fotos, immer 24-Stunden-Format, Light & Dark Mode):
 *   1. Links  : Kontext (Monogramm/Name, Untertitel, Titel, Beschreibung, Metadaten, optional eigene Felder)
 *   2. Mitte  : Monatskalender (MO–SO, Monatsnavigation, verfügbare Tage, Heute-Punkt, gewählter Tag)
 *   3. Rechts : Tageskopf („Fr 30“) + klickbare 24h-Zeitslots oder eigene Tagesdetails
 */
'use strict';

export const MONATE_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export const WOCHENTAGE_KURZ_MO = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
const WOCHENTAGE_KOPF = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const ICON_UHR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>';
const ICON_ORT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';
const ICON_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const ICON_PREV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>';
const ICON_NEXT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

/**
 * Formatiert ein Date-Objekt als lokales ISO-Datum 'YYYY-MM-DD'.
 * @param {Date} date
 * @returns {string}
 */
export function datumIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Heutiges Datum in Europe/Berlin als 'YYYY-MM-DD'.
 * @param {Date} [jetzt]
 * @returns {string}
 */
export function heuteBerlinIso(jetzt = new Date()) {
  try {
    return jetzt.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  } catch {
    return datumIso(jetzt);
  }
}

/**
 * Parst 'YYYY-MM-DD' sicher als lokales Date-Objekt (ohne UTC-Drift).
 * @param {string} iso
 * @returns {Date | null}
 */
export function parseDatumIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/**
 * Erzeugt das Montags-basierte Monatsraster für (year, month0).
 * @param {number} year
 * @param {number} month0 0..11
 * @returns {Array<{ empty: boolean, day?: number, iso?: string, weekday?: number }>}
 */
export function monatsRaster(year, month0) {
  const erster = new Date(year, month0, 1);
  const offset = (erster.getDay() + 6) % 7; // 0 = Mo .. 6 = So
  const anzahlTage = new Date(year, month0 + 1, 0).getDate();
  /** @type {Array<{ empty: boolean, day?: number, iso?: string, weekday?: number }>} */
  const zellen = [];
  for (let i = 0; i < offset; i++) zellen.push({ empty: true });
  for (let day = 1; day <= anzahlTage; day++) {
    const dt = new Date(year, month0, day);
    zellen.push({ empty: false, day, iso: datumIso(dt), weekday: dt.getDay() });
  }
  return zellen;
}

/**
 * Liefert den kurzen Tageskopf für die rechte Spalte: { wochentag: 'Fr', tag: 30 }.
 * @param {string} iso
 * @returns {{ wochentag: string, tag: number, voll: string } | null}
 */
export function kurzTagKopf(iso) {
  const dt = parseDatumIso(iso);
  if (!dt) return null;
  const wochentag = WOCHENTAGE_KOPF[dt.getDay()];
  const tag = dt.getDate();
  return { wochentag, tag, voll: `${wochentag} ${tag}` };
}

/**
 * Formatiert eine Dauer in Minuten im deutschen Format („45 Min.“, „1 Std. 30 Min.“).
 * @param {number | null | undefined} minuten
 * @returns {string}
 */
export function formatDauer(minuten) {
  const m = Number(minuten);
  if (!Number.isFinite(m) || m <= 0) return '';
  const std = Math.floor(m / 60);
  const rest = m % 60;
  if (std > 0 && rest > 0) return `${std} Std. ${rest} Min.`;
  if (std > 0) return `${std} Std.`;
  return `${rest} Min.`;
}

/**
 * Erzeugt ein textbasiertes Monogramm (1–2 Buchstaben, niemals ein Foto).
 * @param {string} name
 * @returns {string}
 */
export function monogramm(name) {
  const teile = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return 'P';
  if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase();
  return (teile[0][0] + teile[teile.length - 1][0]).toUpperCase();
}

/**
 * @typedef {{
 *   icon?: 'clock' | 'globe' | 'calendar',
 *   text: string,
 * }} TpkMetaItem
 *
 * @typedef {{
 *   kicker?: string,
 *   subtitle?: string,
 *   title?: string,
 *   description?: string,
 *   showMonogram?: boolean,
 *   monogramText?: string,
 *   meta?: TpkMetaItem[],
 * }} TpkContext
 *
 * @typedef {{
 *   value: string,
 *   label?: string,
 *   meta?: string,
 *   disabled?: boolean,
 * }} TpkSlot
 *
 * @typedef {{
 *   compact?: boolean,
 *   context?: TpkContext,
 *   minDate?: string | null,
 *   allowPast?: boolean,
 *   initialYear?: number,
 *   initialMonth?: number,
 *   selectedDate?: string | null,
 *   selectedSlot?: string | null,
 *   availableDates?: Iterable<string> | null,
 *   dayMarkers?: Record<string, 'open' | 'closed' | 'holiday' | 'special'>,
 *   slotsHint?: string,
 *   emptySlotsText?: string,
 *   onMonthChange?: (year: number, month0: number) => void | Promise<void>,
 *   onDateSelect?: (iso: string) => void | Promise<void>,
 *   onSlotSelect?: (slot: TpkSlot, iso: string | null) => void,
 * }} TpkOptions
 */

/**
 * Mountet eine 3-Spalten-Terminkarte in `container`.
 * @param {HTMLElement} container
 * @param {TpkOptions} [opts]
 */
export function erstelleTerminPickerKarte(container, opts = {}) {
  const heuteIso = heuteBerlinIso();
  const heuteDt = parseDatumIso(heuteIso) || new Date();

  let curYear = Number.isInteger(opts.initialYear) ? /** @type {number} */ (opts.initialYear) : heuteDt.getFullYear();
  let curMonth = Number.isInteger(opts.initialMonth) ? /** @type {number} */ (opts.initialMonth) : heuteDt.getMonth();
  let selectedDate = opts.selectedDate || null;
  let selectedSlot = opts.selectedSlot || null;
  let minDate = opts.minDate === undefined ? (opts.allowPast ? null : heuteIso) : opts.minDate;
  /** @type {Set<string> | null} */
  let availableDates = opts.availableDates ? new Set(opts.availableDates) : null;
  /** @type {Record<string, 'open' | 'closed' | 'holiday' | 'special'>} */
  let dayMarkers = { ...(opts.dayMarkers || {}) };
  /** @type {TpkSlot[]} */
  let currentSlots = [];
  let isLoadingSlots = false;
  let emptyText = opts.emptySlotsText || 'Keine freien Termine an diesem Tag.';
  let slotsCustomMode = false;

  const card = document.createElement('div');
  card.className = 'tpk-card' + (opts.compact ? ' tpk-card--kompakt' : '');

  // Spalte 1: Kontext (ohne Fotos)
  const colInfo = document.createElement('aside');
  colInfo.className = 'tpk-col-info';
  const infoStatic = document.createElement('div');
  infoStatic.className = 'tpk-info-static';
  const infoExtra = document.createElement('div');
  infoExtra.className = 'tpk-info-extra';
  colInfo.append(infoStatic, infoExtra);

  // Spalte 2: Monatskalender
  const colCal = document.createElement('div');
  colCal.className = 'tpk-col-cal';

  const calHead = document.createElement('div');
  calHead.className = 'tpk-cal-head';
  const monthLabel = document.createElement('div');
  monthLabel.className = 'tpk-cal-month';
  const navWrap = document.createElement('div');
  navWrap.className = 'tpk-cal-nav';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'tpk-nav-btn';
  prevBtn.setAttribute('aria-label', 'Vorheriger Monat');
  prevBtn.innerHTML = ICON_PREV;

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'tpk-nav-btn';
  nextBtn.setAttribute('aria-label', 'Nächster Monat');
  nextBtn.innerHTML = ICON_NEXT;

  navWrap.append(prevBtn, nextBtn);
  calHead.append(monthLabel, navWrap);

  const dowRow = document.createElement('div');
  dowRow.className = 'tpk-dow';
  dowRow.setAttribute('aria-hidden', 'true');
  for (const d of WOCHENTAGE_KURZ_MO) {
    const sp = document.createElement('span');
    sp.textContent = d;
    dowRow.appendChild(sp);
  }

  const gridEl = document.createElement('div');
  gridEl.className = 'tpk-grid';
  gridEl.setAttribute('role', 'grid');

  const calFooter = document.createElement('div');
  calFooter.className = 'tpk-cal-footer';

  colCal.append(calHead, dowRow, gridEl, calFooter);

  // Spalte 3: Zeitslots (immer 24h)
  const colSlots = document.createElement('div');
  colSlots.className = 'tpk-col-slots';

  const slotsHead = document.createElement('div');
  slotsHead.className = 'tpk-slots-head';
  const slotsDayEl = document.createElement('div');
  slotsDayEl.className = 'tpk-slots-day';
  slotsHead.appendChild(slotsDayEl);

  const slotsListEl = document.createElement('div');
  slotsListEl.className = 'tpk-slots-list';

  const slotsHintEl = document.createElement('p');
  slotsHintEl.className = 'tpk-slots-hint';
  slotsHintEl.textContent = opts.slotsHint || '';

  colSlots.append(slotsHead, slotsListEl, slotsHintEl);

  card.append(colInfo, colCal, colSlots);
  container.replaceChildren(card);

  /** @param {TpkContext} ctx */
  function setContext(ctx = {}) {
    infoStatic.replaceChildren();
    if (ctx.showMonogram) {
      const mono = document.createElement('div');
      mono.className = 'tpk-monogram';
      mono.setAttribute('aria-hidden', 'true');
      mono.textContent = ctx.monogramText || monogramm(ctx.kicker || ctx.title || '');
      infoStatic.appendChild(mono);
    }
    if (ctx.kicker || ctx.subtitle) {
      const headWrap = document.createElement('div');
      if (ctx.showMonogram) headWrap.style.marginTop = '10px';
      if (ctx.kicker) {
        const k = document.createElement('div');
        k.className = 'tpk-kicker';
        k.textContent = ctx.kicker;
        headWrap.appendChild(k);
      }
      if (ctx.subtitle) {
        const s = document.createElement('div');
        s.className = 'tpk-subtitle';
        s.textContent = ctx.subtitle;
        headWrap.appendChild(s);
      }
      infoStatic.appendChild(headWrap);
    }
    if (ctx.title) {
      const h = document.createElement('h3');
      h.className = 'tpk-title';
      if (infoStatic.childElementCount > 0) h.style.marginTop = '12px';
      h.textContent = ctx.title;
      infoStatic.appendChild(h);
    }
    if (ctx.description) {
      const p = document.createElement('p');
      p.className = 'tpk-desc';
      p.style.marginTop = '6px';
      p.textContent = ctx.description;
      infoStatic.appendChild(p);
    }
    if (Array.isArray(ctx.meta) && ctx.meta.length > 0) {
      const list = document.createElement('div');
      list.className = 'tpk-meta-list';
      list.style.marginTop = '12px';
      for (const item of ctx.meta) {
        if (!item?.text) continue;
        const row = document.createElement('div');
        row.className = 'tpk-meta-item';
        const iconHtml = item.icon === 'clock' ? ICON_UHR : item.icon === 'globe' ? ICON_ORT : ICON_INFO;
        const iconWrap = document.createElement('span');
        iconWrap.style.display = 'inline-flex';
        iconWrap.innerHTML = iconHtml;
        const txt = document.createElement('span');
        txt.textContent = item.text;
        row.append(iconWrap, txt);
        list.appendChild(row);
      }
      if (list.childElementCount > 0) infoStatic.appendChild(list);
    }
  }

  function renderDayHeader() {
    slotsDayEl.replaceChildren();
    if (!selectedDate) {
      slotsDayEl.textContent = 'Tag wählen';
      return;
    }
    const kopf = kurzTagKopf(selectedDate);
    if (!kopf) {
      slotsDayEl.textContent = selectedDate;
      return;
    }
    const strong = document.createTextNode(kopf.wochentag);
    const num = document.createElement('span');
    num.textContent = String(kopf.tag);
    slotsDayEl.append(strong, num);
  }

  function renderCalendar() {
    monthLabel.replaceChildren();
    monthLabel.append(document.createTextNode(MONATE_DE[curMonth]));
    const yr = document.createElement('span');
    yr.textContent = String(curYear);
    monthLabel.appendChild(yr);

    if (minDate) {
      const minDt = parseDatumIso(minDate);
      if (minDt) {
        const curStart = curYear * 12 + curMonth;
        const minStart = minDt.getFullYear() * 12 + minDt.getMonth();
        prevBtn.disabled = curStart <= minStart;
      }
    } else {
      prevBtn.disabled = false;
    }

    const zellen = monatsRaster(curYear, curMonth);
    gridEl.replaceChildren();

    for (const z of zellen) {
      if (z.empty || !z.iso) {
        const leer = document.createElement('div');
        leer.className = 'tpk-day is-empty';
        leer.setAttribute('aria-hidden', 'true');
        gridEl.appendChild(leer);
        continue;
      }

      const iso = z.iso;
      const isPast = Boolean(minDate && iso < minDate);
      const isToday = iso === heuteIso;
      const isSelected = iso === selectedDate;
      const isAvail = !isPast && (availableDates === null || availableDates.has(iso));
      const marker = dayMarkers[iso];

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tpk-day';
      btn.dataset.date = iso;
      btn.textContent = String(z.day);
      btn.setAttribute('aria-label', `${z.day}. ${MONATE_DE[curMonth]} ${curYear}`);

      if (isPast) {
        btn.classList.add('is-past');
        btn.disabled = true;
      } else if (isAvail) {
        btn.classList.add('is-avail');
      } else {
        btn.classList.add('is-off');
        btn.disabled = true;
      }

      if (isToday) {
        btn.classList.add('is-today');
        btn.setAttribute('aria-current', 'date');
      }
      if (isSelected) {
        btn.classList.add('is-selected');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.setAttribute('aria-pressed', 'false');
      }

      if (marker) {
        const dot = document.createElement('span');
        dot.className = `tpk-day-dot tpk-day-dot--${marker}`;
        dot.setAttribute('aria-hidden', 'true');
        btn.appendChild(dot);
      }

      if (!btn.disabled) {
        btn.addEventListener('click', () => {
          selectDate(iso, true);
        });
      }

      gridEl.appendChild(btn);
    }
  }

  function renderSlots() {
    if (slotsCustomMode) return;
    renderDayHeader();
    slotsListEl.replaceChildren();

    if (isLoadingSlots) {
      const st = document.createElement('div');
      st.className = 'tpk-slots-state';
      st.textContent = 'Freie Zeiten werden geladen…';
      slotsListEl.appendChild(st);
      return;
    }

    if (!selectedDate) {
      const st = document.createElement('div');
      st.className = 'tpk-slots-state';
      st.textContent = 'Bitte einen Tag im Kalender wählen.';
      slotsListEl.appendChild(st);
      return;
    }

    if (!currentSlots.length) {
      const st = document.createElement('div');
      st.className = 'tpk-slots-state';
      st.textContent = emptyText;
      slotsListEl.appendChild(st);
      return;
    }

    for (const slot of currentSlots) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tpk-slot' + (selectedSlot === slot.value ? ' is-picked' : '');
      btn.dataset.slot = slot.value;
      btn.disabled = Boolean(slot.disabled);

      const main = document.createElement('span');
      main.textContent = slot.label || slot.value;
      btn.appendChild(main);

      if (slot.meta) {
        const meta = document.createElement('span');
        meta.className = 'tpk-slot-meta';
        meta.textContent = slot.meta;
        btn.appendChild(meta);
      }

      btn.addEventListener('click', () => {
        selectedSlot = slot.value;
        slotsListEl.querySelectorAll('.tpk-slot').forEach((el) => {
          el.classList.toggle('is-picked', /** @type {HTMLElement} */ (el).dataset.slot === selectedSlot);
        });
        opts.onSlotSelect?.(slot, selectedDate);
      });

      slotsListEl.appendChild(btn);
    }
  }

  /**
   * @param {string | null} iso
   * @param {boolean} [triggerCallback]
   */
  function selectDate(iso, triggerCallback = false) {
    selectedDate = iso || null;
    if (iso) {
      const dt = parseDatumIso(iso);
      if (dt && (dt.getFullYear() !== curYear || dt.getMonth() !== curMonth)) {
        curYear = dt.getFullYear();
        curMonth = dt.getMonth();
      }
    }
    renderCalendar();
    renderDayHeader();
    if (triggerCallback && selectedDate) {
      opts.onDateSelect?.(selectedDate);
    }
  }

  prevBtn.addEventListener('click', () => {
    curMonth -= 1;
    if (curMonth < 0) { curMonth = 11; curYear -= 1; }
    renderCalendar();
    opts.onMonthChange?.(curYear, curMonth);
  });

  nextBtn.addEventListener('click', () => {
    curMonth += 1;
    if (curMonth > 11) { curMonth = 0; curYear += 1; }
    renderCalendar();
    opts.onMonthChange?.(curYear, curMonth);
  });

  if (opts.context) setContext(opts.context);
  renderCalendar();
  renderSlots();

  return {
    root: card,
    infoExtraEl: infoExtra,
    calFooterEl: calFooter,
    slotsListEl,
    slotsDayEl,
    slotsHintEl,
    setContext,
    /** @param {Iterable<string> | null} dates */
    setAvailableDates(dates) {
      availableDates = dates === null ? null : new Set(dates);
      renderCalendar();
    },
    /** @param {Record<string, 'open' | 'closed' | 'holiday' | 'special'>} markers */
    setDayMarkers(markers) {
      dayMarkers = { ...(markers || {}) };
      renderCalendar();
    },
    /** @param {TpkSlot[]} slots @param {{ emptyText?: string }} [extra] */
    setSlots(slots, extra = {}) {
      slotsCustomMode = false;
      isLoadingSlots = false;
      currentSlots = Array.isArray(slots) ? slots : [];
      if (extra.emptyText !== undefined) emptyText = extra.emptyText;
      renderSlots();
    },
    /** @param {boolean} loading */
    setLoading(loading) {
      slotsCustomMode = false;
      isLoadingSlots = Boolean(loading);
      renderSlots();
    },
    /** Schaltet die rechte Spalte auf eigenen Inhalt (z. B. Sondertage-Detailansicht). */
    setCustomSlotsContent(nodeOrHtml) {
      slotsCustomMode = true;
      renderDayHeader();
      if (typeof nodeOrHtml === 'string') {
        slotsListEl.innerHTML = nodeOrHtml;
      } else if (nodeOrHtml instanceof Node) {
        slotsListEl.replaceChildren(nodeOrHtml);
      } else {
        slotsListEl.replaceChildren();
      }
    },
    /** @param {string | null} slotVal */
    setSelectedSlot(slotVal) {
      selectedSlot = slotVal || null;
      if (!slotsCustomMode) renderSlots();
    },
    /** @param {number} year @param {number} month0 */
    setMonth(year, month0) {
      curYear = year;
      curMonth = month0;
      renderCalendar();
    },
    selectDate,
    getMonth: () => ({ year: curYear, month: curMonth }),
    getSelectedDate: () => selectedDate,
    getSelectedSlot: () => selectedSlot,
    findFirstAvailableInMonth() {
      const zellen = monatsRaster(curYear, curMonth);
      for (const z of zellen) {
        if (z.empty || !z.iso) continue;
        if (minDate && z.iso < minDate) continue;
        if (availableDates === null || availableDates.has(z.iso)) return z.iso;
      }
      return null;
    },
    destroy() {
      container.replaceChildren();
    },
  };
}
