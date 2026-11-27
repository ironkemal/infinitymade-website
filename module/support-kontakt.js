/**
 * support-kontakt.js — Hybrides Support-Center im Dashboard (`#panel-feedback`).
 *
 * Funktioniert sowohl im SaaS als auch in der On-Prem-Box (ohne dashboard.js
 * zu verändern):
 * - Ersetzt das alte `feedbacks`-Formular + `#fbList` beim Laden, sodass die
 *   Alt-Listener in dashboard.js ins Leere laufen.
 * - Sendet Anfragen über `${API_BASE}/support/tickets` (SaaS → Ops-DB,
 *   Box → signiertes Relay an Zentral-Backend).
 * - Bei `503 SUPPORT_OFFLINE` (z. B. unverknüpfte Box oder Offline) wird sauber
 *   die `mailto:support@praxura.de`-Rückfallkarte angezeigt.
 * - Streng ohne Patientendaten (PHI) — klarer Datenschutz-Hinweis in der UI.
 */
import { API_BASE, IST_KUTU, SUPABASE_URL } from '../supabase-config.js';

export const SUPPORT_ADRESSE = 'support@praxura.de';

const STATUS_META = Object.freeze({
  neu: { label: 'Neu', cls: 'badge-yellow' },
  in_arbeit: { label: 'In Bearbeitung', cls: 'badge-blue' },
  wartet: { label: 'Wartet auf Rückmeldung', cls: 'badge-red' },
  geloest: { label: 'Gelöst', cls: 'badge-green' },
});

const PRIORITY_META = Object.freeze({
  niedrig: { label: 'Niedrig', cls: 'badge-gray' },
  normal: { label: 'Normal', cls: 'badge-gray' },
  hoch: { label: 'Hoch', cls: 'badge-yellow' },
  kritisch: { label: 'Kritisch', cls: 'badge-red' },
});

const CATEGORY_LABELS = Object.freeze({
  support: 'Support / Frage',
  bug: 'Fehler / Bug',
  abrechnung: 'Abrechnung (§ 302 / Privat)',
  box: 'Praxura-Box / Gerät',
  feature: 'Funktionswunsch',
  sonstiges: 'Sonstiges',
});

/** @param {unknown} s */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c] || c));
}

/** @param {string | null | undefined} iso */
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function supportLink() {
  const betreff = 'Praxura Support-Anfrage';
  const text = 'Bitte beschreiben Sie Ihr Anliegen.\n\nWichtig: Bitte keine Patientendaten (Namen, Diagnosen, KVNR) in diese Mail schreiben.\n';
  return `mailto:${SUPPORT_ADRESSE}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text.replace(/\r?\n/g, '\r\n'))}`; // RFC 6068: CRLF
}

/**
 * Liest das Supabase-Access-Token aus `localStorage` ohne eine zweite GoTrueClient-Instanz zu erzeugen.
 * @param {string} supabaseUrl
 * @param {Storage | null | undefined} storage
 * @returns {string | null}
 */
export function readSupabaseAccessToken(supabaseUrl = SUPABASE_URL, storage = globalThis.localStorage) {
  if (!storage) return null;
  const candidateKeys = [];
  try {
    if (supabaseUrl) {
      const ref = new URL(supabaseUrl).hostname.split('.')[0];
      if (ref) candidateKeys.push(`sb-${ref}-auth-token`);
    }
  } catch { /* ignore */ }

  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && /^sb-.*-auth-token$/.test(k) && !candidateKeys.includes(k)) {
        candidateKeys.push(k);
      }
    }
  } catch { /* ignore */ }

  for (const key of candidateKeys) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token
        || parsed?.currentSession?.access_token
        || parsed?.session?.access_token
        || null;
      if (typeof token === 'string' && token.length > 0) return token;
    } catch { /* ignore */ }
  }
  return null;
}

/**
 * Erzeugt die E-Mail-Rückfallkarte (z. B. wenn Box nicht verknüpft oder Support-API offline ist).
 * @param {Document} doc
 * @param {() => void} [onRetry]
 */
