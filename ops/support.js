// Support & Störungen — Tickets mit Verlauf, Zieldatum, Verknüpfung zu Praxis,
// Box und Entwicklungsaufgabe. Phase 1: Erfassen und Nachverfolgen; die
// eigentliche Reparatur passiert per Fernwartung/SSH und wird hier protokolliert.
import { sb, state, $, esc, toast, fail, fmtDate, fmtDateTime, openModal, closeModal, goTo } from './app.js?v=20261120a';
import { canWrite, canRead } from './rollen.js?v=20261120a';
import {
  isMissingSchema, setupNotice, options, memberOptions, pill, memberChip,
  readFields, fld, inp, txt, sel, empty, debounce,
  persistUi,
} from './kit.js?v=20261120a';
import {
  TICKET_TYP, PRIO, PRIO_TONE, PRIO_COLOR, PRIO_ORDER, TICKET_STATUS, TICKET_TONE, OPEN_STATUS, KANAL,
  EINTRAG_ART, ZIEL_STUNDEN, fmtNr,
} from './begriffe.js?v=20261120a';

let openBound = false, ready = Promise.resolve(), root, tickets = [], kunden = [], boxen = [], missing = false, channel = null;
const [ui, saveUi] = persistUi('ops-support-ui', { view: 'offen', q: '', prio: '', typ: '' });

const PHI_WARN = `<div class="warnbox">⛔ <strong>Keine Patientendaten</strong> — keine Namen, Geburtsdaten, Diagnosen,
  keine Screenshots mit Patientenakten. Beschreibe das Verhalten der Software. Kommt doch etwas an:
  Eintrag nicht speichern, Praxis um eine neutrale Beschreibung bitten.</div>`;

const isOverdue = (t) => OPEN_STATUS.includes(t.status) && t.faellig_am && new Date(t.faellig_am) < new Date();
const kundeName = (id) => kunden.find(k => k.id === id)?.name || '';
const boxName = (id) => boxen.find(b => b.id === id)?.seriennummer || '';

