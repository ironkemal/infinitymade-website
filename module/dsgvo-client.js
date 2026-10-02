// DSGVO Art. 15/17 im Browser — Export (Blob-Download mit Authorization-Header, nie ?token=) und
// Kontolöschung gegen api-backend/routes/dsgvo.js (KHS K1.4, 02.10.2026).

let isExportRunning = false;
let isDeleteRunning = false;
let activeOpts = null;
let isVerdrahtet = false;

/**
 * Kernfunktion für den Datenexport (ohne DOM/Download-Abhängigkeit, direkt testbar).
 * @param {object} params
 * @param {string} params.apiBase
 * @param {string} params.token
 * @param {Function} [params.fetchImpl]
 * @returns {Promise<Blob>}
 */
export async function exportAbrufen({ apiBase, token, fetchImpl = globalThis.fetch }) {
  if (!token) throw new Error('Nicht angemeldet oder kein Zugriffstoken vorhanden.');
  const base = (apiBase || '').replace(/\/+$/, '');
  const url = `${base}/dsgvo/export`;
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Export fehlgeschlagen (${res.status})`);
  }
  return await res.blob();
}

/**
 * Kernfunktion für das Senden der Kontolöschung (ohne DOM/Modals, direkt testbar).
 * @param {object} params
 * @param {string} params.apiBase
 * @param {string} params.token
 * @param {Function} [params.fetchImpl]
 * @returns {Promise<{ ok: boolean, status: number, data: object }>}
 */
export async function kontoLoeschenSenden({ apiBase, token, fetchImpl = globalThis.fetch }) {
  if (!token) throw new Error('Nicht angemeldet oder kein Zugriffstoken vorhanden.');
  const base = (apiBase || '').replace(/\/+$/, '');
  const url = `${base}/dsgvo/loeschen`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ confirm: 'LÖSCHEN' })
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Führt den DSGVO-Datenexport (Art. 15) aus und stößt den Browser-Download an.
 * @param {object} params
 * @param {string} params.apiBase
 * @param {Function|string} params.getToken
 * @param {Function} [params.showToast]
 * @param {Function} [params.fetchImpl]
 * @param {HTMLElement} [params.targetEl]
 */
export async function dsgvoExportHerunterladen({ apiBase, getToken, showToast, fetchImpl = globalThis.fetch, targetEl = null } = {}) {
  if (isExportRunning) return;
  isExportRunning = true;

  let origHtml = null;
  if (targetEl) {
    origHtml = targetEl.innerHTML;
    targetEl.textContent = 'Wird vorbereitet...';
    if ('disabled' in targetEl) targetEl.disabled = true;
    targetEl.style.pointerEvents = 'none';
  }

  try {
    const token = typeof getToken === 'function' ? await getToken() : getToken;
    if (!token) {
      if (showToast) showToast('Nicht angemeldet oder Sitzung abgelaufen.', 'error');
      return;
    }
    const blob = await exportAbrufen({ apiBase, token, fetchImpl });
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = (window.URL || URL).createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `praxura-daten-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      (window.URL || URL).revokeObjectURL(url);
    }
    if (showToast) showToast('Export heruntergeladen ✓');
  } catch (err) {
    if (showToast) showToast('Export fehlgeschlagen: ' + (err.message || err), 'error');
  } finally {
    if (targetEl) {
      if (origHtml !== null) targetEl.innerHTML = origHtml;
      if ('disabled' in targetEl) targetEl.disabled = false;
      targetEl.style.removeProperty('pointer-events');
    }
    isExportRunning = false;
  }
}

/**
 * Führt die Kontolöschung (Art. 17) nach doppelter Bestätigung aus.
 * @param {object} params
 * @param {string} params.apiBase
 * @param {Function|string} params.getToken
 * @param {Function} [params.showToast]
 * @param {Function} [params.showConfirmModal]
 * @param {Function} [params.showInputModal]
 * @param {Function} [params.signOut]
 * @param {boolean} [params.istKutu]
 * @param {Function} [params.fetchImpl]
 * @param {HTMLElement} [params.targetEl]
 */
