// Praxura Cockpit — Onboarding & Fristen-Radar
import { sb, $, esc, toast, fail, fmtDate, showView, myRole } from './app.js?v=20261127d';
import { t, onLangChange } from './i18n.js?v=20261127d';
import { getOverview, currentMonthUtc } from './cockpit-api.js?v=20261127d';

const PIPELINE_STAGES = ['lead', 'demo', 'onboarding', 'aktiv', 'risiko', 'gekuendigt'];
const FOCUS_STAGES = new Set(['lead', 'demo', 'onboarding', 'risiko']);

const ONBOARDING_STEPS = [
  { key: 'avv',       labelKey: 'radar.step.avv',       boxOnly: false },
  { key: 'ik',        labelKey: 'radar.step.ik',        boxOnly: false },
  { key: 'itsg',      labelKey: 'radar.step.itsg',      boxOnly: false },
  { key: 'kartleser', labelKey: 'radar.step.kartleser', boxOnly: false },
  { key: 'test302',   labelKey: 'radar.step.test302',   boxOnly: false },
  { key: 'box_setup', labelKey: 'radar.step.box_setup', boxOnly: true },
];

const FALLBACK_RETIREMENTS = [
  { model: 'gpt-4.1-mini / gpt-4o / gpt-4o-mini', resource: 'de-text', retiresOn: '2027-04-14' },
  { model: 'gpt-5-mini', resource: 'de-text', retiresOn: '2027-07-13' },
];

const GKV_DEADLINE_DATE = '2027-02-01';

let activeTab = 'onboarding'; // 'onboarding' | 'deadlines'
let stageFilter = 'focus';    // 'focus' | 'all' | 'lead' | 'demo' | 'onboarding' | 'aktiv' | 'risiko' | 'gekuendigt'
let showAllStages = false;
let deadlineSevFilter = 'all'; // 'all' | 'kritisch' | 'warn' | 'ok'

let customers = [];
let alerts = [];
let apiRes = { ok: false, data: null };
let schemaMissing = false;
let unsubLang = null;

function isMissingTableError(err) {
  if (!err) return false;
  return err.code === '42P01' || err.code === 'PGRST205' || /does not exist|could not find the table/i.test(err.message || '');
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(target)) return null;
  const today = new Date().setUTCHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (24 * 60 * 60 * 1000));
}

function severityFromDays(days) {
  if (days === null || days === undefined) return 'warn';
  if (days <= 30) return 'kritisch';
  if (days <= 60) return 'warn';
  return 'ok';
}

function sevBadgeClass(sev) {
  if (sev === 'kritisch') return 'sev-critical';
  if (sev === 'warn') return 'sev-warn';
  return 'sev-ok';
}

function getApplicableSteps(customer) {
  const isBoxOrHybrid = customer.deployment_mode === 'box' || customer.deployment_mode === 'hybrid';
  return ONBOARDING_STEPS.filter((step) => !step.boxOnly || isBoxOrHybrid);
}

function checklistProgress(customer) {
  const steps = getApplicableSteps(customer);
  const checklist = customer.onboarding_checklist && typeof customer.onboarding_checklist === 'object'
    ? customer.onboarding_checklist
    : {};
  const done = steps.filter((s) => Boolean(checklist[s.key])).length;
  const total = steps.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { steps, checklist, done, total, pct };
}

