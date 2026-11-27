/**
 * Praxis-Ansicht „KI-Nutzung (Monatsübersicht)“ (Faz 2A).
 * Zeigt ausschließlich statistische Zählerstände des eigenen Mandanten — keine Preise, kein PHI.
 */

const MONATE_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

/** @type {Record<string, string>} */
export const TASK_LABELS = Object.freeze({
  'rezept-ocr': 'Rezept-Erkennung',
  'rezept-validate': 'Rezept-Prüfung',
  'rezept-normalize': 'Rezept-Aufbereitung',
  'b2c-draft': 'Patienten-Entwürfe',
  'b2b-draft': 'Arzt-Entwürfe',
  'appointment-confirm-draft': 'Terminbestätigungen',
  'series-scheduler': 'Serientermine',
  'transkribieren': 'Sprachdiktat'
});

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** @param {unknown} t */
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c] || c));

/** @param {unknown} n */
const fmtInt = (n) => Math.max(0, Math.round(Number(n) || 0)).toLocaleString('de-DE');

/**
 * Aktueller UTC-Monat als `YYYY-MM`.
 * @param {Date} [now]
 * @returns {string}
 */
export function currentUtcMonth(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Verschiebt einen `YYYY-MM`-Wert um `delta` Monate.
 * @param {string} month
 * @param {number} delta
 * @returns {string}
 */
export function shiftMonat(month, delta) {
  if (!MONTH_RE.test(month)) return currentUtcMonth();
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Formatiert `YYYY-MM` auf Deutsch, z. B. `November 2026`.
 * @param {string} month
 * @returns {string}
 */
export function formatMonatLabel(month) {
  if (!MONTH_RE.test(month)) return String(month || '');
  const [y, m] = month.split('-').map(Number);
  return `${MONATE_DE[m - 1] || ''} ${y}`.trim();
}

/**
 * Formatiert Sekunden als `X Min. Y Sek.`.
 * @param {unknown} seconds
 * @returns {string}
 */
export function formatDiktatZeit(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min.toLocaleString('de-DE')} Min. ${sec} Sek.`;
}

/**
 * Erstellt die Aufgabenzeile für die Verbrauchs-Spalte.
 * @param {{ task?: string, totalTokens?: number, audioSeconds?: number }} item
 * @returns {string}
 */
function formatTaskUsage(item) {
  const tokens = Math.max(0, Math.round(Number(item?.totalTokens) || 0));
  const audio = Math.max(0, Math.round(Number(item?.audioSeconds) || 0));
  const parts = [];
  if (audio > 0 || item?.task === 'transkribieren') {
    parts.push(formatDiktatZeit(audio));
  }
  if (tokens > 0) {
    parts.push(`${fmtInt(tokens)} Token`);
  }
  return parts.length ? parts.join(' · ') : '—';
}

/**
 * Mountet die KI-Nutzungskarte in `containerEl`.
 * @param {HTMLElement | null} containerEl
 * @param {{
 *   apiBase?: string,
 *   getToken?: () => Promise<string | null | undefined>,
 *   getSessionToken?: () => Promise<string | null | undefined>,
 *   fetchImpl?: typeof fetch,
 *   initialMonth?: string,
 *   now?: Date
 * }} [options]
 */
export async function mountKiNutzung(containerEl, options = {}) {
  if (!containerEl) return;

  const apiBase = String(options.apiBase || '/api/ai').replace(/\/+$/, '');
  const getToken = options.getToken || options.getSessionToken;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const maxMonth = currentUtcMonth(options.now);
  let selectedMonth = options.initialMonth && MONTH_RE.test(options.initialMonth) && options.initialMonth <= maxMonth
    ? options.initialMonth
    : maxMonth;
  let requestSeq = 0;

  /**
   * @param {string} bodyHtml
   */
  function renderShell(bodyHtml) {
    const canGoNext = selectedMonth < maxMonth;
    containerEl.innerHTML = `
      <div id="kiNutzungCard" style="background:var(--bg-card-solid);border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div style="font-size:14px;font-weight:600;color:var(--text-main);">KI-Nutzung (Monatsübersicht)</div>
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <button type="button" id="kiNutzungPrevBtn" class="btn btn-secondary" aria-label="Vorheriger Monat" style="min-width:34px;min-height:34px;padding:4px 10px;">◀</button>
            <span id="kiNutzungMonthLabel" style="min-width:128px;text-align:center;font-size:13px;font-weight:600;color:var(--text-main);">${esc(formatMonatLabel(selectedMonth))}</span>
            <button type="button" id="kiNutzungNextBtn" class="btn btn-secondary" aria-label="Nächster Monat" ${canGoNext ? '' : 'disabled'} style="min-width:34px;min-height:34px;padding:4px 10px;${canGoNext ? '' : 'opacity:0.45;cursor:not-allowed;'}">▶</button>
          </div>
        </div>
        ${bodyHtml}
        <p class="form-hint" style="margin:0;font-size:11.5px;color:var(--text-muted);line-height:1.45;">
          Nur statistische Zählerstände — es werden keine Patientendaten gespeichert.
        </p>
      </div>
    `;

    const prevBtn = containerEl.querySelector('#kiNutzungPrevBtn');
    const nextBtn = containerEl.querySelector('#kiNutzungNextBtn');
    const retryBtn = containerEl.querySelector('#kiNutzungRetryBtn');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        selectedMonth = shiftMonat(selectedMonth, -1);
        void loadAndRender();
      });
    }
    if (nextBtn && canGoNext) {
      nextBtn.addEventListener('click', () => {
        const next = shiftMonat(selectedMonth, 1);
        selectedMonth = next > maxMonth ? maxMonth : next;
        void loadAndRender();
      });
    }
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        void loadAndRender();
      });
    }
  }

  function renderLoading() {
    renderShell(`
      <div id="kiNutzungStatus" role="status" style="padding:14px 0;font-size:13px;color:var(--text-muted);">
        Nutzungsdaten werden geladen …
      </div>
    `);
  }

  /** @param {string} message */
  function renderError(message) {
    renderShell(`
      <div id="kiNutzungError" role="alert" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);font-size:13px;color:var(--danger);">
        <span>${esc(message)}</span>
        <button type="button" id="kiNutzungRetryBtn" class="btn btn-secondary" style="min-height:34px;padding:4px 10px;">Erneut laden</button>
      </div>
    `);
  }

  /** @param {Record<string, any>} data */
  function renderData(data) {
    const totalCalls = Math.max(0, Number(data.totalCalls) || 0);
    if (totalCalls === 0) {
      renderShell(`
        <div id="kiNutzungEmpty" style="padding:14px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);font-size:13px;color:var(--text-muted);text-align:center;">
          In diesem Monat noch keine KI-Aufrufe.
        </div>
      `);
      return;
    }

    const okCalls = Math.max(0, Number(data.okCalls) || 0);
    const errorCalls = Math.max(0, Number(data.errorCalls) || 0);
    const totalTokens = Math.max(0, Number(data.totalTokens) || 0);
    const reasoningTokens = Math.max(0, Number(data.reasoningTokens) || 0);
    const audioSeconds = Math.max(0, Number(data.audioSeconds) || 0);
    const byTask = Array.isArray(data.byTask) ? data.byTask : [];

    const tokenSubtext = reasoningTokens > 0
      ? `inkl. ${fmtInt(reasoningTokens)} Denk-Token`
      : `${fmtInt(data.promptTokens)} Eingabe · ${fmtInt(data.completionTokens)} Ausgabe`;

    const tileStyle = 'background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;';

    const taskRows = byTask.map((/** @type {any} */ item) => {
      const taskKey = typeof item?.task === 'string' ? item.task : 'unknown';
      const label = TASK_LABELS[taskKey] || taskKey;
      return `
        <tr style="border-top:1px solid var(--border);">
          <td style="padding:7px 8px;color:var(--text-main);">${esc(label)}</td>
          <td style="padding:7px 8px;color:var(--text-main);text-align:right;font-variant-numeric:tabular-nums;">${esc(fmtInt(item?.calls))}</td>
          <td style="padding:7px 8px;color:var(--text-muted);text-align:right;font-variant-numeric:tabular-nums;">${esc(formatTaskUsage(item))}</td>
        </tr>
      `;
    }).join('');

    renderShell(`
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
        <div style="${tileStyle}">
          <span style="font-size:12px;color:var(--text-muted);">KI-Aufrufe</span>
          <strong style="font-size:18px;color:var(--text-main);font-variant-numeric:tabular-nums;">${esc(fmtInt(totalCalls))}</strong>
          <span style="font-size:11.5px;color:var(--text-muted);">${esc(fmtInt(okCalls))} erfolgreich · ${esc(fmtInt(errorCalls))} Fehler</span>
        </div>
        <div style="${tileStyle}">
          <span style="font-size:12px;color:var(--text-muted);">Text-Verbrauch</span>
          <strong style="font-size:18px;color:var(--text-main);font-variant-numeric:tabular-nums;">${esc(fmtInt(totalTokens))} Token</strong>
          <span style="font-size:11.5px;color:var(--text-muted);">${esc(tokenSubtext)}</span>
        </div>
        <div style="${tileStyle}">
          <span style="font-size:12px;color:var(--text-muted);">Diktat-Zeit</span>
          <strong style="font-size:18px;color:var(--text-main);font-variant-numeric:tabular-nums;">${esc(formatDiktatZeit(audioSeconds))}</strong>
          <span style="font-size:11.5px;color:var(--text-muted);">Sprachdiktat</span>
        </div>
      </div>

      ${data.truncated === true ? `
      <div style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);font-size:12px;color:var(--warning-text, var(--warning));">
        Hinweis: Auswertung auf die ersten 20.000 Einträge dieses Monats begrenzt.
      </div>` : ''}

      ${byTask.length ? `
      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg-card);">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
          <thead>
            <tr style="background:var(--bg-card-solid);color:var(--text-muted);text-align:left;">
              <th style="padding:7px 8px;font-weight:600;">Aufgabe</th>
              <th style="padding:7px 8px;font-weight:600;text-align:right;">Aufrufe</th>
              <th style="padding:7px 8px;font-weight:600;text-align:right;">Verbrauch</th>
            </tr>
          </thead>
          <tbody>
            ${taskRows}
          </tbody>
        </table>
      </div>` : ''}
    `);
  }

  async function loadAndRender() {
    const seq = ++requestSeq;
    renderLoading();

    try {
      const token = await getToken?.();
      if (seq !== requestSeq) return;
      if (typeof token !== 'string' || !token) {
        renderError('Keine gültige Sitzung vorhanden.');
        return;
      }

      const res = await fetchImpl(`${apiBase}/_nutzung?month=${encodeURIComponent(selectedMonth)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (seq !== requestSeq) return;

      if (!res || !res.ok) {
        renderError(res?.status === 403
          ? 'Nur der Praxisinhaber darf die KI-Nutzung einsehen.'
          : 'Nutzungsdaten konnten derzeit nicht geladen werden.');
        return;
      }

      const data = await res.json();
      if (seq !== requestSeq) return;
      if (!data || typeof data !== 'object' || data.success === false) {
        renderError('Nutzungsdaten konnten derzeit nicht geladen werden.');
        return;
      }

      renderData(data);
    } catch {
      if (seq !== requestSeq) return;
      renderError('Nutzungsdaten konnten derzeit nicht geladen werden.');
    }
  }

  await loadAndRender();
}
