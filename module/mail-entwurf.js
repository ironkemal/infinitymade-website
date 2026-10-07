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

export function mailtoLink({ to, subject, text } = {}) {
  const teile = [];
  if (subject) teile.push(`subject=${encodeURIComponent(subject)}`);
  if (text) teile.push(`body=${encodeURIComponent(String(text).replace(/\r?\n/g, '\r\n'))}`); // RFC 6068: CRLF (Outlook)
  return `mailto:${encodeURIComponent(to || '').replace(/%40/g, '@')}${teile.length ? `?${teile.join('&')}` : ''}`;
}

/** Öffnet den Entwurf im Mailprogramm. true = geöffnet (Aufrufer zeigt dann keinen „gesendet"-Toast). */
export function mailEntwurfOeffnen(entwurf, win = globalThis) {
  if (!entwurf?.to) return false;
  win.location.href = mailtoLink(entwurf);
  return true;
}

export function composeMailVorbereiten(doc = globalThis.document) {
  const senden = doc?.getElementById('composeSendBtn');
  if (!senden) return false;
  const knopf = doc.createElement('button');
  knopf.type = 'button';
  knopf.className = senden.className;
  knopf.id = 'composeMailtoBtn';
  knopf.textContent = 'Mail vorbereiten';
  knopf.addEventListener('click', () => {
    const wert = id => (doc.getElementById(id)?.value || '').trim();
    const offen = mailEntwurfOeffnen({ to: wert('composeToEmail'), subject: wert('composeSubject'), text: wert('composeBody') });
    if (!offen) { doc.getElementById('composeToEmail')?.focus(); return; }
    doc.querySelector('.modal-close[data-modal="emailComposeModal"]')?.click();
    const danach = globalThis._composePostFlow;
    if (typeof danach === 'function') { globalThis._composePostFlow = null; danach(); }
  });
  senden.hidden = true;
  senden.after(knopf);
  return true;
}

if (IST_KUTU) {
  globalThis.mailEntwurfOeffnen = mailEntwurfOeffnen;
  composeMailVorbereiten();
}
