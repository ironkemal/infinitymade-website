// Praxura Cockpit — Support-Tickets Desk (SaaS + Box + Manuell)
import { sb, state, $, esc, toast, fail, fmtDate, fmtDateTime, openModal, confirmDialog, showView, memberById, myRole } from './app.js?v=20261127a';
import { t, onLangChange } from './i18n.js?v=20261127a';
import { cockpitApi } from './cockpit-api.js?v=20261127a';

const STATUSES = ['neu', 'in_arbeit', 'wartet', 'geloest'];
const PRIORITIES = ['kritisch', 'hoch', 'normal', 'niedrig'];
const SOURCES = ['saas', 'box', 'manual'];
const CATEGORIES = ['support', 'bug', 'abrechnung', 'box', 'feature', 'sonstiges'];

const canManageTickets = (role = myRole()) => role === 'founder' || role === 'tech' || role === 'support';
const canDeleteTickets = (role = myRole()) => role === 'founder';

let tickets = [];
let customers = [];
let todosMap = new Map();
let messagesByTicket = new Map();
let schemaMissing = false;

let filterStatus = 'all';
let filterPriority = 'all';
let filterSource = 'all';
let filterQuery = '';

let selectedTicketId = null;
let pendingOpenTicketId = null;
let ticketsLoaded = false;
let replyMode = 'reply'; // 'reply' | 'internal'
let drawerEscHandler = null;
let unsubLang = null;

function isMissingTableError(err) {
  if (!err) return false;
  return err.code === '42P01' || err.code === 'PGRST205' || /does not exist|could not find the table/i.test(err.message || '');
}

function statusBadgeClass(st) {
  if (st === 'neu') return 'sev-critical';
  if (st === 'in_arbeit') return 'sev-info';
  if (st === 'wartet') return 'sev-warn';
  if (st === 'geloest') return 'sev-ok';
  return '';
}

function prioBadgeClass(pr) {
  if (pr === 'kritisch' || pr === 'hoch') return 'sev-critical';
  if (pr === 'normal') return 'sev-info';
  return '';
}

async function loadTicketsData() {
  const [tktRes, custRes, todoRes] = await Promise.all([
    sb.from('ops_tickets').select('*').order('created_at', { ascending: false }),
    sb.from('ops_customers').select('id, display_name, tenant_id, box_name, deployment_mode, contact_email').order('display_name'),
    sb.from('ops_todos').select('id, title, done'),
  ]);

  schemaMissing = isMissingTableError(tktRes.error);
  if (tktRes.error && !isMissingTableError(tktRes.error)) fail('Tickets laden', tktRes.error);
  if (custRes.error && !isMissingTableError(custRes.error)) fail('Kunden laden', custRes.error);
  if (todoRes.error && !isMissingTableError(todoRes.error)) fail('Aufgaben laden', todoRes.error);

  tickets = tktRes.data || [];
  customers = custRes.data || [];
  todosMap = new Map((todoRes.data || []).map((td) => [td.id, td]));
  ticketsLoaded = true;
}

async function loadTicketMessages(ticketId) {
  if (!ticketId) return [];
  const { data, error } = await sb
    .from('ops_ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) {
    fail('Ticket-Verlauf laden', error);
    return messagesByTicket.get(ticketId) || [];
  }
  const rows = data || [];
  messagesByTicket.set(ticketId, rows);
  return rows;
}

