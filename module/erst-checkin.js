/**
 * erst-checkin.js — Einstempeln beim allerersten Login (Pflichtpunkt 7, 23.11.2026).
 *
 * Warum: Melih wünschte einen automatischen Check-in samt Standortwahl beim ersten Login.
 * legal-de (23.11.2026): automatisch ohne Bestätigung ist nicht vertretbar — die Erstanmeldung
 * passiert oft nicht bei Arbeitsbeginn (z. B. abends mit dem Einrichtungscode), der Eintrag wäre
 * eine falsche Arbeitszeit-Aufzeichnung (BAG 13.09.2022, Art. 5 Abs. 1 lit. d DSGVO). Minimum:
 * ein Klick „Jetzt einstempeln" / „Später"; „Später" legt nichts an.
 *
 * „Allererster Login" = noch keine Zeile in `attendance` für diese Person (kein neues Schema).
 * Nach „Später" fragt dieses Gerät nicht erneut (localStorage, reine Bequemlichkeit).
 * Standorte: die bereits gefilterte Liste aus bootBusinessSwitcher (Mitarbeiter sehen nur ihre
 * zugeordneten Standorte). Ein Standort → fest, mehrere → Auswahl, keiner → kein Dialog.
 * Der Server prüft kein GPS (POST /api/attendance/check-in ignoriert Koordinaten).
 */

const merkerSchluessel = (/** @type {string} */ userId) => `praxura_erst_checkin_${userId}`;

/** @param {string} s */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

/** @param {Storage|null|undefined} speicher @param {string} schluessel */
function lies(speicher, schluessel) { try { return speicher?.getItem(schluessel) ?? null; } catch { return null; } }
/** @param {Storage|null|undefined} speicher @param {string} schluessel */
function merke(speicher, schluessel) { try { speicher?.setItem(schluessel, new Date().toISOString()); } catch { /* privates Fenster */ } }

/**
 * Check-in über die bestehende Route — wiederverwendbar (attendance.js hat denselben Aufruf inline).
 * @param {{ apiBase: string, token: string, businessId: string|null, fetchImpl?: typeof fetch }} o
 * @returns {Promise<{ ok: boolean, bereits?: boolean, fehler?: string }>}
 */
