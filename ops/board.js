// Aufgaben-Board — Kemal | Pool | Melih
// Zwei Ebenen: Oberaufgabe (Thema) → aufklappbare Unteraufgaben.
// Zusätzlich "Zuerst: …" — eine Aufgabe kann auf andere warten.
import { sb, state, $, esc, md, toast, fail, fmtDate, openModal, confirmDialog, memberById } from './app.js?v=20260809c';
import { DONE_ARCHIVE_DAYS } from './config.js?v=20260809c';

let todos = [];
let showArchived = false;
let activeCat = null;      // kategori filtresi — 55 madde tek kolonda okunmaz
let weekOnly = false;      // sadece son toplantıdan gelen istekler
let openMenu = null;
const expanded = new Set();   // acik detay panelleri — yeniden cizimde korunur
const openGroups = new Set(); // aufgeklappte Unteraufgaben-Listen

const POOL = '__pool__';   // assignee === null kolonu için anahtar
const mq = window.matchMedia('(max-width: 900px)');

let loading = false;       // üst üste binen yüklemeleri engelle

// schema-groups.sql çalıştırılmadıysa parent_id/blocked_by sütunları yoktur.
// O hâlde pano düz liste olarak çalışır; bu alanları yazmaya kalkarsak PostgREST
// 400 döner ve kart kaydetmek tamamen bozulur. Bu yüzden veriden okuyup uyum sağlıyoruz.
let hasGroupCols = true;

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
const byId = (id) => todos.find(t => t.id === id);

/** Unteraufgaben in Board-Reihenfolge. */
const kidsOf = (id) => todos
  .filter(t => t.parent_id === id)
  .sort((a, b) => (a.sort_order - b.sort_order) || (new Date(a.created_at) - new Date(b.created_at)));

/** Offene Blocker: "das hier geht erst, wenn jene Aufgabe fertig ist." */
const blockersOf = (t) => (t.blocked_by || [])
  .map(byId).filter(b => b && !b.done);

// ── Meeting-Fokus ──────────────────────────────────────────────────────
// Alles mit meeting_date kommt aus einem wöchentlichen Gespräch — also aus einem
// echten Nutzerwunsch. Das jüngste Meeting ist "diese Woche" und wird blau.

/** Datum des jüngsten Meetings, aus dem noch etwas offen ist. */
function latestMeeting() {
  const ds = todos.filter(t => t.meeting_date && !t.done).map(t => t.meeting_date);
  return ds.length ? ds.sort().at(-1) : null;
}
let currentMeeting = null;   // render() başında tazelenir

const isWeek = (t) => !!currentMeeting && t.meeting_date === currentMeeting && !t.done;
/** Ein Thema zählt zur Woche, wenn eine seiner offenen Unteraufgaben dazugehört. */
const weekKids = (t) => kidsOf(t.id).filter(isWeek);
const inWeek   = (t) => isWeek(t) || weekKids(t).length > 0;

function isArchived(t) {
  if (!t.done || !t.done_at) return false;
  const age = (Date.now() - new Date(t.done_at).getTime()) / 86400000;
  return age > DONE_ARCHIVE_DAYS;
}

/** Kategoriefilter greift auf Themen-Ebene: das Thema bleibt sichtbar,
 *  wenn es selbst oder eine seiner Unteraufgaben passt. */
function catMatch(t) {
  if (weekOnly && !inWeek(t)) return false;
  if (activeCat === null) return true;
  return t.category === activeCat || kidsOf(t.id).some(k => k.category === activeCat);
}

// ── Laden ──────────────────────────────────────────────────────────────

// Belirti: refresh sonrası kabuk geliyor ama görevler hiç gelmiyordu — hata da
// yoktu. Sebebi ne olursa olsun (asılı sorgu, ölü belirteç, RLS) pano SESSİZ
// KALMAMALI: ya veri gösterir ya da sebebini ekrana yazar ve yeniden denetir.
const QUERY_TIMEOUT = 10000;
const TIMEOUT = Symbol('timeout');
const withTimeout = (p, ms) =>
  Promise.race([p, new Promise(r => setTimeout(() => r(TIMEOUT), ms))]);