function filteredTickets() {
  const q = filterQuery.trim().toLowerCase();
  return tickets.filter((tkt) => {
    if (filterStatus !== 'all' && tkt.status !== filterStatus) return false;
    if (filterPriority !== 'all' && tkt.priority !== filterPriority) return false;
    if (filterSource !== 'all' && tkt.source !== filterSource) return false;
    if (q) {
      const hay = [
        `#${tkt.ticket_no}`,
        tkt.ticket_no,
        tkt.subject,
        tkt.practice_name,
        tkt.contact_email,
        tkt.box_name,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderTickets() {
  const root = $('#view-tickets');
  if (!root) return;

  const counts = {
    all: tickets.length,
    neu: tickets.filter((x) => x.status === 'neu').length,
    in_arbeit: tickets.filter((x) => x.status === 'in_arbeit').length,
    wartet: tickets.filter((x) => x.status === 'wartet').length,
    geloest: tickets.filter((x) => x.status === 'geloest').length,
  };

  const rows = filteredTickets();

  root.innerHTML = `
    <div class="ck-head">
      <div>
        <h2 class="ck-title">${esc(t('tkt.title'))}</h2>
        <p class="ck-sub">${esc(t('tkt.subtitle'))}</p>
      </div>
      <div class="ck-head-actions">
        <button class="btn btn-primary" id="tktNewBtn">${esc(t('tkt.newBtn'))}</button>
        <button class="btn btn-ghost" id="tktRefreshBtn">${esc(t('common.refresh'))}</button>
      </div>
    </div>

    ${schemaMissing ? `<div class="ck-banner ck-banner-warn">${esc(t('tkt.schemaPending'))}</div>` : ''}

    <div class="tagbar" id="tktStatusPills">
      <button class="tag ${filterStatus === 'all' ? 'is-on' : ''}" data-tkt-status="all">${esc(t('common.all'))} (${esc(counts.all)})</button>
      ${STATUSES.map((st) => `
        <button class="tag ${filterStatus === st ? 'is-on' : ''}" data-tkt-status="${esc(st)}">${esc(t(`tkt.status.${st}`))} (${esc(counts[st])})</button>
      `).join('')}
    </div>

    <div class="view-bar">
      <input class="search" id="tktSearch" type="search" value="${esc(filterQuery)}" placeholder="${esc(t('tkt.searchPh'))}">
      <select class="search f-filter-select" id="tktPrioFilter" style="max-width:170px">
        <option value="all">${esc(t('tkt.filter.allPriorities'))}</option>
        ${PRIORITIES.map((pr) => `<option value="${esc(pr)}" ${filterPriority === pr ? 'selected' : ''}>${esc(t(`tkt.prio.${pr}`))}</option>`).join('')}
      </select>
      <select class="search f-filter-select" id="tktSourceFilter" style="max-width:160px">
        <option value="all">${esc(t('tkt.filter.allSources'))}</option>
        ${SOURCES.map((src) => `<option value="${esc(src)}" ${filterSource === src ? 'selected' : ''}>${esc(t(`tkt.src.${src}`))}</option>`).join('')}
      </select>
      <div class="spacer"></div>
      <span class="hint">${esc(rows.length)} / ${esc(tickets.length)}</span>
    </div>

    <div class="ck-table-wrap">
      <table class="ck-table">
        <thead>
          <tr>
            <th>${esc(t('tkt.col.no'))}</th>
            <th>${esc(t('tkt.col.subject'))}</th>
            <th>${esc(t('tkt.col.source'))}</th>
            <th>${esc(t('tkt.col.category'))}</th>
            <th>${esc(t('tkt.col.priority'))}</th>
            <th>${esc(t('tkt.col.status'))}</th>
            <th>${esc(t('tkt.col.assignee'))}</th>
            <th>${esc(t('tkt.col.created'))}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0 ? `
            <tr><td colspan="8" class="empty">${esc(t('tkt.empty'))}</td></tr>
          ` : rows.map((tkt) => {
            const assignee = tkt.assigned_to ? memberById(tkt.assigned_to) : null;
            const linkedTodo = tkt.linked_todo_id ? todosMap.get(tkt.linked_todo_id) : null;
            return `
              <tr class="ck-row ${selectedTicketId === tkt.id ? 'is-selected' : ''}" data-open-ticket="${esc(tkt.id)}">
                <td class="f-num"><strong>#${esc(tkt.ticket_no)}</strong></td>
                <td>
                  <div class="ck-cell-main">${esc(tkt.subject)}</div>
                  <div class="ck-cell-sub">
                    <span>${esc(tkt.practice_name || tkt.box_name || '—')}</span>
                    ${tkt.contact_email ? `<span>· ${esc(tkt.contact_email)}</span>` : ''}
                    ${linkedTodo ? `<span class="ck-badge ${linkedTodo.done ? 'sev-ok' : 'sev-info'}">✓ ${esc(t('tkt.todoLinked'))}</span>` : ''}
                  </div>
                </td>
                <td><span class="ck-badge">${esc(t(`tkt.src.${tkt.source}`))}</span></td>
                <td><span class="ck-badge">${esc(t(`tkt.cat.${tkt.category}`))}</span></td>
                <td><span class="ck-badge ${esc(prioBadgeClass(tkt.priority))}">${esc(t(`tkt.prio.${tkt.priority}`))}</span></td>
                <td><span class="ck-badge ${esc(statusBadgeClass(tkt.status))}">${esc(t(`tkt.status.${tkt.status}`))}</span></td>
                <td>${assignee ? esc(assignee.display_name) : `<span class="hint">${esc(t('common.none'))}</span>`}</td>
                <td>${esc(fmtDate(tkt.created_at))}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  $('#tktNewBtn', root)?.addEventListener('click', openNewTicketModal);
  $('#tktRefreshBtn', root)?.addEventListener('click', async () => {
    await loadTicketsData();
    renderTickets();
    if (selectedTicketId) await openTicketDrawer(selectedTicketId);
  });

  $('#tktStatusPills', root)?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tkt-status]');
    if (!btn) return;
    filterStatus = btn.getAttribute('data-tkt-status') || 'all';
    renderTickets();
  });

  $('#tktSearch', root)?.addEventListener('input', (e) => {
    filterQuery = e.target.value || '';
    renderTickets();
  });
  $('#tktPrioFilter', root)?.addEventListener('change', (e) => {
    filterPriority = e.target.value || 'all';
    renderTickets();
  });
  $('#tktSourceFilter', root)?.addEventListener('change', (e) => {
    filterSource = e.target.value || 'all';
    renderTickets();
  });

  root.querySelectorAll('[data-open-ticket]').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-open-ticket');
      if (id) void openTicketDrawer(id);
    });
  });
}

