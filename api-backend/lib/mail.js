// Gemeinsamer Mail-Transport + Absenderadresse. Bis 11.09.2026 gab es sechs
// Kopien von `"<Praxis> via Praxura" <noreply@praxura.de>` in server.js —
// eine feste Adresse, die auf SaaS zufällig funktioniert (unser eigener
// Provider, SPF/DKIM passen) und in der Kundenbox garantiert nicht (fremder
// Mailserver, SPF-Hardfail gemessen — onprem/REGISTER.md O-51).
//
// Diese Datei macht daraus EINEN Ort. server.js und api-backend/setup/router.js
// (Testmail-Endpunkt) rufen dieselben zwei Funktionen — zwei getrennte
// Vorstellungen von "welcher Port/from" waren genau das Risiko, das O-66s
// Entscheidung vermeiden sollte.
//
// SaaS-Verhalten bleibt BYTE-GLEICH: SMTP_FROM/MAIL_FROM_NAME sind dort nie
// gesetzt (die Variable existiert im VPS-.env.calendar nicht), also greifen
// exakt die alten Fallbacks. Nur die Box setzt sie (install.sh, O-66).

import nodemailer from 'nodemailer';
import { istKutu } from './dagitim.js';
import { encryptPHI, decryptPHI } from './phi-encrypt.js';

// `requireTLS` nur auf Wunsch (Dokumentenversand, legal-de 22.10.2026: ohne TLS kein
// Versand). Ohne Argument bleibt der Transport byte-gleich wie bisher — Buchungsmails
// und Testmail rufen ohne Optionen (onprem O-216).
//
// Mit `host` (Praxis-Postfach aus Einstellungen → E-Mail-Versand, praxis_mailversand)
// werden host/port/secure/user/pass aus dem Argument genommen, sonst aus SMTP_* (wie bisher).
// `tls` (z. B. servername beim festgenagelten Ziel, routes/mailversand.js pruefZiel) und Zeitgrenzen werden durchgereicht.
export function createSMTPTransport({
  requireTLS = false, host, port, secure, user, pass, tls, connectionTimeout, greetingTimeout, socketTimeout,
} = {}) {
  if (host) {
    return nodemailer.createTransport({
      host, port: Number(port) || 587, secure: !!secure,
      auth: { user, pass },
      ...(requireTLS ? { requireTLS: true } : {}),
      ...(tls ? { tls } : {}),
      ...(connectionTimeout ? { connectionTimeout } : {}),
      ...(greetingTimeout ? { greetingTimeout } : {}),
      ...(socketTimeout ? { socketTimeout } : {}),
    });
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    ...(requireTLS ? { requireTLS: true } : {}),
  });
}

