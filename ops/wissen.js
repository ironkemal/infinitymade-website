// Wissensbank — Notizen, Erkenntnisse, Logs
import { sb, state, $, esc, md, toast, fail, fmtDate, openModal, confirmDialog, memberById } from './app.js?v=20260808c';

let items = [];
let query = '';
let activeTag = null;

// Not sayısı iki kişilik bir ekipte binleri bulmaz → hepsini çekip istemcide
// süzüyoruz. Böylece arama anlık ve alt-dize eşleşmeli olur. Şema'daki tsvector
// indeksi, hacim büyürse sunucu tarafına geçmek için hazır duruyor.
async function load() {
  const { data, error } = await sb.from('ops_wissen').select('*').order('updated_at', { ascending: false });
  if (error) return fail('Wissensbank laden', error);
  items = data || [];
  render();
}

function visible() {
  const q = query.trim().toLowerCase();
  return items.filter(it => {
    if (activeTag && !(it.tags || []).includes(activeTag)) return false;
    if (!q) return true;
    if (q.startsWith('#')) return (it.tags || []).some(t => t.toLowerCase().includes(q.slice(1)));
    return (it.title + ' ' + it.body).toLowerCase().includes(q);
  });
}

function render() {
  const all = [...new Set(items.flatMap(i => i.tags || []))].sort();
  $('#wissenTags').innerHTML = all.map(t =>
    `<button class="tag ${t === activeTag ? 'is-on' : ''}" data-tag="${esc(t)}">#${esc(t)}</button>`).join('');
  $('#wissenTags').onclick = (e) => {
    const b = e.target.closest('.tag'); if (!b) return;
    activeTag = activeTag === b.dataset.tag ? null : b.dataset.tag;
    render();
  };

  const list = visible();
  $('#wissenCount').textContent = `${list.length} / ${items.length}`;
  $('#wissenList').innerHTML = list.length ? list.map(it => `
    <article class="card" data-id="${it.id}">
      <h3>${esc(it.title)}</h3>
      <div class="card-meta">
        <span>${esc(memberById(it.created_by)?.display_name || '—')}</span>
        <span>${esc(fmtDate(it.updated_at))}</span>
        ${(it.tags || []).map(t => `<span class="pill">#${esc(t)}</span>`).join('')}
      </div>
      <div class="card-body">${md(it.body)}</div>
      <div class="card-actions">
        <button class="btn btn-ghost" data-act="edit">Bearbeiten</button>
        <button class="btn btn-danger" data-act="del">Löschen</button>
      </div>
    </article>`).join('') : '<p class="empty">Kein Eintrag gefunden.</p>';

  $('#wissenList').onclick = (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const it = items.find(x => x.id === b.closest('.card').dataset.id);
    if (b.dataset.act === 'edit') return form(it);
    confirmDialog('Eintrag löschen', it.title, async () => {
      const { error } = await sb.from('ops_wissen').delete().eq('id', it.id);
      if (error) return fail('Löschen', error), false;
      items = items.filter(x => x.id !== it.id); render(); return true;
    });
  };
}

function form(it = null) {
  openModal({
    title: it ? 'Eintrag bearbeiten' : 'Neuer Eintrag',
    bodyHTML: `
      <label class="fld"><span>Titel</span>
        <input id="w_title" value="${esc(it?.title || '')}" maxlength="200" required></label>
      <label class="fld"><span>Inhalt (Markdown)</span>
        <textarea id="w_body" style="min-height:220px">${esc(it?.body || '')}</textarea></label>
      <label class="fld"><span>Tags — mit Komma trennen</span>
        <input id="w_tags" value="${esc((it?.tags || []).join(', '))}" placeholder="gkv, stripe, recht"></label>`,
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      { label: it ? 'Speichern' : 'Anlegen', kind: 'primary', onClick: async () => {
        const title = $('#w_title').value.trim();
        if (!title) { toast('Titel fehlt', true); return false; }
        const row = {
          title,
          body: $('#w_body').value,
          tags: $('#w_tags').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        };
        const q = it
          ? sb.from('ops_wissen').update(row).eq('id', it.id)
          : sb.from('ops_wissen').insert({ ...row, created_by: state.me.id });
        const { error } = await q;
        if (error) return fail('Speichern', error), false;
        toast('Gespeichert'); load();
      } }
    ]
  });
}

export function mountWissen() {
  $('#addWissenBtn').onclick = () => form();
  $('#wissenSearch').oninput = (e) => { query = e.target.value; render(); };
  sb.channel('ops_wissen_live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_wissen' }, load)
    .subscribe();
  load();
}
