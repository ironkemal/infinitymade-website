// Aufgaben-Board — Kemal | Pool | Melih
import { sb, state, $, esc, toast, fail, fmtDate, openModal, closeModal, confirmDialog, memberById } from './app.js?v=20260808e';
import { DONE_ARCHIVE_DAYS } from './config.js?v=20260808e';

let todos = [];
let showArchived = false;
let activeCat = null;      // kategori filtresi — 55 madde tek kolonda okunmaz
let openMenu = null;

const POOL = '__pool__';   // assignee === null kolonu için anahtar
const mq = window.matchMedia('(max-width: 900px)');

let loading = false;       // üst üste binen yüklemeleri engelle

/** Kolon düzeni: üyeler alfabetik, havuz tam ortada. */
function columns() {
  const ms = [...state.members].sort((a, b) => a.display_name.localeCompare(b.display_name, 'de'));
  const mid = Math.ceil(ms.length / 2);
  return [
    ...ms.slice(0, mid).map(m => ({ key: m.id, name: m.display_name, color: m.color })),
    { key: POOL, name: 'Gemeinsam', color: '#6b7482' },
    ...ms.slice(mid).map(m => ({ key: m.id, name: m.display_name, color: m.color }))
  ];
}

const colKeyOf = (t) => t.assignee || POOL;

function isArchived(t) {
  if (!t.done || !t.done_at) return false;
  const age = (Date.now() - new Date(t.done_at).getTime()) / 86400000;
  return age > DONE_ARCHIVE_DAYS;
}

// ── Laden ──────────────────────────────────────────────────────────────

async function load() {
  if (loading) return;
  loading = true;
  try {
    const { data, error } = await sb.from('ops_todos').select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) return fail('Aufgaben laden', error);
    todos = data || [];
    render();
  } finally {
    loading = false;
  }
}

// ── Rendern ────────────────────────────────────────────────────────────

/** Kategori filtresi çubuğu — açık görev sayısıyla. */
function renderCatBar() {
  const open = todos.filter(t => !t.done);
  const cats = [...new Set(open.map(t => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  const count = (c) => open.filter(t => c === null || t.category === c).length;

  $('#catBar').innerHTML =
    `<button class="tag ${activeCat === null ? 'is-on' : ''}" data-cat="">Alle ${count(null)}</button>` +
    cats.map(c => `<button class="tag ${activeCat === c ? 'is-on' : ''}" data-cat="${esc(c)}">${esc(c)} ${count(c)}</button>`).join('');

  $('#catBar').onclick = (e) => {
    const b = e.target.closest('.tag'); if (!b) return;
    activeCat = b.dataset.cat || null;
    render();
  };
}

function render() {
  renderCatBar();
  const board = $('#board');
  const cols = columns();
  board.style.gridTemplateColumns = mq.matches
    ? '1fr' : `repeat(${cols.length}, 1fr)`;

  let hidden = 0;
  board.innerHTML = cols.map(c => {
    const mine  = todos.filter(t => colKeyOf(t) === c.key
                                 && (activeCat === null || t.category === activeCat));
    const open  = mine.filter(t => !t.done);
    const done  = mine.filter(t => t.done && (showArchived || !isArchived(t)))
                      .sort((a, b) => new Date(b.done_at || 0) - new Date(a.done_at || 0));
    hidden += mine.filter(t => t.done && isArchived(t)).length;

    return `
      <div class="col" data-col="${esc(c.key)}">
        <div class="col-head">
          <span class="dot" style="background:${esc(c.color)}"></span>
          <span class="col-name">${esc(c.name)}</span>
          <span class="col-count">${open.length}</span>
        </div>
        <div class="stack" data-stack="${esc(c.key)}">
          ${open.map(cardHTML).join('') || '<p class="empty">Nichts offen.</p>'}
        </div>
        ${done.length ? `<div class="done-head">Erledigt (${done.length})</div>
          <div class="stack">${done.map(cardHTML).join('')}</div>` : ''}
      </div>`;
  }).join('');

  $('#boardHint').textContent = hidden && !showArchived
    ? `${hidden} erledigte Aufgabe(n) älter als ${DONE_ARCHIVE_DAYS} Tage ausgeblendet`
    : '';

  wire();
}

function cardHTML(t) {
  const author = t.source === 'claude'
    ? '<span class="pill pill-claude">Claude</span>'
    : (memberById(t.created_by) ? `<span class="pill">${esc(memberById(t.created_by).display_name)}</span>` : '');

  return `
    <div class="card-t prio-${esc(t.priority)} ${t.done ? 'is-done' : ''}"
         data-id="${t.id}" draggable="${t.done ? 'false' : 'true'}">
      <input type="checkbox" class="t-check" ${t.done ? 'checked' : ''} aria-label="erledigt">
      <div class="t-body">
        <div class="t-title">${esc(t.title)}</div>
        <div class="t-meta">
          ${t.category ? `<span class="pill">${esc(t.category)}</span>` : ''}
          ${author}
          ${t.priority === 'hoch' ? '<span class="pill">Hoch</span>' : ''}
          ${t.meeting_date ? `<span class="pill">Meeting ${esc(fmtDate(t.meeting_date))}</span>` : ''}
          ${t.notes ? '<span class="pill">Notiz</span>' : ''}
          ${t.done && t.done_at ? `<span>✓ ${esc(fmtDate(t.done_at))}</span>` : ''}
        </div>
      </div>
      <div class="t-move">
        <button class="t-move-btn" aria-label="Aktionen">⋮</button>
      </div>
    </div>`;
}

// ── Interaktion ────────────────────────────────────────────────────────

function wire() {
  // Checkbox
  document.querySelectorAll('#board .t-check').forEach(cb => {
    cb.onchange = async (e) => {
      const id = e.target.closest('.card-t').dataset.id;
      const done = e.target.checked;
      const t = todos.find(x => x.id === id);
      if (t) { t.done = done; t.done_at = done ? new Date().toISOString() : null; render(); }
      const { error } = await sb.from('ops_todos').update({ done }).eq('id', id);
      if (error) { fail('Speichern', error); load(); }
    };
  });

  // Aktionsmenü — auf dem Handy der einzige Weg zum Zuweisen (HTML5-Drag geht dort nicht)
  document.querySelectorAll('#board .t-move-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const card = e.target.closest('.card-t');
      toggleMenu(card, e.target.parentElement);
    };
  });

  // Drag & Drop (Desktop)
  document.querySelectorAll('#board .card-t[draggable="true"]').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  document.querySelectorAll('#board .col').forEach(col => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('is-over');
    });
    col.addEventListener('dragleave', (e) => {
      if (!col.contains(e.relatedTarget)) col.classList.remove('is-over');
    });
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('is-over');
      const id = e.dataTransfer.getData('text/plain');
      if (id) await moveTo(id, col.dataset.col, dropIndexIn(col, e.clientY));
    });
  });
}

