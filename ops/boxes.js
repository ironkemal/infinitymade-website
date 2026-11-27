// Praxura Cockpit — Boxen & KI-Fabrik (Merkez Admin-Bridge UI)
import { $, esc, toast, fail, fmtDateTime, openModal, myRole } from './app.js?v=20261127d';
import { t, onLangChange } from './i18n.js?v=20261127d';
import {
  merkezStatus,
  merkezNewCode,
  merkezRebindCode,
  merkezUpdateBoxKi,
  merkezSetKiGlobal,
  merkezIptalBox,
} from './cockpit-api.js?v=20261127d';

const SILENT_THRESHOLD_SEC = 24 * 3600;

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

function fmtUnix(sec) {
  if (!sec || !Number.isFinite(Number(sec))) return '—';
  return fmtDateTime(Number(sec) * 1000);
}

function isBoxSilent(box, nowSec) {
  if (!box || box.status !== 'aktiv') return false;
  if (!box.ip_am) return true;
  return (nowSec - Number(box.ip_am)) > SILENT_THRESHOLD_SEC;
}

function openOneTimeCodeModal({ title, code, gueltigBis }) {
  openModal({
    title,
    bodyHTML: `
      <div class="ck-banner ck-banner-warn" style="margin-bottom:0">${esc(t('box.modal.codeWarn'))}</div>
      <div class="box-code-display">
        <code id="boxGeneratedCode">${esc(code)}</code>
      </div>
      <div class="hint">${esc(t('box.modal.codeExpires', { dt: fmtUnix(gueltigBis) }))}</div>
    `,
    actions: [
      {
        label: t('box.modal.copy'),
        kind: 'primary',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(code);
            toast(t('box.modal.copied'));
          } catch {
            toast(code);
          }
          return false;
        },
      },
      { label: t('common.close'), onClick: () => true },
    ],
  });
}

async function handleCreateSetupCode() {
  const res = await merkezNewCode();
  if (!res.ok) {
    return fail('Einrichtungscode', new Error(res.reason || 'Fehler'));
  }
  openOneTimeCodeModal({
    title: t('box.modal.codeTitle'),
    code: res.data.code,
    gueltigBis: res.data.gueltigBis,
  });
  await mountBoxes();
}

function openRebindModal(name) {
  openModal({
    title: t('box.modal.rebindConfirmTitle'),
    bodyHTML: `<p style="margin:0;color:var(--text-dim)">${esc(t('box.modal.rebindConfirmText', { name }))}</p>`,
    actions: [
      { label: t('common.cancel'), onClick: () => true },
      {
        label: t('box.modal.rebindBtn'),
        kind: 'primary',
        onClick: async () => {
          const res = await merkezRebindCode(name);
          if (!res.ok) {
            fail('Rebind-Code', new Error(res.reason || 'Fehler'));
            return false;
          }
          openOneTimeCodeModal({
            title: t('box.modal.rebindTitle', { name }),
            code: res.data.code,
            gueltigBis: res.data.gueltigBis,
          });
          await mountBoxes();
          return false;
        },
      },
    ],
  });
}

function openLimitModal(box, stdLimit) {
  const currentVal = box.ki_limit != null ? String(box.ki_limit) : '';
  openModal({
    title: t('box.modal.limitTitle', { name: box.name }),
    bodyHTML: `
      <label class="fld">
        <span>${esc(t('box.modal.limitLabel'))}</span>
        <input type="number" id="boxLimitInput" min="1" max="1000000" step="1" value="${esc(currentVal)}" placeholder="${esc(stdLimit)}">
      </label>
      <p class="hint" style="margin:0">${esc(t('box.modal.limitHint', { std: stdLimit }))}</p>
    `,
    actions: [
      {
        label: t('box.modal.limitReset', { std: stdLimit }),
        onClick: async () => {
          const res = await merkezUpdateBoxKi(box.name, { limit: 'standard' });
          if (!res.ok) {
            fail('Limit', new Error(res.reason || 'Fehler'));
            return false;
          }
          toast(t('box.toast.limitUpdated', { name: box.name }));
          await mountBoxes();
        },
      },
      { label: t('common.cancel'), onClick: () => true },
      {
        label: t('common.save'),
        kind: 'primary',
        onClick: async () => {
          const raw = $('#boxLimitInput')?.value.trim() || '';
          const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN;
          if (!Number.isSafeInteger(n) || n < 1 || n > 1_000_000) {
            toast(t('box.modal.limitInvalid'), true);
            return false;
          }
          const res = await merkezUpdateBoxKi(box.name, { limit: n });
          if (!res.ok) {
            fail('Limit', new Error(res.reason || 'Fehler'));
            return false;
          }
          toast(t('box.toast.limitUpdated', { name: box.name }));
          await mountBoxes();
        },
      },
    ],
  });
}

