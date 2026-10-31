/**
 * rechnung-mail.js — Rechnung an den Patienten per E-Mail (P1, K9, 31.10.2026).
 *
 * Warum es das gibt: im Gespräch mit P1 wurde „Rechnung per Mail" zugesagt, es
 * gab nur Drucken. Das PDF entsteht auf dem Server (api-backend/lib/rechnung-pdf.js),
 * immer passwortgeschützt (compliance/LEGAL_DECISIONS.md 2026-10-31). Versand:
 * Box → SMTP der Praxis, SaaS → Gmail-Konto der Praxis (onprem O-233). Klappt
 * der Versand nicht, bekommt die Praxis PDF + Passwort zum selbst Senden.
 *
 * Erste Verwendung: Rechnungsansicht (#invView), Knopf #invvMailBtn —
 * eingehängt von module/rechnung-ansicht.js.
 */

let d = null;
let aktuelleRechnung = null;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Ergebnistext nach dem Versuch — ohne DOM, damit prüfbar. */
export function ergebnisText(antwort) {
  if (antwort?.gesendet) {
    return { ok: true, text: `Die Rechnung wurde an ${antwort.empfaenger} gesendet${antwort.weg === 'gmail' ? ' (über Ihr Gmail-Konto)' : ''}.` };
  }
  const gruende = {
    KEINE_EMAIL: 'Für diesen Patienten ist keine E-Mail-Adresse hinterlegt.',
    VERSAND_NICHT_EINGERICHTET: 'Der E-Mail-Versand ist nicht eingerichtet (SMTP der Praxis fehlt).',
    GMAIL_NICHT_VERBUNDEN: 'Gmail ist nicht verbunden.',
    gmail_reauth_required: 'Die Gmail-Verbindung ist abgelaufen – bitte neu verbinden.',
  };
  return { ok: false, text: `${gruende[antwort?.code] || antwort?.error || 'Die E-Mail konnte nicht versendet werden.'} Sie können das PDF herunterladen und selbst senden.` };
}

function pdfLink(base64, dateiname) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  return `<a class="btn-ghost" href="${url}" download="${esc(dateiname || 'Rechnung.pdf')}" style="text-decoration:none;">PDF herunterladen</a>`;
}

function modal() {
  let el = document.getElementById('rechnungMailModal');
  if (el) return el;
  el = document.createElement('div');
  el.className = 'modal-overlay';
  el.id = 'rechnungMailModal';
  el.hidden = true;
  el.innerHTML = `
    <div class="modal">
      <div class="modal-header"><span class="modal-title">Rechnung per E-Mail senden</span>
        <button class="modal-close" type="button" data-rm-schliessen>✕</button></div>
      <div class="modal-body" id="rmBody"></div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', ev => { if (ev.target === el || ev.target.closest('[data-rm-schliessen]')) el.hidden = true; });
  return el;
}

async function oeffnen() {
  const inv = aktuelleRechnung;
  if (!inv) return;
  const m = modal();
  const body = m.querySelector('#rmBody');
  let email = '';
  if (inv.patient_id) {
    const { data } = await d.supabase.from('leads').select('email').eq('id', inv.patient_id).maybeSingle();
    email = data?.email || '';
  }
  body.innerHTML = `
    <label style="display:block;font-size:13px;margin-bottom:6px;">An (E-Mail des Patienten)</label>
    <input type="email" id="rmAn" class="input" value="${esc(email)}" placeholder="name@beispiel.de" style="width:100%;">
    <p style="font-size:13px;color:var(--text-muted);margin-top:10px;line-height:1.5;">
      Die Rechnung geht als passwortgeschütztes PDF. Das Passwort sehen Sie nach dem Senden –
      bitte teilen Sie es dem Patienten persönlich oder telefonisch mit, nicht per E-Mail.<br>
      Bei Versand über Gmail: ein Google-Workspace-Konto mit Auftragsverarbeitungsvertrag ist Pflicht der Praxis.</p>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
      <button class="btn-ghost" type="button" data-rm-schliessen>Abbrechen</button>
      <button class="btn-primary" type="button" id="rmSenden">Senden</button>
    </div>`;
  m.hidden = false;
  body.querySelector('#rmSenden').addEventListener('click', () => senden(body));
}

async function senden(body) {
  const knopf = body.querySelector('#rmSenden');
  const an = body.querySelector('#rmAn').value.trim();
  knopf.disabled = true; knopf.textContent = 'Wird gesendet…';
  let antwort;
  try {
    const res = await fetch(`${String(d.apiBasis).replace(/\/+$/, '')}/dokument/rechnung`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await d.token()) },
      body: JSON.stringify({ aktion: 'mail', invoice_id: aktuelleRechnung.id, an_email: an }),
    });
    antwort = await res.json().catch(() => ({}));
    if (!res.ok && !antwort.passwort) { d.showToast(antwort.error || 'Senden fehlgeschlagen.', 'error'); knopf.disabled = false; knopf.textContent = 'Senden'; return; }
  } catch {
    d.showToast('Keine Verbindung zum Server.', 'error'); knopf.disabled = false; knopf.textContent = 'Senden'; return;
  }
  const e = ergebnisText(antwort);
  body.innerHTML = `
    <p style="font-size:14px;line-height:1.5;color:var(--text-main);">${esc(e.text)}</p>
    <div style="margin-top:12px;padding:12px;border-radius:8px;background:var(--bg-card-solid);border:1px solid var(--border, rgba(0,0,0,.12));">
      <div style="font-size:12px;color:var(--text-muted);">Passwort für das PDF (nur jetzt sichtbar)</div>
      <div style="font-size:22px;font-weight:700;letter-spacing:2px;font-family:monospace;margin-top:4px;">${esc(antwort.passwort || '')}</div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
      ${antwort.pdf_base64 ? pdfLink(antwort.pdf_base64, antwort.dateiname) : ''}
      <button class="btn-primary" type="button" data-rm-schliessen>Fertig</button>
    </div>`;
  if (e.ok) d.showToast('Rechnung gesendet.', 'success');
}

/** Einmal aufrufen; danach zeigt jeder Aufruf von merke(inv) den Knopf für diese Rechnung. */
export function mountRechnungMail(deps) {
  d = deps;
  document.getElementById('invvMailBtn')?.addEventListener('click', () => void oeffnen());
}

/** Bei jedem Öffnen der Rechnungsansicht: Knopf nur für abgeschlossene Rechnungen. */
export function merkeRechnungFuerMail(inv) {
  aktuelleRechnung = inv || null;
  const knopf = document.getElementById('invvMailBtn');
  if (!knopf) return;
  const entwurf = !inv || inv.status === 'draft';
  knopf.disabled = entwurf;
  knopf.title = entwurf ? 'Entwürfe werden nicht versendet – bitte zuerst abschließen.' : 'Rechnung als passwortgeschütztes PDF an den Patienten senden';
}
