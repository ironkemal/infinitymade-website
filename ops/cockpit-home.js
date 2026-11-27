// Praxura Cockpit — Kommandozentrale / Cockpit Home
import { sb, state, $, esc, toast, fail, fmtDate, showView, myRole } from './app.js?v=20261127d';
import { t, onLangChange } from './i18n.js?v=20261127d';
import { getOverview, currentMonthUtc } from './cockpit-api.js?v=20261127d';

let lastData = null;
let unsubLang = null;

function isMissingTableError(err) {
  if (!err) return false;
  return err.code === '42P01' || err.code === 'PGRST205' || /does not exist|could not find the table/i.test(err.message || '');
}

function fmtEur(val, digits = 2) {
  return (Number(val) || 0).toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }) + ' €';
}

function fmtInt(val) {
  return Math.round(Number(val) || 0).toLocaleString('de-DE');
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (!Number.isFinite(target)) return null;
  const today = new Date().setUTCHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (24 * 60 * 60 * 1000));
}

async function fetchHomeData() {
  const role = myRole();
  const month = currentMonthUtc();
  const canSeeBilling = role === 'founder' || role === 'sales';
  const canSeeAlertsTable = role === 'founder' || role === 'tech' || role === 'support';

  const [custRes, billingRes, alertsRes, ticketsRes, apiRes] = await Promise.all([
    sb.from('ops_customers').select('id, display_name, lifecycle_stage, deployment_mode, itsg_cert_expires_at, avv_signed'),
    canSeeBilling
      ? sb.from('ops_customer_billing').select('customer_id, payment_status')
      : Promise.resolve({ data: [], error: null }),
    canSeeAlertsTable
      ? sb.from('ops_alerts').select('*').is('resolved_at', null).order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    sb.from('ops_tickets').select('id, ticket_no, subject, practice_name, priority, status, created_at').neq('status', 'geloest').order('created_at', { ascending: false }),
    getOverview(month),
  ]);

  const schemaMissing =
    isMissingTableError(custRes.error) ||
    isMissingTableError(billingRes.error) ||
    isMissingTableError(alertsRes.error);

  if (custRes.error && !isMissingTableError(custRes.error)) fail('Cockpit Kunden', custRes.error);
  if (billingRes.error && !isMissingTableError(billingRes.error)) fail('Cockpit Billing', billingRes.error);
  if (alertsRes.error && !isMissingTableError(alertsRes.error)) fail('Cockpit Alerts', alertsRes.error);
  if (ticketsRes.error && !isMissingTableError(ticketsRes.error)) fail('Cockpit Tickets', ticketsRes.error);

  return {
    role,
    month,
    schemaMissing,
    customers: custRes.data || [],
    billing: billingRes.data || [],
    alerts: alertsRes.data || [],
    openTickets: ticketsRes.data || [],
    api: apiRes,
  };
}