export async function checkInAusfuehren({ apiBase, token, businessId, fetchImpl = fetch }) {
  const res = await fetchImpl(`${apiBase}/attendance/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ business_id: businessId }),
  });
  const daten = await res.json().catch(() => ({}));
  if (res.status === 409) return { ok: true, bereits: true };
  if (!res.ok) return { ok: false, fehler: daten.error || 'Check-in fehlgeschlagen' };
  return { ok: true };
}

/**
 * @param {any} supabase @param {string} userId
 * @returns {Promise<boolean|null>} true = noch nie eingestempelt, null = unbekannt (dann nicht fragen)
 */
export async function nochNieEingestempelt(supabase, userId) {
  const { data, error } = await supabase.from('attendance').select('id').eq('employee_id', userId).limit(1);
  if (error || !Array.isArray(data)) return null;
  return data.length === 0;
}

/**
 * Zeigt den Dialog, falls passend. Gibt zurück, was passiert ist (für Tests/Protokoll).
 * @param {object} o
 * @param {any} o.supabase
 * @param {string} o.userId
 * @param {{ id: string, business_name?: string }[]} o.standorte
 * @param {string|null} [o.aktuellerStandortId]
 * @param {string} o.apiBase
 * @param {() => Promise<string|null|undefined>} o.getToken
 * @param {(msg: string, typ?: string) => void} [o.showToast]
 * @param {Document} [o.doc]
 * @param {Storage|null} [o.speicher]
 * @param {typeof fetch} [o.fetchImpl]
 * @returns {Promise<'kein-standort'|'gemerkt'|'schon-eingestempelt'|'unbekannt'|'spaeter'|'eingestempelt'|'fehler'>}
 */
export async function erstCheckinAnbieten(o) {
  const speicher = o.speicher === undefined ? globalThis.localStorage : o.speicher;
  if (!o.userId || !o.standorte?.length) return 'kein-standort';
  if (lies(speicher, merkerSchluessel(o.userId))) return 'gemerkt';
  const nie = await nochNieEingestempelt(o.supabase, o.userId);
  if (nie === null) return 'unbekannt';
  if (!nie) { merke(speicher, merkerSchluessel(o.userId)); return 'schon-eingestempelt'; }

  const vorwahl = o.standorte.find(s => s.id === o.aktuellerStandortId)?.id || o.standorte[0].id;
  const wahl = await dialog(o.doc || document, o.standorte, vorwahl);
  if (!wahl) { merke(speicher, merkerSchluessel(o.userId)); return 'spaeter'; }

  const token = await o.getToken();
  if (!token) { o.showToast?.('Keine aktive Sitzung. Bitte erneut anmelden.', 'error'); return 'fehler'; }
  try {
    const r = await checkInAusfuehren({ apiBase: o.apiBase, token, businessId: wahl, fetchImpl: o.fetchImpl });
    if (!r.ok) { o.showToast?.(r.fehler || 'Check-in fehlgeschlagen', 'error'); return 'fehler'; }
    merke(speicher, merkerSchluessel(o.userId));
    o.showToast?.(r.bereits ? 'Heute bereits eingecheckt.' : 'Eingestempelt ✓');
    return 'eingestempelt';
  } catch {
    o.showToast?.('Netzwerkfehler beim Einstempeln. Bitte über „Zeiterfassung“ erneut versuchen.', 'error');
    return 'fehler';
  }
}

/**
 * @param {Document} doc @param {{ id: string, business_name?: string }[]} standorte @param {string} vorwahl
 * @returns {Promise<string|null>} gewählte Standort-ID oder null (Später)
 */
function dialog(doc, standorte, vorwahl) {
  return new Promise(resolve => {
    doc.getElementById('erstCheckinModal')?.remove();
    const modal = doc.createElement('div');
    modal.id = 'erstCheckinModal';
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    const auswahl = standorte.length > 1
      ? `<label class="form-label" for="erstCheckinStandort">Standort</label>
         <select class="form-select" id="erstCheckinStandort">${standorte.map(s => `<option value="${esc(s.id)}"${s.id === vorwahl ? ' selected' : ''}>${esc(s.business_name || 'Standort')}</option>`).join('')}</select>`
      : `<p style="font-size:14px;margin:0;color:var(--text-main);">Standort: <strong>${esc(standorte[0].business_name || 'Standort')}</strong></p>`;
    modal.innerHTML = `
      <div class="modal" style="background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:12px;max-width:440px;width:100%;padding:22px;box-sizing:border-box;">
        <h3 style="margin:0 0 10px;font-size:18px;font-weight:600;">Willkommen! Jetzt einstempeln?</h3>
        <p style="font-size:13.5px;line-height:1.5;color:var(--text-muted);margin:0 0 14px;">Ihre Arbeitszeit beginnt erst mit dem Einstempeln. Wenn Sie gerade nicht arbeiten, wählen Sie „Später“ — Sie können jederzeit über die Zeiterfassung einstempeln.</p>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:18px;">${auswahl}</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
          <button class="btn-ghost" type="button" data-erst="spaeter">Später</button>
          <button class="btn-primary" type="button" data-erst="ja">Jetzt einstempeln</button>
        </div>
      </div>`;
    const ende = (/** @type {string|null} */ wert) => { doc.removeEventListener('keydown', taste); modal.remove(); resolve(wert); };
    const taste = (/** @type {KeyboardEvent} */ e) => { if (e.key === 'Escape') ende(null); };
    modal.querySelector('[data-erst="spaeter"]')?.addEventListener('click', () => ende(null));
    modal.querySelector('[data-erst="ja"]')?.addEventListener('click', () => {
      const sel = /** @type {HTMLSelectElement|null} */ (modal.querySelector('#erstCheckinStandort'));
      ende(sel ? sel.value : standorte[0].id);
    });
    doc.addEventListener('keydown', taste);
    doc.body.appendChild(modal);
    /** @type {HTMLElement|null} */ (modal.querySelector('[data-erst="ja"]'))?.focus?.();
  });
}