function buildDeadlineItems() {
  const role = myRole();
  const canSeeKi = role === 'founder' || role === 'tech';
  const items = [];

  // 1. ITSG-Zertifikatsabläufe (alle nicht gekündigten Praxen mit Datum)
  for (const c of customers) {
    if (c.lifecycle_stage === 'gekuendigt' || !c.itsg_cert_expires_at) continue;
    const days = daysUntil(c.itsg_cert_expires_at);
    if (days === null) continue;
    items.push({
      id: `itsg:${c.id}`,
      category: 'ITSG',
      title: t('radar.dead.itsgTitle', { name: c.display_name }),
      detail: `${t(`cust.fach.${c.fachbereich}`)} · ${t(`cust.stage.${c.lifecycle_stage}`)}`,
      dateStr: c.itsg_cert_expires_at,
      daysRemaining: days,
      sortDays: days,
      severity: severityFromDays(days),
      gotoView: 'customers',
    });
  }

  // 2. Aktiv / Onboarding ohne unterschriebenen AVV
  for (const c of customers) {
    if ((c.lifecycle_stage === 'aktiv' || c.lifecycle_stage === 'onboarding') && !c.avv_signed) {
      const isAktiv = c.lifecycle_stage === 'aktiv';
      items.push({
        id: `avv:${c.id}`,
        category: 'AVV',
        title: t('radar.dead.avvTitle', { name: c.display_name }),
        detail: `${t(`cust.stage.${c.lifecycle_stage}`)} · ${t('radar.dead.avvDetail')}`,
        dateStr: null,
        daysRemaining: null,
        sortDays: isAktiv ? -1 : 31,
        severity: isAktiv ? 'kritisch' : 'warn',
        gotoView: 'customers',
      });
    }
  }

  // 3. GKV / §302 regulatorische Frist
  const gkvDays = daysUntil(GKV_DEADLINE_DATE);
  items.push({
    id: 'gkv:tp5-v22',
    category: 'GKV / §302',
    title: 'TP5 Anlage 1 & 3 (V22/V10 Umstellung)',
    detail: t('radar.dead.gkvDetail'),
    dateStr: GKV_DEADLINE_DATE,
    daysRemaining: gkvDays,
    sortDays: gkvDays ?? 9999,
    severity: severityFromDays(gkvDays),
    gotoView: null,
  });

  // 4. Azure KI Modellabkündigungen (live aus Cockpit-API, sonst Fallback)
  const overview = apiRes?.ok ? apiRes.data : null;
  const liveRetirements = Array.isArray(overview?.ki?.retirements) && overview.ki.retirements.length > 0
    ? overview.ki.retirements
    : null;
  const retirements = liveRetirements || FALLBACK_RETIREMENTS;

  for (const r of retirements) {
    const days = r.daysRemaining !== undefined && r.daysRemaining !== null
      ? Number(r.daysRemaining)
      : daysUntil(r.retiresOn);
    items.push({
      id: `azure:${r.model}:${r.retiresOn}`,
      category: 'AZURE KI',
      title: t('radar.dead.azureTitle', { model: r.model }),
      detail: `${r.resource || 'de-text'}${liveRetirements ? '' : ` · ${t('radar.dead.fallbackHint')}`}`,
      dateStr: r.retiresOn,
      daysRemaining: days,
      sortDays: days ?? 9999,
      severity: severityFromDays(days),
      gotoView: canSeeKi ? 'ki-costs' : null,
    });
  }

  // 5. Offene ops_alerts (per RLS nach Rolle gefiltert)
  for (const a of alerts) {
    const sev = a.severity === 'critical' ? 'kritisch' : a.severity === 'warn' ? 'warn' : 'ok';
    const sortDays = a.severity === 'critical' ? -2 : a.severity === 'warn' ? 35 : 999;
    items.push({
      id: `alert:${a.id}`,
      alertId: a.id,
      alertKind: a.kind,
      category: `ALERT · ${String(a.kind || 'system').toUpperCase()}`,
      title: a.title,
      detail: fmtDate(a.created_at),
      dateStr: a.created_at ? String(a.created_at).slice(0, 10) : null,
      daysRemaining: null,
      sortDays,
      severity: sev,
      gotoView: a.kind === 'ticket_urgent' ? 'tickets' : null,
    });
  }

  items.sort((a, b) => a.sortDays - b.sortDays);
  return items;
}

function getFilteredOnboardingCustomers() {
  return customers.filter((c) => {
    if (stageFilter === 'all') return true;
    if (stageFilter === 'focus') {
      return showAllStages ? true : FOCUS_STAGES.has(c.lifecycle_stage);
    }
    return c.lifecycle_stage === stageFilter;
  });
}