function buildOfflineCard(doc, onRetry) {
  const karte = doc.createElement('div');
  karte.className = 'feedback-form card';
  karte.id = 'supOfflineCard';
  karte.hidden = true;

  const titel = doc.createElement('h3');
  titel.textContent = 'Support direkt per E-Mail kontaktieren';

  const hinweis = doc.createElement('p');
  hinweis.style.cssText = 'font-size:14px;color:var(--text-sub);margin:8px 0 14px;line-height:1.5;';
  hinweis.textContent = `Der direkte Ticket-Dienst ist derzeit nicht verbunden. Schreiben Sie uns gern an ${SUPPORT_ADRESSE}. Bitte geben Sie keine Patientendaten (Namen, Diagnosen, KVNR) an.`;

  const aktionen = doc.createElement('div');
  aktionen.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;';

  const link = doc.createElement('a');
  link.className = 'btn-primary';
  link.href = supportLink();
  link.textContent = 'E-Mail an Support schreiben';

  const retryBtn = doc.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'btn-ghost';
  retryBtn.textContent = 'Erneut prüfen';
  if (onRetry) retryBtn.addEventListener('click', onRetry);

  aktionen.append(link, retryBtn);
  karte.append(titel, hinweis, aktionen);
  return karte;
}

/**
 * Fallback-Helfer (Kompatibilität): ersetzt das Formular durch die E-Mail-Karte.
 * @param {Document} [doc]
 */
export function supportKontaktEinsetzen(doc = globalThis.document) {
  const panel = doc?.getElementById('panel-feedback');
  const formular = panel?.querySelector('.feedback-form');
  if (!formular) return false;
  const karte = buildOfflineCard(doc);
  karte.hidden = false;
  formular.replaceWith(karte);
  const liste = doc.getElementById('fbList');
  liste?.previousElementSibling?.matches?.('h3.section-title') && liste.previousElementSibling.remove();
  liste?.remove();
  return true;
}

/**
 * Montiert das hybride Support-Portal in `#panel-feedback`.
 * @param {{
 *   doc?: Document,
 *   apiBase?: string,
 *   istKutu?: boolean,
 *   supabaseUrl?: string,
 *   getToken?: () => Promise<string | null> | string | null,
 *   fetchImpl?: typeof fetch,
 *   storage?: Storage | null,
 * }} [deps]
 */
