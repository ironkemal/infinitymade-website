/**
 * support-kontakt.js — Feedback-Panel in der Box: „Support kontaktieren" per Mail.
 *
 * Herkunft: KHS K2b.15, Entscheidung K-19 d (05.10.2026).
 * Im SaaS schreibt `#fbSendBtn` (dashboard.js) direkt in die Tabelle `feedbacks`,
 * wir lesen sie im Admin. In der Box landet derselbe Insert in der Box-DB, die
 * wir nie sehen — das Ticket verschwände still. Darum ersetzt dieses Modul in der
 * Box Formular und Ticketliste durch einen mailto-Link an den Support; die Mail
 * geht aus dem eigenen Mailprogramm der Praxis. Hinweis „keine Patientendaten",
 * weil der Weg kein AVV-Kanal ist.
 *
 * Läuft beim Import (Muster module/hausbesuch-route.js) — dashboard.js wächst nicht.
 */
import { IST_KUTU } from '../supabase-config.js';

export const SUPPORT_ADRESSE = 'support@praxura.de';

export function supportLink() {
  const betreff = 'Praxura-Box: Support-Anfrage';
  const text = 'Bitte beschreiben Sie Ihr Anliegen.\n\nBitte keine Patientendaten (Namen, Diagnosen, Befunde) in diese Mail schreiben.\n';
  return `mailto:${SUPPORT_ADRESSE}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text.replace(/\r?\n/g, '\r\n'))}`; // RFC 6068: CRLF
}

export function supportKontaktEinsetzen(doc = globalThis.document) {
  const panel = doc?.getElementById('panel-feedback');
  const formular = panel?.querySelector('.feedback-form');
  if (!formular) return false;
  const karte = doc.createElement('div');
  karte.className = 'feedback-form card';
  const titel = doc.createElement('h3');
  titel.textContent = 'Support kontaktieren';
  const text = doc.createElement('p');
  text.style.cssText = 'font-size:14px;color:var(--text-sub);margin:8px 0 14px;';
  text.textContent = `Fehler gefunden oder eine Frage? Schreiben Sie uns an ${SUPPORT_ADRESSE}. Bitte keine Patientendaten in die Mail.`;
  const link = doc.createElement('a');
  link.className = 'btn-primary';
  link.href = supportLink();
  link.textContent = 'Support kontaktieren';
  karte.append(titel, text, link);
  formular.replaceWith(karte);
  // Ticketliste + Überschrift: in der Box gibt es keine Tickets bei uns.
  const liste = doc.getElementById('fbList');
  liste?.previousElementSibling?.matches?.('h3.section-title') && liste.previousElementSibling.remove();
  liste?.remove();
  return true;
}

if (IST_KUTU) supportKontaktEinsetzen();
