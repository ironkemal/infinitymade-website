// Praxura Cockpit — KI-Nutzung & Azure-Kosten (nur EK-Kalkulation)
import { $, esc } from './app.js?v=20261127a';
import { t, onLangChange } from './i18n.js?v=20261127a';
import { getKiUsage, currentMonthUtc } from './cockpit-api.js?v=20261127a';

let selectedMonth = currentMonthUtc();
let sortCol = 'costEur';
let sortDir = 'desc';
let lastResponse = null;
let unsubLang = null;

function fmtEur(val, digits = 4) {
  return (Number(val) || 0).toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }) + ' €';
}

function fmtInt(val) {
  return Math.round(Number(val) || 0).toLocaleString('de-DE');
}

function fmtMin(seconds) {
  return ((Number(seconds) || 0) / 60).toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (!Number.isFinite(target)) return null;
  const today = new Date().setUTCHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (24 * 60 * 60 * 1000));
}

function sortTenants(rows) {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortCol === 'name') {
      return dir * String(a.name || '').localeCompare(String(b.name || ''), 'de');
    }
    return dir * ((Number(a[sortCol]) || 0) - (Number(b[sortCol]) || 0));
  });
}

function renderKiCosts() {
  const root = $('#view-ki-costs');
  if (!root || !lastResponse) return;

  const res = lastResponse;
  const data = res.ok ? res.data : null;

  let banner = '';
  if (!res.ok) {
    const msg = res.reason === 'NOT_CONFIGURED'
      ? t('common.apiNotConfigured')
      : t('common.apiOffline', { reason: res.reason || 'offline' });
    banner += `<div class="ck-banner ck-banner-info">${esc(msg)}</div>`;
  } else if (data && data.extendedColumnsAvailable === false) {
    banner += `<div class="ck-banner ck-banner-warn">${esc(t('ki.extColsMissing'))}</div>`;
  }

  const totals = data?.totals || {
    calls: 0, successCalls: 0, errorCalls: 0, dryRunCalls: 0,
    promptTokens: 0, completionTokens: 0, reasoningTokens: 0, totalTokens: 0,
    audioSeconds: 0, costEur: 0, reasoningShareEur: 0,
  };
  const deText = data?.byResource?.['de-text'] || { costEur: 0, totalTokens: 0, reasoningTokens: 0 };
  const seAudio = data?.byResource?.['se-audio'] || { costEur: 0, audioSeconds: 0, calls: 0 };
  const byResource = data?.byResource || {};
  const byTask = data?.byTask || [];
  const byTenant = sortTenants(data?.byTenant || []);
  const models = data?.pricingMeta?.models || {};
  const stand = data?.pricingMeta?.stand || '—';

  const maxResCost = Math.max(0.0001, ...Object.values(byResource).map((r) => Number(r.costEur) || 0));
  const maxTaskCost = Math.max(0.0001, ...byTask.map((tk) => Number(tk.costEur) || 0));

  const sortArrow = (col) => (sortCol === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '');

  root.innerHTML = `
    <div class="ck-head">
      <div>
        <h2 class="ck-title">${esc(t('ki.title'))}</h2>
        <p class="ck-sub">${esc(t('ki.subtitle'))}</p>
      </div>
      <div class="ck-head-actions">
        <span class="ck-badge">${esc(t('ki.disclaimer'))}</span>
        <label class="ck-month-pick">
          <span>${esc(t('ki.month'))}</span>
          <input type="month" id="kiMonthPicker" value="${esc(selectedMonth)}">
        </label>
        <button class="btn btn-ghost" id="kiRefreshBtn">${esc(t('common.refresh'))}</button>
      </div>
    </div>

    ${banner}

    <div class="ck-kpi-grid">
      <div class="ck-kpi">
        <div class="ck-kpi-label">${esc(t('ki.kpi.totalCost'))}</div>
        <div class="ck-kpi-val">${data ? esc(fmtEur(totals.costEur, 2)) : '—'}</div>
        <div class="ck-kpi-sub">${esc(fmtEur(totals.costEur, 4))}</div>
      </div>

      <div class="ck-kpi">
        <div class="ck-kpi-label">${esc(t('ki.kpi.deText'))}</div>
        <div class="ck-kpi-val">${data ? esc(fmtEur(deText.costEur, 2)) : '—'}</div>
        <div class="ck-kpi-sub">${esc(fmtInt(deText.totalTokens))} tok · ${esc(t('ki.kpi.reasoningNote', {
          tokens: fmtInt(totals.reasoningTokens),
          eur: fmtEur(totals.reasoningShareEur, 4),
        }))}</div>
      </div>

      <div class="ck-kpi">
        <div class="ck-kpi-label">${esc(t('ki.kpi.seAudio'))}</div>
        <div class="ck-kpi-val">${data ? esc(fmtEur(seAudio.costEur, 2)) : '—'}</div>
        <div class="ck-kpi-sub">${esc(t('ki.kpi.audioNote', { mins: fmtMin(seAudio.audioSeconds) }))}</div>
      </div>

      <div class="ck-kpi">
        <div class="ck-kpi-label">${esc(t('ki.kpi.calls'))}</div>
        <div class="ck-kpi-val">${data ? esc(fmtInt(totals.calls)) : '—'}</div>
        <div class="ck-kpi-sub">${esc(t('ki.kpi.callsNote', {
          ok: fmtInt(totals.successCalls),
          err: fmtInt(totals.errorCalls),
          dry: fmtInt(totals.dryRunCalls),
        }))}</div>
      </div>
    </div>

    <div class="ck-two-col">
      <section class="ck-panel">
        <div class="ck-panel-head"><h3>${esc(t('ki.section.resources'))}</h3></div>
        <div class="ck-bars">
          ${Object.entries(byResource).map(([key, bucket]) => {
            const pct = Math.min(100, Math.round(((Number(bucket.costEur) || 0) / maxResCost) * 100));
            return `
              <div class="ck-bar-row">
                <div class="ck-bar-top">
                  <span><code>${esc(key)}</code> (${esc(fmtInt(bucket.calls))})</span>
                  <strong>${esc(fmtEur(bucket.costEur, 4))}</strong>
                </div>
                <div class="ck-bar-track"><div class="ck-bar-fill res-${esc(key)}" style="width:${pct}%"></div></div>
              </div>
            `;
          }).join('') || `<p class="empty">${esc(t('cust.noKiData'))}</p>`}
        </div>
      </section>

      <section class="ck-panel">
        <div class="ck-panel-head"><h3>${esc(t('ki.section.tasks'))}</h3></div>
        <div class="ck-bars">
          ${byTask.map((tk) => {
            const pct = Math.min(100, Math.round(((Number(tk.costEur) || 0) / maxTaskCost) * 100));
            return `
              <div class="ck-bar-row">
                <div class="ck-bar-top">
                  <span><code>${esc(tk.task)}</code> (${esc(fmtInt(tk.calls))})</span>
                  <strong>${esc(fmtEur(tk.costEur, 4))}</strong>
                </div>
                <div class="ck-bar-track"><div class="ck-bar-fill" style="width:${pct}%"></div></div>
              </div>
            `;
          }).join('') || `<p class="empty">${esc(t('cust.noKiData'))}</p>`}
        </div>
      </section>
    </div>

    <section class="ck-panel" style="margin-top:16px">
      <div class="ck-panel-head"><h3>${esc(t('ki.section.tenants'))}</h3></div>
      <div class="ck-table-wrap">
        <table class="ck-table">
          <thead>
            <tr>
              <th class="ck-sort" data-sort="name">${esc(t('ki.col.practice'))}${esc(sortArrow('name'))}</th>
              <th class="ck-sort" data-sort="calls">${esc(t('ki.col.calls'))}${esc(sortArrow('calls'))}</th>
              <th class="ck-sort" data-sort="promptTokens">${esc(t('ki.col.inputTok'))}${esc(sortArrow('promptTokens'))}</th>
              <th class="ck-sort" data-sort="completionTokens">${esc(t('ki.col.outputTok'))}${esc(sortArrow('completionTokens'))}</th>
              <th class="ck-sort" data-sort="reasoningTokens">${esc(t('ki.col.reasoningTok'))}${esc(sortArrow('reasoningTokens'))}</th>
              <th class="ck-sort" data-sort="audioSeconds">${esc(t('ki.col.audioMin'))}${esc(sortArrow('audioSeconds'))}</th>
              <th class="ck-sort" data-sort="costEur">${esc(t('ki.col.costEur'))}${esc(sortArrow('costEur'))}</th>
            </tr>
          </thead>
          <tbody>
            ${byTenant.length === 0
              ? `<tr><td colspan="7"><p class="empty">${esc(t('cust.noKiData'))}</p></td></tr>`
              : byTenant.map((ten) => `
                  <tr>
                    <td>
                      <div class="ck-cell-main">${esc(ten.name)}</div>
                      <div class="ck-cell-sub">${esc(ten.fachbereich || ten.tenantId)}</div>
                    </td>
                    <td>${esc(fmtInt(ten.calls))}</td>
                    <td>${esc(fmtInt(ten.promptTokens))}</td>
                    <td>${esc(fmtInt(ten.completionTokens))}</td>
                    <td>${esc(fmtInt(ten.reasoningTokens))}</td>
                    <td>${esc(fmtMin(ten.audioSeconds))}</td>
                    <td><strong>${esc(fmtEur(ten.costEur, 4))}</strong></td>
                  </tr>
                `).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="ck-panel" style="margin-top:16px">
      <div class="ck-panel-head">
        <h3>${esc(t('ki.section.prices', { stand }))}</h3>
        <span class="ck-badge">${esc(t('ki.disclaimer'))}</span>
      </div>
      <div class="ck-table-wrap">
        <table class="ck-table">
          <thead>
            <tr>
              <th>${esc(t('ki.col.model'))}</th>
              <th>${esc(t('ki.col.resource'))}</th>
              <th>${esc(t('ki.col.billingType'))}</th>
              <th>${esc(t('ki.col.inputRate'))}</th>
              <th>${esc(t('ki.col.outputRate'))}</th>
              <th>${esc(t('ki.col.audioRate'))}</th>
              <th>${esc(t('ki.col.retires'))}</th>
              <th>${esc(t('ki.col.note'))}</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(models).length === 0
              ? `<tr><td colspan="8"><p class="empty">${esc(t('cust.noKiData'))}</p></td></tr>`
              : Object.entries(models).map(([name, spec]) => {
                  const days = daysUntil(spec.retiresOn);
                  return `
                    <tr>
                      <td><code>${esc(name)}</code></td>
                      <td><code>${esc(spec.resource)}</code></td>
                      <td>${esc(spec.billingType)}</td>
                      <td>${spec.inputPerMtokEur != null ? esc(fmtEur(spec.inputPerMtokEur, 4)) : '—'}</td>
                      <td>${spec.outputPerMtokEur != null ? esc(fmtEur(spec.outputPerMtokEur, 4)) : '—'}</td>
                      <td>${spec.audioPerMinuteEur != null ? esc(fmtEur(spec.audioPerMinuteEur, 4)) : '—'}</td>
                      <td>
                        ${spec.retiresOn
                          ? `<span>${esc(spec.retiresOn)}</span> ${days !== null && days <= 120 ? `<span class="ck-badge sev-${days <= 45 ? 'critical' : 'warn'}">${esc(days)}d</span>` : ''}`
                          : '—'}
                      </td>
                      <td>${spec.reasoningIncludedInOutput ? `<span class="hint">${esc(t('ki.reasoningIncluded'))}</span>` : '—'}</td>
                    </tr>
                  `;
                }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;

  $('#kiMonthPicker', root)?.addEventListener('change', (e) => {
    selectedMonth = e.target.value || currentMonthUtc();
    mountKiCosts();
  });
  $('#kiRefreshBtn', root)?.addEventListener('click', () => mountKiCosts());

  root.querySelectorAll('th.ck-sort').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (!col) return;
      if (sortCol === col) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
      else { sortCol = col; sortDir = col === 'name' ? 'asc' : 'desc'; }
      renderKiCosts();
    });
  });
}

export async function mountKiCosts() {
  if (!unsubLang) {
    unsubLang = onLangChange(() => {
      const el = $('#view-ki-costs');
      if (el && !el.hidden) renderKiCosts();
    });
  }
  const root = $('#view-ki-costs');
  if (root && !lastResponse) {
    root.innerHTML = `<p class="empty">${esc(t('auth.loading'))}</p>`;
  }
  lastResponse = await getKiUsage(selectedMonth);
  renderKiCosts();
}
