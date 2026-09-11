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

export function createSMTPTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
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
