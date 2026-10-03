/**
 * Scoped frontend paper receipt (Papier-Empfangsnachweis) for recorded 78040 treatments.
 * Only for non-cancelled 78040 treatments. Owner attests paper completeness;
 * no digital patient signature, retain original paper, no technical DTA receipt.
 */

let _mountSequence = 0;

function safeEscape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEscape(ctx) {
  if (ctx && typeof ctx.escapeHtml === 'function') {
    return (s) => ctx.escapeHtml(s);
  }
  return safeEscape;
}

/**
 * Pure eligibility check: treatment must be non-cancelled and contain exact '78040' in hpnr_codes.
 * Does not mutate the treatment object.
 */
export function ist78040EmpfangsnachweisEligible(beh) {
  if (!beh || typeof beh !== 'object') return false;
  if (beh.storniert_am) return false;
  if (!Array.isArray(beh.hpnr_codes)) return false;
  return beh.hpnr_codes.includes('78040');
}

/**
 * Pure status helper: maps server event to readable German status and attributes.
 * DB statuses recognized: only bestaetigt, widerrufen, or null/other -> ungeprueft.
 */
export function getEmpfangsnachweisStatusInfo(nachweis) {
  if (!nachweis || typeof nachweis !== 'object' || !nachweis.status) {
    return {
      status: 'ungeprueft',
      label: 'Papiernachweis: ungeprüft',
      initials: null,
      isConfirmed: false,
      isWithdrawn: false,
    };
  }
  if (nachweis.status === 'bestaetigt') {
    const initials = typeof nachweis.therapeuteninitialen === 'string'
      ? nachweis.therapeuteninitialen.trim()
      : '';
    return {
      status: 'bestaetigt',
      label: initials ? `Papiernachweis geprüft (${initials})` : 'Papiernachweis geprüft',
      initials,
      isConfirmed: true,
      isWithdrawn: false,
    };
  }
  if (nachweis.status === 'widerrufen') {
    return {
      status: 'widerrufen',
      label: 'Papiernachweis widerrufen',
      initials: null,
      isConfirmed: false,
      isWithdrawn: true,
    };
  }
  return {
    status: 'ungeprueft',
    label: 'Papiernachweis: ungeprüft',
    initials: null,
    isConfirmed: false,
    isWithdrawn: false,
  };
}

/**
 * Renders the host container HTML for an eligible treatment in the main history cell.
 * Returns empty string if treatment is not eligible.
 * Fails safe with proper HTML escaping even if ctx.escapeHtml is absent.
 */
export function renderEmpfangsnachweisHost(beh, ctx) {
  if (!ist78040EmpfangsnachweisEligible(beh)) return '';
  const escape = getEscape(ctx);
  const behId = escape(beh.id);
  return `<div class="podo-empfangsnachweis-host" data-beh-id="${behId}" style="margin-top:6px;font-size:11px;padding:6px 8px;border-radius:6px;background:var(--bg-card-solid,#1f2937);border:1px solid var(--border,#374151);color:var(--text-main,#f9fafb);">
    <div class="podo-nachweis-status-line" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
      <span class="podo-nachweis-badge" style="color:var(--text-muted,#9ca3af);">Papiernachweis: ungeprüft</span>
    </div>
    <div style="font-size:10px;color:var(--text-muted,#9ca3af);margin-top:4px;line-height:1.3;">
      Praxisinhaber bestätigt die Vollständigkeit des Papiernachweises (keine digitale Patientenunterschrift; Originalpapier aufbewahren, kein technischer DTA-Empfangsnachweis).
    </div>
  </div>`;
}

function validateNachweisEnvelope(data, beh, { isGet = false, expectedStatus = null } = {}) {
  if (!data || typeof data !== 'object' || !Object.prototype.hasOwnProperty.call(data, 'nachweis')) {
    return false;
  }
  const nachweis = data.nachweis;
  if (nachweis === null) {
    return isGet;
  }
  if (!nachweis || typeof nachweis !== 'object' || Array.isArray(nachweis)) {
    return false;
  }
  if (!['bestaetigt', 'widerrufen'].includes(nachweis.status)) {
    return false;
  }
  if (expectedStatus && nachweis.status !== expectedStatus) {
    return false;
  }
  if (nachweis.behandlung_id !== beh?.id) {
    return false;
  }
  if (nachweis.hpnr_code !== '78040') {
    return false;
  }
  const behDatum = String(beh?.behandlungsdatum ?? '').trim();
  const nDatum = String(nachweis.behandlungsdatum ?? '').trim();
  if (!behDatum || !nDatum || nachweis.behandlungsdatum !== beh.behandlungsdatum) {
    return false;
  }
  if (nachweis.status === 'bestaetigt') {
    if (typeof nachweis.therapeuteninitialen !== 'string') {
      return false;
    }
    const initials = nachweis.therapeuteninitialen.trim();
    if (initials.length < 1 || initials.length > 16) {
      return false;
    }
  }
  return true;
}