function renderHome() {
  const root = $('#view-cockpit');
  if (!root || !lastData) return;

  const { role, month, schemaMissing, customers, billing, alerts, openTickets = [], api } = lastData;
  const canSeeBilling = role === 'founder' || role === 'sales';
  const canSeeKiCosts = role === 'founder' || role === 'tech';
  const overview = api.ok ? api.data : null;

  const activeCrm = customers.filter((c) => c.lifecycle_stage === 'aktiv').length;
  const saasOwners = overview?.customers?.totalOwners ?? '—';

  const trialsCount = overview?.customers?.trialsCount ?? billing.filter((b) => b.payment_status === 'trial').length;
  const pastDueCount = overview?.customers?.pastDueCount ?? billing.filter((b) => b.payment_status === 'past_due').length;

  const expiringCerts = customers
    .map((c) => ({ ...c, days: daysUntil(c.itsg_cert_expires_at) }))
    .filter((c) => c.days !== null && c.days <= 60)
    .sort((a, b) => a.days - b.days);

  const retirements = canSeeKiCosts && Array.isArray(overview?.ki?.retirements)
    ? overview.ki.retirements
    : [];

  const sevRank = { critical: 0, warn: 1, info: 2 };
  const sortedAlerts = [...alerts].sort((a, b) => (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9));

  const alertTicketIds = new Set(
    sortedAlerts
      .filter((a) => a.kind === 'ticket_urgent' && a.details?.ticket_id)
      .map((a) => a.details.ticket_id)
  );
  const urgentTickets = openTickets.filter(
    (tkt) => (tkt.priority === 'kritisch' || tkt.priority === 'hoch') && !alertTicketIds.has(tkt.id)
  );
  const newTicketsCount = openTickets.filter((tkt) => tkt.status === 'neu').length;
  const allUrgentCount = openTickets.filter((tkt) => tkt.priority === 'kritisch' || tkt.priority === 'hoch').length;

  const actionCount = sortedAlerts.length + expiringCerts.length + retirements.length + urgentTickets.length;

  let statusBanner = '';
  if (schemaMissing) {
    statusBanner += `<div class="ck-banner ck-banner-warn">${esc(t('common.schemaPending'))}</div>`;
  }
  if (!api.ok) {
    const msg = api.reason === 'NOT_CONFIGURED'
      ? t('common.apiNotConfigured')
      : t('common.apiOffline', { reason: api.reason || 'offline' });
    statusBanner += `<div class="ck-banner ck-banner-info">${esc(msg)}</div>`;
  }

  root.innerHTML = `
    <div class="ck-head">
      <div>
        <div class="ck-eyebrow">${esc(t('home.eyebrow'))}</div>
        <h2 class="ck-title">${esc(t('home.title'))}</h2>
        <p class="ck-sub">${esc(t('home.subtitle'))}</p>
      </div>
      <div class="ck-head-actions">
        <button class="btn btn-ghost" id="ckRefreshBtn">${esc(t('common.refresh'))}</button>
      </div>
    </div>

    ${statusBanner}

    <div class="ck-kpi-grid">
      <div class="ck-kpi">
        <div class="ck-kpi-label">${esc(t('home.kpi.activeCustomers'))}</div>
        <div class="ck-kpi-val">${esc(activeCrm)}</div>
        <div class="ck-kpi-sub">${esc(t('home.kpi.activeSub', { saas: saasOwners, crm: customers.length }))}</div>
      </div>

      ${canSeeBilling ? `
        <div class="ck-kpi ${pastDueCount > 0 ? 'is-warn' : ''}">
          <div class="ck-kpi-label">${esc(t('home.kpi.trialsBilling'))}</div>
          <div class="ck-kpi-val">${esc(trialsCount)} / <span class="${pastDueCount > 0 ? 'ck-txt-red' : ''}">${esc(pastDueCount)}</span></div>
          <div class="ck-kpi-sub">${esc(t('home.kpi.trialsSub', { trials: trialsCount, pastDue: pastDueCount }))}</div>
        </div>
      ` : ''}

      ${canSeeKiCosts ? `
        <div class="ck-kpi">
          <div class="ck-kpi-label">${esc(t('home.kpi.kiMonth', { month }))}</div>
          <div class="ck-kpi-val">${overview ? esc(fmtEur(overview.ki.totalCostEur, 2)) : '—'}</div>
          <div class="ck-kpi-sub">${overview
            ? esc(t('home.kpi.kiSub', { calls: fmtInt(overview.ki.calls), tokens: fmtInt(overview.ki.totalTokens) }))
            : esc(t('cust.noKiData'))}</div>
        </div>
      ` : ''}

      <div class="ck-kpi ${allUrgentCount > 0 ? 'is-warn' : ''}" style="cursor:pointer;" data-goto="tickets">
        <div class="ck-kpi-label">${esc(t('home.kpi.openTickets'))}</div>
        <div class="ck-kpi-val">${esc(openTickets.length)}</div>
        <div class="ck-kpi-sub">${esc(t('home.kpi.openTicketsSub', { neu: newTicketsCount, urgent: allUrgentCount }))}</div>
      </div>

      <div class="ck-kpi ${actionCount > 0 ? 'is-alert' : 'is-ok'}">
        <div class="ck-kpi-label">${esc(t('home.kpi.openAlerts'))}</div>
        <div class="ck-kpi-val">${esc(actionCount)}</div>
        <div class="ck-kpi-sub">${esc(t('home.kpi.openAlertsSub', {
          alerts: sortedAlerts.length,
          certs: expiringCerts.length,
          retire: retirements.length,
        }))}</div>
      </div>
    </div>

    <div class="ck-home-grid">
      <section class="ck-panel">
        <div class="ck-panel-head">
          <h3>${esc(t('home.action.title'))}</h3>
          <div style="display:flex;align-items:center;gap:8px">
            <button type="button" class="btn btn-ghost ck-btn-sm" data-goto="radar">${esc(t('home.action.openRadar'))} →</button>
            <span class="pill ${actionCount > 0 ? 'ck-pill-red' : 'ck-pill-green'}">${esc(actionCount)}</span>
          </div>
        </div>
        <div class="ck-action-list">
          ${actionCount === 0 ? `<p class="empty">${esc(t('home.action.empty'))}</p>` : ''}

          ${sortedAlerts.map((a) => `
            <div class="ck-action-item sev-${esc(a.severity)}">
              <div class="ck-action-main">
                <div class="ck-action-top">
                  <span class="ck-badge sev-${esc(a.severity)}">${esc(a.severity.toUpperCase())}</span>
                  <span class="ck-badge">${esc(a.kind)}</span>
                  <span class="hint">${esc(fmtDate(a.created_at))}</span>
                </div>
                <div class="ck-action-title">${esc(a.title)}</div>
              </div>
              <button class="btn btn-ghost ck-btn-sm" data-resolve-alert="${esc(a.id)}">${esc(t('home.action.resolve'))}</button>
            </div>
          `).join('')}

          ${expiringCerts.map((c) => `
            <div class="ck-action-item sev-${c.days <= 14 ? 'critical' : 'warn'}">
              <div class="ck-action-main">
                <div class="ck-action-top">
                  <span class="ck-badge sev-${c.days <= 14 ? 'critical' : 'warn'}">ITSG</span>
                  <span class="hint">${esc(fmtDate(c.itsg_cert_expires_at))} · ${esc(
                    c.days < 0
                      ? t('common.expiredDays', { n: Math.abs(c.days) })
                      : t('common.daysLeft', { n: c.days })
                  )}</span>
                </div>
                <div class="ck-action-title">${esc(t('home.action.certExpiry', { name: c.display_name }))}</div>
              </div>
              <button class="btn btn-ghost ck-btn-sm" data-goto="customers">${esc(t('nav.customers'))}</button>
            </div>
          `).join('')}

          ${retirements.map((r) => `
            <div class="ck-action-item sev-${r.daysRemaining <= 45 ? 'critical' : 'warn'}">
              <div class="ck-action-main">
                <div class="ck-action-top">
                  <span class="ck-badge sev-${r.daysRemaining <= 45 ? 'critical' : 'warn'}">AZURE</span>
                  <span class="hint">${esc(r.retiresOn)} · ${esc(t('common.daysLeft', { n: r.daysRemaining }))}</span>
                </div>
                <div class="ck-action-title">${esc(t('home.action.modelRetire', { model: r.model, resource: r.resource }))}</div>
              </div>
              <button class="btn btn-ghost ck-btn-sm" data-goto="ki-costs">${esc(t('nav.kiCosts'))}</button>
            </div>
          `).join('')}

          ${urgentTickets.map((tkt) => `
            <div class="ck-action-item sev-${tkt.priority === 'kritisch' ? 'critical' : 'warn'}">
              <div class="ck-action-main">
                <div class="ck-action-top">
                  <span class="ck-badge sev-${tkt.priority === 'kritisch' ? 'critical' : 'warn'}">${esc(t(`tkt.prio.${tkt.priority}`).toUpperCase())}</span>
                  <span class="ck-badge">TICKET</span>
                  <span class="hint">${esc(fmtDate(tkt.created_at))}</span>
                </div>
                <div class="ck-action-title">${esc(t('home.action.ticketUrgent', { no: tkt.ticket_no, subject: tkt.subject, practice: tkt.practice_name || '—' }))}</div>
              </div>
              <button class="btn btn-ghost ck-btn-sm" data-open-ticket-id="${esc(tkt.id)}">${esc(t('nav.tickets'))}</button>
            </div>
          `).join('')}
        </div>
      </section>

      <aside class="ck-panel">
        <div class="ck-panel-head">
          <h3>${esc(t('home.quick.title'))}</h3>
        </div>
        <div class="ck-quick-list">
          <button class="btn btn-primary" id="ckQuickNewPractice">${esc(t('home.quick.newPractice'))}</button>
          ${canSeeKiCosts ? `<button class="btn" id="ckQuickNewBoxCode">${esc(t('home.quick.newBoxCode'))}</button>` : ''}
          <button class="btn" id="ckQuickTickets">${esc(t('home.quick.openTickets'))}</button>
          <button class="btn" id="ckQuickRadar">${esc(t('home.quick.radar'))}</button>
          ${canSeeKiCosts ? `<button class="btn" id="ckQuickKi">${esc(t('home.quick.checkKi'))}</button>` : ''}
          <button class="btn" id="ckQuickTask">${esc(t('home.quick.newTask'))}</button>
        </div>

        ${overview && overview.customers ? `
          <div class="ck-mini-box">
            <div class="ck-mini-title">${esc(t('home.saasSummary', { month }))}</div>
            <div class="ck-mini-row"><span>SaaS Owners</span><strong>${esc(overview.customers.totalOwners)}</strong></div>
            <div class="ck-mini-row"><span>${esc(t('ki.kpi.calls'))}</span><strong>${esc(fmtInt(overview.ki?.calls))}</strong></div>
            ${canSeeBilling && overview.customers.byPlan ? Object.entries(overview.customers.byPlan).map(([plan, cnt]) =>
              `<div class="ck-mini-row"><span>Plan: ${esc(plan)}</span><strong>${esc(cnt)}</strong></div>`
            ).join('') : ''}
          </div>
        ` : ''}
      </aside>
    </div>
  `;

  $('#ckRefreshBtn', root)?.addEventListener('click', () => mountCockpit());
  $('#ckQuickNewPractice', root)?.addEventListener('click', () => {
    showView('customers');
    setTimeout(() => window.__praxuraOpenNewPractice?.(), 60);
  });
  $('#ckQuickNewBoxCode', root)?.addEventListener('click', () => {
    showView('boxes');
    setTimeout(() => window.__praxuraNewBoxCode?.(), 60);
  });
  $('#ckQuickTickets', root)?.addEventListener('click', () => showView('tickets'));
  $('#ckQuickRadar', root)?.addEventListener('click', () => showView('radar'));
  $('#ckQuickKi', root)?.addEventListener('click', () => showView('ki-costs'));
  $('#ckQuickTask', root)?.addEventListener('click', () => showView('todo'));

  root.querySelectorAll('[data-open-ticket-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-open-ticket-id');
      if (window.__praxuraOpenTicket) window.__praxuraOpenTicket(id);
      else showView('tickets');
    });
  });

  root.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.getAttribute('data-goto')));
  });

  root.querySelectorAll('[data-resolve-alert]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-resolve-alert');
      btn.disabled = true;
      const { error } = await sb
        .from('ops_alerts')
        .update({ resolved_at: new Date().toISOString(), resolved_by: state.me?.id || null })
        .eq('id', id);
      if (error) {
        btn.disabled = false;
        return fail('Alert schließen', error);
      }
      toast(t('home.action.resolvedToast'));
      await mountCockpit();
    });
  });
}

export async function mountCockpit() {
  if (!unsubLang) {
    unsubLang = onLangChange(() => {
      const el = $('#view-cockpit');
      if (el && !el.hidden) renderHome();
    });
  }
  const root = $('#view-cockpit');
  if (root && !lastData) {
    root.innerHTML = `<p class="empty">${esc(t('auth.loading'))}</p>`;
  }
  lastData = await fetchHomeData();
  renderHome();
}
