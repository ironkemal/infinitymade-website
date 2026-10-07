// Mail-Entwurf statt Versand — Box ohne SMTP (KHS K2b.15, Entscheidung K-19 e, 05.10.2026).
//
// Im SaaS schicken die Termin-Anfrage-Routen (approve/decline/offer/message in
// server.js) die Patientenmail selbst per SMTP. In der Box ist SMTP_HOST meist
// leer (onprem/.env.template, „leer = entfällt still") — der Patient erfuhr
// nichts, „Nachricht senden" lief in 503. Darum liefert der Server dort statt
// zu senden einen Entwurf {to, subject, text}; der Browser des Inhabers öffnet
// ihn als mailto im eigenen Mailprogramm der Praxis (module/mail-entwurf.js).
// Der Entwurf geht nur an den angemeldeten Inhaber zurück, nicht nach außen.
//
// Keine Links im Box-Text (onprem O-155, 07.10.2026): ein Storno-/Annahme-Link
// zeigt auf die Box-Adresse, die der Patient von zu Hause meist nicht erreicht.
// Bis Kemal O-155 entscheidet, steht dort „Bitte rufen Sie die Praxis an".
// Praxisseitiger Direktversand aus dem eigenen Postfach: Ops #335 (nach Launch).
import { istKutu } from './dagitim.js';

export function mailEntwurfStattVersand() {
  return istKutu() && !process.env.SMTP_HOST;
}

const datumDe = d => new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('de-DE');
const gruss = praxis => `\n\nFreundliche Grüße\n${praxis || 'Ihre Praxis'}`;

export function entwurfBestaetigt({ to, vorname, praxis, datum, uhrzeit, therapeut }) {
  const zeilen = [
    praxis ? `Praxis: ${praxis}` : null,
    datum ? `Datum: ${datumDe(datum)}` : null,
    uhrzeit ? `Uhrzeit: ${uhrzeit} Uhr` : null,
    therapeut ? `Therapeut: ${therapeut}` : null,
  ].filter(Boolean).join('\n');
  return {
    to,
    subject: `Ihr Termin wurde bestätigt – ${praxis || 'Ihre Praxis'}`,
    text: `Hallo ${vorname || ''},\n\nIhr Termin wurde bestätigt.\n\n${zeilen}\n\n`
      + 'Die Uhrzeit ist ein Richtwert – bitte planen Sie 5–10 Minuten Puffer ein. '
      + 'Wenn Sie den Termin nicht wahrnehmen können, rufen Sie bitte die Praxis an.'
      + gruss(praxis),
  };
}

export function entwurfAbgelehnt({ to, vorname, praxis, grund }) {
  return {
    to,
    subject: 'Terminanfrage – Leider nicht möglich',
    text: `Hallo ${vorname || ''},\n\nleider können wir Ihren Wunschtermin nicht bestätigen.`
      + (grund ? `\nGrund: ${grund}` : '')
      + '\n\nBitte rufen Sie uns an, dann finden wir gemeinsam einen Termin.'
      + gruss(praxis),
  };
}

export function entwurfGegenangebot({ to, vorname, praxis, grund, termine }) {
  const liste = (termine || []).map(a => {
    const tag = new Date(`${a.date}T12:00:00`).toLocaleDateString('de-DE', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    });
    return `- ${tag} um ${a.time} Uhr`;
  }).join('\n');
  return {
    to,
    subject: `Terminvorschlag – ${praxis || 'Ihre Praxis'}`,
    text: `Hallo ${vorname || ''},\n\nIhren Wunschtermin können wir leider nicht anbieten.`
      + (grund ? ` ${grund}` : '')
      + `\n\nDiese Zeiten hätten wir frei:\n${liste}\n\n`
      + 'Bitte rufen Sie die Praxis an oder antworten Sie auf diese Mail, welcher Termin passt. '
      + 'Es gilt, was zuerst bestätigt wird. Die Uhrzeit ist ein Richtwert – bitte planen Sie 5–10 Minuten Puffer ein.'
      + gruss(praxis),
  };
}

export function entwurfNachricht({ to, vorname, praxis, nachricht }) {
  return {
    to,
    subject: `Nachricht von ${praxis || 'Ihrer Praxis'}`,
    text: `Hallo ${vorname || ''},\n\n${nachricht}${gruss(praxis)}`,
  };
}
