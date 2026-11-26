/**
 * mail-entwurf.js — „Mail vorbereiten" in der Box: Patientenmail im eigenen Mailprogramm.
 *
 * Herkunft: KHS K2b.15, Entscheidung K-19 e (05.10.2026). In der Box gibt es
 * weder Gmail-OAuth noch (meist) SMTP. Zwei Wege führen deshalb hierher:
 *   1. Termin-Anfrage bestätigen/ablehnen/Gegenangebot/Nachricht — der Server
 *      antwortet dort mit `mailEntwurf {to, subject, text}` statt zu senden
 *      (api-backend/lib/mail-entwurf.js). Aufrufer: module/anfrage-bearbeiten.js,
 *      dashboard.js (Anfragen-Panel) über `window.mailEntwurfOeffnen`.
 *   2. Das Compose-Modal (`openComposeModal`, 6 Aufrufer): `#composeSendBtn`
 *      (Gmail) wird in der Box verborgen, daneben „Mail vorbereiten" (mailto).
 *      Verborgen statt ersetzt: dashboard.js hängt seinen Listener ohne `?.` an
 *      genau diese ID — dieses Modul läuft als Import VOR dem dashboard.js-Rumpf.
 * Direktversand aus dem Praxispostfach: Ops #335 (nach Launch).
 */
import { IST_KUTU } from '../supabase-config.js';
import { einrichtenLink } from './mailversand.js?v=20261109';

export function mailtoLink({ to, subject, text } = {}) {
  const teile = [];
  if (subject) teile.push(`subject=${encodeURIComponent(subject)}`);
  if (text) teile.push(`body=${encodeURIComponent(String(text).replace(/\r?\n/g, '\r\n'))}`); // RFC 6068: CRLF (Outlook)
  return `mailto:${encodeURIComponent(to || '').replace(/%40/g, '@')}${teile.length ? `?${teile.join('&')}` : ''}`;
}

/** Öffnet den Entwurf im Browser-Dialog (mit Kopieren + mailto) oder direkt per mailto. */
export function mailEntwurfOeffnen(entwurf, win = globalThis) {
  if (!entwurf?.to) return false;
  const doc = win.document;
  const anfragen = doc?.getElementById('panel-anfragen');
  if (anfragen && !doc.getElementById('anfragenMailEinrichten')) {
    const hinweis = doc.createElement('p');
    hinweis.id = 'anfragenMailEinrichten';
    hinweis.className = 'form-hint';
    const link = einrichtenLink(doc);
    link.style.display = 'inline-block';
    hinweis.append('Direkt aus Praxura senden: ', link);
    const liste = doc.getElementById('anfragenList');
    if (liste && anfragen.contains(liste)) liste.before(hinweis); else anfragen.append(hinweis);
  }

  const linkHref = mailtoLink(entwurf);
  if (typeof win.showHtmlModal === 'function' && doc?.getElementById?.('htmlModal')) {
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    win.showHtmlModal({
      title: 'E-Mail senden (Browser / Mailprogramm)',
      confirmText: 'Im Mailprogramm öffnen',
      html: `
        <p style="font-size:12.5px;color:var(--text-sub);margin:0 0 10px;line-height:1.45">
          Direktversand ist noch nicht eingerichtet. Sie können die Mail im Mailprogramm öffnen oder direkt für Webmail (z. B. Gmail, IONOS, Outlook im Browser) kopieren.
        </p>
        <div class="form-group" style="margin-bottom:8px">
          <label class="form-label">Empfänger</label>
          <input type="text" class="form-input" readonly value="${esc(entwurf.to)}" />
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label class="form-label">Betreff</label>
          <input type="text" class="form-input" readonly value="${esc(entwurf.subject || '')}" />
        </div>
        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label">Nachricht</label>
          <textarea class="form-input" id="mailEntwurfCopyText" rows="6" readonly style="width:100%;resize:vertical">${esc(entwurf.text || '')}</textarea>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button type="button" class="btn-secondary btn-sm" id="mailEntwurfCopyBtn">Text kopieren</button>
          <a href="${esc(linkHref)}" class="btn-ghost btn-sm" style="text-decoration:none">mailto-Link öffnen ↗</a>
        </div>
      `,
      afterRender: () => {
        const copyBtn = doc.getElementById('mailEntwurfCopyBtn');
        copyBtn?.addEventListener('click', async () => {
          const voll = `An: ${entwurf.to}\nBetreff: ${entwurf.subject || ''}\n\n${entwurf.text || ''}`;
          try {
            await win.navigator?.clipboard?.writeText(voll);
            copyBtn.textContent = '✓ Kopiert';
          } catch {
            const ta = doc.getElementById('mailEntwurfCopyText');
            ta?.select?.();
            copyBtn.textContent = 'Markiert — Strg+C / ⌘C';
          }
        });
      },
      onConfirm: () => {
        win.location.href = linkHref;
      },
    });
    return true;
  }

  win.location.href = linkHref;
  return true;
}

export function composeMailVorbereiten(doc = globalThis.document) {
  const senden = doc?.getElementById('composeSendBtn');
  if (!senden) return false;
  if (doc.getElementById('composeMailtoBtn')) return true;
  const knopf = doc.createElement('button');
  knopf.type = 'button';
  knopf.className = senden.className;
  knopf.id = 'composeMailtoBtn';
  knopf.textContent = 'Mail vorbereiten';
  knopf.addEventListener('click', () => {
    const wert = id => (doc.getElementById(id)?.value || '').trim();
    const offen = mailEntwurfOeffnen({ to: wert('composeToEmail'), subject: wert('composeSubject'), text: [wert('composeBody'), doc.getElementById('mailSignaturCompose')?.dataset?.signaturText || ''].filter(Boolean).join('\n\n') });
    if (!offen) { doc.getElementById('composeToEmail')?.focus(); return; }
    doc.querySelector('.modal-close[data-modal="emailComposeModal"]')?.click();
    const danach = globalThis._composePostFlow;
    if (typeof danach === 'function') { globalThis._composePostFlow = null; danach(); }
  });
  senden.hidden = true;
  const einrichten = einrichtenLink(doc);
  einrichten.addEventListener('click', () => doc.querySelector('.modal-close[data-modal="emailComposeModal"]')?.click(), { capture: true });
  senden.after(knopf, einrichten);
  return true;
}

if (IST_KUTU) {
  globalThis.mailEntwurfOeffnen = mailEntwurfOeffnen;
  composeMailVorbereiten();
}
