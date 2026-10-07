// K2b.15 — Box-Anpassungen: Route öffnen, Support kontaktieren, Mail vorbereiten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeLink, hausbesuchZiel } from './hausbesuch-route.js';
import { supportLink, SUPPORT_ADRESSE } from './support-kontakt.js';
import { mailtoLink, mailEntwurfOeffnen } from './mail-entwurf.js';

const fakeDoc = (els) => ({ getElementById: id => els[id] || null });

test('routeLink: Ziel kodiert, kein Start, keine API', () => {
  const l = routeLink('Hauptstraße 12, 53721 Siegburg');
  assert.ok(l.startsWith('https://www.google.com/maps/dir/?api=1&destination='));
  assert.ok(l.includes(encodeURIComponent('Hauptstraße 12, 53721 Siegburg')));
  assert.ok(!l.includes('origin='));
});

test('hausbesuchZiel: Anzeige vor Eingabefeldern, Platzhalter zählt nicht', () => {
  assert.equal(hausbesuchZiel(fakeDoc({
    bkHbAddrView: { hidden: false }, bkHbAddressText: { textContent: 'Weg 1, 12345 Ort' },
  })), 'Weg 1, 12345 Ort');
  assert.equal(hausbesuchZiel(fakeDoc({
    bkHbAddrView: { hidden: false }, bkHbAddressText: { textContent: '— Patient auswählen —' },
  })), '');
  assert.equal(hausbesuchZiel(fakeDoc({
    bkHbAddrView: { hidden: true }, bkHbAddressText: { textContent: 'alt' },
    bkHbStreet: { value: ' Weg 2 ' }, bkHbPlz: { value: '12345' }, bkHbCity: { value: 'Ort' },
  })), 'Weg 2, 12345 Ort');
});

test('supportLink: Support-Adresse, Hinweis keine Patientendaten', () => {
  const l = supportLink();
  assert.ok(l.startsWith(`mailto:${SUPPORT_ADRESSE}?`));
  assert.ok(decodeURIComponent(l).includes('keine Patientendaten'));
});

test('mailtoLink: Empfänger lesbar, Betreff + Text kodiert', () => {
  const l = mailtoLink({ to: 'a.b@example.de', subject: 'Termin & Zeit', text: 'Zeile 1\nZeile 2' });
  assert.ok(l.startsWith('mailto:a.b@example.de?subject=Termin%20%26%20Zeit&body='));
  assert.ok(l.includes('Zeile%201%0D%0AZeile%202'), 'CRLF nach RFC 6068');
});

test('mailEntwurfOeffnen: ohne Empfänger nichts, sonst mailto', () => {
  const win = { location: { href: '' } };
  assert.equal(mailEntwurfOeffnen(null, win), false);
  assert.equal(mailEntwurfOeffnen({ subject: 'x' }, win), false);
  assert.equal(win.location.href, '');
  assert.equal(mailEntwurfOeffnen({ to: 'p@example.de', subject: 's', text: 't' }, win), true);
  assert.ok(win.location.href.startsWith('mailto:p@example.de?'));
});