/**
 * Mounts interactive behavior on a single host element.
 */
export function mountEmpfangsnachweis(host, beh, ctx, fetchFn = globalThis.fetch) {
  if (!host || !beh || !ist78040EmpfangsnachweisEligible(beh)) return;

  _mountSequence++;
  const currentMountId = _mountSequence;
  host._mountId = currentMountId;
  let pending = false;
  let loadRequestId = 0;

  const escape = getEscape(ctx);
  let currentNachweis = null;

  function isStale() {
    return host._mountId !== currentMountId || host.isConnected === false;
  }

  function isOwner() {
    const profile = ctx?.getProfile ? ctx.getProfile() : null;
    return profile?.role === 'owner';
  }

  function renderDisplay() {
    if (isStale()) return;
    const statusInfo = getEmpfangsnachweisStatusInfo(currentNachweis);
    const owner = isOwner();

    let badgeHtml = '';
    if (statusInfo.status === 'bestaetigt') {
      badgeHtml = `<span class="podo-nachweis-badge" style="color:#10b981;font-weight:600;">Papiernachweis geprüft (${escape(statusInfo.initials || '')})</span>`;
    } else if (statusInfo.status === 'widerrufen') {
      badgeHtml = `<span class="podo-nachweis-badge" style="color:#f59e0b;font-weight:600;">Papiernachweis widerrufen</span>`;
    } else {
      badgeHtml = `<span class="podo-nachweis-badge" style="color:var(--text-muted,#9ca3af);">Papiernachweis: ungeprüft</span>`;
    }

    let actionBtnsHtml = '';
    if (owner) {
      if (statusInfo.status === 'bestaetigt') {
        actionBtnsHtml = `<div style="display:flex;gap:6px;">
          <button type="button" class="podo-nachweis-btn-start-korrektur" style="background:none;border:1px solid var(--border,#374151);color:var(--text-main,#f9fafb);font-size:10px;padding:2px 6px;border-radius:4px;cursor:pointer;">Korrigieren</button>
          <button type="button" class="podo-nachweis-btn-start-widerruf" style="background:none;border:1px solid var(--border,#374151);color:#ef4444;font-size:10px;padding:2px 6px;border-radius:4px;cursor:pointer;">Widerrufen</button>
        </div>`;
      } else if (statusInfo.status === 'widerrufen') {
        actionBtnsHtml = `<button type="button" class="podo-nachweis-btn-start-confirm" style="background:none;border:1px solid var(--border,#374151);color:var(--text-main,#f9fafb);font-size:10px;padding:2px 6px;border-radius:4px;cursor:pointer;">Erneut prüfen</button>`;
      } else {
        actionBtnsHtml = `<button type="button" class="podo-nachweis-btn-start-confirm" style="background:none;border:1px solid var(--border,#374151);color:var(--text-main,#f9fafb);font-size:10px;padding:2px 6px;border-radius:4px;cursor:pointer;">Papiernachweis prüfen</button>`;
      }
    }

    host.innerHTML = `<div class="podo-nachweis-status-line" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
      ${badgeHtml}
      ${actionBtnsHtml}
    </div>
    <div style="font-size:10px;color:var(--text-muted,#9ca3af);margin-top:4px;line-height:1.3;">
      Praxisinhaber bestätigt die Vollständigkeit des Papiernachweises (keine digitale Patientenunterschrift; Originalpapier aufbewahren, kein technischer DTA-Empfangsnachweis).
    </div>`;

    const btnStartConfirm = host.querySelector('.podo-nachweis-btn-start-confirm');
    if (btnStartConfirm) {
      btnStartConfirm.addEventListener('click', () => renderConfirmForm(''));
    }
    const btnStartKorrektur = host.querySelector('.podo-nachweis-btn-start-korrektur');
    if (btnStartKorrektur) {
      btnStartKorrektur.addEventListener('click', () => renderConfirmForm(statusInfo.initials || ''));
    }
    const btnStartWiderruf = host.querySelector('.podo-nachweis-btn-start-widerruf');
    if (btnStartWiderruf) {
      btnStartWiderruf.addEventListener('click', () => renderWithdrawForm());
    }
  }

  function renderLoadError() {
    if (isStale()) return;
    host.innerHTML = `<div class="podo-nachweis-status-line" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
      <span class="podo-nachweis-badge" style="color:#ef4444;font-weight:600;">Status nicht geladen</span>
      <button type="button" class="podo-nachweis-retry-btn" style="background:none;border:1px solid var(--border,#374151);color:var(--text-muted,#9ca3af);font-size:10px;padding:2px 6px;border-radius:4px;cursor:pointer;">Wiederholen</button>
    </div>
    <div style="font-size:10px;color:var(--text-muted,#9ca3af);margin-top:4px;line-height:1.3;">
      Praxisinhaber bestätigt die Vollständigkeit des Papiernachweises (keine digitale Patientenunterschrift; Originalpapier aufbewahren, kein technischer DTA-Empfangsnachweis).
    </div>`;

    const retryBtn = host.querySelector('.podo-nachweis-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => loadStatus());
    }
  }

  function renderConfirmForm(initialInitials = '') {
    if (isStale()) return;
    host.innerHTML = `<form class="podo-nachweis-confirm-form" style="margin-top:2px;display:flex;flex-direction:column;gap:6px;">
      <div style="font-size:10px;color:var(--text-muted,#9ca3af);line-height:1.3;">
        Praxisinhaber bestätigt die Vollständigkeit des Papiernachweises (keine digitale Patientenunterschrift; Originalpapier aufbewahren, kein technischer DTA-Empfangsnachweis).
      </div>
      <div class="podo-nachweis-form-error" style="display:none;color:#ef4444;font-size:10px;"></div>
      <div>
        <input type="text" class="podo-nachweis-initials-input" maxlength="16" placeholder="Therapeuteninitialen (max. 16 Zeichen)" value="${escape(initialInitials)}" style="width:100%;box-sizing:border-box;font-size:11px;padding:4px 6px;border:1px solid var(--border,#374151);border-radius:4px;background:var(--bg-main,#111827);color:var(--text-main,#f9fafb);">
      </div>
      <label style="display:flex;align-items:flex-start;gap:6px;font-size:10px;color:var(--text-main,#f9fafb);cursor:pointer;line-height:1.3;">
        <input type="checkbox" class="podo-nachweis-checkbox" style="margin-top:2px;">
        <span>Originalpapier geprüft: Leistung, Datum, Therapeuteninitialen und Patientenunterschrift vorhanden.</span>
      </label>
      <div style="display:flex;gap:6px;margin-top:2px;">
        <button type="submit" class="podo-nachweis-submit-confirm-btn" style="background:var(--primary,#2563eb);color:#fff;border:none;font-size:10px;padding:3px 8px;border-radius:4px;cursor:pointer;">Bestätigen</button>
        <button type="button" class="podo-nachweis-cancel-btn" style="background:none;border:1px solid var(--border,#374151);color:var(--text-muted,#9ca3af);font-size:10px;padding:3px 8px;border-radius:4px;cursor:pointer;">Abbrechen</button>
      </div>
    </form>`;

    const form = host.querySelector('.podo-nachweis-confirm-form');
    const submitBtn = host.querySelector('.podo-nachweis-submit-confirm-btn');
    const cancelBtn = host.querySelector('.podo-nachweis-cancel-btn');

    if (form) {
      form.addEventListener('submit', handleConfirmSubmit);
    }
    if (submitBtn) {
      submitBtn.addEventListener('click', handleConfirmSubmit);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (isStale() || pending) return;
        renderDisplay();
      });
    }
  }

  function renderWithdrawForm() {
    if (isStale()) return;
    host.innerHTML = `<form class="podo-nachweis-withdraw-form" style="margin-top:2px;display:flex;flex-direction:column;gap:6px;">
      <div style="font-size:10px;color:var(--text-muted,#9ca3af);line-height:1.3;">
        Praxisinhaber bestätigt die Vollständigkeit des Papiernachweises (keine digitale Patientenunterschrift; Originalpapier aufbewahren, kein technischer DTA-Empfangsnachweis).
      </div>
      <div class="podo-nachweis-form-error" style="display:none;color:#ef4444;font-size:10px;"></div>
      <div>
        <textarea class="podo-nachweis-grund-input" maxlength="500" placeholder="Grund für den Widerruf (1–500 Zeichen)..." rows="2" style="width:100%;box-sizing:border-box;font-size:11px;padding:4px 6px;border:1px solid var(--border,#374151);border-radius:4px;background:var(--bg-main,#111827);color:var(--text-main,#f9fafb);resize:vertical;"></textarea>
      </div>
      <div style="display:flex;gap:6px;margin-top:2px;">
        <button type="submit" class="podo-nachweis-submit-withdraw-btn" style="background:#ef4444;color:#fff;border:none;font-size:10px;padding:3px 8px;border-radius:4px;cursor:pointer;">Widerruf speichern</button>
        <button type="button" class="podo-nachweis-cancel-btn" style="background:none;border:1px solid var(--border,#374151);color:var(--text-muted,#9ca3af);font-size:10px;padding:3px 8px;border-radius:4px;cursor:pointer;">Abbrechen</button>
      </div>
    </form>`;

    const form = host.querySelector('.podo-nachweis-withdraw-form');
    const submitBtn = host.querySelector('.podo-nachweis-submit-withdraw-btn');
    const cancelBtn = host.querySelector('.podo-nachweis-cancel-btn');

    if (form) {
      form.addEventListener('submit', handleWithdrawSubmit);
    }
    if (submitBtn) {
      submitBtn.addEventListener('click', handleWithdrawSubmit);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (isStale() || pending) return;
        renderDisplay();
      });
    }
  }

  async function executePost(payload, successMsg, toastType, submitBtn, cancelBtn, showFormError) {
    pending = true;
    if (submitBtn) submitBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;

    if (!isOwner()) {
      pending = false;
      if (submitBtn) submitBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      showFormError(payload.status === 'widerrufen'
        ? 'Nur Praxisinhaber dürfen den Nachweis widerrufen.'
        : 'Nur Praxisinhaber dürfen den Nachweis erfassen.');
      return;
    }

    let token = null;
    try {
      const sessionRes = await ctx?.supabase?.auth?.getSession?.();
      token = sessionRes?.data?.session?.access_token;
    } catch (err) {}

    // Stale/detached mount check after awaiting session
    if (isStale()) return;

    // Role rechecked after session await
    if (!isOwner()) {
      if (isStale()) return;
      pending = false;
      if (submitBtn) submitBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      showFormError(payload.status === 'widerrufen'
        ? 'Nur Praxisinhaber dürfen den Nachweis widerrufen.'
        : 'Nur Praxisinhaber dürfen den Nachweis erfassen.');
      return;
    }

    if (!token || !ctx?.apiBase) {
      if (isStale()) return;
      pending = false;
      if (submitBtn) submitBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      showFormError('Authentifizierung fehlt. Bitte erneut anmelden.');
      return;
    }

    const base = ctx.apiBase.replace(/\/+$/, '');
    const url = `${base}/billing/podologie/behandlungen/${encodeURIComponent(beh.id)}/empfangsnachweis`;

    try {
      const res = await fetchFn(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res || !res.ok) {
        throw new Error(`HTTP ${res?.status || 'error'}`);
      }

      const data = await res.json();
      if (isStale()) return;
      pending = false;

      if (!validateNachweisEnvelope(data, beh, { isGet: false, expectedStatus: payload.status })) {
        throw new Error('Ungültige Antwort vom Server.');
      }

      const returnedNachweis = data.nachweis;

      if (ctx?.showToast) {
        ctx.showToast(successMsg, toastType);
      }

      currentNachweis = returnedNachweis;
      renderDisplay();
    } catch (err) {
      if (isStale()) return;
      pending = false;
      if (submitBtn) submitBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      showFormError(payload.status === 'widerrufen'
        ? 'Fehler beim Widerrufen. Bitte wiederholen.'
        : 'Fehler beim Speichern. Bitte wiederholen.');
    }
  }

  async function handleConfirmSubmit(e) {
    if (e?.preventDefault) e.preventDefault();
    if (isStale() || pending) return;

    const initialsInput = host.querySelector('.podo-nachweis-initials-input');
    const checkbox = host.querySelector('.podo-nachweis-checkbox');
    const errorEl = host.querySelector('.podo-nachweis-form-error');
    const submitBtn = host.querySelector('.podo-nachweis-submit-confirm-btn');
    const cancelBtn = host.querySelector('.podo-nachweis-cancel-btn');

    function showFormError(msg) {
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
      }
    }

    const initials = (initialsInput ? initialsInput.value : '').trim();
    if (!initials || initials.length > 16) {
      showFormError('Therapeuteninitialen erforderlich (1–16 Zeichen).');
      return;
    }

    if (!checkbox || !checkbox.checked) {
      showFormError('Bitte bestätigen Sie die Prüfung des Originalpapiers.');
      return;
    }

    await executePost(
      { status: 'bestaetigt', therapeuteninitialen: initials },
      'Papiernachweis erfolgreich bestätigt.',
      'success',
      submitBtn,
      cancelBtn,
      showFormError
    );
  }

  async function handleWithdrawSubmit(e) {
    if (e?.preventDefault) e.preventDefault();
    if (isStale() || pending) return;

    const grundInput = host.querySelector('.podo-nachweis-grund-input');
    const errorEl = host.querySelector('.podo-nachweis-form-error');
    const submitBtn = host.querySelector('.podo-nachweis-submit-withdraw-btn');
    const cancelBtn = host.querySelector('.podo-nachweis-cancel-btn');

    function showFormError(msg) {
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
      }
    }

    const grund = (grundInput ? grundInput.value : '').trim();
    if (grund.length < 1 || grund.length > 500) {
      showFormError('Grund für den Widerruf erforderlich (1–500 Zeichen).');
      return;
    }

    await executePost(
      { status: 'widerrufen', grund },
      'Papiernachweis widerrufen.',
      'info',
      submitBtn,
      cancelBtn,
      showFormError
    );
  }

  async function loadStatus() {
    loadRequestId++;
    const reqId = loadRequestId;

    let token = null;
    try {
      const sessionRes = await ctx?.supabase?.auth?.getSession?.();
      token = sessionRes?.data?.session?.access_token;
    } catch (err) {}

    if (isStale() || loadRequestId !== reqId) return;

    if (!token || !ctx?.apiBase) {
      renderLoadError();
      return;
    }

    const base = ctx.apiBase.replace(/\/+$/, '');
    const url = `${base}/billing/podologie/behandlungen/${encodeURIComponent(beh.id)}/empfangsnachweis`;

    try {
      const res = await fetchFn(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res || !res.ok) {
        throw new Error(`HTTP ${res?.status || 'error'}`);
      }

      const data = await res.json();
      if (isStale() || loadRequestId !== reqId) return;

      if (!validateNachweisEnvelope(data, beh, { isGet: true })) {
        throw new Error('Ungültiger Nachweis-Status');
      }

      currentNachweis = data.nachweis;
      renderDisplay();
    } catch (err) {
      if (isStale() || loadRequestId !== reqId) return;
      renderLoadError();
    }
  }

  loadStatus();
}

/**
 * Mounts all receipt hosts inside rootEl for documented treatments.
 * Accepts actual documented rows and ctx; avoids guessing APIs.
 */
export function mountEmpfangsnachweise(rootEl, behandlungen, ctx, fetchFn = globalThis.fetch) {
  if (!rootEl || !Array.isArray(behandlungen)) return;
  const behMap = new Map();
  for (const b of behandlungen) {
    if (b && b.id) {
      behMap.set(String(b.id), b);
    }
  }

  const hosts = rootEl.querySelectorAll ? rootEl.querySelectorAll('.podo-empfangsnachweis-host') : [];
  for (const host of hosts) {
    const behId = host.dataset?.behId || host.getAttribute?.('data-beh-id');
    const beh = behMap.get(String(behId));
    if (!beh || !ist78040EmpfangsnachweisEligible(beh)) {
      host.innerHTML = '';
      continue;
    }
    mountEmpfangsnachweis(host, beh, ctx, fetchFn);
  }
}
