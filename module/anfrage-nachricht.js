/**
 * anfrage-nachricht.js — Nachricht an Patienten zu einer Terminanfrage,
 * optional mit KI-Entwurf über das bestehende M4-Gateway (/api/ai/b2c-draft).
 *
 * Datenschutz & Konsey-Rahmen (24.11.2026 Option D):
 * - KI-Aufruf läuft ausschließlich serverseitig über /api/ai/b2c-draft (PII-Maskierung + EU-Region).
 * - Die KI sendet niemals selbst E-Mails — sie füllt lediglich das Textfeld als Entwurf.
 * - Ist KI nicht aktiviert, funktioniert das manuelle Schreiben ohne Einschränkung weiter.
 */
'use strict';

import { zeitwunschAus } from './anfrage-bearbeiten.js?v=20261126p2';

const KI_VORLAGEN = [
  { id: 'terminvorschlag', label: 'Terminvorschlag', prompt: 'Schlage dem Patienten freundlich einen konkreten Termin passend zu seinem Zeitwunsch vor und bitte um kurze Bestätigung.' },
  { id: 'rueckfrage', label: 'Rückfrage', prompt: 'Bitte den Patienten höflich um eine kurze Rückmeldung bzw. Rückruf zur Klärung offener Details der Anfrage.' },
  { id: 'rezept', label: 'Rezept mitbringen', prompt: 'Erinnere den Patienten freundlich daran, die gültige Heilmittelverordnung (Rezept) und die Versichertenkarte zum ersten Termin mitzubringen.' },
  { id: 'umformulieren', label: 'Text verbessern', prompt: 'Formuliere den bisherigen Nachrichtentext professionell, freundlich und klar auf Deutsch (Sie-Form) um.' },
];

/**
 * Baut den strukturierten Auftragstext für /api/ai/b2c-draft (rein, testbar).
 */
export function baueAnfrageKiAuftrag({ req, anweisung = '', aktuellerText = '' }) {
  const pat = req?.patients || {};
  const patName = [pat.vorname, pat.nachname].filter(Boolean).join(' ') || 'Patient';
  const leistung = req?.services?.title || req?.behandlungsart || '';
  const wunsch = zeitwunschAus(req?.notizen);
  const zeilen = [
    `Empfänger: ${patName}`,
    leistung ? `Angefragte Leistung: ${leistung}` : '',
    wunsch ? `Zeitwunsch aus Anfrage: ${wunsch.replace(/\n/g, ' | ')}` : '',
    anweisung ? `Gewünschter Inhalt: ${anweisung.trim()}` : 'Verfasse eine freundliche, kurze Antwort auf die Terminanfrage.',
    aktuellerText ? `Bisheriger Entwurf (bitte berücksichtigen/verbessern):\n${aktuellerText.trim()}` : '',
  ].filter(Boolean);
  return zeilen.join('\n');
}

/**
 * Öffnet den Nachrichten-Dialog für eine Terminanfrage mit optionaler KI-Entwurfshilfe.
 */