/** Kalıcı durum paneli — toast gibi kaybolmaz, çünkü teşhis edilecek şey budur. */
function boardNotice(title, detail, actions = true) {
  $('#board').style.gridTemplateColumns = '1fr';
  $('#board').innerHTML = `
    <div class="col">
      <p class="empty" style="margin:0 0 10px"><strong>${esc(title)}</strong></p>
      <p class="empty" style="margin:0 0 12px">${esc(detail)}</p>
      ${actions ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" id="boardRetry">Erneut versuchen</button>
        <button class="btn btn-ghost" id="boardRelogin">Neu anmelden</button>
      </div>` : ''}`;
  if (!actions) return;
  $('#boardRetry').onclick = () => load();
  $('#boardRelogin').onclick = async () => { await sb.auth.signOut().catch(() => {}); location.reload(); };
}

async function load(retry = true) {
  if (loading) return;
  loading = true;
  try {
    if (!todos.length) boardNotice('Laden …', 'Aufgaben werden geholt.', false);

    const res = await withTimeout(
      sb.from('ops_todos').select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      QUERY_TIMEOUT);

    if (res === TIMEOUT || res.error) {
      const why = res === TIMEOUT ? 'Zeitüberschreitung (Anfrage kam nicht zurück)' : res.error.message;
      window.__opsLastError = why;
      console.error('[ops:board]', why, res === TIMEOUT ? '' : res.error);

      // Kendi kendine onarma: büyük ihtimalle belirteç ölü. Bir kez tazeleyip
      // yeniden dene — kullanıcının çıkış yapıp girmesi gerekmesin.
      if (retry) {
        loading = false;
        const { error: rErr } = await sb.auth.refreshSession().catch(e => ({ error: e }));
        if (!rErr) return load(false);
        console.error('[ops:board] refreshSession', rErr);
      }
      return boardNotice('Aufgaben konnten nicht geladen werden', why);
    }

    todos = res.data || [];
    if (todos.length) hasGroupCols = 'parent_id' in todos[0] && 'blocked_by' in todos[0];

    // Çizim patlarsa da boş ekran bırakma — sebebi yaz.
    try { render(); }
    catch (e) {
      window.__opsLastError = String(e?.message || e);
      console.error('[ops:render]', e);
      return boardNotice('Anzeige-Fehler', String(e?.message || e));
    }

    if (!todos.length) {
      // 0 satır iki farklı şey olabilir: gerçekten boş pano, ya da sorgunun
      // kullanıcı belirteci olmadan gitmesi (o zaman RLS her şeyi süzer, HTTP 200
      // döner ve hata görünmez). Hangisi olduğunu burada açıkça yazıyoruz.
      let who = 'unbekannt';
      try {
        const { data: { session } } = await sb.auth.getSession();
        who = session?.user?.id ? `angemeldet (${session.user.id.slice(0, 8)}…)` : 'KEIN Token — anonyme Anfrage';
      } catch { /* teşhis için, kritik değil */ }
      boardNotice('Keine Aufgaben sichtbar',
        `0 Zeilen zurückgekommen · Sitzung: ${who} · Mitglied: ${state.me ? state.me.display_name : 'nein'}`);
    }
  } finally {
    loading = false;
  }
}

// ── Rendern ────────────────────────────────────────────────────────────

/** Kategorie-Filterleiste — mit offener Aufgabenzahl (Unteraufgaben mitgezählt). */
function renderCatBar() {
  const open = todos.filter(t => !t.done);
  const cats = [...new Set(open.map(t => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  const count = (c) => open.filter(t => c === null || t.category === c).length;

  // Meeting-Chip zuerst: er beantwortet die Frage "was muss diese Woche fertig sein".
  const weekCount = open.filter(isWeek).length;
  const weekChip = currentMeeting
    ? `<button class="tag tag-week ${weekOnly ? 'is-on' : ''}" data-week="1">
         ◆ Diese Woche · Meeting ${esc(fmtDate(currentMeeting))} ${weekCount}</button>`
    : '';

  $('#catBar').innerHTML = weekChip +
    `<button class="tag ${activeCat === null ? 'is-on' : ''}" data-cat="">Alle ${count(null)}</button>` +
    cats.map(c => `<button class="tag ${activeCat === c ? 'is-on' : ''}" data-cat="${esc(c)}">${esc(c)} ${count(c)}</button>`).join('');

  $('#catBar').onclick = (e) => {
    const b = e.target.closest('.tag'); if (!b) return;
    if (b.dataset.week) weekOnly = !weekOnly;
    else activeCat = b.dataset.cat || null;
    render();
  };
}

function render() {
  currentMeeting = latestMeeting();
  renderCatBar();
  const board = $('#board');
  const cols = columns();
  board.style.gridTemplateColumns = mq.matches
    ? '1fr' : `repeat(${cols.length}, 1fr)`;

  let hidden = 0;
  board.innerHTML = cols.map(c => {
    // Nur oberste Ebene wandert in die Spalte; Unteraufgaben hängen an ihrem Thema.
    const mine  = todos.filter(t => !t.parent_id && colKeyOf(t) === c.key && catMatch(t));
    const open  = mine.filter(t => !t.done);
    const done  = mine.filter(t => t.done && (showArchived || !isArchived(t)))
                      .sort((a, b) => new Date(b.done_at || 0) - new Date(a.done_at || 0));
    hidden += mine.filter(t => t.done && isArchived(t)).length;

    const openTotal = open.reduce((n, t) => n + 1 + kidsOf(t.id).filter(k => !k.done).length, 0);

    return `
      <div class="col" data-col="${esc(c.key)}">
        <div class="col-head">
          <span class="dot" style="background:${esc(c.color)}"></span>
          <span class="col-name">${esc(c.name)}</span>
          <span class="col-count">${open.length} Themen · ${openTotal} offen</span>
        </div>
        <div class="stack" data-stack="${esc(c.key)}">
          ${open.map(t => cardHTML(t)).join('') || '<p class="empty">Nichts offen.</p>'}
        </div>
        ${done.length ? `<div class="done-head">Erledigt (${done.length})</div>
          <div class="stack">${done.map(t => cardHTML(t)).join('')}</div>` : ''}
      </div>`;
  }).join('');

  $('#boardHint').textContent = hidden && !showArchived
    ? `${hidden} erledigte Aufgabe(n) älter als ${DONE_ARCHIVE_DAYS} Tage ausgeblendet`
    : '';

  wire();
}

// Not iki parcali: ustte kisa ozet, "## Ayrintili" ayracindan sonra uzun hali.
// Kart acilinca sadece ozet gorunur; uzun kisim ayri bir dugmeyle acilir.
const SPLIT = /^## Ayrıntı\s*$/m;
const kurzOf = (t) => String(t.notes || '').split(SPLIT)[0].trim();
const langOf = (t) => String(t.notes || '').split(SPLIT).slice(1).join('').trim();

function cardHTML(t) {
  const author = t.source === 'claude'
    ? '<span class="pill pill-claude">Claude</span>'
    : (memberById(t.created_by) ? `<span class="pill">${esc(memberById(t.created_by).display_name)}</span>` : '');

  const kids     = kidsOf(t.id);
  const kidsDone = kids.filter(k => k.done).length;
  const isGroup  = kids.length > 0;
  // Im Wochenfilter zeigt ein Thema nur die Punkte dieser Woche — und ist offen,
  // sonst müsste man 16 Themen von Hand aufklappen.
  const shown    = weekOnly ? kids.filter(isWeek) : kids;
  const isOpenG  = openGroups.has(t.id) || (weekOnly && shown.length > 0);
  const blockers = blockersOf(t);
  const wKids    = weekKids(t);

  return `
    <div class="card-t prio-${esc(t.priority)} ${t.done ? 'is-done' : ''} ${isGroup ? 'is-group' : ''} ${blockers.length && !t.done ? 'is-blocked' : ''} ${inWeek(t) ? 'is-week' : ''}"
         data-id="${t.id}" draggable="${t.done ? 'false' : 'true'}">
      ${isGroup
        ? `<span class="t-progress ${kidsDone === kids.length ? 'is-full' : ''}">${kidsDone}/${kids.length}</span>`
        : `<input type="checkbox" class="t-check" ${t.done ? 'checked' : ''} aria-label="erledigt">`}
      <div class="t-body">
        <div class="t-title">${esc(t.title)}</div>
        <div class="t-meta">
          ${t.category ? `<span class="pill">${esc(t.category)}</span>` : ''}
          ${author}
          ${t.priority === 'hoch' ? '<span class="pill">Hoch</span>' : ''}
          ${t.meeting_date ? `<span class="pill ${isWeek(t) ? 'pill-week' : 'pill-meeting'}">${isWeek(t) ? '◆ ' : ''}Meeting ${esc(fmtDate(t.meeting_date))}</span>` : ''}
          ${isGroup && wKids.length ? `<span class="pill pill-week">◆ Diese Woche ${wKids.length}</span>` : ''}
          ${t.notes ? `<span class="pill pill-open">${expanded.has(t.id) ? '▾' : '▸'} Details</span>` : ''}
          ${isGroup ? `<span class="pill pill-subs">${isOpenG ? '▾' : '▸'} ${weekOnly ? `${shown.length}/${kids.length}` : kids.length} Unteraufgaben</span>` : ''}
          ${t.done && t.done_at ? `<span>✓ ${esc(fmtDate(t.done_at))}</span>` : ''}
        </div>
        ${blockers.length && !t.done ? `<div class="t-block">Zuerst: ${blockers.map(b => esc(b.title)).join(' · ')}</div>` : ''}
      </div>
      <div class="t-move">
        <button class="t-move-btn" aria-label="Aktionen">⋮</button>
      </div>
      ${t.notes ? `<div class="t-detail" ${expanded.has(t.id) ? '' : 'hidden'}>
        ${md(kurzOf(t))}
        ${langOf(t) ? `<button class="pill more">Ayrıntı ▾</button>
          <div class="t-more" hidden>${md(langOf(t))}</div>` : ''}
      </div>` : ''}
      ${isGroup ? `<div class="subs" data-parent="${t.id}" ${isOpenG ? '' : 'hidden'}>
        ${shown.map(k => cardHTML(k)).join('')}
      </div>` : ''}
    </div>`;
}

// ── Interaktion ────────────────────────────────────────────────────────

function wire() {
  // Checkbox
  document.querySelectorAll('#board .t-check').forEach(cb => {
    cb.onchange = async (e) => {
      e.stopPropagation();
      const id = e.target.closest('.card-t').dataset.id;
      const done = e.target.checked;
      const t = byId(id);
      if (t) { t.done = done; t.done_at = done ? new Date().toISOString() : null; }
      const { error } = await sb.from('ops_todos').update({ done }).eq('id', id);
      if (error) { fail('Speichern', error); return load(); }
      await syncParent(t?.parent_id);
      render();
    };
  });

  // Karta tiklayinca detay acilir/kapanir. Checkbox, menu ve baglantilar haric.
  document.querySelectorAll('#board .card-t').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('input, button, a')) return;
      // Klick auf eine Unteraufgabe darf das Thema nicht mit umschalten.
      if (e.target.closest('.card-t') !== card) return;

      const t = byId(card.dataset.id);
      if (!t) return;

      if (e.target.closest('.pill-subs')) return toggleGroup(card, t);
      if (!t.notes) return;

      expanded.has(t.id) ? expanded.delete(t.id) : expanded.add(t.id);
      const box = card.querySelector(':scope > .t-detail');
      if (box) box.hidden = !expanded.has(t.id);
      const badge = card.querySelector(':scope > .t-body .pill-open');
      if (badge) badge.textContent = (expanded.has(t.id) ? '▾' : '▸') + ' Details';
    });
  });

  // "Ayrıntı" düğmesi — uzun metni açar/kapar
  document.querySelectorAll('#board .more').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const box = btn.parentElement.querySelector('.t-more');
      box.hidden = !box.hidden;
      btn.textContent = box.hidden ? 'Ayrıntı ▾' : 'Ayrıntı ▴';
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
      e.stopPropagation();                       // sonst zieht das Thema mit
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', (e) => { e.stopPropagation(); card.classList.remove('dragging'); });
  });

  // Ablegen in einer Unteraufgaben-Liste = "gehört unter dieses Thema"
  document.querySelectorAll('#board .subs').forEach(box => {
    const parent = byId(box.dataset.parent);
    box.addEventListener('dragover', (e) => {
      e.preventDefault(); e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      box.classList.add('is-over');
    });
    box.addEventListener('dragleave', (e) => {
      if (!box.contains(e.relatedTarget)) box.classList.remove('is-over');
    });
    box.addEventListener('drop', async (e) => {
      e.preventDefault(); e.stopPropagation();
      box.classList.remove('is-over');
      const id = e.dataTransfer.getData('text/plain');
      if (!id || id === box.dataset.parent) return;
      await moveTo(id, colKeyOf(parent || {}), dropIndexIn(box, e.clientY), box.dataset.parent);
    });
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
      // Auf die Spalte fallen lassen heißt: oberste Ebene, kein Thema mehr.
      if (id) await moveTo(id, col.dataset.col, dropIndexIn(col, e.clientY), null);
    });
  });
}

/** Unteraufgaben-Liste auf-/zuklappen. */
function toggleGroup(card, t) {
  openGroups.has(t.id) ? openGroups.delete(t.id) : openGroups.add(t.id);
  const box = card.querySelector(':scope > .subs');
  if (box) box.hidden = !openGroups.has(t.id);
  const badge = card.querySelector(':scope > .t-body .pill-subs');
  const kids = kidsOf(t.id);
  const n = weekOnly ? `${kids.filter(isWeek).length}/${kids.length}` : kids.length;
  if (badge) badge.textContent = `${openGroups.has(t.id) ? '▾' : '▸'} ${n} Unteraufgaben`;
}

/** Thema gilt als erledigt, sobald alle Unteraufgaben erledigt sind — und umgekehrt.
 *  Ohne das bliebe ein abgehaktes Thema mit offenen Punkten stehen. */
async function syncParent(parentId) {
  if (!parentId) return;
  const p = byId(parentId);
  if (!p) return;
  const kids = kidsOf(parentId);
  if (!kids.length) return;
  const shouldBeDone = kids.every(k => k.done);
  if (shouldBeDone === p.done) return;
  p.done = shouldBeDone;
  p.done_at = shouldBeDone ? new Date().toISOString() : null;
  const { error } = await sb.from('ops_todos').update({ done: shouldBeDone }).eq('id', parentId);
  if (error) fail('Thema aktualisieren', error);
}

/** Bırakılan noktaya en yakın kartın indeksi — kolon içi sıralama için. */
function dropIndexIn(container, y) {
  // In der Spalte nur der offene Stapel (data-stack), in einem Thema die .subs-Liste.
  const sel = container.classList.contains('subs')
    ? ':scope > .card-t:not(.dragging)'
    : '.stack[data-stack] > .card-t:not(.dragging)';
  const cards = [...container.querySelectorAll(sel)];
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) return i;
  }
  return cards.length;
}

function toggleMenu(card, host) {
  closeMenu();
  const t = byId(card.dataset.id);
  if (!t) return;

  const targets = columns().filter(c => c.key !== colKeyOf(t));
  const groups  = !hasGroupCols ? []
    : todos.filter(g => !g.parent_id && !g.done && g.id !== t.id && !kidsOf(t.id).length);

  const el = document.createElement('div');
  el.className = 'menu';
  el.innerHTML =
    targets.map(c => `<button data-to="${esc(c.key)}">→ ${esc(c.name)}</button>`).join('') +
    (groups.length ? '<hr><button data-sub="">↑ Eigenes Thema (oberste Ebene)</button>' +
      groups.map(g => `<button data-sub="${g.id}">↳ ${esc(g.title.slice(0, 42))}</button>`).join('') : '') +
    '<hr><button data-act="edit">Bearbeiten</button>' +
    '<button data-act="del">Löschen</button>';

  el.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    closeMenu();
    if (b.dataset.to) return moveTo(t.id, b.dataset.to, 0, t.parent_id);
    if (b.dataset.sub !== undefined) return moveTo(t.id, colKeyOf(t), 0, b.dataset.sub || null);
    if (b.dataset.act === 'edit') return editTodo(t);
    if (b.dataset.act === 'del') return confirmDialog('Aufgabe löschen',
      kidsOf(t.id).length
        ? `${t.title}\n\n${kidsOf(t.id).length} Unteraufgaben bleiben erhalten und rücken auf die oberste Ebene.`
        : t.title,
      async () => {
        const { error } = await sb.from('ops_todos').delete().eq('id', t.id);
        if (error) return fail('Löschen', error), false;
        await load(); return true;
      });
  };

  host.appendChild(el);
  openMenu = el;
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
}

function closeMenu() { openMenu?.remove(); openMenu = null; }

/** Spalte wechseln, Thema wechseln und/oder innerhalb neu einsortieren. */
async function moveTo(id, colKey, index, parentId = null) {
  const t = byId(id);
  if (!t) return;

  // Ein Thema mit Unteraufgaben darf nicht selbst Unteraufgabe werden (2 Ebenen).
  if (parentId && kidsOf(id).length) return toast('Thema mit Unteraufgaben kann nicht eingehängt werden', true);

  const assignee = colKey === POOL ? null : colKey;
  const siblings = todos
    .filter(x => x.id !== id && !x.done &&
                 (parentId ? x.parent_id === parentId : (!x.parent_id && colKeyOf(x) === colKey)))
    .sort((a, b) => a.sort_order - b.sort_order);

  const before = siblings[index - 1]?.sort_order;
  const after  = siblings[index]?.sort_order;
  const sort_order =
    before == null && after == null ? 0 :
    before == null ? after - 1 :
    after  == null ? before + 1 :
    (before + after) / 2;

  const patch = hasGroupCols
    ? { assignee, sort_order, parent_id: parentId }
    : { assignee, sort_order };
  const oldParent = t.parent_id;
  Object.assign(t, patch);
  if (parentId) openGroups.add(parentId);
  render();

  const { error } = await sb.from('ops_todos').update(patch).eq('id', id);
  if (error) { fail('Verschieben', error); return load(); }
  await syncParent(oldParent);
  await syncParent(parentId);
  render();
}

// ── Formular ───────────────────────────────────────────────────────────

function todoForm(t = {}) {
  const opts = [{ id: '', name: 'Gemeinsam (Pool)' },
                ...state.members.map(m => ({ id: m.id, name: m.display_name }))];

  // Als Thema kommen nur Aufgaben der obersten Ebene in Frage — und nicht man selbst.
  const groups = todos.filter(g => !g.parent_id && g.id !== t.id && !kidsOf(t.id || '').length);
  // Blocker: alles außer der Aufgabe selbst und ihren eigenen Unteraufgaben.
  const kidIds = new Set(kidsOf(t.id || '').map(k => k.id));
  const blockCands = todos.filter(x => x.id !== t.id && !kidIds.has(x.id) && !x.done);
  const chosen = new Set(t.blocked_by || []);

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
    ${!hasGroupCols ? '' : `
    <label class="fld"><span>Gehört zu (Thema)</span>
      <select id="f_parent">
        <option value="">— eigenes Thema —</option>
        ${groups.map(g =>
          `<option value="${g.id}" ${t.parent_id === g.id ? 'selected' : ''}>${esc(g.title.slice(0, 70))}</option>`).join('')}
      </select></label>
    <label class="fld"><span>Erst nach … (Voraussetzung, Mehrfachauswahl mit Strg)</span>
      <select id="f_block" multiple size="5">
        ${blockCands.map(x =>
          `<option value="${x.id}" ${chosen.has(x.id) ? 'selected' : ''}>${x.parent_id ? '↳ ' : ''}${esc(x.title.slice(0, 70))}</option>`).join('')}
      </select></label>`}
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
  const v = {
    title,
    notes: $('#f_notes').value.trim() || null,
    assignee: $('#f_assignee').value || null,
    priority: $('#f_prio').value,
    category: (catSel === '__new__' ? $('#f_cat_new').value.trim() : catSel) || null
  };
  if (hasGroupCols) {
    v.parent_id  = $('#f_parent').value || null;
    v.blocked_by = [...$('#f_block').selectedOptions].map(o => o.value);
  }
  return v;
}

function newTodo() {
  openModal({
    title: 'Neue Aufgabe',
    // Standard ist bewusst der gemeinsame Pool: verteilt wird später, bewusst.
    bodyHTML: todoForm({ assignee: null, category: activeCat }),
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
        todos.push(data);
        if (data.parent_id) openGroups.add(data.parent_id);
        render(); toast('Angelegt');
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
        Object.assign(byId(t.id), data); render(); toast('Gespeichert');
      } }
    ]
  });
}

// ── Mount ──────────────────────────────────────────────────────────────

let channel = null;
let onceWired = false;

export function mountTodo() {
  $('#addTodoBtn').onclick = newTodo;
  $('#showArchived').onchange = (e) => { showArchived = e.target.checked; render(); };

  if (!onceWired) {
    onceWired = true;
    // Eskiden 'resize' dinleniyordu. Tehlikeli: render() icerik yuksekligini degistirip
    // kaydirma cubugunu acip kapatabiliyor, bu da yeni bir resize dogurup sonsuz dongu
    // yaratabiliyor (sayfa kilitlenir). matchMedia sadece esik gecilince tetiklenir.
    mq.addEventListener('change', () => { if (!$('#view-todo').hidden) render(); });
  }

  // Oturum tazelenince mount tekrar calisir. Eski kanali kapatmazsak kanallar birikir
  // ve tek bir degisiklik icin birden fazla yeniden cizim tetiklenir.
  if (channel) { sb.removeChannel(channel); channel = null; }

  // Debounce: 63 satirlik toplu bir guncelleme 63 ayri olay uretir; her biri icin
  // yeniden cizmek tarayiciyi kilitler.
  let t = null;
  const reload = () => { clearTimeout(t); t = setTimeout(load, 250); };
  channel = sb.channel('ops_todos_live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_todos' }, reload)
    .subscribe();

  load();
}
