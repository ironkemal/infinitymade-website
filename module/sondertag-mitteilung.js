/**
 * sondertag-mitteilung.js — Terminabsage per E-Mail im Sondertag-Dialog (Physio-Pilot M6c/S9, 02.11.2026).
 *
 * Nie automatisch: Vorschau vom Backend (POST /sondertag/mitteilung/vorschau), die Praxis wählt Empfänger ab,
 * liest den Mustertext und gibt mit Bestätigung frei (POST …/senden). Das Backend prüft beim Senden alles neu.
 * Ohne Einwilligung ab v6, ohne Adresse oder ohne eingerichteten Versand bleibt es bei der Anrufliste.
 */

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const zeit = iso => new Date(iso).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function mitteilungHtml(v) {
  if (!v) return '';
  const teile = [];
  if (v.mail?.length) {
    teile.push(`<p class="form-hint">Diese Patienten haben in E-Mail-Mitteilungen eingewilligt. Abwählen, wer angerufen werden soll.</p>
      <ul class="stm-liste">${v.mail.map(m => `<li><label><input type="checkbox" class="stm-wahl" value="${escapeHtml(m.bookingId)}" checked>
        <span>${escapeHtml(zeit(m.start))}</span> <span>${escapeHtml(m.name || 'Ohne Name')}</span></label></li>`).join('')}</ul>
      ${v.beispiel ? `<details class="stm-text"><summary>Mustertext ansehen</summary><p><strong>${escapeHtml(v.beispiel.betreff)}</strong></p><pre>${escapeHtml(v.beispiel.text)}</pre></details>` : ''}
      <button type="button" class="btn-primary" id="stmSenden">Freigeben und senden (${v.mail.length})</button>`);
  } else if (!v.weg) {
    teile.push('<p class="form-hint">E-Mail-Versand ist nicht eingerichtet (Box: SMTP der Praxis, sonst Gmail unter Einstellungen → E-Mail). Bitte telefonisch informieren.</p>');
  } else {
    teile.push('<p class="form-hint">Niemand hat in E-Mail-Mitteilungen eingewilligt. Bitte telefonisch informieren.</p>');
  }
  if (v.bereits?.length) teile.push(`<p class="form-hint">Bereits per E-Mail informiert: ${v.bereits.length}.</p>`);
  return `<section class="stm"><h3>Per E-Mail informieren</h3>${teile.join('')}<div class="stm-ergebnis" role="status"></div></section>`;
}

async function anfrage(deps, pfad, body) {
  const token = await deps.getToken?.();
  const r = await fetch(`${deps.apiBase}${pfad}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const daten = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, daten };
}

/**
 * @param {HTMLElement} host
 * @param {object} deps apiBase, getToken, von, bis, showToast, showConfirmModal
 */
export async function mountMitteilung(host, deps = {}) {
  if (!host || !deps.apiBase) return;
  const { von, bis, showToast = () => {}, showConfirmModal } = deps;
  let v;
  try {
    const r = await anfrage(deps, '/sondertag/mitteilung/vorschau', { von, bis });
    if (!r.ok) { host.innerHTML = ''; return; }
    v = r.daten;
  } catch { host.innerHTML = ''; return; }
  host.innerHTML = mitteilungHtml(v);
  const knopf = host.querySelector('#stmSenden');
  const ergebnis = host.querySelector('.stm-ergebnis');
  const gewaehlt = () => [...host.querySelectorAll('.stm-wahl:checked')].map(c => c.value);
  host.querySelectorAll('.stm-wahl').forEach(c => c.addEventListener('change', () => {
    if (knopf) { knopf.textContent = `Freigeben und senden (${gewaehlt().length})`; knopf.disabled = !gewaehlt().length; }
  }));
  knopf?.addEventListener('click', async () => {
    const ids = gewaehlt();
    if (!ids.length) return;
    const ok = showConfirmModal ? await showConfirmModal({
      title: 'E-Mails senden?',
      message: `${ids.length} Patient${ids.length === 1 ? '' : 'en'} erhalten eine Terminabsage per E-Mail (ohne Grund, ohne Behandlungsangaben). Termine werden nicht verschoben.`,
      confirmText: 'Senden', cancelText: 'Abbrechen',
    }) : false;
    if (!ok) return;
    knopf.disabled = true;
    try {
      const r = await anfrage(deps, '/sondertag/mitteilung/senden', { von, bis, bookingIds: ids });
      const d = r.daten || {};
      if (!r.ok) {
        ergebnis.textContent = d.error || 'Versand fehlgeschlagen.';
        showToast(d.error || 'Versand fehlgeschlagen.', 'error');
        knopf.disabled = false;
        return;
      }
      const teile = [`${d.gesendet} gesendet`];
      if (d.doppelt) teile.push(`${d.doppelt} bereits informiert`);
      if (d.abgelehnt) teile.push(`${d.abgelehnt} nicht mehr zulässig (bitte anrufen)`);
      if (d.fehler) teile.push(`${d.fehler} fehlgeschlagen (bitte anrufen)`);
      ergebnis.textContent = teile.join(' · ');
      showToast(d.fehler ? 'Teilweise gesendet.' : 'E-Mails gesendet ✓', d.fehler ? 'error' : undefined);
      host.querySelectorAll('.stm-wahl').forEach(c => { c.disabled = true; });
    } catch {
      ergebnis.textContent = 'Versand fehlgeschlagen. Bitte telefonisch informieren.';
      knopf.disabled = false;
    }
  });
}