function closeTicketDrawer() {
  selectedTicketId = null;
  document.getElementById('tktDrawerBack')?.remove();
  if (drawerEscHandler) {
    document.removeEventListener('keydown', drawerEscHandler);
    drawerEscHandler = null;
  }
  renderTickets();
}

async function openTicketDrawer(ticketId) {
  const tkt = tickets.find((x) => x.id === ticketId);
  if (!tkt) return;
  selectedTicketId = ticketId;
  renderTickets();

  const role = myRole();
  const editable = canManageTickets(role);
  const canDel = canDeleteTickets(role);
  if (!editable) replyMode = 'internal';

  const msgs = await loadTicketMessages(ticketId);
  const linkedTodo = tkt.linked_todo_id ? todosMap.get(tkt.linked_todo_id) : null;
  const techEntries = Object.entries(tkt.tech_context && typeof tkt.tech_context === 'object' ? tkt.tech_context : {})
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');

  document.getElementById('tktDrawerBack')?.remove();
  const back = document.createElement('div');
  back.id = 'tktDrawerBack';
  back.className = 'ck-drawer-back';
  back.innerHTML = `
    <div class="ck-drawer tkt-drawer" role="dialog" aria-modal="true">
      <div class="ck-drawer-head">
        <div>
          <div class="ck-drawer-top-badges" style="margin-bottom:4px;">
            <span class="ck-badge">#${esc(tkt.ticket_no)}</span>
            <span class="ck-badge">${esc(t(`tkt.src.${tkt.source}`))}</span>
            <span class="ck-badge">${esc(t(`tkt.cat.${tkt.category}`))}</span>
            <span class="ck-badge ${esc(statusBadgeClass(tkt.status))}">${esc(t(`tkt.status.${tkt.status}`))}</span>
          </div>
          <h3>${esc(tkt.subject)}</h3>
        </div>
        <button class="btn btn-icon" id="tktDrawerClose" aria-label="${esc(t('common.close'))}">×</button>
      </div>

      <div class="ck-drawer-body">
        ${!editable ? `<div class="ck-banner ck-banner-info">${esc(t('tkt.readOnlyHint'))}</div>` : ''}

        <div class="ck-drawer-sec">
          <div class="ck-kv-grid">
            <div>
              <span>${esc(t('tkt.field.practiceName'))}</span>
              <strong>${esc(tkt.practice_name || tkt.box_name || '—')}</strong>
            </div>
            <div>
              <span>${esc(t('tkt.field.contactEmail'))}</span>
              <strong>${esc(tkt.contact_email || '—')}</strong>
            </div>
            <div>
              <span>${esc(t('tkt.col.created'))}</span>
              <strong>${esc(fmtDateTime(tkt.created_at))}</strong>
            </div>
            <div>
              <span>${esc(t('tkt.firstResponse'))}</span>
              <strong>${tkt.first_response_at ? esc(fmtDateTime(tkt.first_response_at)) : '—'}</strong>
            </div>
          </div>

          ${techEntries.length ? `
            <div class="tkt-tech-chips">
              ${techEntries.map(([k, v]) => `<span class="ck-badge">${esc(k)}: ${esc(v)}</span>`).join('')}
            </div>
          ` : ''}

          <hr class="ck-hr" style="margin:12px 0;">

          <div class="tkt-controls-grid">
            <label class="fld">
              <span>${esc(t('tkt.field.status'))}</span>
              <select id="tktEditStatus" ${editable ? '' : 'disabled'}>
                ${STATUSES.map((st) => `<option value="${esc(st)}" ${tkt.status === st ? 'selected' : ''}>${esc(t(`tkt.status.${st}`))}</option>`).join('')}
              </select>
            </label>
            <label class="fld">
              <span>${esc(t('tkt.field.priority'))}</span>
              <select id="tktEditPriority" ${editable ? '' : 'disabled'}>
                ${PRIORITIES.map((pr) => `<option value="${esc(pr)}" ${tkt.priority === pr ? 'selected' : ''}>${esc(t(`tkt.prio.${pr}`))}</option>`).join('')}
              </select>
            </label>
            <label class="fld">
              <span>${esc(t('tkt.field.assignee'))}</span>
              <select id="tktEditAssignee" ${editable ? '' : 'disabled'}>
                <option value="">${esc(t('tkt.unassigned'))}</option>
                ${state.members.filter((m) => m.is_active !== false).map((m) =>
                  `<option value="${esc(m.id)}" ${tkt.assigned_to === m.id ? 'selected' : ''}>${esc(m.display_name)}</option>`
                ).join('')}
              </select>
            </label>
          </div>

          <div class="tkt-meta-actions">
            ${linkedTodo ? `
              <span class="ck-badge ${linkedTodo.done ? 'sev-ok' : 'sev-info'}">
                ✓ ${esc(t('tkt.todoLinked'))}: ${esc(linkedTodo.done ? t('tkt.todoDone') : t('tkt.todoPending'))}
              </span>
              <button type="button" class="btn btn-ghost ck-btn-sm" id="tktOpenTodoBtn">${esc(t('tkt.todoOpen'))}</button>
            ` : (editable ? `
              <button type="button" class="btn btn-ghost ck-btn-sm" id="tktMakeTodoBtn">${esc(t('tkt.makeTodo'))}</button>
            ` : '')}
            <div class="spacer"></div>
            ${canDel ? `<button type="button" class="btn btn-danger ck-btn-sm" id="tktDeleteBtn">${esc(t('tkt.deleteBtn'))}</button>` : ''}
          </div>
        </div>

        <div class="ck-drawer-sec">
          <h4>${esc(t('tkt.timeline'))} (${esc(msgs.length)})</h4>
          <div class="tkt-timeline">
            ${msgs.map((m) => {
              const isInternal = m.is_internal_note === true;
              const cls = isInternal ? 'msg-internal' : `msg-${m.sender_type || 'staff'}`;
              const senderRoleLabel = isInternal
                ? t('tkt.internalBadge')
                : m.sender_type === 'praxis'
                  ? t('tkt.senderPraxis')
                  : m.sender_type === 'system'
                    ? t('tkt.senderSystem')
                    : t('tkt.senderStaff');
              return `
                <div class="tkt-msg ${esc(cls)}">
                  <div class="tkt-msg-head">
                    <div class="tkt-msg-who">
                      <strong>${esc(m.sender_name || senderRoleLabel)}</strong>
                      <span class="ck-badge ${isInternal ? 'sev-warn' : ''}">${esc(isInternal ? `🔒 ${t('tkt.internalBadge')}` : senderRoleLabel)}</span>
                      ${m.emailed_at ? `<span class="ck-badge sev-ok">📧 ${esc(t('tkt.emailedBadge', { dt: fmtDateTime(m.emailed_at) }))}</span>` : ''}
                    </div>
                    <span class="hint">${esc(fmtDateTime(m.created_at))}</span>
                  </div>
                  <div class="tkt-msg-body">${esc(m.body)}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="ck-drawer-sec">
          <h4>${esc(t('tkt.replyTitle'))}</h4>
          <div class="tkt-mode-switch">
            ${editable ? `
              <button type="button" class="fb-sub-tab-btn ${replyMode === 'reply' ? 'active' : ''}" data-tkt-mode="reply">${esc(t('tkt.modeReply'))}</button>
            ` : ''}
            <button type="button" class="fb-sub-tab-btn ${replyMode === 'internal' ? 'active' : ''}" data-tkt-mode="internal">${esc(t('tkt.modeInternal'))}</button>
          </div>

          <div class="tkt-reply-box">
            <textarea id="tktReplyBody" rows="4" placeholder="${esc(t('tkt.replyPlaceholder'))}"></textarea>

            ${replyMode === 'reply' && editable ? `
              <div class="tkt-reply-options">
                <label class="chk-inline">
                  <input type="checkbox" id="tktSendEmailChk" ${tkt.contact_email ? 'checked' : 'disabled'}>
                  <span>${esc(t('tkt.sendEmailChk'))}${tkt.contact_email ? ` (${esc(tkt.contact_email)})` : ''}</span>
                </label>
                <select id="tktReplyStatus" class="search f-filter-select" style="max-width:190px;">
                  <option value="">${esc(t('tkt.field.status'))}: ${esc(t(`tkt.status.${tkt.status}`))}</option>
                  ${STATUSES.map((st) => `<option value="${esc(st)}" ${st === 'wartet' && tkt.status !== 'wartet' ? 'selected' : ''}>→ ${esc(t(`tkt.status.${st}`))}</option>`).join('')}
                </select>
              </div>
              ${!tkt.contact_email ? `<p class="hint" style="margin:0;">${esc(t('tkt.noContactEmail'))}</p>` : ''}
            ` : ''}

            <div style="display:flex;justify-content:flex-end;gap:8px;">
              <button type="button" class="btn btn-primary" id="tktSendReplyBtn">
                ${esc(replyMode === 'internal' ? t('tkt.saveNoteBtn') : t('tkt.sendReplyBtn'))}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(back);

  $('#tktDrawerClose', back)?.addEventListener('click', closeTicketDrawer);
  back.addEventListener('click', (e) => {
    if (e.target === back) closeTicketDrawer();
  });
  drawerEscHandler = (e) => { if (e.key === 'Escape') closeTicketDrawer(); };
  document.addEventListener('keydown', drawerEscHandler);

  const patchTicketField = async (patch) => {
    const { data, error } = await sb
      .from('ops_tickets')
      .update(patch)
      .eq('id', tkt.id)
      .select('*')
      .single();
    if (error) return fail('Ticket aktualisieren', error);
    const idx = tickets.findIndex((x) => x.id === tkt.id);
    if (idx >= 0 && data) tickets[idx] = data;
    toast(t('tkt.updatedToast'));
    await openTicketDrawer(tkt.id);
  };

  $('#tktEditStatus', back)?.addEventListener('change', (e) => {
    const val = e.target.value;
    void patchTicketField({
      status: val,
      resolved_at: val === 'geloest' ? new Date().toISOString() : null,
    });
  });

  $('#tktEditPriority', back)?.addEventListener('change', (e) => {
    void patchTicketField({ priority: e.target.value });
  });

  $('#tktEditAssignee', back)?.addEventListener('change', (e) => {
    void patchTicketField({ assigned_to: e.target.value || null });
  });

  $('#tktOpenTodoBtn', back)?.addEventListener('click', () => {
    closeTicketDrawer();
    showView('todo');
  });

  $('#tktMakeTodoBtn', back)?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const mappedPrio = (tkt.priority === 'kritisch' || tkt.priority === 'hoch')
      ? 'hoch'
      : tkt.priority === 'niedrig'
        ? 'niedrig'
        : 'normal';

    const { data: createdTodo, error: tdErr } = await sb
      .from('ops_todos')
      .insert({
        title: `[Ticket #${tkt.ticket_no}] ${tkt.subject}`,
        notes: [
          `Praxis: ${tkt.practice_name || tkt.box_name || '—'}`,
          `Quelle: ${tkt.source} · Kategorie: ${tkt.category}`,
          tkt.contact_email ? `Kontakt: ${tkt.contact_email}` : null,
        ].filter(Boolean).join('\n'),
        assignee: tkt.assigned_to || null,
        priority: mappedPrio,
        category: 'support',
        source: 'manuell',
        created_by: state.me?.id || null,
      })
      .select('id, title, done')
      .single();

    if (tdErr || !createdTodo) {
      btn.disabled = false;
      return fail('Aufgabe anlegen', tdErr);
    }

    const { data: updTkt, error: upErr } = await sb
      .from('ops_tickets')
      .update({ linked_todo_id: createdTodo.id })
      .eq('id', tkt.id)
      .select('*')
      .single();

    if (upErr) {
      btn.disabled = false;
      return fail('Ticket verknüpfen', upErr);
    }

    todosMap.set(createdTodo.id, createdTodo);
    const idx = tickets.findIndex((x) => x.id === tkt.id);
    if (idx >= 0 && updTkt) tickets[idx] = updTkt;
    toast(t('tkt.todoCreatedToast'));
    await openTicketDrawer(tkt.id);
  });

  $('#tktDeleteBtn', back)?.addEventListener('click', () => {
    confirmDialog(t('tkt.deleteBtn'), t('tkt.deleteConfirm', { no: tkt.ticket_no }), async () => {
      const { error } = await sb.from('ops_tickets').delete().eq('id', tkt.id);
      if (error) { fail('Ticket löschen', error); return false; }
      tickets = tickets.filter((x) => x.id !== tkt.id);
      toast(t('tkt.deletedToast'));
      closeTicketDrawer();
      return true;
    });
  });

  back.querySelectorAll('[data-tkt-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = btn.getAttribute('data-tkt-mode');
      if (m === 'reply' && !editable) return;
      replyMode = m === 'internal' ? 'internal' : 'reply';
      void openTicketDrawer(tkt.id);
    });
  });

  $('#tktSendReplyBtn', back)?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const bodyEl = $('#tktReplyBody', back);
    const body = (bodyEl?.value || '').trim();
    if (!body) {
      bodyEl?.focus();
      return;
    }

    const isInternal = replyMode === 'internal' || !editable;
    const sendEmail = !isInternal && Boolean($('#tktSendEmailChk', back)?.checked) && Boolean(tkt.contact_email);
    const newStatus = (!isInternal && $('#tktReplyStatus', back)?.value) || undefined;

    btn.disabled = true;
    try {
      // Für echte Antworten (oder wenn Backend aktiv): Backend-Endpunkt mit SMTP-Versand aufrufen.
      // Bei Sales oder interner Notiz oder Offline-API: sauber auf direkten Ops-DB-Insert zurückfallen.
      let usedApi = false;
      let apiRes = null;
      if (editable) {
        apiRes = await cockpitApi(`/api/support/cockpit/tickets/${encodeURIComponent(tkt.id)}/reply`, {
          method: 'POST',
          body: {
            body,
            isInternalNote: isInternal,
            sendEmail,
            ...(newStatus ? { newStatus } : {}),
          },
        });
        if (apiRes.ok) {
          usedApi = true;
          if (apiRes.data?.ticket) {
            const idx = tickets.findIndex((x) => x.id === tkt.id);
            if (idx >= 0) tickets[idx] = apiRes.data.ticket;
          }
          if (isInternal) toast(t('tkt.noteSaved'));
          else if (apiRes.data?.emailed) toast(t('tkt.replySentEmail'));
          else toast(t('tkt.replySavedNoEmail'));
        } else if (!apiRes.offline && apiRes.reason !== 'NOT_CONFIGURED') {
          toast(`API: ${apiRes.reason || 'Fehler'}`, true);
          return;
        }
      }

      if (!usedApi) {
        const { error: mErr } = await sb.from('ops_ticket_messages').insert({
          ticket_id: tkt.id,
          sender_type: 'staff',
          sender_name: state.me?.display_name || state.me?.email || 'Team',
          sender_member_id: state.me?.id || null,
          body,
          is_internal_note: isInternal,
        });
        if (mErr) {
          fail('Nachricht speichern', mErr);
          return;
        }

        if (!isInternal && editable) {
          const patch = {};
          if (!tkt.first_response_at) patch.first_response_at = new Date().toISOString();
          if (newStatus) {
            patch.status = newStatus;
            patch.resolved_at = newStatus === 'geloest' ? new Date().toISOString() : null;
          }
          if (Object.keys(patch).length > 0) {
            const { data: upd } = await sb.from('ops_tickets').update(patch).eq('id', tkt.id).select('*').single();
            const idx = tickets.findIndex((x) => x.id === tkt.id);
            if (idx >= 0 && upd) tickets[idx] = upd;
          }
        }
        toast(isInternal ? t('tkt.noteSaved') : t('tkt.replySavedOffline'));
      }

      await openTicketDrawer(tkt.id);
    } finally {
      btn.disabled = false;
    }
  });
}