function openGlobalKiModal(currentWert) {
  const targetWert = currentWert === 'an' ? 'aus' : 'an';
  const expectedPhrase = targetWert === 'an' ? 'KI-GLOBAL-AN' : 'KI-GLOBAL-AUS';
  const desc = targetWert === 'an' ? t('box.modal.globalDescOn') : t('box.modal.globalDescOff');

  openModal({
    title: t('box.modal.globalTitle'),
    bodyHTML: `
      <p style="margin:0;color:var(--text-dim)">${esc(desc)}</p>
      <div class="box-phrase-target"><code>${esc(expectedPhrase)}</code></div>
      <label class="fld">
        <span>${esc(t('box.modal.phraseLabel'))}</span>
        <input type="text" id="boxGlobalPhrase" autocomplete="off" placeholder="${esc(expectedPhrase)}">
      </label>
    `,
    actions: [
      { label: t('common.cancel'), onClick: () => true },
      {
        label: targetWert === 'an' ? t('box.globalToggleOn') : t('box.globalToggleOff'),
        kind: targetWert === 'an' ? 'primary' : 'danger',
        onClick: async () => {
          const typed = $('#boxGlobalPhrase')?.value.trim() || '';
          if (typed !== expectedPhrase) {
            toast(t('box.modal.phraseMismatch', { phrase: expectedPhrase }), true);
            return false;
          }
          const res = await merkezSetKiGlobal(targetWert, typed);
          if (!res.ok) {
            fail('KI Global', new Error(res.reason || 'Fehler'));
            return false;
          }
          toast(t('box.toast.globalUpdated', { wert: targetWert.toUpperCase() }));
          await mountBoxes();
        },
      },
    ],
  });
}

function openIptalModal(name) {
  const expectedPhrase = `IPTAL-${name}`;
  openModal({
    title: t('box.modal.iptalTitle', { name }),
    bodyHTML: `
      <p style="margin:0;color:var(--text-dim)">${esc(t('box.modal.iptalDesc'))}</p>
      <div class="box-phrase-target"><code>${esc(expectedPhrase)}</code></div>
      <label class="fld">
        <span>${esc(t('box.modal.phraseLabel'))}</span>
        <input type="text" id="boxIptalPhrase" autocomplete="off" placeholder="${esc(expectedPhrase)}">
      </label>
    `,
    actions: [
      { label: t('common.cancel'), onClick: () => true },
      {
        label: t('box.btn.iptal'),
        kind: 'danger',
        onClick: async () => {
          const typed = $('#boxIptalPhrase')?.value.trim() || '';
          if (typed !== expectedPhrase) {
            toast(t('box.modal.phraseMismatch', { phrase: expectedPhrase }), true);
            return false;
          }
          const res = await merkezIptalBox(name, typed);
          if (!res.ok) {
            fail('Iptal', new Error(res.reason || 'Fehler'));
            return false;
          }
          toast(t('box.toast.iptalDone', { name }));
          await mountBoxes();
        },
      },
    ],
  });
}