export function mountSupportKontakt({
  doc = globalThis.document,
  apiBase = API_BASE,
  istKutu = IST_KUTU,
  supabaseUrl = SUPABASE_URL,
  getToken = null,
  fetchImpl = globalThis.fetch,
  storage = globalThis.localStorage,
} = {}) {
  const panel = doc?.getElementById('panel-feedback');
  if (!panel) return null;
  if (panel.dataset.supMounted === '1') return null;
  panel.dataset.supMounted = '1';

  const base = String(apiBase || '/api').replace(/\/+$/, '');
  const expandedTickets = new Set();
  /** @type {any[]} */
  let currentTickets = [];
  let loading = false;

  const resolveToken = async () => {
    if (typeof getToken === 'function') return await getToken();
    return readSupabaseAccessToken(supabaseUrl, storage);
  };

  // 1. Datenschutz-Hinweisbanner einfügen
  const header = panel.querySelector('.panel-header');
  const privacyBanner = doc.createElement('div');
  privacyBanner.id = 'supPrivacyBanner';
  privacyBanner.style.cssText = [
    'padding:12px 14px',
    'margin:0 0 16px',
    'border-radius:var(--radius-sm, 8px)',
    'border:1px solid var(--warning, #d97706)',
    'background:var(--bg-card-solid, var(--bg-card))',
    'color:var(--text-main)',
    'font-size:13px',
    'line-height:1.45',
  ].join(';');
  privacyBanner.innerHTML = '<strong>Datenschutz-Hinweis:</strong> Wichtig: Bitte keine Patientendaten (Namen, Diagnosen, KVNR) eingeben.';
  if (header) header.after(privacyBanner);
  else panel.prepend(privacyBanner);

  // 2. Altes Formular ersetzen (entfernt #fbSendBtn vor dashboard.js-Listener-Bindung)
  const oldForm = panel.querySelector('.feedback-form');
  const formCard = doc.createElement('div');
  formCard.className = 'feedback-form card';
  formCard.id = 'supFormCard';
  formCard.innerHTML = `
    <h3>Neue Support-Anfrage</h3>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="supCategory">Kategorie</label>
        <select class="form-select" id="supCategory">
          <option value="support">Support / Frage</option>
          <option value="bug">Fehler / Bug</option>
          <option value="abrechnung">Abrechnung (§ 302 / Privat)</option>
          <option value="box">Praxura-Box / Gerät</option>
          <option value="feature">Funktionswunsch</option>
          <option value="sonstiges">Sonstiges</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="supPriority">Priorität</label>
        <select class="form-select" id="supPriority">
          <option value="niedrig">Niedrig</option>
          <option value="normal" selected>Normal</option>
          <option value="hoch">Hoch</option>
          <option value="kritisch">Kritisch</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="supSubject">Betreff</label>
      <input class="form-input" id="supSubject" type="text" maxlength="200" placeholder="Kurze Zusammenfassung Ihres Anliegens …" />
    </div>
    <div class="form-group">
      <label class="form-label" for="supBody">Beschreibung</label>
      <textarea class="form-textarea" id="supBody" rows="4" maxlength="5000" placeholder="Bitte beschreiben Sie Ihr Anliegen möglichst genau (keine Patientendaten) …"></textarea>
    </div>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <button type="button" class="btn-primary" id="supSubmitBtn">Anfrage senden</button>
      <span id="supFormMsg" style="font-size:13px;color:var(--text-sub);"></span>
    </div>
  `;
  if (oldForm) oldForm.replaceWith(formCard);
  else privacyBanner.after(formCard);

  // 3. Offline-/Fallback-Karte einfügen
  const offlineCard = buildOfflineCard(doc, () => { void loadTickets(); });
  formCard.after(offlineCard);

  // 4. Altes #fbList + Überschrift ersetzen (deaktiviert altes loadFeedbacks() in dashboard.js)
  const oldList = doc.getElementById('fbList');
  if (oldList?.previousElementSibling?.matches?.('h3.section-title')) {
    oldList.previousElementSibling.remove();
  }
  oldList?.remove();

  const ticketsSection = doc.createElement('div');
  ticketsSection.id = 'supTicketsSection';
  ticketsSection.style.marginTop = '24px';
  ticketsSection.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
      <h3 class="section-title" style="margin:0;">Meine Anfragen</h3>
      <button type="button" class="btn-ghost btn-sm" id="supRefreshBtn">Aktualisieren</button>
    </div>
    <div class="feedback-list" id="supTicketList">
      <div class="table-empty">Anfragen werden geladen …</div>
    </div>
  `;
  offlineCard.after(ticketsSection);

  const formMsgEl = () => /** @type {HTMLElement | null} */ (doc.getElementById('supFormMsg'));
  const listEl = () => /** @type {HTMLElement | null} */ (doc.getElementById('supTicketList'));

  function setFormMessage(text, isError = false) {
    const el = formMsgEl();
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? 'var(--danger, #dc2626)' : 'var(--success, #16a34a)';
  }

  function setOfflineMode(isOffline) {
    offlineCard.hidden = !isOffline;
    formCard.hidden = isOffline;
    ticketsSection.hidden = isOffline;
  }

  function safeTechContext() {
    const appVersion = doc.querySelector('meta[name="praxura-version"]')?.getAttribute('content')
      || doc.body?.dataset?.version
      || 'dashboard';
    return {
      mode: istKutu ? 'box' : 'saas',
      panel: 'feedback',
      appVersion: String(appVersion).slice(0, 120),
    };
  }

  function renderTickets() {
    const list = listEl();
    if (!list) return;
    if (!currentTickets.length) {
      list.innerHTML = '<div class="table-empty">Noch keine Anfragen vorhanden.</div>';
      return;
    }

    list.innerHTML = currentTickets.map((t) => {
      const st = STATUS_META[t.status] || { label: t.status || 'Neu', cls: 'badge-gray' };
      const pr = PRIORITY_META[t.priority] || { label: t.priority || 'Normal', cls: 'badge-gray' };
      const catLabel = CATEGORY_LABELS[t.category] || t.category || 'Support';
      const isOpen = expandedTickets.has(t.id);
      const msgs = Array.isArray(t.messages) ? t.messages : [];
      const ticketLabel = t.ticket_no ? `#${t.ticket_no}` : '';

      return `
        <div class="feedback-item" data-ticket-id="${esc(t.id)}">
          <div class="feedback-header" style="cursor:pointer;" data-toggle-ticket="${esc(t.id)}">
            <div>
              <span class="feedback-title">${ticketLabel ? `<span style="color:var(--text-muted);margin-right:6px;">${esc(ticketLabel)}</span>` : ''}${esc(t.subject)}</span>
              <div class="feedback-meta">${esc(catLabel)} · ${esc(fmtDateTime(t.created_at))} · ${esc(msgs.length)} ${msgs.length === 1 ? 'Nachricht' : 'Nachrichten'}</div>
            </div>
            <div class="feedback-badges">
              <span class="badge ${esc(st.cls)}">${esc(st.label)}</span>
              <span class="badge ${esc(pr.cls)}">${esc(pr.label)}</span>
            </div>
          </div>
          ${isOpen ? `
            <div class="sup-thread" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:grid;gap:8px;">
              ${msgs.length ? msgs.map((m) => {
                const isStaff = m.sender_type === 'staff';
                const who = isStaff ? `Praxura-Team (${m.sender_name || 'Support'})` : (m.sender_name || 'Ihre Praxis');
                return `
                  <div style="padding:10px 12px;border-radius:var(--radius-sm, 8px);border:1px solid var(--border);background:${isStaff ? 'var(--primary-dim, rgba(15,118,110,0.08))' : 'var(--bg-card-solid, var(--bg-card))'};border-left:3px solid ${isStaff ? 'var(--primary, #0f766e)' : 'var(--border-strong, var(--border))'};">
                    <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--text-muted);margin-bottom:4px;">
                      <strong style="color:var(--text-main);">${esc(who)}</strong>
                      <span>${esc(fmtDateTime(m.created_at))}</span>
                    </div>
                    <div class="feedback-desc" style="white-space:pre-wrap;overflow-wrap:anywhere;">${esc(m.body)}</div>
                  </div>
                `;
              }).join('') : '<div class="table-empty">Keine Nachrichten.</div>'}
              <div style="margin-top:6px;display:grid;gap:8px;">
                <textarea class="form-textarea" rows="2" maxlength="5000" data-reply-input="${esc(t.id)}" placeholder="Rückmeldung hinzufügen (keine Patientendaten) …"></textarea>
                <div style="display:flex;align-items:center;gap:10px;">
                  <button type="button" class="btn-primary btn-sm" data-reply-send="${esc(t.id)}">Antwort senden</button>
                  <span data-reply-msg="${esc(t.id)}" style="font-size:12px;color:var(--text-muted);"></span>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  async function loadTickets() {
    if (loading) return;
    loading = true;
    const list = listEl();
    try {
      const token = await resolveToken();
      if (!token) {
        if (list) list.innerHTML = '<div class="table-empty">Bitte melden Sie sich erneut an, um Ihre Anfragen zu sehen.</div>';
        return;
      }

      const res = await fetchImpl(`${base}/support/tickets`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      let body = null;
      try { body = await res.json(); } catch { body = null; }

      if (res.status === 503 || body?.error === 'SUPPORT_OFFLINE') {
        setOfflineMode(true);
        return;
      }

      setOfflineMode(false);
      if (!res.ok) {
        if (list) list.innerHTML = '<div class="table-empty">Anfragen konnten derzeit nicht geladen werden.</div>';
        return;
      }

      currentTickets = Array.isArray(body?.tickets) ? body.tickets : [];
      if (currentTickets.length && expandedTickets.size === 0) {
        expandedTickets.add(currentTickets[0].id);
      }
      renderTickets();
    } catch {
      setOfflineMode(true);
    } finally {
      loading = false;
    }
  }

  // Ereignisse verdrahten
  doc.getElementById('supRefreshBtn')?.addEventListener('click', () => {
    void loadTickets();
  });

  doc.getElementById('supSubmitBtn')?.addEventListener('click', async () => {
    const btn = /** @type {HTMLButtonElement | null} */ (doc.getElementById('supSubmitBtn'));
    const categoryEl = /** @type {HTMLSelectElement | null} */ (doc.getElementById('supCategory'));
    const priorityEl = /** @type {HTMLSelectElement | null} */ (doc.getElementById('supPriority'));
    const subjectEl = /** @type {HTMLInputElement | null} */ (doc.getElementById('supSubject'));
    const bodyEl = /** @type {HTMLTextAreaElement | null} */ (doc.getElementById('supBody'));

    const subject = (subjectEl?.value || '').trim();
    const bodyText = (bodyEl?.value || '').trim();
    if (!subject) {
      setFormMessage('Bitte geben Sie einen Betreff ein.', true);
      subjectEl?.focus();
      return;
    }
    if (!bodyText) {
      setFormMessage('Bitte beschreiben Sie Ihr Anliegen.', true);
      bodyEl?.focus();
      return;
    }

    if (btn) btn.disabled = true;
    setFormMessage('Wird gesendet …', false);

    try {
      const token = await resolveToken();
      if (!token) {
        setFormMessage('Keine aktive Sitzung. Bitte laden Sie die Seite neu.', true);
        return;
      }

      const res = await fetchImpl(`${base}/support/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          category: categoryEl?.value || 'support',
          priority: priorityEl?.value || 'normal',
          subject,
          body: bodyText,
          techContext: safeTechContext(),
        }),
      });

      let json = null;
      try { json = await res.json(); } catch { json = null; }

      if (res.status === 503 || json?.error === 'SUPPORT_OFFLINE') {
        setOfflineMode(true);
        return;
      }

      if (!res.ok) {
        setFormMessage('Anfrage konnte nicht gesendet werden. Bitte Eingaben prüfen.', true);
        return;
      }

      if (subjectEl) subjectEl.value = '';
      if (bodyEl) bodyEl.value = '';
      if (json?.ticket?.id) expandedTickets.add(json.ticket.id);
      setFormMessage('Vielen Dank! Ihre Support-Anfrage wurde übermittelt.', false);
      await loadTickets();
    } catch {
      setOfflineMode(true);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  ticketsSection.addEventListener('click', async (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target);
    if (!target) return;

    const toggle = target.closest('[data-toggle-ticket]');
    if (toggle) {
      const id = toggle.getAttribute('data-toggle-ticket');
      if (id) {
        if (expandedTickets.has(id)) expandedTickets.delete(id);
        else expandedTickets.add(id);
        renderTickets();
      }
      return;
    }

    const sendBtn = /** @type {HTMLButtonElement | null} */ (target.closest('[data-reply-send]'));
    if (sendBtn) {
      const ticketId = sendBtn.getAttribute('data-reply-send');
      if (!ticketId) return;
      const input = /** @type {HTMLTextAreaElement | null} */ (
        ticketsSection.querySelector(`[data-reply-input="${ticketId}"]`)
      );
      const msgEl = /** @type {HTMLElement | null} */ (
        ticketsSection.querySelector(`[data-reply-msg="${ticketId}"]`)
      );
      const replyBody = (input?.value || '').trim();
      if (!replyBody) {
        if (msgEl) { msgEl.textContent = 'Bitte eine Nachricht eingeben.'; msgEl.style.color = 'var(--danger, #dc2626)'; }
        return;
      }

      sendBtn.disabled = true;
      if (msgEl) { msgEl.textContent = 'Wird gesendet …'; msgEl.style.color = 'var(--text-muted)'; }

      try {
        const token = await resolveToken();
        if (!token) {
          if (msgEl) { msgEl.textContent = 'Bitte erneut anmelden.'; msgEl.style.color = 'var(--danger, #dc2626)'; }
          return;
        }

        const res = await fetchImpl(`${base}/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          body: JSON.stringify({ body: replyBody }),
        });

        let json = null;
        try { json = await res.json(); } catch { json = null; }

        if (res.status === 503 || json?.error === 'SUPPORT_OFFLINE') {
          setOfflineMode(true);
          return;
        }
        if (!res.ok) {
          if (msgEl) { msgEl.textContent = 'Antwort konnte nicht gesendet werden.'; msgEl.style.color = 'var(--danger, #dc2626)'; }
          return;
        }

        if (input) input.value = '';
        await loadTickets();
      } catch {
        setOfflineMode(true);
      } finally {
        sendBtn.disabled = false;
      }
    }
  });

  // Wenn #panel-feedback sichtbar geschaltet wird (.active), Ticketliste aktualisieren
  if (typeof globalThis.MutationObserver === 'function') {
    let wasActive = panel.classList.contains('active');
    const observer = new globalThis.MutationObserver(() => {
      const isActive = panel.classList.contains('active');
      if (isActive && !wasActive) {
        void loadTickets();
      }
      wasActive = isActive;
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
  }

  if (panel.classList.contains('active')) {
    void loadTickets();
  }

  return { loadTickets, renderTickets };
}

if (globalThis.document?.getElementById?.('panel-feedback')) {
  mountSupportKontakt();
}