export function oeffneAnfrageNachricht({
  requestId,
  req,
  tl,
  API,
  supabase,
  currentProfile,
  escapeHtml,
  showHtmlModal,
  showToast,
}) {
  const ownerId = currentProfile?.id;
  const pat = req?.patients || {};
  const patName = [pat.vorname, pat.nachname].filter(Boolean).join(' ') || 'Patient';
  const wunsch = zeitwunschAus(req?.notizen);

  showHtmlModal({
    title: tl.anfragen_nachricht,
    confirmText: tl.anfragen_nachricht_senden,
    html: `
      <div style="font-size:13px;color:var(--text-sub);margin-bottom:10px;line-height:1.45">
        <div><strong>An:</strong> ${escapeHtml(patName)}${pat.email ? ` (${escapeHtml(pat.email)})` : ''}</div>
        ${wunsch ? `<div style="margin-top:4px">${escapeHtml(wunsch).replace(/\n/g, ' · ')}</div>` : ''}
      </div>

      <div class="anf-ki-box" style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--bg-card-solid,var(--bg-hover,rgba(0,0,0,.03)));margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <span style="font-size:12px;font-weight:600;color:var(--text-main)">✨ KI-Entwurfshilfe</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${KI_VORLAGEN.map(v => `<button type="button" class="btn-ghost btn-sm anf-ki-preset" data-prompt="${escapeHtml(v.prompt)}" style="font-size:11px;padding:3px 8px">${escapeHtml(v.label)}</button>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" id="patNachrichtKiPrompt" class="form-input" placeholder="Stichwort für KI, z. B. Dienstag 10 Uhr vorschlagen…" style="flex:1;font-size:13px" maxlength="300" />
          <button type="button" id="patNachrichtKiBtn" class="btn-secondary btn-sm" style="white-space:nowrap">✨ Mit KI erstellen</button>
        </div>
        <div id="patNachrichtKiHinweis" hidden style="margin-top:6px;font-size:12px;color:var(--text-muted)"></div>
      </div>

      <p style="font-size:12px;color:var(--text-sub);margin-bottom:6px">${tl.anfragen_nachricht_hint}</p>
      <textarea id="patNachrichtInput" class="form-input" maxlength="2000" style="width:100%;height:150px;resize:vertical" placeholder="Ihre Nachricht an den Patienten…"></textarea>
    `,
    afterRender: () => {
      const promptInput = document.getElementById('patNachrichtKiPrompt');
      const kiBtn = document.getElementById('patNachrichtKiBtn');
      const hinweisEl = document.getElementById('patNachrichtKiHinweis');
      const textEl = document.getElementById('patNachrichtInput');

      const zeigeHinweis = (msg, istFehler = false) => {
        if (!hinweisEl) return;
        hinweisEl.textContent = msg;
        hinweisEl.style.color = istFehler ? 'var(--danger, #b91c1c)' : 'var(--text-muted)';
        hinweisEl.hidden = !msg;
      };

      async function kiEntwurfLaden(overridePrompt) {
        if (!kiBtn) return;
        const anweisung = (overridePrompt ?? promptInput?.value ?? '').trim();
        const aktuellerText = textEl?.value?.trim() || '';
        kiBtn.disabled = true;
        const altLabel = kiBtn.textContent;
        kiBtn.textContent = 'Entwurf läuft…';
        zeigeHinweis('');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) throw new Error('Nicht angemeldet.');
          const intent = baueAnfrageKiAuftrag({ req, anweisung, aktuellerText });
          const r = await fetch(`${API}/ai/b2c-draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              intent,
              contacts: pat.email ? [{ id: req?.patient_id || requestId, name: patName, email: pat.email, notes: '' }] : [],
              owner_info: {
                business_name: currentProfile?.business_name || '',
                sender_name: [currentProfile?.owner_first_name, currentProfile?.owner_last_name].filter(Boolean).join(' ') || currentProfile?.business_name || '',
                sector: currentProfile?.sector || '',
              },
            }),
          });
          const json = await r.json().catch(() => ({}));
          if (!r.ok) {
            const msg = r.status === 503 || json.code === 'AI_DISABLED'
              ? 'KI ist aktuell nicht aktiv. Status prüfen unter Einstellungen → KI-Assistent.'
              : (json.error || 'KI-Entwurf konnte nicht erstellt werden.');
            zeigeHinweis(msg, true);
            return;
          }
          const body = json?.draft?.body || json?.body || '';
          if (body && textEl) {
            textEl.value = body.trim().slice(0, 2000);
            textEl.focus();
            zeigeHinweis('Entwurf eingefügt — bitte vor dem Senden prüfen.');
          } else {
            zeigeHinweis('KI hat keinen Entwurf geliefert.', true);
          }
        } catch (e) {
          zeigeHinweis(e.message || 'KI-Verbindung fehlgeschlagen.', true);
        } finally {
          kiBtn.disabled = false;
          kiBtn.textContent = altLabel;
        }
      }

      kiBtn?.addEventListener('click', () => kiEntwurfLaden());
      promptInput?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); kiEntwurfLaden(); }
      });
      document.querySelectorAll('.anf-ki-preset').forEach(btn => {
        btn.addEventListener('click', () => {
          if (promptInput) promptInput.value = btn.dataset.prompt || '';
          kiEntwurfLaden(btn.dataset.prompt || '');
        });
      });
    },
    onConfirm: async () => {
      const text = document.getElementById('patNachrichtInput')?.value?.trim() || '';
      if (!text) { showToast(tl.anfragen_nachricht_leer, 'error'); return false; }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const r = await fetch(`${API}/booking-request/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ request_id: requestId, owner_id: ownerId, text }),
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Fehler');
        if (globalThis.mailEntwurfOeffnen?.(json.mailEntwurf)) {
          showToast('Mail-Entwurf im Mailprogramm geöffnet — bitte dort senden. Direkt versenden: Einstellungen → E-Mail-Versand.', 'info');
        } else {
          showToast(tl.anfragen_nachricht_ok, 'success');
        }
      } catch (e) {
        showToast(e.message || 'Fehler beim Senden', 'error');
        return false;
      }
    },
  });
}