function openNewTicketModal() {
  const role = myRole();
  const bodyHTML = `
    <div class="fld">
      <span>${esc(t('tkt.field.customer'))}</span>
      <select id="ntCustomer">
        <option value="">${esc(t('tkt.field.customerNone'))}</option>
        ${customers.map((c) => `<option value="${esc(c.id)}">${esc(c.display_name)} (${esc(c.deployment_mode || 'saas')})</option>`).join('')}
      </select>
    </div>
    <div class="ck-two-col">
      <label class="fld">
        <span>${esc(t('tkt.field.practiceName'))}</span>
        <input id="ntPractice" type="text" placeholder="Praxisname …">
      </label>
      <label class="fld">
        <span>${esc(t('tkt.field.contactEmail'))}</span>
        <input id="ntEmail" type="email" placeholder="kontakt@praxis.de">
      </label>
    </div>
    <div class="ck-two-col">
      <label class="fld">
        <span>${esc(t('tkt.field.source'))}</span>
        <select id="ntSource">
          <option value="manual" selected>${esc(t('tkt.src.manual'))}</option>
          <option value="saas">${esc(t('tkt.src.saas'))}</option>
          <option value="box">${esc(t('tkt.src.box'))}</option>
        </select>
      </label>
      <label class="fld">
        <span>${esc(t('tkt.field.category'))}</span>
        <select id="ntCategory">
          ${CATEGORIES.map((c) => `<option value="${esc(c)}">${esc(t(`tkt.cat.${c}`))}</option>`).join('')}
        </select>
      </label>
    </div>
    <label class="fld">
      <span>${esc(t('tkt.field.priority'))}</span>
      <select id="ntPriority">
        ${PRIORITIES.slice().reverse().map((p) => `<option value="${esc(p)}" ${p === 'normal' ? 'selected' : ''}>${esc(t(`tkt.prio.${p}`))}</option>`).join('')}
      </select>
    </label>
    <label class="fld">
      <span>${esc(t('tkt.field.subject'))}</span>
      <input id="ntSubject" type="text" maxlength="200" required>
    </label>
    <label class="fld">
      <span>${esc(t('tkt.field.description'))}</span>
      <textarea id="ntBody" rows="4" maxlength="5000" required></textarea>
    </label>
  `;

  openModal({
    title: t('tkt.createTitle'),
    bodyHTML,
    onOpen(bodyEl) {
      const custSel = $('#ntCustomer', bodyEl);
      custSel?.addEventListener('change', () => {
        const cust = customers.find((c) => c.id === custSel.value);
        if (!cust) return;
        $('#ntPractice', bodyEl).value = cust.display_name || '';
        if (cust.contact_email) $('#ntEmail', bodyEl).value = cust.contact_email;
        if (cust.deployment_mode === 'box') $('#ntSource', bodyEl).value = 'box';
        else if (cust.deployment_mode === 'saas') $('#ntSource', bodyEl).value = 'saas';
      });
    },
    actions: [
      { label: t('common.cancel'), onClick: () => true },
      {
        label: t('tkt.createBtn'),
        kind: 'primary',
        onClick: async () => {
          const subject = $('#ntSubject').value.trim();
          const body = $('#ntBody').value.trim();
          if (!subject || !body) {
            toast('Betreff und Beschreibung erforderlich', true);
            return false;
          }
          const custId = $('#ntCustomer').value || null;
          const cust = custId ? customers.find((c) => c.id === custId) : null;

          const { data: created, error: tErr } = await sb
            .from('ops_tickets')
            .insert({
              customer_id: custId,
              tenant_id: cust?.tenant_id || null,
              box_name: cust?.box_name || null,
              source: $('#ntSource').value || 'manual',
              practice_name: $('#ntPractice').value.trim() || cust?.display_name || '',
              contact_email: $('#ntEmail').value.trim() || null,
              category: $('#ntCategory').value || 'support',
              priority: $('#ntPriority').value || 'normal',
              status: 'neu',
              subject,
            })
            .select('*')
            .single();

          if (tErr || !created) {
            fail('Ticket anlegen', tErr);
            return false;
          }

          // Sales darf per RLS ausschließlich interne Notizen einfügen
          const isSalesOnlyInternal = role === 'sales';
          const { error: mErr } = await sb
            .from('ops_ticket_messages')
            .insert({
              ticket_id: created.id,
              sender_type: 'staff',
              sender_name: state.me?.display_name || state.me?.email || 'Team',
              sender_member_id: state.me?.id || null,
              body,
              is_internal_note: isSalesOnlyInternal,
            });

          if (mErr) fail('Erste Nachricht speichern', mErr);

          tickets.unshift(created);
          toast(t('tkt.createdToast', { no: created.ticket_no }));
          renderTickets();
          void openTicketDrawer(created.id);
          return true;
        },
      },
    ],
  });
}

window.__praxuraOpenTicket = (ticketId) => {
  pendingOpenTicketId = ticketId || null;
  showView('tickets');
  if (pendingOpenTicketId && ticketsLoaded) {
    const targetId = pendingOpenTicketId;
    pendingOpenTicketId = null;
    void openTicketDrawer(targetId);
  }
};

export async function mountTickets() {
  if (!unsubLang) {
    unsubLang = onLangChange(() => {
      const el = $('#view-tickets');
      if (el && !el.hidden) {
        renderTickets();
        if (selectedTicketId) void openTicketDrawer(selectedTicketId);
      }
    });
  }
  const root = $('#view-tickets');
  if (root && !tickets.length) {
    root.innerHTML = `<p class="empty">${esc(t('auth.loading'))}</p>`;
  }
  ticketsLoaded = false;
  await loadTicketsData();
  renderTickets();
  if (pendingOpenTicketId) {
    const targetId = pendingOpenTicketId;
    pendingOpenTicketId = null;
    void openTicketDrawer(targetId);
  }
}