export async function dsgvoKontoLoeschen({
  apiBase, getToken, showToast, showConfirmModal, showInputModal,
  signOut, istKutu = false, fetchImpl = globalThis.fetch, targetEl = null
} = {}) {
  if (istKutu) {
    if (showToast) showToast('In der lokalen Box ist keine Kontolöschung möglich.', 'info');
    return;
  }

  if (typeof showConfirmModal === 'function') {
    const confirm1 = await showConfirmModal({
      title: 'Konto löschen',
      message: 'Sind Sie sicher? Ihre Daten werden gelöscht, soweit keine gesetzliche Aufbewahrungspflicht besteht. Aufbewahrungspflichtige Unterlagen bleiben gesperrt bis zum Fristablauf.\n\nVorher muss Ihr Datenexport heruntergeladen sein.\n\nDiese Aktion ist NICHT rückgängig zu machen.',
      confirmText: 'Weiter',
      cancelText: 'Abbrechen',
      variant: 'danger'
    });
    if (!confirm1) return;
  }

  if (typeof showInputModal === 'function') {
    const typed = await showInputModal({
      title: 'Löschen bestätigen',
      message: 'Tippen Sie LÖSCHEN (Großbuchstaben) um zu bestätigen:',
      placeholder: 'LÖSCHEN',
      confirmText: 'Endgültig löschen',
      cancelText: 'Abbrechen',
      variant: 'danger'
    });
    if (typed !== 'LÖSCHEN') {
      if (showToast) showToast('Abgebrochen — Bestätigung stimmte nicht überein.', 'error');
      return;
    }
  }

  if (isDeleteRunning) return;
  isDeleteRunning = true;

  let origHtml = null;
  if (targetEl) {
    origHtml = targetEl.innerHTML;
    if ('disabled' in targetEl) targetEl.disabled = true;
    targetEl.textContent = 'Wird gelöscht...';
  }

  try {
    const token = typeof getToken === 'function' ? await getToken() : getToken;
    if (!token) {
      if (showToast) showToast('Nicht angemeldet oder Sitzung abgelaufen.', 'error');
      if (targetEl) {
        if (origHtml !== null) targetEl.innerHTML = origHtml;
        if ('disabled' in targetEl) targetEl.disabled = false;
      }
      isDeleteRunning = false;
      return;
    }

    const { ok, status, data } = await kontoLoeschenSenden({ apiBase, token, fetchImpl });
    if (!ok) {
      if (status === 409 || data?.code === 'EXPORT_FEHLT') {
        if (showToast) showToast('Bitte zuerst ‚Daten exportieren‘ ausführen.', 'error');
      } else {
        const errMsg = data?.message || data?.error || `Löschung fehlgeschlagen (${status})`;
        if (showToast) showToast(errMsg, 'error');
      }
      if (targetEl) {
        if (origHtml !== null) targetEl.innerHTML = origHtml;
        if ('disabled' in targetEl) targetEl.disabled = false;
      }
      isDeleteRunning = false;
      return;
    }

    // 200 OK
    let toastMsg = '';
    if (data?.status === 'teilweise_geloescht') {
      toastMsg = 'Ihr Konto wurde gelöscht; aufbewahrungspflichtige Unterlagen bleiben gesperrt.';
    } else {
      const firstLine = data?.message ? data.message.split('\n')[0].trim() : '';
      toastMsg = firstLine || 'Ihr Konto wurde gelöscht.';
    }
    if (showToast) showToast(toastMsg);

    await new Promise(r => setTimeout(r, 1500));
    if (typeof signOut === 'function') {
      try { await signOut(); } catch (_) {}
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/';
    }
  } catch (err) {
    if (showToast) showToast('Fehler: ' + (err.message || err), 'error');
    if (targetEl) {
      if (origHtml !== null) targetEl.innerHTML = origHtml;
      if ('disabled' in targetEl) targetEl.disabled = false;
    }
  } finally {
    isDeleteRunning = false;
  }
}

/**
 * Verdrahtet DSGVO-Export und -Löschung per Event-Delegation am Dokument.
 * In der lokalen Box wird der Lösch-Button ausgeblendet.
 * @param {object} opts
 * @param {string} opts.apiBase
 * @param {Function} opts.getToken
 * @param {Function} opts.showToast
 * @param {Function} opts.showConfirmModal
 * @param {Function} opts.showInputModal
 * @param {Function} opts.signOut
 * @param {boolean} opts.istKutu
 */
export function dsgvoVerdrahten(opts = {}) {
  activeOpts = opts;
  if (typeof document === 'undefined') return;

  const hideDeleteInBox = () => {
    if (activeOpts?.istKutu) {
      const deleteBtn = document.getElementById('dsgvoDeleteBtn');
      if (deleteBtn) { deleteBtn.hidden = true; deleteBtn.style.display = 'none'; }
    }
  };
  hideDeleteInBox();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideDeleteInBox, { once: true });
  }

  if (isVerdrahtet) return;
  isVerdrahtet = true;

  document.addEventListener('click', async (e) => {
    const exportEl = e.target.closest('[data-dsgvo-export], #dsgvoExportBtn');
    if (exportEl) {
      e.preventDefault();
      await dsgvoExportHerunterladen({
        apiBase: activeOpts?.apiBase,
        getToken: activeOpts?.getToken,
        showToast: activeOpts?.showToast,
        targetEl: exportEl
      });
      return;
    }

    const deleteEl = e.target.closest('#dsgvoDeleteBtn');
    if (deleteEl) {
      e.preventDefault();
      if (activeOpts?.istKutu) {
        deleteEl.hidden = true;
        return;
      }
      await dsgvoKontoLoeschen({
        apiBase: activeOpts?.apiBase,
        getToken: activeOpts?.getToken,
        showToast: activeOpts?.showToast,
        showConfirmModal: activeOpts?.showConfirmModal,
        showInputModal: activeOpts?.showInputModal,
        signOut: activeOpts?.signOut,
        istKutu: activeOpts?.istKutu,
        targetEl: deleteEl
      });
      return;
    }
  });
}
