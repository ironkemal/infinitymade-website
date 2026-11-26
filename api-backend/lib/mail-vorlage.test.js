import { test } from 'node:test';
import assert from 'node:assert/strict';

import { absenderDomain, baueMessageId, renderePraxuraMail, baueMailOptionen } from './mail-vorlage.js';

test('absenderDomain und baueMessageId richten Message-ID an Absender-Domain aus', () => {
  assert.equal(absenderDomain('"Praxis Muster" <info@praxis-muster.de>'), 'praxis-muster.de');
  assert.equal(absenderDomain('kontakt@podologie.example'), 'podologie.example');
  const mid = baueMessageId('"Praxis" <info@praxis-muster.de>');
  assert.match(mid, /^<[a-f0-9]+\.\d+@praxis-muster\.de>$/);
});

test('renderePraxuraMail erzeugt maskiertes HTML und passenden Klartext', () => {
  const { html, text } = renderePraxuraMail({
    praxis: 'Praxis <Test> & Co',
    titel: 'Termin bestätigt',
    anrede: 'Hallo Erika,',
    absaetze: ['Ihr Termin wurde bestätigt.'],
    boxZeilen: [{ label: 'Datum', wert: '01.12.2026' }],
    aktionen: [{ label: 'Termin stornieren', href: 'https://app.praxura.de/booking-request.html?cancel=1', stil: 'link' }],
    hinweis: 'Bitte 5–10 Minuten Puffer einplanen.',
  });
  assert.ok(html.includes('Praxis &lt;Test&gt; &amp; Co'));
  assert.ok(!html.includes('<Test>'));
  assert.ok(html.includes('#2563EB'));
  assert.match(text, /Hallo Erika,/);
  assert.match(text, /Datum: 01\.12\.2026/);
  assert.match(text, /Termin stornieren: https:\/\/app\.praxura\.de/);
});

test('baueMailOptionen ergaenzt multipart text, messageId und optional Auto-Submitted', () => {
  const opt = baueMailOptionen({
    from: '"Praxis" <info@praxis.de>',
    to: 'patient@example.invalid',
    replyTo: 'info@praxis.de',
    subject: 'Termin bestätigt',
    html: '<p>Hallo Welt</p>',
    autoSubmitted: true,
  });
  assert.equal(opt.text, 'Hallo Welt');
  assert.match(opt.messageId, /@praxis\.de>$/);
  assert.equal(opt.headers?.['Auto-Submitted'], 'auto-generated');
});