function renderBoxes() {
  const root = $('#view-boxes');
  if (!root || !lastResponse) return;

  const role = myRole();
  const isFounder = role === 'founder';
  const res = lastResponse;
  const data = res.ok ? res.data : null;

  let banner = '';
  if (!res.ok) {
    const isNotConf = res.reason === 'NOT_CONFIGURED' || res.reason === 'MERKEZ_BRIDGE_NOT_CONFIGURED';
    const msg = isNotConf
      ? t('box.notConfigured')
      : t('box.offline', { reason: res.reason || 'offline' });
    banner = `<div class="ck-banner ${isNotConf ? 'ck-banner-info' : 'ck-banner-warn'}">${esc(msg)}</div>`;
  }

  const kiGlobal = data?.kiGlobal === 'an' ? 'an' : 'aus';
  const stdLimit = Number(data?.monatsLimitStandard) || 600;
  const monat = data?.monat || '—';
  const boxes = Array.isArray(data?.boxes) ? data.boxes : [];
  const adminlog = Array.isArray(data?.adminlogRecent) ? data.adminlogRecent : [];

  const activeCount = boxes.filter((b) => b.status === 'aktiv').length;
  const revokedCount = boxes.filter((b) => b.status === 'iptal').length;
  const kiEnabledCount = boxes.filter((b) => b.status === 'aktiv' && b.ki_status === 'aktiv').length;
  const totalJetons = boxes.reduce((s, b) => s + (Number(b.ki_ausgaben_monat) || 0), 0);
  const totalCalls7d = boxes.reduce((s, b) => s + (Number(b.letzte_berichte?.calls) || 0), 0);
  const totalTokens7d = boxes.reduce((s, b) => s + (Number(b.letzte_berichte?.total_tokens) || 0), 0);
  const totalCost7d = boxes.reduce((s, b) => s + (Number(b.letzte_berichte?.cost_eur) || 0), 0);

  const nowSec = Math.floor(Date.now() / 1000);

  root.innerHTML = `
    <div class="ck-head">
      <div>
        <h2 class="ck-title">${esc(t('box.title'))}</h2>
        <p class="ck-sub">${esc(t('box.subtitle'))}</p>
      </div>
      <div class="ck-head-actions">
        ${data ? `
          <span class="ck-badge ${kiGlobal === 'an' ? 'sev-ok' : 'sev-critical'}" id="boxGlobalPill">
            ${esc(t('box.globalLabel'))}: ${esc(kiGlobal === 'an' ? t('box.globalOn') : t('box.globalOff'))}
          </span>
        ` : ''}
        ${data && isFounder ? `
          <button class="btn ${kiGlobal === 'an' ? 'btn-danger' : 'btn-ghost'}" id="boxGlobalToggleBtn">
            ${esc(kiGlobal === 'an' ? t('box.globalToggleOff') : t('box.globalToggleOn'))}
          </button>
        ` : ''}
        <button class="btn btn-primary" id="boxNewCodeBtn" ${!data ? 'disabled' : ''}>${esc(t('box.newCodeBtn'))}</button>
        <button class="btn btn-ghost" id="boxRefreshBtn">${esc(t('common.refresh'))}</button>
      </div>
    </div>

    ${banner}

    <div class="ck-kpi-grid">
      <div class="ck-kpi">
        <div class="ck-kpi-label">${esc(t('box.kpi.total'))}</div>
        <div class="ck-kpi-val">${data ? esc(fmtInt(boxes.length)) : '—'}</div>
        <div class="ck-kpi-sub">${data ? esc(t('box.kpi.totalSub', { active: activeCount, revoked: revokedCount })) : '—'}</div>
      </div>

      <div class="ck-kpi ${data && kiGlobal === 'an' ? 'is-ok' : 'is-warn'}">
        <div class="ck-kpi-label">${esc(t('box.kpi.kiEnabled'))}</div>
        <div class="ck-kpi-val">${data ? esc(fmtInt(kiEnabledCount)) : '—'}</div>
        <div class="ck-kpi-sub">${data ? esc(t('box.kpi.kiEnabledSub', { global: kiGlobal === 'an' ? t('box.globalOn') : t('box.globalOff') })) : '—'}</div>
      </div>

      <div class="ck-kpi">
        <div class="ck-kpi-label">${esc(t('box.kpi.jetonsMonth', { month: monat }))}</div>
        <div class="ck-kpi-val">${data ? esc(fmtInt(totalJetons)) : '—'}</div>
        <div class="ck-kpi-sub">${data ? esc(t('box.kpi.jetonsSub', { limit: fmtInt(stdLimit) })) : '—'}</div>
      </div>

      <div class="ck-kpi">
        <div class="ck-kpi-label">${esc(t('box.kpi.cost7d'))}</div>
        <div class="ck-kpi-val">${data ? esc(fmtEur(totalCost7d, 2)) : '—'}</div>
        <div class="ck-kpi-sub">${data ? esc(t('box.kpi.cost7dSub', { calls: fmtInt(totalCalls7d), tokens: fmtInt(totalTokens7d) })) : '—'}</div>
      </div>
    </div>

    <div class="ck-table-wrap">
      <table class="ck-table">
        <thead>
          <tr>
            <th>${esc(t('box.col.name'))}</th>
            <th>${esc(t('box.col.status'))}</th>
            <th>${esc(t('box.col.network'))}</th>
            <th>${esc(t('box.col.ki'))}</th>
            <th>${esc(t('box.col.jetons'))}</th>
            <th>${esc(t('box.col.reports7d'))}</th>
            <th>${esc(t('box.col.actions'))}</th>
          </tr>
        </thead>
        <tbody>
          ${boxes.length === 0
            ? `<tr><td colspan="7"><p class="empty">${esc(t('box.empty'))}</p></td></tr>`
            : boxes.map((b) => {
                const isAktiv = b.status === 'aktiv';
                const kiOn = b.ki_status === 'aktiv';
                const silent = isBoxSilent(b, nowSec);
                const effLimit = b.ki_limit != null ? Number(b.ki_limit) : stdLimit;
                const used = Number(b.ki_ausgaben_monat) || 0;
                const pct = effLimit > 0 ? Math.min(100, Math.round((used / effLimit) * 100)) : 0;
                const rep = b.letzte_berichte || {};

                return `
                  <tr class="${silent ? 'box-row-silent' : ''}">
                    <td>
                      <div class="ck-cell-main"><code>${esc(b.name)}</code></div>
                      <div class="ck-cell-sub">
                        <span><code>${esc(String(b.box_id || '').slice(0, 12))}…</code></span>
                        <span>${esc(fmtUnix(b.erstellt))}</span>
                      </div>
                    </td>
                    <td>
                      <span class="ck-badge ${isAktiv ? 'sev-ok' : 'sev-critical'}">${esc(t(`box.status.${b.status}`))}</span>
                      ${b.iptal_am ? `<div class="ck-cell-sub">${esc(fmtUnix(b.iptal_am))}</div>` : ''}
                    </td>
                    <td>
                      <div class="ck-cell-main">${b.lan_ip ? `<code>${esc(b.lan_ip)}</code>` : '—'}</div>
                      <div class="ck-cell-sub">
                        ${b.ip_am ? `<span>${esc(fmtUnix(b.ip_am))}</span>` : `<span>${esc(t('box.neverContact'))}</span>`}
                        ${silent ? `<span class="ck-badge sev-warn">${esc(t('box.silentWarn'))}</span>` : ''}
                      </div>
                    </td>
                    <td>
                      <button
                        class="btn ck-btn-sm ${kiOn ? 'box-ki-on' : 'btn-ghost'}"
                        data-toggle-ki="${esc(b.name)}"
                        data-next-ki="${kiOn ? 'aus' : 'aktiv'}"
                        ${!isAktiv ? 'disabled' : ''}
                      >${esc(t(`box.ki.${b.ki_status || 'aus'}`))}</button>
                    </td>
                    <td>
                      <div class="box-jeton-cell" data-edit-limit="${esc(b.name)}" role="button" tabindex="0">
                        <div class="box-jeton-top">
                          <strong>${esc(fmtInt(used))} / ${esc(fmtInt(effLimit))}</strong>
                          <span class="hint">${esc(b.ki_limit != null ? t('box.limitCustom') : t('box.limitStd', { n: stdLimit }))}</span>
                        </div>
                        <div class="ck-bar-track">
                          <div class="ck-bar-fill ${pct >= 90 ? 'res-se-legacy' : 'res-de-text'}" style="width:${pct}%"></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="ck-cell-main">${esc(fmtEur(rep.cost_eur, 4))}</div>
                      <div class="ck-cell-sub">${esc(fmtInt(rep.total_tokens))} tok · ${esc(fmtInt(rep.calls))} calls</div>
                    </td>
                    <td>
                      <div class="box-actions">
                        <button class="btn btn-ghost ck-btn-sm" data-rebind="${esc(b.name)}" ${!isAktiv ? 'disabled' : ''}>${esc(t('box.btn.rebind'))}</button>
                        <button class="btn btn-ghost ck-btn-sm" data-edit-limit="${esc(b.name)}">${esc(t('box.btn.limit'))}</button>
                        ${isFounder ? `<button class="btn btn-danger ck-btn-sm" data-iptal="${esc(b.name)}" ${!isAktiv ? 'disabled' : ''}>${esc(t('box.btn.iptal'))}</button>` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
        </tbody>
      </table>
    </div>

    <details class="ck-panel box-adminlog" style="margin-top:16px">
      <summary class="box-adminlog-summary">
        <span>${esc(t('box.adminlog.title', { n: adminlog.length }))}</span>
      </summary>
      <div class="ck-table-wrap" style="margin-top:12px">
        <table class="ck-table">
          <thead>
            <tr>
              <th>${esc(t('box.adminlog.time'))}</th>
              <th>${esc(t('box.adminlog.actor'))}</th>
              <th>${esc(t('box.adminlog.action'))}</th>
              <th>${esc(t('box.adminlog.target'))}</th>
              <th>${esc(t('box.adminlog.details'))}</th>
            </tr>
          </thead>
          <tbody>
            ${adminlog.length === 0
              ? `<tr><td colspan="5"><p class="empty">${esc(t('box.adminlog.empty'))}</p></td></tr>`
              : adminlog.map((row) => `
                  <tr>
                    <td>${esc(fmtUnix(row.zeit))}</td>
                    <td><code>${esc(row.akteur)}</code></td>
                    <td><span class="ck-badge">${esc(row.aktion)}</span></td>
                    <td>${row.ziel ? `<code>${esc(row.ziel)}</code>` : '—'}</td>
                    <td>${row.details ? `<code>${esc(row.details)}</code>` : '—'}</td>
                  </tr>
                `).join('')}
          </tbody>
        </table>
      </div>
    </details>
  `;

  $('#boxRefreshBtn', root)?.addEventListener('click', () => mountBoxes());
  $('#boxNewCodeBtn', root)?.addEventListener('click', () => handleCreateSetupCode());
  $('#boxGlobalToggleBtn', root)?.addEventListener('click', () => openGlobalKiModal(kiGlobal));

  root.querySelectorAll('[data-toggle-ki]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.getAttribute('data-toggle-ki');
      const nextStatus = btn.getAttribute('data-next-ki');
      if (!name || !nextStatus) return;
      btn.disabled = true;
      const upd = await merkezUpdateBoxKi(name, { status: nextStatus });
      if (!upd.ok) {
        btn.disabled = false;
        return fail('KI-Status', new Error(upd.reason || 'Fehler'));
      }
      toast(t('box.toast.kiUpdated', { name }));
      await mountBoxes();
    });
  });

  root.querySelectorAll('[data-edit-limit]').forEach((el) => {
    const trigger = () => {
      const name = el.getAttribute('data-edit-limit');
      const box = boxes.find((x) => x.name === name);
      if (box) openLimitModal(box, stdLimit);
    };
    el.addEventListener('click', trigger);
    if (el.tagName !== 'BUTTON') {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          trigger();
        }
      });
    }
  });

  root.querySelectorAll('[data-rebind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-rebind');
      if (name) openRebindModal(name);
    });
  });

  root.querySelectorAll('[data-iptal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-iptal');
      if (name) openIptalModal(name);
    });
  });
}

window.__praxuraNewBoxCode = handleCreateSetupCode;

export async function mountBoxes() {
  if (!unsubLang) {
    unsubLang = onLangChange(() => {
      const el = $('#view-boxes');
      if (el && !el.hidden) renderBoxes();
    });
  }
  const root = $('#view-boxes');
  if (root && !lastResponse) {
    root.innerHTML = `<p class="empty">${esc(t('auth.loading'))}</p>`;
  }
  lastResponse = await merkezStatus();
  renderBoxes();
}