export function mountSupport() {
  root = $('#view-support');
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Support &amp; Störungen</h1><p>Jede Kundenanfrage, jede Störung, jeder Fehler — mit Verlauf bis zur Lösung.</p></div>
      <div class="spacer"></div>
      <div class="page-actions">${canWrite('tickets') ? '<button class="btn btn-primary" id="tNew">+ Ticket</button>' : ''}</div>
    </div>
    <div id="tNotice"></div>
    <div class="stats" id="tStats"></div>
    <div class="filters">
      <div class="seg" id="tSeg">
        <button data-v="offen">Offen</button><button data-v="meine">Meine</button>
        <button data-v="geloest">Gelöst</button><button data-v="alle">Alle</button>
      </div>
      <input type="search" id="tQ" placeholder="Suchen: Titel, Nr., Praxis …" value="${esc(ui.q)}">
      <select id="tPrio">${options(PRIO, ui.prio, { empty: 'Alle Prioritäten' })}</select>
      <select id="tTyp">${options(TICKET_TYP, ui.typ, { empty: 'Alle Arten' })}</select>
    </div>
    <div id="tBody"></div>`;

  root.querySelector('#tNew')?.addEventListener('click', () => editTicket(null));
  root.querySelector('#tSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; ui.view = b.dataset.v; saveUi(); render();
  });
  root.querySelector('#tQ').addEventListener('input', debounce((e) => { ui.q = e.target.value; saveUi(); render(); }));
  root.querySelector('#tPrio').addEventListener('change', (e) => { ui.prio = e.target.value; saveUi(); render(); });
  root.querySelector('#tTyp').addEventListener('change', (e) => { ui.typ = e.target.value; saveUi(); render(); });
  root.onclick = (e) => {
    const r = e.target.closest('[data-ticket]'); if (r) openTicket(r.dataset.ticket);
    const s = e.target.closest('[data-stat]'); if (s) { ui.view = s.dataset.stat; saveUi(); render(); }
  };
  if (!openBound) { openBound = true; window.addEventListener('ops:open', async (e) => {
    if (e.detail?.view !== 'support') return;
    await ready;
    if (e.detail.id) openTicket(e.detail.id);
    else if (e.detail.neu) editTicket(null, { kunde_id: e.detail.kunde_id, box_id: e.detail.box_id });
  }); }

  ready = load();
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('ops_tickets_live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_tickets' }, () => load())
    .subscribe();
}

async function load() {
  const [t, k, b] = await Promise.all([
    sb.from('ops_tickets').select('*').order('created_at', { ascending: false }).limit(1000),
    canRead('kunden') ? sb.from('ops_kunden').select('id,name,stage').order('name') : { data: [] },
    canRead('boxen') ? sb.from('ops_boxen').select('id,seriennummer,kunde_id').order('seriennummer') : { data: [] },
  ]);
  if (t.error) {
    if (isMissingSchema(t.error)) { missing = true; $('#tNotice').innerHTML = setupNotice(); $('#tBody').innerHTML = ''; return; }
    return fail('Tickets laden', t.error);
  }
  missing = false; $('#tNotice').innerHTML = '';
  tickets = t.data || []; kunden = k.data || []; boxen = b.data || [];
  render();
}

function filtered() {
  const q = ui.q.trim().toLowerCase();
  return tickets.filter(t =>
    (ui.view === 'alle' ||
     (ui.view === 'offen' && OPEN_STATUS.includes(t.status)) ||
     (ui.view === 'meine' && OPEN_STATUS.includes(t.status) && t.assignee === state.me.id) ||
     (ui.view === 'geloest' && !OPEN_STATUS.includes(t.status)) ||
     (ui.view === 'ueberfaellig' && isOverdue(t)) ||
     (ui.view === 'dringend' && OPEN_STATUS.includes(t.status) && ['kritisch', 'hoch'].includes(t.prioritaet))) &&
    (!ui.prio || t.prioritaet === ui.prio) &&
    (!ui.typ || t.typ === ui.typ) &&
    (!q || [t.titel, t.beschreibung, fmtNr('T', t.nr), kundeName(t.kunde_id), boxName(t.box_id)]
      .some(v => String(v || '').toLowerCase().includes(q))))
    .sort((a, b) => {
      const ao = OPEN_STATUS.includes(a.status), bo = OPEN_STATUS.includes(b.status);
      if (ao !== bo) return ao ? -1 : 1;
      return (PRIO_ORDER[a.prioritaet] - PRIO_ORDER[b.prioritaet]) ||
        (a.faellig_am || '9999').localeCompare(b.faellig_am || '9999');
    });
}

function render() {
  if (missing) return;
  const open = tickets.filter(t => OPEN_STATUS.includes(t.status));
  const urgent = open.filter(t => ['kritisch', 'hoch'].includes(t.prioritaet));
  const over = tickets.filter(isOverdue);
  const waiting = open.filter(t => t.status === 'wartet_kunde');
  const week = tickets.filter(t => t.geloest_at && (Date.now() - new Date(t.geloest_at)) < 7 * 864e5);
  $('#tStats').innerHTML = `
    <button class="stat" data-stat="offen"><span class="stat-label">Offen</span><span class="stat-value">${open.length}</span><span class="stat-sub">${open.filter(t => !t.assignee).length} ohne Zuständige</span></button>
    <button class="stat ${urgent.length ? 'is-bad' : ''}" data-stat="dringend"><span class="stat-label">Kritisch / Hoch</span><span class="stat-value">${urgent.length}</span><span class="stat-sub">zuerst bearbeiten</span></button>
    <button class="stat ${over.length ? 'is-bad' : ''}" data-stat="ueberfaellig"><span class="stat-label">Zieldatum überschritten</span><span class="stat-value">${over.length}</span><span class="stat-sub">interne Orientierung</span></button>
    <div class="stat ${waiting.length ? 'is-warn' : ''}"><span class="stat-label">Wartet auf Kunde</span><span class="stat-value">${waiting.length}</span><span class="stat-sub">nachfassen</span></div>
    <button class="stat is-ok" data-stat="geloest"><span class="stat-label">Gelöst (7 Tage)</span><span class="stat-value">${week.length}</span><span class="stat-sub">abgeschlossen</span></button>`;
  root.querySelectorAll('#tSeg button').forEach(b => b.classList.toggle('is-on', b.dataset.v === ui.view));

  const list = filtered();
  if (!list.length) {
    $('#tBody').innerHTML = `<div class="panel">${empty(tickets.length ? 'Keine Tickets für diesen Filter.' : 'Noch kein Ticket. Anfragen per Mail/Telefon hier erfassen — dann geht nichts verloren.')}</div>`;
    return;
  }
  $('#tBody').innerHTML = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th></th><th>Nr.</th><th>Titel</th><th>Praxis / Box</th><th>Art</th><th>Status</th><th>Zuständig</th><th>Ziel</th></tr></thead>
    <tbody>${list.map(t => `<tr data-ticket="${t.id}">
      <td><span class="prio-dot" style="background:${PRIO_COLOR[t.prioritaet]}" title="${esc(PRIO[t.prioritaet])}"></span></td>
      <td class="num">${fmtNr('T', t.nr)}</td>
      <td><span class="strong">${esc(t.titel)}</span><span class="sub">${fmtDateTime(t.created_at)} · ${esc(KANAL[t.kanal])}</span></td>
      <td>${esc(kundeName(t.kunde_id) || '—')}<span class="sub">${esc(boxName(t.box_id))}</span></td>
      <td>${esc(TICKET_TYP[t.typ])}</td>
      <td>${pill(TICKET_STATUS[t.status], TICKET_TONE[t.status])}</td>
      <td>${memberChip(t.assignee)}</td>
      <td>${t.faellig_am ? pill(fmtDateTime(t.faellig_am), isOverdue(t) ? 'bad' : 'mute') : ''}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

// ── Formular ───────────────────────────────────────────────────────────

const toLocalInput = (d) => {
  if (!d) return '';
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
const zielFuer = (prio) => toLocalInput(new Date(Date.now() + ZIEL_STUNDEN[prio] * 3600e3));

function formHTML(t) {
  const kOpts = `<option value="">— keine —</option>` + kunden.map(k =>
    `<option value="${k.id}" ${t.kunde_id === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('');
  const bOpts = `<option value="">— keine —</option>` + boxen.map(b =>
    `<option value="${b.id}" ${t.box_id === b.id ? 'selected' : ''}>${esc(b.seriennummer)}${b.kunde_id ? ' · ' + esc(kundeName(b.kunde_id)) : ''}</option>`).join('');
  return `${PHI_WARN}
  <div class="form-grid">
    ${fld('Titel *', inp('titel', t.titel, 'required placeholder="Kurz: Was geht nicht?"'), 'span-2')}
    ${fld('Art', sel('typ', options(TICKET_TYP, t.typ || 'frage')))}
    ${fld('Priorität', `<select data-f="prioritaet" id="fPrio">${options(PRIO, t.prioritaet || 'normal')}</select>`)}
    ${fld('Status', sel('status', options(TICKET_STATUS, t.status || 'neu')))}
    ${fld('Kanal', sel('kanal', options(KANAL, t.kanal || 'mail')))}
    ${canRead('kunden') ? fld('Praxis', sel('kunde_id', kOpts)) : ''}
    ${canRead('boxen') ? fld('Box', sel('box_id', bOpts)) : ''}
    ${fld('Zuständig', sel('assignee', memberOptions(t.assignee ?? (t.id ? null : state.me.id), { filter: m => ['admin', 'technik', 'support'].includes(m.role ?? 'admin') })))}
    ${fld('Zieldatum (intern, kein zugesagtes SLA)', `<input data-f="faellig_am" id="fZiel" type="datetime-local" value="${t.id ? toLocalInput(t.faellig_am) : zielFuer(t.prioritaet || 'normal')}">`)}
    ${fld('Beschreibung', txt('beschreibung', t.beschreibung, 'rows="5" placeholder="Was passiert, seit wann, was wurde schon versucht?"'), 'span-2')}
    ${t.id ? fld('Lösung', txt('loesung', t.loesung, 'rows="3" placeholder="Ursache und Lösung — wird zur Wissensbasis"'), 'span-2') : ''}
    ${fld('Externer Link (Sentry, Mail-Thread)', inp('extern_link', t.extern_link, 'type="url" placeholder="https://"'), 'span-2')}
  </div>`;
}

function collect(body) {
  const v = readFields(body);
  v.beschreibung = v.beschreibung ?? '';
  if ('loesung' in v) v.loesung = v.loesung ?? '';
  v.faellig_am = v.faellig_am ? new Date(v.faellig_am).toISOString() : null;
  return v;
}

function editTicket(t, preset = {}) {
  const cur = t || { ...preset };
  openModal({
    title: t ? `${fmtNr('T', t.nr)} bearbeiten` : 'Neues Ticket',
    wide: true,
    bodyHTML: formHTML(cur),
    onOpen: (body) => {
      if (t) return;
      body.querySelector('#fPrio').addEventListener('change', (e) => { body.querySelector('#fZiel').value = zielFuer(e.target.value); });
    },
    actions: [
      { label: 'Abbrechen', onClick: () => { if (t) setTimeout(() => openTicket(t.id), 0); return true; } },
      { label: 'Speichern', kind: 'primary', onClick: async () => {
        const v = collect($('#modalBody'));
        if (!v.titel) { toast('Titel fehlt', true); return false; }
        const q = t
          ? sb.from('ops_tickets').update(v).eq('id', t.id).select().single()
          : sb.from('ops_tickets').insert({ ...v, created_by: state.me.id }).select().single();
        const { data, error } = await q;
        if (error) { fail('Ticket speichern', error); return false; }
        toast(t ? 'Gespeichert' : `${fmtNr('T', data.nr)} angelegt`);
        await load();
        setTimeout(() => openTicket(data.id), 0);
        return true;
      } },
    ],
  });
}

// ── Detail ─────────────────────────────────────────────────────────────

async function openTicket(id) {
  let t = tickets.find(x => x.id === id);
  if (!t) {
    const { data } = await sb.from('ops_tickets').select('*').eq('id', id).maybeSingle();
    if (!data) return toast('Ticket nicht gefunden', true);
    t = data;
  }
  const mayWrite = canWrite('tickets');
  const [{ data: eintraege = [] } = {}, todoRes] = await Promise.all([
    sb.from('ops_ticket_eintraege').select('*').eq('ticket_id', id).order('created_at', { ascending: false }),
    t.todo_id && canRead('todo') ? sb.from('ops_todos').select('id,title,done,seq_no').eq('id', t.todo_id).maybeSingle() : { data: null },
  ]);
  const todo = todoRes?.data;

  const tl = (eintraege || []).map(e => `<div class="tl-item"><span class="dot" style="${e.art === 'antwort' ? 'background:var(--blue)' : e.art === 'loesung' ? 'background:var(--green)' : ''}"></span><div>
    <div class="meta">${esc(EINTRAG_ART[e.art] || e.art)} · ${fmtDateTime(e.created_at)} · ${esc(state.members.find(m => m.id === e.created_by)?.display_name || '')}</div>
    <div class="body">${esc(e.text)}</div></div></div>`).join('');

  const quickStatus = mayWrite ? `<div class="stages">${Object.entries(TICKET_STATUS).map(([v, l]) =>
    `<button data-st="${v}" class="${v === t.status ? 'is-on' : ''}">${l}</button>`).join('')}</div>` : '';

  openModal({
    title: `${fmtNr('T', t.nr)} · ${t.titel}`,
    wide: true,
    bodyHTML: `
      ${quickStatus}
      <div class="detail">
        <div>
          <dl class="kv">
            <dt>Status</dt><dd>${pill(TICKET_STATUS[t.status], TICKET_TONE[t.status])}</dd>
            <dt>Priorität</dt><dd>${pill(PRIO[t.prioritaet], PRIO_TONE[t.prioritaet])}</dd>
            <dt>Art / Kanal</dt><dd>${esc(TICKET_TYP[t.typ])} · ${esc(KANAL[t.kanal])}</dd>
            <dt>Praxis</dt><dd>${t.kunde_id && canRead('kunden') ? `<a href="#" data-goto-kunde="${t.kunde_id}">${esc(kundeName(t.kunde_id) || 'öffnen')}</a>` : '—'}</dd>
            <dt>Box</dt><dd>${t.box_id && canRead('boxen') ? `<a href="#" data-goto-box="${t.box_id}">${esc(boxName(t.box_id) || 'öffnen')}</a>` : '—'}</dd>
            <dt>Zuständig</dt><dd>${memberChip(t.assignee)}</dd>
            <dt>Angelegt</dt><dd>${fmtDateTime(t.created_at)}</dd>
            <dt>Zieldatum</dt><dd>${t.faellig_am ? pill(fmtDateTime(t.faellig_am), isOverdue(t) ? 'bad' : 'mute') : '—'}</dd>
            ${t.geloest_at ? `<dt>Gelöst</dt><dd>${fmtDateTime(t.geloest_at)}</dd>` : ''}
            ${t.extern_link ? `<dt>Link</dt><dd><a href="${esc(t.extern_link)}" target="_blank" rel="noopener">${esc(t.extern_link)}</a></dd>` : ''}
            <dt>Aufgabe</dt><dd>${todo ? `<a href="#" data-goto-todo>#${esc(todo.seq_no ?? '')} ${esc(todo.title)}</a> ${todo.done ? pill('erledigt', 'ok') : ''}` : '—'}</dd>
          </dl>
          <div class="section-t" style="margin-top:14px">Beschreibung</div>
          <div class="card-body" style="white-space:pre-wrap">${esc(t.beschreibung || '—')}</div>
          ${t.loesung ? `<div class="section-t" style="margin-top:14px">Lösung</div><div class="card-body" style="white-space:pre-wrap">${esc(t.loesung)}</div>` : ''}
        </div>
        <div class="detail-side">
          <div class="section-t">Verlauf</div>
          ${mayWrite ? `<div class="tl-add">
            <select id="eArt">${options(Object.fromEntries(Object.entries(EINTRAG_ART).filter(([v]) => v !== 'status')), 'notiz')}</select>
            <textarea id="eText" placeholder="Was wurde gemacht / gesagt? Keine Patientendaten."></textarea>
            <button class="btn" id="eAdd">+</button></div>` : ''}
          <div class="timeline-mini">${tl || empty('Noch kein Eintrag.')}</div>
        </div>
      </div>`,
    actions: [
      { label: 'Schließen', onClick: () => true },
      ...(mayWrite && !t.todo_id && canWrite('todo') ? [{ label: 'Als Aufgabe ans Board', onClick: () => toTodo(t) }] : []),
      ...(t.box_id && canWrite('wartung') ? [{ label: 'Wartung erfassen', onClick: () => { setTimeout(() => goTo('boxen', { id: t.box_id, wartung: true, ticket_id: t.id }), 0); return true; } }] : []),
      ...(mayWrite ? [{ label: 'Bearbeiten', kind: 'primary', onClick: () => { setTimeout(() => editTicket(t), 0); return true; } }] : []),
    ],
    onOpen: (body) => {
      body.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', async () => {
        if (b.dataset.st === t.status) return;
        if (['geloest', 'geschlossen'].includes(b.dataset.st) && !t.loesung) toast('Tipp: Lösung unter „Bearbeiten" eintragen — sie hilft beim nächsten Mal.');
        const { error } = await sb.from('ops_tickets').update({ status: b.dataset.st }).eq('id', t.id);
        if (error) return fail('Status', error);
        await load(); openTicket(t.id);
      }));
      body.querySelector('#eAdd')?.addEventListener('click', async () => {
        const text = body.querySelector('#eText').value.trim(); if (!text) return;
        const art = body.querySelector('#eArt').value;
        const { error } = await sb.from('ops_ticket_eintraege').insert({ ticket_id: t.id, art, text, created_by: state.me.id });
        if (error) return fail('Eintrag', error);
        if (art === 'loesung' && !t.loesung) await sb.from('ops_tickets').update({ loesung: text }).eq('id', t.id);
        if (t.status === 'neu') await sb.from('ops_tickets').update({ status: 'in_arbeit' }).eq('id', t.id);
        await load(); openTicket(t.id);
      });
      body.querySelector('[data-goto-kunde]')?.addEventListener('click', (e) => { e.preventDefault(); closeModal(); goTo('kunden', { id: t.kunde_id }); });
      body.querySelector('[data-goto-box]')?.addEventListener('click', (e) => { e.preventDefault(); closeModal(); goTo('boxen', { id: t.box_id }); });
      body.querySelector('[data-goto-todo]')?.addEventListener('click', (e) => { e.preventDefault(); closeModal(); goTo('todo'); });
    },
  });
}

/** Softwarefehler → Entwicklungsaufgabe. Kategorie "Support", Pool-Spalte. */
async function toTodo(t) {
  const { data, error } = await sb.from('ops_todos').insert({
    title: `${fmtNr('T', t.nr)} — ${t.titel}`,
    notes: `Aus Support-Ticket ${fmtNr('T', t.nr)}.\n\n${t.beschreibung || ''}`,
    priority: ['kritisch', 'hoch'].includes(t.prioritaet) ? 'hoch' : 'normal',
    category: 'Support',
    created_by: state.me.id,
  }).select('id').single();
  if (error) { fail('Aufgabe anlegen', error); return false; }
  await sb.from('ops_tickets').update({ todo_id: data.id, status: t.status === 'neu' ? 'wartet_intern' : t.status }).eq('id', t.id);
  await sb.from('ops_ticket_eintraege').insert({ ticket_id: t.id, art: 'notiz', text: 'Als Aufgabe ans Board übergeben.', created_by: state.me.id });
  toast('Aufgabe angelegt (Kategorie Support)');
  await load();
  setTimeout(() => openTicket(t.id), 0);
  return true;
}
