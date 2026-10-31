import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { istOeffentlicherHost, einbettungsHost, einbettungsCode, einbettungsHinweis } from './widget-einbettung.js';

const OWNER = '11111111-2222-4333-8444-555555555555';

test('Box mit öffentlicher Adresse bekommt ihren eigenen Host, nie praxura.de als Ziel', () => {
  assert.equal(einbettungsHost({ istKutu: true, origin: 'https://hafer-turm-9.box.praxura.de' }), 'https://hafer-turm-9.box.praxura.de');
  assert.equal(einbettungsHost({ istKutu: true, origin: 'https://termine.beispielpraxis.de/dashboard.html' }), 'https://termine.beispielpraxis.de');
});

test('LAN-Box bekommt keinen Code', () => {
  for (const origin of ['https://praxis.home.arpa', 'https://kasten.local', 'http://praxis.beispiel.de', 'https://192.168.1.20', 'https://10.0.0.4', 'https://localhost:8443']) {
    assert.equal(einbettungsHost({ istKutu: true, origin }), null, origin);
  }
});

test('SaaS zeigt immer auf praxura.de, die App-Subdomain lässt sich nicht rahmen', () => {
  assert.equal(einbettungsHost({ istKutu: false, origin: 'https://beispiel.de' }), 'https://praxura.de');
});

test('Ungültige Adresse gilt nicht als öffentlich', () => {
  assert.equal(istOeffentlicherHost('kein url'), false);
});

test('Code rahmt nur das Widget, nie booking.html, und trägt die Sandbox ohne Top-Navigation', () => {
  const code = einbettungsCode({ host: 'https://praxura.de', ownerId: OWNER });
  assert.match(code, /\/widget\/booking-widget\.html\?owner=11111111-2222-4333-8444-555555555555"/);
  assert.doesNotMatch(code, /booking\.html/);
  assert.match(code, /sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"/);
  assert.doesNotMatch(code, /allow-top-navigation/);
  assert.match(code, /referrerpolicy="strict-origin"/);
});

test('Ohne gültige Praxis-ID oder Host gibt es keinen Code', () => {
  assert.equal(einbettungsCode({ host: 'https://praxura.de', ownerId: '"><script>' }), '');
  assert.equal(einbettungsCode({ host: null, ownerId: OWNER }), '');
});

test('Hinweis an die Praxis nennt die Pflichten, in der Box auch die Verantwortung', () => {
  assert.match(einbettungsHinweis({ istKutu: true }), /auf Ihrem Server; Sie sind verantwortlich/);
  assert.match(einbettungsHinweis({ istKutu: true }), /Datenschutzerklärung/);
  assert.doesNotMatch(einbettungsHinweis({ istKutu: false }), /Ihrem Server/);
});

test('Die Sonder-CSP für das Widget existiert in SaaS und Box', () => {
  const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
  const caddy = readFileSync(new URL('../onprem/Caddyfile', import.meta.url), 'utf8');
  assert.match(vercel, /\/widget\/booking-widget\.html/);
  assert.match(caddy, /booking-widget\.html/);
});