/** Bırakılan noktaya en yakın kartın indeksi — kolon içi sıralama için. */
function dropIndexIn(col, y) {
  // data-stack sadece açık görevlerin yığınında var — "Erledigt" yığınına düşürülemez.
  const cards = [...col.querySelectorAll('.stack[data-stack] > .card-t:not(.dragging)')];
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) return i;
  }
  return cards.length;
}

function toggleMenu(card, host) {
  closeMenu();
  const t = todos.find(x => x.id === card.dataset.id);
  if (!t) return;

  const targets = columns().filter(c => c.key !== colKeyOf(t));
  const el = document.createElement('div');
  el.className = 'menu';
  el.innerHTML =
    targets.map(c => `<button data-to="${esc(c.key)}">→ ${esc(c.name)}</button>`).join('') +
    '<hr><button data-act="edit">Bearbeiten</button>' +
    '<button data-act="del">Löschen</button>';

  el.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    closeMenu();
    if (b.dataset.to) return moveTo(t.id, b.dataset.to, 0);
    if (b.dataset.act === 'edit') return editTodo(t);
    if (b.dataset.act === 'del') return confirmDialog('Aufgabe löschen', t.title, async () => {
      const { error } = await sb.from('ops_todos').delete().eq('id', t.id);
      if (error) return fail('Löschen', error), false;
      todos = todos.filter(x => x.id !== t.id); render(); return true;
    });
  };

  host.appendChild(el);
  openMenu = el;
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
}

function closeMenu() { openMenu?.remove(); openMenu = null; }

/** Kolon değiştir ve/veya kolon içinde sırala. */
async function moveTo(id, colKey, index) {
  const t = todos.find(x => x.id === id);
  if (!t) return;

  const assignee = colKey === POOL ? null : colKey;
  const siblings = todos
    .filter(x => x.id !== id && !x.done && colKeyOf(x) === colKey)
    .sort((a, b) => a.sort_order - b.sort_order);

  const before = siblings[index - 1]?.sort_order;
  const after  = siblings[index]?.sort_order;
  const sort_order =
    before == null && after == null ? 0 :
    before == null ? after - 1 :
    after  == null ? before + 1 :
    (before + after) / 2;

  t.assignee = assignee; t.sort_order = sort_order;
  render();

  const { error } = await sb.from('ops_todos').update({ assignee, sort_order }).eq('id', id);
  if (error) { fail('Verschieben', error); load(); }
}

// ── Formular ───────────────────────────────────────────────────────────