// Entfernt alles, was eine Mail-Header-Zeile aufbrechen koennte. business_name
// ist Nutzereingabe (Onboarding, Faz-2.2-Sihirbaz) und ging bisher UNGEFILTERT
// in den From-Header — eine Header-Injection-Luecke, nicht erst seit O-66,
// hier aber miterledigt statt eine zweite Kopie mitzuschleppen.
function saeubereAnzeigename(text) {
  return String(text || '').replace(/[\r\n"]/g, '').trim();
}

// getMailFrom(businessName?) -> vollstaendiger From-Header-String.
//
// Adresse: SMTP_FROM, sonst die alte feste Adresse (SaaS-Fallback, unveraendert).
// Anzeigename: MAIL_FROM_NAME wenn gesetzt (Box hat volle Kontrolle — kein
// "Praxis X via Praxis X"), sonst wie bisher "<Praxis> via Praxura"/"Praxura".
export function getMailFrom(businessName) {
  const adresse = process.env.SMTP_FROM || 'noreply@praxura.de';
  const eigenerName = process.env.MAIL_FROM_NAME;
  if (eigenerName) {
    return `"${saeubereAnzeigename(eigenerName)}" <${adresse}>`;
  }
  const praxis = saeubereAnzeigename(businessName);
  const anzeigename = praxis ? `${praxis} via Praxura` : 'Praxura';
  return `"${anzeigename}" <${adresse}>`;
}

// ═══ Praxis-Postfach: EIN Selektor für alle Patientenmails (AUFTRAG-MAILVERSAND, Kemal 09.11.2026) ═══
//
// Vorher entschieden fünf Stellen mit drei Regeln (versandWeg, versandMoeglich, mailEntwurfStattVersand,
// rohe SMTP_HOST-Abfragen in server.js/setup/update-alarm). Jetzt: mailKanal().
// Reihenfolge: 1. Einstellung der Praxis (praxis_mailversand, Einstellungen → E-Mail-Versand)
//              2. SMTP_* aus der Umgebung (alte Boxen + SaaS — Verhalten unverändert)
//              3. kein Versand (Box: Mail-Entwurf/PDF; die Oberfläche zeigt „E-Mail-Versand einrichten →").
// Env wird NIE in die DB kopiert. Passwort/Token verlassen diese Datei nur in Richtung Mailserver:
// `smtp` ist am Kanal nicht aufzählbar (JSON.stringify(kanal) enthält es nicht), Logs nur e.code.
// Hosts sind fest im Code — keine automatische Erkennung (ISPDB/MX), das wäre eine neue Außenverbindung.

/** Anbieter-Vorlagen. Nur host/port/sicherheit; der Nutzer gibt Adresse + Passwort ein.
 *  Alle auf 587/STARTTLS (requireTLS erzwingt die Verschluesselung): Port 465 ist ausgehend oft gesperrt —
 *  live gemessen 10.11.2026 auf dem SaaS-VPS (Hetzner: smtp.gmail.com:465 Zeitueberschreitung, :587 erreichbar;
 *  ebenso IONOS/Strato/T-Online auf 587). Alle vier Anbieter dokumentieren 587 mit STARTTLS. */
export const SMTP_PRESETS = Object.freeze({
  outlook: Object.freeze({ name: 'Microsoft 365 / Outlook', host: 'smtp.office365.com', port: 587, sicherheit: 'starttls' }),
  gmail: Object.freeze({ name: 'Google / Gmail', host: 'smtp.gmail.com', port: 587, sicherheit: 'starttls' }),
  ionos: Object.freeze({ name: 'IONOS', host: 'smtp.ionos.de', port: 587, sicherheit: 'starttls' }),
  strato: Object.freeze({ name: 'Strato', host: 'smtp.strato.de', port: 587, sicherheit: 'starttls' }),
  einsundeins: Object.freeze({ name: '1&1', host: 'smtp.1und1.de', port: 587, sicherheit: 'starttls' }),
  telekom: Object.freeze({ name: 'T-Online', host: 'securesmtp.t-online.de', port: 587, sicherheit: 'starttls' }),
  gmx: Object.freeze({ name: 'GMX', host: 'mail.gmx.net', port: 587, sicherheit: 'starttls' }),
  webde: Object.freeze({ name: 'WEB.DE', host: 'smtp.web.de', port: 587, sicherheit: 'starttls' }),
  andere: Object.freeze({ name: 'Andere', host: null, port: null, sicherheit: null }),
});

/** Anbieterspezifische Hilfe — statt eines allgemeinen „Anmeldung fehlgeschlagen". */
export const ANBIETER_HINWEIS = Object.freeze({
  telekom: 'T-Online: Das Login-Passwort funktioniert hier nicht. Bitte im Telekom Kundencenter ein separates E-Mail-Passwort anlegen und dieses eintragen.',
  gmx: 'GMX: Unter Einstellungen → POP3/IMAP Abruf den Zugriff per POP3/IMAP erlauben, danach erneut testen.',
  webde: 'WEB.DE: Unter Einstellungen → POP3/IMAP Abruf den Zugriff per POP3/IMAP erlauben, danach erneut testen.',
  gmail: 'Gmail: Das normale Passwort funktioniert nicht. Bestätigung in zwei Schritten aktivieren und ein App-Passwort erstellen (myaccount.google.com/apppasswords), dann dieses eintragen.',
  outlook: 'Microsoft 365: „Authentifiziertes SMTP" muss für das Postfach erlaubt sein (Microsoft 365 Admin Center). Bei Zwei-Faktor-Anmeldung ein App-Kennwort verwenden.',
});

/** Nodemailer-Code → verständliche Diagnose (vorher inline in setup/router.js /test-smtp). */
export const SMTP_DIAGNOSE = Object.freeze({
  EAUTH: 'Benutzername oder Passwort wird vom Mailserver abgelehnt.',
  ECONNECTION: 'Server oder Port nicht erreichbar — Firewall oder falscher Port?',
  ECONNREFUSED: 'Server oder Port nicht erreichbar — Firewall oder falscher Port?',
  ESOCKET: 'Verbindung zum Mailserver ist abgebrochen — falscher Port oder falsche Verschlüsselung (SSL/STARTTLS)?',
  ETIMEDOUT: 'Mailserver antwortet nicht (Zeitüberschreitung).',
  EENVELOPE: 'Absender- oder Empfängeradresse wurde vom Mailserver abgelehnt.',
  EDNS: 'Mailserver-Adresse ist unbekannt — bitte den Servernamen prüfen.',
  ETLS: 'Verschlüsselte Verbindung fehlgeschlagen — SSL/STARTTLS-Einstellung prüfen.',
  EPROTOCOL: 'Der Mailserver hat die Anmeldung unerwartet beendet — bitte E-Mail-Adresse, Passwort und Anbieter prüfen.',
  PASSWORT_NICHT_LESBAR: 'Das gespeicherte Passwort kann nicht gelesen werden (Schlüssel geändert). Bitte das Passwort neu eingeben.',
});

/** Codes, bei denen das Postfach als „Verbindung unterbrochen" gilt (nicht: einzelner Empfänger abgelehnt). */
export const VERBINDUNG_CODES = new Set(['EAUTH', 'EPROTOCOL', 'ECONNECTION', 'ECONNREFUSED', 'ESOCKET', 'ETIMEDOUT', 'EDNS', 'ETLS', 'PASSWORT_NICHT_LESBAR']);

/** @returns {{code: string|null, meldung: string, hinweis: string|null}} — nie die Rohmeldung (kann Empfänger enthalten). */
export function fehlerHinweis(code, preset) {
  const c = code ? String(code) : null;
  const meldung = (c && SMTP_DIAGNOSE[c]) || 'Unbekannter Fehler beim Mailversand.';
  const anbieter = preset && ANBIETER_HINWEIS[preset] ? ANBIETER_HINWEIS[preset] : null;
  const hinweis = anbieter && (c === 'EAUTH' || c === 'EPROTOCOL' || c === 'ETLS' || c === 'ESOCKET') ? anbieter : null;
  return { code: c, meldung, hinweis };
}

/** SMTP über Umgebung eingerichtet (install.sh/compose bzw. SaaS-VPS)? */
export function envSmtpVorhanden(env = process.env) { return !!env.SMTP_HOST; }

/** Anzeige der Umgebungs-Konfiguration für die Einstellungen (read-only) — ohne Benutzer/Passwort. */
export function envSmtpAnzeige(env = process.env) {
  if (!env.SMTP_HOST) return null;
  return { host: env.SMTP_HOST, port: Number(env.SMTP_PORT) || 587, absender: env.SMTP_FROM || null };
}

/** Passwort für die Spalte smtp_passwort (bytea, Hex-Eingabeformat für PostgREST). Wirft ohne DATA_ENCRYPTION_KEY. */
export function verschluesselePasswort(klartext) {
  const buf = encryptPHI(String(klartext));
  return '\\x' + buf.toString('hex');
}

/** Liest die Praxis-Einstellung; jeder Fehler (auch: Tabelle fehlt noch) = keine Einstellung. */
export async function ladeMailEinstellung(supabase, ownerId) {
  if (!supabase || !ownerId) return null;
  try {
    const { data, error } = await supabase.from('praxis_mailversand').select('*').eq('owner_id', ownerId).maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

function fromHeader(name, adresse) {
  const n = saeubereAnzeigename(name);
  const a = String(adresse || '').replace(/[\r\n<>"]/g, '').trim();
  return n ? `"${n}" <${a}>` : a;
}

function kanal(weg, quelle, extra = {}) {
  const { smtp = null, from, fehler = null, preset = null, absender = null } = extra;
  const k = {
    weg, quelle, fehler, preset, absender,
    from: from || (name => getMailFrom(name)),
    transport: (opts = {}) => createSMTPTransport({ ...(smtp || {}), ...opts }),
  };
  // Nicht aufzählbar: JSON.stringify/Logs/Antworten sehen Zugangsdaten nie.
  Object.defineProperty(k, 'smtp', { value: smtp, enumerable: false });
  return k;
}

/**
 * Der Versandweg für eine Praxis.
 * @param {object} o
 * @param {'dokument'|'booking'|'erinnerung'|'alarm'} [o.zweck] — hält bei fehlender Einstellung die alten
 *   SaaS-Unterschiede: Booking/Alarm über SMTP_* (Praxura), Dokumente nie über Praxura-SMTP, sondern Gmail
 *   der Praxis (O-233), Erinnerung nur mit Praxis-SMTP.
 * @returns {Promise<{weg:'smtp'|'gmail'|'kein', quelle:'db'|'env'|'saas_gmail'|null, fehler:string|null,
 *   preset:string|null, absender:string|null, from:(name?:string)=>string, transport:(opts?:object)=>any}>}
 */
export async function mailKanal({ supabase, ownerId, zweck = 'dokument', env = process.env, kutu = istKutu(), zeile } = {}) {
  const z = zeile !== undefined ? zeile : await ladeMailEinstellung(supabase, ownerId);
  if (z?.modus === 'smtp' && z.smtp_host) {
    const pass = decryptPHI(z.smtp_passwort);
    const absender = z.absender_email || z.smtp_benutzer || null;
    if (!pass) {
      // Schlüssel gewechselt/Zeile kaputt: lieber der alte Weg (SMTP_*) als gar keiner — Fehler bleibt sichtbar.
      const rueckfall = umgebungsKanal(zweck, env, kutu);
      if (rueckfall.weg !== 'kein') { rueckfall.fehler = 'PASSWORT_NICHT_LESBAR'; return rueckfall; }
      return kanal('kein', 'db', { fehler: 'PASSWORT_NICHT_LESBAR', preset: z.preset || null, absender });
    }
    const smtp = {
      host: z.smtp_host, port: Number(z.smtp_port) || 587, secure: z.smtp_sicherheit === 'ssl',
      user: z.smtp_benutzer || z.absender_email, pass,
    };
    return kanal('smtp', 'db', {
      smtp, preset: z.preset || null, absender,
      from: name => fromHeader(z.absender_name || name, absender),
    });
  }
  // Gmail der Praxis ersetzt nur den Dokumentenweg; Booking/Alarm bleiben wie bisher auf SMTP_*.
  if (z?.modus === 'gmail_oauth' && !kutu && zweck === 'dokument') return kanal('gmail', 'db');
  return umgebungsKanal(zweck, env, kutu);
}

/** Weg ohne Praxis-Einstellung — exakt das Verhalten vor AUFTRAG-MAILVERSAND. */
function umgebungsKanal(zweck, env, kutu) {
  const envSmtp = envSmtpVorhanden(env);
  if (kutu) return envSmtp ? kanal('smtp', 'env') : kanal('kein', null);
  if (zweck === 'booking' || zweck === 'alarm') return envSmtp ? kanal('smtp', 'env') : kanal('kein', null);
  if (zweck === 'dokument') return kanal('gmail', 'saas_gmail');
  return kanal('kein', null);
}

/** Transportfabrik, die die Zugangsdaten des Kanals einsetzt (Tests injizieren `fabrik`). */
export function transportFabrikFuer(k, fabrik = createSMTPTransport) {
  return (opts = {}) => fabrik({ ...(k?.smtp || {}), ...opts });
}

/**
 * Echter Versand scheiterte an der Verbindung: Postfach als „unterbrochen" markieren, damit Einstellungen
 * und Dashboard es zeigen. Nur für die Praxis-Einstellung (quelle 'db'); still bei jedem Fehler.
 */
export async function meldeVerbindungsfehler(supabase, ownerId, k, err) {
  const code = String(err?.code || '');
  if (!supabase || !ownerId || k?.quelle !== 'db' || !VERBINDUNG_CODES.has(code)) return;
  try {
    await supabase.from('praxis_mailversand')
      .update({ status: 'unterbrochen', letzter_fehler_code: code.slice(0, 64), updated_at: new Date().toISOString() })
      .eq('owner_id', ownerId);
  } catch { /* Statusanzeige ist Komfort, der Versandfehler wird ohnehin gemeldet */ }
}