function renderOnboardingTab(role) {
  const canEdit = role === 'founder' || role === 'sales' || role === 'tech';
  const stageCounts = Object.fromEntries(PIPELINE_STAGES.map((st) => [st, 0]));
  for (const c of customers) {
    if (stageCounts[c.lifecycle_stage] !== undefined) stageCounts[c.lifecycle_stage] += 1;
  }

  const list = getFilteredOnboardingCustomers();

  return `
    <div class="radar-stage-grid">
      ${PIPELINE_STAGES.map((st) => {
        const isActive = stageFilter === st;
        return `
          <button type="button" class="radar-stage-kpi stage-${esc(st)} ${isActive ? 'is-active' : ''}" data-stage-kpi="${esc(st)}">
            <span class="radar-stage-label">${esc(t(`cust.stage.${st}`))}</span>
            <strong class="radar-stage-val">${esc(stageCounts[st])}</strong>
          </button>
        `;
      }).join('')}
    </div>

    <div class="radar-filter-bar">
      <div class="radar-stage-pills">
        <button type="button" class="btn btn-ghost ck-btn-sm ${stageFilter === 'focus' && !showAllStages ? 'is-active' : ''}" data-stage-pill="focus">
          ${esc(t('radar.filter.focus'))}
        </button>
        <button type="button" class="btn btn-ghost ck-btn-sm ${stageFilter === 'all' || (stageFilter === 'focus' && showAllStages) ? 'is-active' : ''}" data-stage-pill="all">
          ${esc(t('common.all'))} (${esc(customers.length)})
        </button>
        ${PIPELINE_STAGES.map((st) => `
          <button type="button" class="btn btn-ghost ck-btn-sm ${stageFilter === st ? 'is-active' : ''}" data-stage-pill="${esc(st)}">
            ${esc(t(`cust.stage.${st}`))} (${esc(stageCounts[st])})
          </button>
        `).join('')}
      </div>

      <label class="chk-inline">
        <input type="checkbox" id="radarShowAllChk" ${showAllStages || stageFilter === 'all' ? 'checked' : ''}>
        <span>${esc(t('radar.filter.showAll'))}</span>
      </label>
    </div>

    ${!canEdit ? `<div class="ck-banner ck-banner-info">${esc(t('radar.readOnlyHint'))}</div>` : ''}

    ${list.length === 0
      ? `<div class="ck-panel"><p class="empty">${esc(t('radar.onboarding.empty'))}</p></div>`
      : `<div class="radar-cards">
          ${list.map((c) => {
            const { steps, checklist, done, total, pct } = checklistProgress(c);
            const allDone = done === total;
            return `
              <article class="radar-card" data-customer-id="${esc(c.id)}">
                <div class="radar-card-head">
                  <div>
                    <div class="radar-card-title">${esc(c.display_name)}</div>
                    <div class="radar-card-badges">
                      <span class="ck-badge stage-${esc(c.lifecycle_stage)}">${esc(t(`cust.stage.${c.lifecycle_stage}`))}</span>
                      <span class="ck-badge">${esc(t(`cust.mode.${c.deployment_mode}`))}</span>
                      <span class="ck-badge">${esc(t(`cust.fach.${c.fachbereich}`))}</span>
                      <span class="ck-badge ${c.avv_signed ? 'sev-ok' : 'sev-critical'}">${esc(c.avv_signed ? t('cust.avvOk') : t('cust.avvMissing'))}</span>
                    </div>
                  </div>
                  <button type="button" class="btn btn-ghost ck-btn-sm" data-goto-customers="${esc(c.id)}">
                    ${esc(t('radar.openCustomer'))} →
                  </button>
                </div>

                <div class="radar-progress-wrap">
                  <div class="radar-progress-meta">
                    <span>${esc(t('radar.progressLabel'))}</span>
                    <strong>${esc(done)}/${esc(total)} (${esc(pct)}%)</strong>
                  </div>
                  <div class="radar-progress-track">
                    <div class="radar-progress-fill ${allDone ? 'is-complete' : ''}" style="width:${pct}%"></div>
                  </div>
                </div>

                <div class="radar-checklist">
                  ${steps.map((step) => {
                    const checked = Boolean(checklist[step.key]);
                    return `
                      <label class="radar-chk-item ${checked ? 'is-done' : ''}">
                        <input
                          type="checkbox"
                          data-radar-cust="${esc(c.id)}"
                          data-radar-key="${esc(step.key)}"
                          ${checked ? 'checked' : ''}
                          ${canEdit ? '' : 'disabled'}
                        >
                        <span>${esc(t(step.labelKey))}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              </article>
            `;
          }).join('')}
        </div>`}
  `;
}

function renderDeadlinesTab(allItems, role) {
  const counts = {
    all: allItems.length,
    kritisch: allItems.filter((i) => i.severity === 'kritisch').length,
    warn: allItems.filter((i) => i.severity === 'warn').length,
    ok: allItems.filter((i) => i.severity === 'ok').length,
  };
  const filtered = deadlineSevFilter === 'all'
    ? allItems
    : allItems.filter((i) => i.severity === deadlineSevFilter);

  const canResolveAlert = (item) => {
    if (!item.alertId) return false;
    if (role === 'founder' || role === 'tech') return true;
    return role === 'support' && item.alertKind === 'ticket_urgent';
  };

  return `
    <div class="radar-filter-bar">
      <div class="radar-stage-pills">
        ${(['all', 'kritisch', 'warn', 'ok']).map((sev) => `
          <button type="button" class="btn btn-ghost ck-btn-sm ${deadlineSevFilter === sev ? 'is-active' : ''}" data-sev-filter="${esc(sev)}">
            ${esc(sev === 'all' ? t('common.all') : t(`radar.sev.${sev}`))} (${esc(counts[sev])})
          </button>
        `).join('')}
      </div>
    </div>

    <div class="ck-table-wrap">
      <table class="ck-table">
        <thead>
          <tr>
            <th>${esc(t('radar.col.severity'))}</th>
            <th>${esc(t('radar.col.category'))}</th>
            <th>${esc(t('radar.col.item'))}</th>
            <th>${esc(t('radar.col.dueDate'))}</th>
            <th>${esc(t('radar.col.remaining'))}</th>
            <th>${esc(t('radar.col.action'))}</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0
            ? `<tr><td colspan="6"><p class="empty">${esc(t('radar.deadlines.empty'))}</p></td></tr>`
            : filtered.map((item) => {
                const remText = item.daysRemaining === null || item.daysRemaining === undefined
                  ? t('radar.dead.immediate')
                  : item.daysRemaining < 0
                    ? t('common.expiredDays', { n: Math.abs(item.daysRemaining) })
                    : t('common.daysLeft', { n: item.daysRemaining });

                return `
                  <tr>
                    <td>
                      <span class="ck-badge ${sevBadgeClass(item.severity)}">
                        ${esc(t(`radar.sev.${item.severity}`))}
                      </span>
                    </td>
                    <td><span class="ck-badge">${esc(item.category)}</span></td>
                    <td>
                      <div class="ck-cell-main">${esc(item.title)}</div>
                      <div class="ck-cell-sub">${esc(item.detail)}</div>
                    </td>
                    <td>${item.dateStr ? esc(fmtDate(item.dateStr)) : '—'}</td>
                    <td><strong>${esc(remText)}</strong></td>
                    <td>
                      <div class="radar-row-actions">
                        ${canResolveAlert(item)
                          ? `<button type="button" class="btn btn-ghost ck-btn-sm" data-resolve-alert="${esc(item.alertId)}">${esc(t('home.action.resolve'))}</button>`
                          : ''}
                        ${item.gotoView
                          ? `<button type="button" class="btn btn-ghost ck-btn-sm" data-goto-view="${esc(item.gotoView)}">${esc(t(`nav.${item.gotoView === 'ki-costs' ? 'kiCosts' : item.gotoView}`))} →</button>`
                          : (!canResolveAlert(item) ? '—' : '')}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderRadar() {
  const root = $('#view-radar');
  if (!root) return;

  const role = myRole();
  const deadlineItems = buildDeadlineItems();
  const urgentDeadlineCount = deadlineItems.filter((i) => i.severity === 'kritisch' || i.severity === 'warn').length;
  const focusCount = customers.filter((c) => FOCUS_STAGES.has(c.lifecycle_stage)).length;

  let banner = '';
  if (schemaMissing) {
    banner += `<div class="ck-banner ck-banner-warn">${esc(t('common.schemaPending'))}</div>`;
  }

  root.innerHTML = `
    <div class="ck-head">
      <div>
        <div class="ck-eyebrow">${esc(t('radar.eyebrow'))}</div>
        <h2 class="ck-title">${esc(t('radar.title'))}</h2>
        <p class="ck-sub">${esc(t('radar.subtitle'))}</p>
      </div>
      <div class="ck-head-actions">
        <button type="button" class="btn btn-ghost" id="radarRefreshBtn">${esc(t('common.refresh'))}</button>
      </div>
    </div>

    ${banner}

    <div class="radar-tabs" role="tablist">
      <button type="button" class="radar-tab ${activeTab === 'onboarding' ? 'is-active' : ''}" data-radar-tab="onboarding" role="tab">
        <span>${esc(t('radar.tab.onboarding'))}</span>
        <span class="ck-badge">${esc(focusCount)}</span>
      </button>
      <button type="button" class="radar-tab ${activeTab === 'deadlines' ? 'is-active' : ''}" data-radar-tab="deadlines" role="tab">
        <span>${esc(t('radar.tab.deadlines'))}</span>
        <span class="ck-badge ${urgentDeadlineCount > 0 ? 'sev-warn' : 'sev-ok'}">${esc(deadlineItems.length)}</span>
      </button>
    </div>

    ${activeTab === 'onboarding'
      ? renderOnboardingTab(role)
      : renderDeadlinesTab(deadlineItems, role)}
  `;

  $('#radarRefreshBtn', root)?.addEventListener('click', () => mountRadar());

  root.querySelectorAll('[data-radar-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-radar-tab') || 'onboarding';
      renderRadar();
    });
  });

  root.querySelectorAll('[data-stage-kpi]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const st = btn.getAttribute('data-stage-kpi');
      stageFilter = stageFilter === st ? 'focus' : st;
      renderRadar();
    });
  });

  root.querySelectorAll('[data-stage-pill]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-stage-pill');
      stageFilter = val;
      if (val === 'all') showAllStages = true;
      else if (val === 'focus') showAllStages = false;
      renderRadar();
    });
  });

  $('#radarShowAllChk', root)?.addEventListener('change', (e) => {
    showAllStages = Boolean(e.target.checked);
    if (stageFilter === 'all' && !showAllStages) stageFilter = 'focus';
    else if (showAllStages && stageFilter !== 'focus') stageFilter = 'all';
    renderRadar();
  });

  root.querySelectorAll('[data-goto-customers]').forEach((btn) => {
    btn.addEventListener('click', () => showView('customers'));
  });

  root.querySelectorAll('input[data-radar-cust]').forEach((chk) => {
    chk.addEventListener('change', async () => {
      const custId = chk.getAttribute('data-radar-cust');
      const key = chk.getAttribute('data-radar-key');
      const row = customers.find((c) => c.id === custId);
      if (!row) return;

      const prevChecklist = row.onboarding_checklist && typeof row.onboarding_checklist === 'object'
        ? row.onboarding_checklist
        : {};
      const nextChecklist = { ...prevChecklist, [key]: chk.checked };

      chk.disabled = true;
      const { error } = await sb
        .from('ops_customers')
        .update({ onboarding_checklist: nextChecklist })
        .eq('id', row.id);

      if (error) {
        chk.checked = !chk.checked;
        chk.disabled = false;
        return fail('Onboarding-Checkliste', error);
      }

      row.onboarding_checklist = nextChecklist;
      toast(t('radar.checklistSaved'));
      renderRadar();
    });
  });

  root.querySelectorAll('[data-sev-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      deadlineSevFilter = btn.getAttribute('data-sev-filter') || 'all';
      renderRadar();
    });
  });

  root.querySelectorAll('[data-goto-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-goto-view');
      if (target) showView(target);
    });
  });

  root.querySelectorAll('[data-resolve-alert]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-resolve-alert');
      if (!id) return;
      btn.disabled = true;
      const { error } = await sb
        .from('ops_alerts')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        btn.disabled = false;
        return fail('Alert erledigen', error);
      }
      alerts = alerts.filter((a) => a.id !== id);
      toast(t('home.action.resolvedToast'));
      renderRadar();
    });
  });
}

export async function mountRadar() {
  if (!unsubLang) {
    unsubLang = onLangChange(() => {
      if (!$('#view-radar')?.hidden) renderRadar();
    });
  }

  const root = $('#view-radar');
  if (root && !customers.length) {
    root.innerHTML = `<p class="empty">${esc(t('auth.loading'))}</p>`;
  }

  const [custRes, alertsRes, overviewRes] = await Promise.all([
    sb.from('ops_customers')
      .select('id, display_name, deployment_mode, fachbereich, lifecycle_stage, avv_signed, avv_signed_at, itsg_cert_expires_at, onboarding_checklist, updated_at, created_at')
      .order('display_name'),
    sb.from('ops_alerts')
      .select('id, kind, severity, title, details, created_at')
      .is('resolved_at', null)
      .order('created_at', { ascending: false }),
    getOverview(currentMonthUtc()),
  ]);

  schemaMissing = isMissingTableError(custRes.error) || isMissingTableError(alertsRes.error);

  if (custRes.error && !isMissingTableError(custRes.error)) fail('Radar Kunden', custRes.error);
  if (alertsRes.error && !isMissingTableError(alertsRes.error) && alertsRes.error.code !== '42501') {
    fail('Radar Alerts', alertsRes.error);
  }

  customers = custRes.data || [];
  alerts = alertsRes.data || [];
  apiRes = overviewRes || { ok: false, data: null };

  renderRadar();
}