function todoForm(t = {}) {
  const opts = [{ id: '', name: 'Gemeinsam (Pool)' },
                ...state.members.map(m => ({ id: m.id, name: m.display_name }))];
  return `
    <label class="fld"><span>Aufgabe</span>
      <input id="f_title" value="${esc(t.title || '')}" maxlength="300" required></label>
    <label class="fld"><span>Notiz (optional, Markdown)</span>
      <textarea id="f_notes">${esc(t.notes || '')}</textarea></label>
    <div class="row-2">
      <label class="fld"><span>Zuständig</span>
        <select id="f_assignee">${opts.map(o =>
          `<option value="${esc(o.id)}" ${String(t.assignee || '') === o.id ? 'selected' : ''}>${esc(o.name)}</option>`
        ).join('')}</select></label>
      <label class="fld"><span>Priorität</span>
        <select id="f_prio">${['hoch', 'normal', 'niedrig'].map(p =>
          `<option ${(t.priority || 'normal') === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
    </div>
    <label class="fld"><span>Kategorie</span>
      <select id="f_cat">
        <option value="">— ohne —</option>
        ${categoryList().map(c =>
          `<option ${t.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        <option value="__new__">+ neue Kategorie …</option>
      </select></label>
    <label class="fld" id="f_cat_new_wrap" hidden><span>Neue Kategorie</span>
      <input id="f_cat_new" maxlength="40" placeholder="z. B. Marketing"></label>`;
}

/** Panoda hâlihazırda kullanılan kategoriler — yeni kart açarken listeden seçilsin. */
function categoryList() {
  return [...new Set(todos.map(t => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
}

/** "+ neue Kategorie" seçilince serbest metin alanını aç. */
function wireCategoryField() {
  const sel = $('#f_cat'); if (!sel) return;
  sel.onchange = () => {
    const isNew = sel.value === '__new__';
    $('#f_cat_new_wrap').hidden = !isNew;
    if (isNew) $('#f_cat_new').focus();
  };
}

function readForm() {
  const title = $('#f_title').value.trim();
  if (!title) { toast('Titel fehlt', true); return null; }
  const catSel = $('#f_cat').value;
  return {
    title,
    notes: $('#f_notes').value.trim() || null,
    assignee: $('#f_assignee').value || null,
    priority: $('#f_prio').value,
    category: (catSel === '__new__' ? $('#f_cat_new').value.trim() : catSel) || null
  };
}

function newTodo() {
  openModal({
    title: 'Neue Aufgabe',
    bodyHTML: todoForm({ assignee: state.me.id, category: activeCat }),
    onOpen: wireCategoryField,
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      { label: 'Anlegen', kind: 'primary', onClick: async () => {
        const v = readForm(); if (!v) return false;
        const max = Math.max(0, ...todos.map(t => t.sort_order || 0));
        const { data, error } = await sb.from('ops_todos')
          .insert({ ...v, source: 'manuell', created_by: state.me.id, sort_order: max + 1 })
          .select().single();
        if (error) return fail('Anlegen', error), false;
        todos.push(data); render(); toast('Angelegt');
      } }
    ]
  });
}

function editTodo(t) {
  openModal({
    title: 'Aufgabe bearbeiten',
    bodyHTML: todoForm(t),
    onOpen: wireCategoryField,
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      { label: 'Speichern', kind: 'primary', onClick: async () => {
        const v = readForm(); if (!v) return false;
        const { data, error } = await sb.from('ops_todos').update(v).eq('id', t.id).select().single();
        if (error) return fail('Speichern', error), false;
        Object.assign(todos.find(x => x.id === t.id), data); render(); toast('Gespeichert');
      } }
    ]
  });
}

// ── Mount ──────────────────────────────────────────────────────────────

export function mountTodo() {
  $('#addTodoBtn').onclick = newTodo;
  $('#showArchived').onchange = (e) => { showArchived = e.target.checked; render(); };

  // Eskiden 'resize' dinleniyordu. Tehlikeli: render() içerik yüksekliğini değiştirip
  // kaydırma çubuğunu açıp kapatabiliyor, bu da yeni bir resize doğurup sonsuz döngü
  // yaratabiliyor (sayfa kilitlenir). matchMedia sadece eşik geçilince tetiklenir.
  mq.addEventListener('change', () => { if (!$('#view-todo').hidden) render(); });

  // Realtime: ikiniz aynı anda açıkken karşı tarafın değişikliği anında düşsün.
  // Debounce: 63 satırlık toplu bir güncelleme 63 ayrı olay üretir; her biri için
  // yeniden çizmek tarayıcıyı kilitler.
  let t = null;
  const reload = () => { clearTimeout(t); t = setTimeout(load, 250); };
  sb.channel('ops_todos_live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_todos' }, reload)
    .subscribe();

  load();
}
