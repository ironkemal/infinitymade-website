// Reusable Cal.com style calendar widget
// Usage:
//   const cal = mountCalendar(containerEl, {
//     minDate:       new Date(),                // optional, disable past
//     locale:        'de',
//     onDaySelect:   async (dateStr) => [{ label:'10:30', meta:'Müller — Schnitt', picked:false, onClick:fn }, ...],
//     onMonthChange: async (year, month) => { '2026-05-12': true, ... } // marks dots on days
//   });
//   cal.refresh();        // re-fetch current day's items
//   cal.selectDate(str);  // programmatic select

const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAYS_DE   = ['So','Mo','Di','Mi','Do','Fr','Sa'];

const CSS = `
.cw-root { font-family:'Inter',sans-serif; color:var(--cw-text,#f1f5f9); }
.cw-layout { display:grid; grid-template-columns:minmax(0,1fr) 160px; gap:20px; align-items:start; }
.cw-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.cw-month-lbl { font-size:14px; font-weight:700; }
.cw-month-lbl em { font-style:normal; color:var(--cw-muted,#94a3b8); font-weight:400; margin-left:4px; }
.cw-nav { display:flex; gap:4px; }
.cw-nav-btn { width:24px; height:24px; background:none; border:none; color:var(--cw-muted,#94a3b8); font-size:14px; cursor:pointer; font-family:inherit; display:flex; align-items:center; justify-content:center; border-radius:4px; transition:background .12s; }
.cw-nav-btn:hover:not(:disabled) { background:var(--cw-panel,#1a1d24); color:var(--cw-text,#f1f5f9); }
.cw-nav-btn:disabled { opacity:.25; cursor:not-allowed; }
.cw-dow { display:grid; grid-template-columns:repeat(7,1fr); text-align:center; margin-bottom:4px; }
.cw-dow span { font-size:10px; font-weight:600; color:var(--cw-muted,#94a3b8); padding:2px 0; letter-spacing:.5px; }
.cw-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
.cw-cell { aspect-ratio:1; display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:12px; font-weight:500; background:none; border:none; color:inherit; font-family:inherit; cursor:pointer; transition:background .1s; position:relative; padding:0; }
.cw-cell.avail { background:var(--cw-panel,#1a1d24); }
.cw-cell.avail:hover { background:rgba(34,197,94,.14); color:var(--cw-accent,#22c55e); }
.cw-cell.today::after { content:''; position:absolute; bottom:4px; left:50%; transform:translateX(-50%); width:3px; height:3px; background:var(--cw-accent,#22c55e); border-radius:50%; }
.cw-cell.selected { background:var(--cw-accent,#22c55e) !important; color:#000 !important; font-weight:700; }
.cw-cell.has-items::after { content:''; position:absolute; bottom:4px; left:50%; transform:translateX(-50%); width:3px; height:3px; background:var(--cw-accent,#22c55e); border-radius:50%; }
.cw-cell.selected.today::after, .cw-cell.selected.has-items::after { background:#000; }
.cw-cell.past, .cw-cell.off { color:rgba(255,255,255,.16); pointer-events:none; background:none; }
.cw-cell.empty { pointer-events:none; }

.cw-side { min-height:200px; max-height:340px; overflow-y:auto; padding-right:4px; }
.cw-side::-webkit-scrollbar { width:4px; }
.cw-side::-webkit-scrollbar-thumb { background:var(--cw-border,rgba(255,255,255,.1)); border-radius:2px; }
.cw-side-head { font-size:13px; font-weight:700; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--cw-border,rgba(255,255,255,.08)); display:none; }
.cw-side-head.show { display:block; }
.cw-item { display:flex; align-items:center; gap:8px; width:100%; padding:9px 12px; background:var(--cw-panel,#1a1d24); border:1px solid var(--cw-border,rgba(255,255,255,.08)); border-radius:6px; color:inherit; font-family:inherit; font-size:12px; font-weight:500; cursor:pointer; margin-bottom:6px; transition:border-color .12s; text-align:left; }
.cw-item:hover { border-color:var(--cw-accent,#22c55e); }
.cw-item.picked { background:var(--cw-accent,#22c55e); color:#000; border-color:var(--cw-accent,#22c55e); }
.cw-item-dot { width:6px; height:6px; background:var(--cw-accent,#22c55e); border-radius:50%; flex-shrink:0; }
.cw-item.picked .cw-item-dot { background:#000; }
.cw-item-body { flex:1; display:flex; flex-direction:column; gap:1px; min-width:0; }
.cw-item-meta { font-size:10px; opacity:.7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cw-empty { font-size:11px; color:var(--cw-muted,#94a3b8); padding-top:6px; }

@media (max-width:740px) { .cw-layout { grid-template-columns:1fr; } }
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  const tag = document.createElement('style');
  tag.textContent = CSS;
  document.head.appendChild(tag);
  cssInjected = true;
}

export function mountCalendar(container, opts = {}) {
  injectCSS();
  const minDate = opts.minDate ? new Date(opts.minDate) : null;
  if (minDate) minDate.setHours(0,0,0,0);
  const monthsLabels = opts.months || MONTHS_DE;
  const daysShort    = opts.daysShort || DAYS_DE;
  let disabledWeekdays = opts.disabledWeekdays || [];
  let disabledDates    = new Set(opts.disabledDates || []);

  const today = new Date(); today.setHours(0,0,0,0);
  let curYear  = today.getFullYear();
  let curMonth = today.getMonth();
  let selectedDate = null;
  let monthDots = {}; // { 'YYYY-MM-DD': true }

  container.classList.add('cw-root');
  container.innerHTML = `
    <div class="cw-layout">
      <div>
        <div class="cw-head">
          <div class="cw-month-lbl"></div>
          <div class="cw-nav">
            <button class="cw-nav-btn cw-prev">&#8249;</button>
            <button class="cw-nav-btn cw-next">&#8250;</button>
          </div>
        </div>
        <div class="cw-dow">${daysShort.map(d => `<span>${d.toUpperCase()}</span>`).join('')}</div>
        <div class="cw-grid"></div>
      </div>
      <div class="cw-side">
        <div class="cw-side-head"></div>
        <div class="cw-side-list"><div class="cw-empty">${opts.placeholder || 'Bitte Datum wählen'}</div></div>
      </div>
    </div>`;

  const monthLblEl = container.querySelector('.cw-month-lbl');
  const prevBtn    = container.querySelector('.cw-prev');
  const nextBtn    = container.querySelector('.cw-next');
  const gridEl     = container.querySelector('.cw-grid');
  const sideHead   = container.querySelector('.cw-side-head');
  const sideList   = container.querySelector('.cw-side-list');

  function toStr(date) { return date.toISOString().split('T')[0]; }

  async function loadMonthDots() {
    if (!opts.onMonthChange) return;
    try { monthDots = (await opts.onMonthChange(curYear, curMonth)) || {}; }
    catch(e) { monthDots = {}; }
  }

  function render() {
    monthLblEl.innerHTML = `${monthsLabels[curMonth]} <em>${curYear}</em>`;

    if (minDate) {
      const firstOfMonth = new Date(curYear, curMonth, 1);
      const firstOfMin   = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      prevBtn.disabled = firstOfMonth <= firstOfMin;
    }

    const firstDow    = new Date(curYear, curMonth, 1).getDay();
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
    gridEl.innerHTML = '';

    for (let i = 0; i < firstDow; i++) {
      const el = document.createElement('div');
      el.className = 'cw-cell empty';
      gridEl.appendChild(el);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(curYear, curMonth, d);
      const dateStr = toStr(date);
      const isPast  = minDate && date < minDate;
      const isToday = date.getTime() === today.getTime();
      const isSel   = dateStr === selectedDate;
      const hasItems = !!monthDots[dateStr];
      const isOff   = disabledWeekdays.includes(date.getDay()) || disabledDates.has(dateStr);

      const btn = document.createElement('button');
      btn.className = 'cw-cell';
      btn.textContent = d;

      if (isPast) {
        btn.classList.add('past');
      } else if (isOff) {
        btn.classList.add('off');
      } else {
        btn.classList.add('avail');
        if (isToday)   btn.classList.add('today');
        if (isSel)     btn.classList.add('selected');
        if (hasItems)  btn.classList.add('has-items');
        btn.addEventListener('click', () => selectDate(dateStr));
      }
      gridEl.appendChild(btn);
    }
  }

  async function selectDate(dateStr) {
    selectedDate = dateStr;
    render();

    const date = new Date(dateStr);
    sideHead.textContent = `${daysShort[date.getDay()]} ${date.getDate()}`;
    sideHead.classList.add('show');
    sideList.innerHTML = '<div class="cw-empty">Lade…</div>';

    if (!opts.onDaySelect) {
      sideList.innerHTML = '<div class="cw-empty">Keine Daten.</div>';
      return;
    }

    try {
      const items = await opts.onDaySelect(dateStr);
      sideList.innerHTML = '';
      if (!items || !items.length) {
        sideList.innerHTML = `<div class="cw-empty">${opts.emptyText || 'Keine Einträge.'}</div>`;
        return;
      }
      items.forEach(item => {
        const el = document.createElement('button');
        el.className = 'cw-item' + (item.picked ? ' picked' : '');
        el.innerHTML = `
          <span class="cw-item-dot" style="${item.color ? 'background:' + item.color : ''}"></span>
          <div class="cw-item-body">
            <span>${item.label}</span>
            ${item.meta ? `<span class="cw-item-meta">${item.meta}</span>` : ''}
          </div>`;
        if (item.onClick) {
          el.addEventListener('click', () => {
            sideList.querySelectorAll('.cw-item').forEach(b => b.classList.remove('picked'));
            el.classList.add('picked');
            item.onClick(item);
          });
        }
        sideList.appendChild(el);
      });
    } catch(e) {
      sideList.innerHTML = '<div class="cw-empty" style="color:#ef4444;">Fehler beim Laden.</div>';
    }
  }

  prevBtn.addEventListener('click', async () => {
    curMonth--; if (curMonth < 0) { curMonth = 11; curYear--; }
    await loadMonthDots();
    render();
  });
  nextBtn.addEventListener('click', async () => {
    curMonth++; if (curMonth > 11) { curMonth = 0; curYear++; }
    await loadMonthDots();
    render();
  });

  function findFirstAvailable() {
    const start = !minDate || today >= minDate ? today : new Date(minDate);
    for (let i = 0; i < 60; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const ds = toStr(d);
      if (!disabledWeekdays.includes(d.getDay()) && !disabledDates.has(ds)) return ds;
    }
    return null;
  }

  (async () => {
    await loadMonthDots();
    render();
    if (opts.autoSelectToday !== false) {
      const first = findFirstAvailable();
      if (first) selectDate(first);
    }
  })();

  return {
    refresh: () => selectedDate && selectDate(selectedDate),
    selectDate,
    getSelectedDate: () => selectedDate,
    reloadMonth: async () => { await loadMonthDots(); render(); },
    setDisabled: ({ weekdays, dates } = {}) => {
      if (weekdays) disabledWeekdays = weekdays;
      if (dates)    disabledDates    = new Set(dates);
      const wasSelOff = selectedDate && (disabledWeekdays.includes(new Date(selectedDate).getDay()) || disabledDates.has(selectedDate));
      if (wasSelOff) {
        selectedDate = null;
        const first = findFirstAvailable();
        if (first) { selectDate(first); return; }
      }
      render();
    }
  };
}
