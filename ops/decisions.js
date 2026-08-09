// Entscheidungen — "warum haben wir das so gemacht"
import { sb, state, $, esc, toast, fail, fmtDate, openModal, confirmDialog, memberById } from './app.js?v=20260809f';

let items = [];
let query = '';

async function load() {
  const { data, error } = await sb.from('ops_decisions').select('*').order('decided_on', { ascending: false });
  if (error) return fail('Entscheidungen laden', error);
  items = data || [];
  render();
}

function render() {
  const q = query.trim().toLowerCase();
  const list = q
    ? items.filter(d => `${d.title} ${d.decision} ${d.rationale} ${d.alternatives}`.toLowerCase().includes(q))
    : items;

  $('#decisionList').innerHTML = list.length ? list.map(d => `
    <article class="dec st-${esc(d.status)}" data-id="${d.id}">
      <h3>${esc(d.title)}</h3>
      <div class="card-meta">
        <span>${esc(fmtDate(d.decided_on))}</span>
        <span class="pill">${esc(d.status)}</span>
        ${(d.agreed_by || []).map(n => `<span class="pill">${esc(n)}</span>`).join('')}
        <span>erfasst von ${esc(memberById(d.created_by)?.display_name || '—')}</span>
      </div>
      <dl>
        <div><dt>Entscheidung</dt><dd>${esc(d.decision)}</dd></div>
        ${d.rationale ? `<div><dt>Begründung</dt><dd>${esc(d.rationale)}</dd></div>` : ''}
        ${d.alternatives ? `<div><dt>Verworfene Alternativen</dt><dd>${esc(d.alternatives)}</dd></div>` : ''}
      </dl>
      <div class="card-actions">
        <button class="btn btn-ghost" data-act="edit">Bearbeiten</button>
        <button class="btn btn-danger" data-act="del">Löschen</button>
      </div>
    </article>`).join('') : '<p class="empty">Noch keine Entscheidung erfasst.</p>';

  $('#decisionList').onclick = (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const d = items.find(x => x.id === b.closest('.dec').dataset.id);
    if (b.dataset.act === 'edit') return form(d);
    confirmDialog('Entscheidung löschen', d.title, async () => {
      const { error } = await sb.from('ops_decisions').delete().eq('id', d.id);
      if (error) return fail('Löschen', error), false;
      items = items.filter(x => x.id !== d.id); render(); return true;
    });
  };
}

function form(d = null) {
  const names = state.members.map(m => m.display_name);
  openModal({
    title: d ? 'Entscheidung bearbeiten' : 'Neue Entscheidung',
    bodyHTML: `
      <label class="fld"><span>Titel</span>
        <input id="d_title" value="${esc(d?.title || '')}" maxlength="200" required></label>
      <div class="row-2">
        <label class="fld"><span>Datum</span>
          <input type="date" id="d_date" value="${esc(d?.decided_on || new Date().toISOString().slice(0, 10))}"></label>
        <label class="fld"><span>Status</span>
          <select id="d_status">${['aktiv', 'revidiert', 'verworfen'].map(s =>
            `<option ${(d?.status || 'aktiv') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      </div>
      <label class="fld"><span>Was wurde entschieden</span>
        <textarea id="d_decision">${esc(d?.decision || '')}</textarea></label>
      <label class="fld"><span>Warum — die Begründung, die man in 6 Monaten sucht</span>
        <textarea id="d_rationale">${esc(d?.rationale || '')}</textarea></label>
      <label class="fld"><span>Was wir verworfen haben (optional)</span>
        <textarea id="d_alt">${esc(d?.alternatives || '')}</textarea></label>
      <div class="fld"><span>Einverstanden</span>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:4px">
          ${names.map(n => `<label class="chk-inline"><input type="checkbox" class="d_by" value="${esc(n)}"
             ${(d?.agreed_by || []).includes(n) ? 'checked' : ''}><span>${esc(n)}</span></label>`).join('')}
        </div>
      </div>`,
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      { label: d ? 'Speichern' : 'Anlegen', kind: 'primary', onClick: async () => {
        const title = $('#d_title').value.trim();
        if (!title) { toast('Titel fehlt', true); return false; }
        const row = {
          title,
          decided_on: $('#d_date').value,
          status: $('#d_status').value,
          decision: $('#d_decision').value.trim(),
          rationale: $('#d_rationale').value.trim(),
          alternatives: $('#d_alt').value.trim(),
          agreed_by: [...document.querySelectorAll('.d_by:checked')].map(c => c.value)
        };
        const req = d
          ? sb.from('ops_decisions').update(row).eq('id', d.id)
          : sb.from('ops_decisions').insert({ ...row, created_by: state.me.id });
        const { error } = await req;
        if (error) return fail('Speichern', error), false;
        toast('Gespeichert'); load();
      } }
    ]
  });
}

export function mountDecisions() {
  $('#addDecisionBtn').onclick = () => form();
  $('#decisionSearch').oninput = (e) => { query = e.target.value; render(); };
  load();
}
