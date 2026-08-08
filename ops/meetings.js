// Meetings — wöchentliche Notiz + daraus entstandene Aufgaben
import { sb, state, $, esc, md, toast, fail, fmtDate, openModal, confirmDialog } from './app.js?v=20260808b';

let meetings = [];
let counts = {};   // 'YYYY-MM-DD' → { open, done }

async function load() {
  const [m, t] = await Promise.all([
    sb.from('ops_meetings').select('*').order('meeting_date', { ascending: false }),
    sb.from('ops_todos').select('meeting_date, done').not('meeting_date', 'is', null)
  ]);
  if (m.error) return fail('Meetings laden', m.error);
  meetings = m.data || [];

  counts = {};
  for (const row of (t.data || [])) {
    const c = counts[row.meeting_date] ||= { open: 0, done: 0 };
    row.done ? c.done++ : c.open++;
  }
  render();
}

function render() {
  $('#meetingList').innerHTML = meetings.length ? meetings.map(mt => {
    const c = counts[mt.meeting_date] || { open: 0, done: 0 };
    return `
    <article class="card" data-id="${mt.id}">
      <h3>${esc(mt.title || 'Weekly')} — ${esc(fmtDate(mt.meeting_date))}</h3>
      <div class="card-meta">
        ${c.open + c.done ? `<span class="pill">${c.done}/${c.open + c.done} Aufgaben erledigt</span>`
                          : '<span class="pill">keine Aufgaben verknüpft</span>'}
        ${mt.summary_md ? '<span class="pill pill-claude">Zusammenfassung</span>' : ''}
      </div>
      <div class="card-body">${md(mt.summary_md || mt.notes_md || '_Keine Notiz._')}</div>
      <div class="card-actions">
        <button class="btn btn-ghost" data-act="edit">Bearbeiten</button>
        <button class="btn btn-danger" data-act="del">Löschen</button>
      </div>
    </article>`;
  }).join('') : '<p class="empty">Noch kein Meeting erfasst.</p>';

  $('#meetingList').onclick = (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const mt = meetings.find(x => x.id === b.closest('.card').dataset.id);
    if (b.dataset.act === 'edit') return form(mt);
    confirmDialog('Meeting löschen', `${mt.title || 'Weekly'} ${fmtDate(mt.meeting_date)}`, async () => {
      const { error } = await sb.from('ops_meetings').delete().eq('id', mt.id);
      if (error) return fail('Löschen', error), false;
      meetings = meetings.filter(x => x.id !== mt.id); render(); return true;
    });
  };
}

function form(mt = null) {
  openModal({
    title: mt ? 'Meeting bearbeiten' : 'Neues Meeting',
    bodyHTML: `
      <div class="row-2">
        <label class="fld"><span>Datum</span>
          <input type="date" id="m_date" value="${esc(mt?.meeting_date || new Date().toISOString().slice(0, 10))}"></label>
        <label class="fld"><span>Titel</span>
          <input id="m_title" value="${esc(mt?.title || 'Weekly')}" maxlength="120"></label>
      </div>
      <label class="fld"><span>Rohnotiz — einfach reinkopieren</span>
        <textarea id="m_notes" style="min-height:200px">${esc(mt?.notes_md || '')}</textarea></label>
      <label class="fld"><span>Zusammenfassung (schreibt Claude)</span>
        <textarea id="m_summary">${esc(mt?.summary_md || '')}</textarea></label>
      <p class="hint" style="margin:0">
        Aufgaben aus diesem Meeting trägt Claude direkt ins Board ein — sie erscheinen
        dort mit dem Meeting-Datum und dem Kennzeichen „Claude“.</p>`,
    actions: [
      { label: 'Abbrechen', onClick: () => true },
      { label: mt ? 'Speichern' : 'Anlegen', kind: 'primary', onClick: async () => {
        const date = $('#m_date').value;
        if (!date) { toast('Datum fehlt', true); return false; }
        const row = {
          meeting_date: date,
          title: $('#m_title').value.trim(),
          notes_md: $('#m_notes').value,
          summary_md: $('#m_summary').value
        };
        const req = mt
          ? sb.from('ops_meetings').update(row).eq('id', mt.id)
          : sb.from('ops_meetings').insert({ ...row, created_by: state.me.id });
        const { error } = await req;
        // Tarih benzersiz: aynı güne ikinci meeting açılmasın.
        if (error) return fail(error.code === '23505' ? 'Für dieses Datum gibt es schon ein Meeting' : 'Speichern', error), false;
        toast('Gespeichert'); load();
      } }
    ]
  });
}

export function mountMeetings() {
  $('#addMeetingBtn').onclick = () => form();
  load();
}
