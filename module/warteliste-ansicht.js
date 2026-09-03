/**
 * warteliste-ansicht.js — die Tabelle im Warteliste-Bildschirm.
 *
 * Warum es das gibt
 * ─────────────────
 * Die Warteliste zeigte bis zum 03.09.2026 ausschliesslich `status = 'waiting'`.
 * Das war richtig, solange niemand vermittelt wurde. Seit ein abgesagter Termin
 * per Klick an einen Nachrücker gehen kann (`module/warteliste-nachruecker.js`),
 * ist es ein Loch: in dem Moment, in dem jemand den Platz annimmt, wird sein
 * Eintrag `matched` — und verschwindet vom Bildschirm.
 *
 * Menschen sagen aber danach ab. Der Nachrücker meldet sich nicht, kann doch
 * nicht, wird wieder krank. Bisher gab es dann keinen Weg zurück: der Wartende
 * war unsichtbar und musste neu eingetragen werden — mit neuem Datum, also
 * hinten in der Reihe, obwohl er in Wahrheit am längsten wartet.
 *
 * Deshalb zwei Ansichten auf dieselbe Tabelle, umschaltbar, und in der zweiten
 * ein Weg zurück. Die Umschaltung ist bewusst kein Filterfeld: es gibt genau
 * zwei Zustände, die jemanden interessieren, und ein Reiterpaar zeigt beide,
 * ohne dass man erst etwas eintippen muss.
 *
 * (`cancelled` fehlt absichtlich. Ein abgesagter Wartelisten-Eintrag ist
 * erledigt; ihn zu zeigen hiesse, den Bildschirm mit Vergangenheit zu füllen.)
 */

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const PRIO_LABEL = {
  1: 'Normal',
  2: '<span style="color:#f59e0b;font-weight:600;">Hoch</span>',
  3: '<span style="color:#dc2626;font-weight:700;">Dringend</span>',
};

const ICON_STIFT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const ICON_ZURUECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>';

/** Welcher Reiter ist gewählt? Steht im DOM, damit niemand den Zustand doppelt hält. */
export function wartelisteStatus() {
  const aktiv = document.querySelector('#wlStatusTabs [data-wl-status].btn-primary');
  return aktiv?.dataset.wlStatus === 'matched' ? 'matched' : 'waiting';
}

/** Reiter setzen — der gewählte trägt `btn-primary`, der andere `btn-ghost`. */
export function setzeWartelisteStatus(status) {
  document.querySelectorAll('#wlStatusTabs [data-wl-status]').forEach(btn => {
    const gewaehlt = btn.dataset.wlStatus === status;
    btn.className = gewaehlt ? 'btn-primary' : 'btn-ghost';
  });
}

function patientName(e) {
  const l = e.leads;
  if (!l) return '—';
  return `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.title || '—';
}

function zeitfenster(e) {
  return (e.preferred_time_from && e.preferred_time_to)
    ? `${e.preferred_time_from.slice(0, 5)} – ${e.preferred_time_to.slice(0, 5)}`
    : 'Egal';
}

/**
 * Baut Tabelle, Leermeldung und Kopfzeile für den gewählten Reiter.
 *
 * `aufZurueck(id, knopf)` wird beim Klick auf „Zurück auf die Warteliste"
 * gerufen und darf asynchron sein; der Knopf sperrt sich für die Dauer selbst.
 * In der `waiting`-Ansicht gibt es ihn nicht.
 */
export function rendereWarteliste({ rows = [], status = 'waiting', aufZurueck = null } = {}) {
  const tbody = document.getElementById('wlTableBody');
  const leerEl = document.getElementById('wlEmpty');
  const summaryEl = document.getElementById('wlSummary');
  if (!tbody) return;

  const vermittelt = status === 'matched';

  if (summaryEl) {
    const wort = vermittelt
      ? `vermittelte${rows.length === 1 ? 'r' : ''} Eintr${rows.length === 1 ? 'ag' : 'äge'}`
      : `Patient${rows.length !== 1 ? 'en' : ''} auf der Warteliste`;
    summaryEl.innerHTML = `<span style="font-size:13px;"><strong>${rows.length}</strong> ${wort}</span>`;
  }

  if (leerEl) {
    const text = document.getElementById('wlEmptyText');
    if (text) {
      text.textContent = vermittelt
        ? 'Noch niemand aus der Warteliste vermittelt.'
        : 'Keine Patienten auf der Warteliste.';
    }
    leerEl.hidden = rows.length > 0;
  }

  if (rows.length === 0) { tbody.innerHTML = ''; return; }

  tbody.innerHTML = rows.map(e => {
    const tage = Array.isArray(e.preferred_days) ? (e.preferred_days.join(', ') || 'Egal') : 'Egal';
    // In der vermittelten Ansicht zählt, WANN vermittelt wurde — das Eintragsdatum
    // steht dort nur noch für die Wartezeit davor und ist die schwächere Auskunft.
    const datum = vermittelt && e.notified_at
      ? new Date(e.notified_at).toLocaleDateString('de-DE')
      : new Date(e.created_at).toLocaleDateString('de-DE');

    const aktion = vermittelt
      ? `<button class="btn-ghost" data-wl-zurueck="${e.id}" style="font-size:12px;padding:3px 8px;">${ICON_ZURUECK} Zurück auf die Warteliste</button>`
      : `<button class="btn-ghost" style="font-size:12px;padding:3px 8px;" onclick="openWlEntry('${e.id}')">${ICON_STIFT} Bearbeiten</button>`;

    return `<tr>
      <td><strong>${escapeHtml(patientName(e))}</strong></td>
      <td>${escapeHtml(e.services?.title || '—')}</td>
      <td>${escapeHtml(tage)}</td>
      <td>${zeitfenster(e)}</td>
      <td>${PRIO_LABEL[e.priority] || 'Normal'}</td>
      <td style="color:var(--text-muted);font-size:12px;">${datum}</td>
      <td>${aktion}</td>
    </tr>`;
  }).join('');

  // Delegiert und per `onclick` gesetzt: `innerHTML` hat die alten Knöpfe eben
  // weggeworfen, `addEventListener` würde sich bei jedem Aufbau erneut stapeln.
  tbody.onclick = async (ev) => {
    const btn = ev.target.closest('[data-wl-zurueck]');
    if (!btn || !aufZurueck) return;
    btn.disabled = true;
    const vorher = btn.innerHTML;
    btn.textContent = '…';
    try {
      await aufZurueck(btn.dataset.wlZurueck);
    } finally {
      btn.disabled = false;
      btn.innerHTML = vorher;
    }
  };
}
