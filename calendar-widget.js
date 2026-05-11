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
.cw-layout { display:grid; grid-template-columns:1fr 220px; gap:24px; align-items:start; }
.cw-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; }
.cw-month-lbl { font-size:16px; font-weight:700; }
.cw-month-lbl em { font-style:normal; color:var(--cw-accent,#22c55e); font-weight:500; margin-left:4px; }
.cw-nav { display:flex; gap:6px; }
.cw-nav-btn { width:28px; height:28px; background:none; border:1px solid var(--cw-border,rgba(255,255,255,.08)); border-radius:8px; color:inherit; font-size:15px; cursor:pointer; font-family:inherit; display:flex; align-items:center; justify-content:center; transition:border-color .12s; }
.cw-nav-btn:hover:not(:disabled) { border-color:var(--cw-accent,#22c55e); color:var(--cw-accent,#22c55e); }
.cw-nav-btn:disabled { opacity:.25; cursor:not-allowed; }
.cw-dow { display:grid; grid-template-columns:repeat(7,1fr); text-align:center; margin-bottom:6px; }
.cw-dow span { font-size:11px; font-weight:600; color:var(--cw-muted,#94a3b8); padding:4px 0; }
.cw-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:3px; }
.cw-cell { aspect-ratio:1; display:flex; align-items:center; justify-content:center; border-radius:8px; font-size:13px; font-weight:500; background:none; border:none; color:inherit; font-family:inherit; cursor:pointer; transition:background .1s; position:relative; }
.cw-cell.avail { background:var(--cw-panel,#1a1d24); }
.cw-cell.avail:hover { background:rgba(34,197,94,.14); color:var(--cw-accent,#22c55e); }
.cw-cell.today { box-shadow:inset 0 0 0 2px var(--cw-accent,#22c55e); }
.cw-cell.selected { background:var(--cw-accent,#22c55e) !important; color:#000 !important; font-weight:700; }
.cw-cell.has-items::after { content:''; position:absolute; bottom:3px; left:50%; transform:translateX(-50%); width:4px; height:4px; background:var(--cw-accent,#22c55e); border-radius:50%; }
.cw-cell.selected.has-items::after { background:#000; }
.cw-cell.past { color:rgba(255,255,255,.18); pointer-events:none; }
.cw-cell.empty { pointer-events:none; }

.cw-side { min-height:200px; }
.cw-side-head { font-size:14px; font-weight:700; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid var(--cw-border,rgba(255,255,255,.08)); display:none; }
.cw-side-head.show { display:block; }
.cw-item { display:flex; align-items:center; gap:10px; width:100%; padding:11px 14px; background:var(--cw-panel,#1a1d24); border:1px solid var(--cw-border,rgba(255,255,255,.08)); border-radius:8px; color:inherit; font-family:inherit; font-size:13px; font-weight:500; cursor:pointer; margin-bottom:8px; transition:border-color .12s; text-align:left; }
.cw-item:hover { border-color:var(--cw-accent,#22c55e); }
.cw-item.picked { background:var(--cw-accent,#22c55e); color:#000; border-color:var(--cw-accent,#22c55e); }
.cw-item-dot { width:8px; height:8px; background:var(--cw-accent,#22c55e); border-radius:50%; flex-shrink:0; }
.cw-item.picked .cw-item-dot { background:#000; }
.cw-item-body { flex:1; display:flex; flex-direction:column; gap:2px; }
.cw-item-meta { font-size:11px; opacity:.7; }
.cw-empty { font-size:12px; color:var(--cw-muted,#94a3b8); padding-top:8px; }

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

      const btn = document.createElement('button');
      btn.className = 'cw-cell';
      btn.textContent = d;

      if (isPast) {
        btn.classList.add('past');
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

  (async () => {
    await loadMonthDots();
    render();
    if (opts.autoSelectToday !== false) {
      const validDate = !minDate || today >= minDate ? today : minDate;
      selectDate(toStr(validDate));
    }
  })();

  return {
    refresh: () => selectedDate && selectDate(selectedDate),
    selectDate,
    getSelectedDate: () => selectedDate,
    reloadMonth: async () => { await loadMonthDots(); render(); }
  };
}
