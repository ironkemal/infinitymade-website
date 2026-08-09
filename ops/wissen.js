// Wissensbank — Notizen, Erkenntnisse, Logs
import { sb, state, $, esc, md, toast, fail, fmtDate, openModal, confirmDialog, memberById } from './app.js?v=20260809e';

let items = [];
let query = '';
let activeTag = null;
let channel = null;   // mount tekrarinda eski kanal kapatilir

const BUCKET = 'wissen';
const MAX_MB = 20;          // ücretsiz katmanda toplam 1 GB — tek dosyayı sınırlı tut

/** Seçilen dosyaları Storage'a yükler, kayda yazılacak meta listesini döner. */
async function uploadPicked() {
  const files = [...($('#w_files')?.files || [])];
  const out = [];
  for (const file of files) {
    if (file.size > MAX_MB * 1024 * 1024) {
      toast(`${file.name}: ${MAX_MB} MB üstü, atlandı`, true);
      continue;
    }
    // Ad çakışmasın ve Storage yolunu bozmasın diye: uuid + temizlenmiş ad
    const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
    const path = `${crypto.randomUUID()}-${safe}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file);
    if (error) { fail('Upload ' + file.name, error); continue; }
    out.push({ path, name: file.name, size: file.size, type: file.type });
  }
  return out;
}

/** Bucket private — dosya kısa ömürlü imzalı bağlantıyla açılır. */
async function openAttachment(path) {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 120);
  if (error) return fail('Datei öffnen', error);
  window.open(data.signedUrl, '_blank', 'noopener');
}

async function removeFiles(paths) {
  if (!paths.length) return;
  const { error } = await sb.storage.from(BUCKET).remove(paths);
  if (error) fail('Datei löschen', error);   // kayıt yine de güncellensin
}

const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

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
      ${(it.attachments || []).length ? `<div class="atts">${(it.attachments || []).map(a =>
        `<button class="pill att" data-path="${esc(a.path)}" title="${esc(a.name)}">📎 ${esc(a.name)} · ${esc(kb(a.size))}</button>`
      ).join('')}</div>` : ''}
      <div class="card-actions">
        <button class="btn btn-ghost" data-act="edit">Bearbeiten</button>
        <button class="btn btn-danger" data-act="del">Löschen</button>
      </div>
    </article>`).join('') : '<p class="empty">Kein Eintrag gefunden.</p>';

  $('#wissenList').onclick = (e) => {
    const att = e.target.closest('.att');
    if (att) return openAttachment(att.dataset.path);

    const b = e.target.closest('button[data-act]'); if (!b) return;
    const it = items.find(x => x.id === b.closest('.card').dataset.id);
    if (b.dataset.act === 'edit') return form(it);
    confirmDialog('Eintrag löschen', it.title, async () => {
      const { error } = await sb.from('ops_wissen').delete().eq('id', it.id);
      if (error) return fail('Löschen', error), false;
      // Kayıt gidince ekleri de sil, yoksa Storage'da yetim dosya kalır
      await removeFiles((it.attachments || []).map(a => a.path));
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
        <input id="w_tags" value="${esc((it?.tags || []).join(', '))}" placeholder="gkv, stripe, recht"></label>
      ${(it?.attachments || []).length ? `
        <div class="fld"><span>Vorhandene Dateien — abwählen zum Löschen</span>
          <div class="att-list">${it.attachments.map(a => `
            <label class="chk-inline"><input type="checkbox" class="w_keep" value="${esc(a.path)}" checked>
              <span>📎 ${esc(a.name)} · ${esc(kb(a.size))}</span></label>`).join('')}</div>
        </div>` : ''}
      <label class="fld"><span>Dateien anhängen — max. ${MAX_MB} MB pro Datei</span>
        <input type="file" id="w_files" multiple></label>`,
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      { label: it ? 'Speichern' : 'Anlegen', kind: 'primary', onClick: async () => {
        const title = $('#w_title').value.trim();
        if (!title) { toast('Titel fehlt', true); return false; }

        // Kaldırılmak istenenler: kutusu işaretsiz bırakılan mevcut ekler
        const keep = new Set([...document.querySelectorAll('.w_keep:checked')].map(c => c.value));
        const old = it?.attachments || [];
        const dropped = old.filter(a => !keep.has(a.path)).map(a => a.path);

        if ($('#w_files')?.files.length) toast('Dateien werden hochgeladen …');
        const added = await uploadPicked();

        const row = {
          title,
          body: $('#w_body').value,
          tags: $('#w_tags').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
          attachments: [...old.filter(a => keep.has(a.path)), ...added]
        };
        const q = it
          ? sb.from('ops_wissen').update(row).eq('id', it.id)
          : sb.from('ops_wissen').insert({ ...row, created_by: state.me.id });
        const { error } = await q;
        if (error) return fail('Speichern', error), false;

        // Kayıt yazıldıktan SONRA sil — yazma başarısızsa dosyayı kaybetmeyelim
        await removeFiles(dropped);
        toast('Gespeichert'); load();
      } }
    ]
  });
}

export function mountWissen() {
  $('#addWissenBtn').onclick = () => form();
  $('#wissenSearch').oninput = (e) => { query = e.target.value; render(); };
  if (channel) { sb.removeChannel(channel); channel = null; }
  let t = null;
  const reload = () => { clearTimeout(t); t = setTimeout(load, 250); };
  channel = sb.channel('ops_wissen_live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_wissen' }, reload)
    .subscribe();
  load();
}
