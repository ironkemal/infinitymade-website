import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusInfo, testMoeglich, anfrageKoerper, anfrage, einrichtenLinkHtml, ANBIETER_REIHENFOLGE, OHNE_POSTFACH_TEXT } from './mailversand.js';

test('statusInfo: nicht eingerichtet / verbunden / unterbrochen / Installation / Gmail', () => {
  assert.deepEqual(statusInfo({ einstellung: null }), { stufe: 'aus', titel: 'Nicht eingerichtet', text: OHNE_POSTFACH_TEXT });
  assert.equal(statusInfo({ einstellung: { modus: 'smtp', status: 'verbunden', absender_email: 'p@x.de' } }).titel, 'Verbunden');
  const f = statusInfo({ einstellung: { modus: 'smtp', status: 'unterbrochen' }, fehler: { meldung: 'Passwort abgelehnt.' } });
  assert.equal(f.stufe, 'fehler'); assert.equal(f.text, 'Passwort abgelehnt.');
  assert.equal(statusInfo({ einstellung: { modus: 'smtp', status: 'nicht_eingerichtet' } }).stufe, 'offen');
  assert.equal(statusInfo({ einstellung: { modus: 'aus' }, env: { host: 'mail.box', port: 587 } }).text, 'mail.box:587');
  assert.equal(statusInfo({ google: { verbunden: true, adresse: 'a@gmail.com' } }).titel, 'Verbunden über Gmail');
});

test('testMoeglich: eigenes Postfach oder Box-SMTP, nicht SaaS-Env', () => {
  assert.equal(testMoeglich({ einstellung: { modus: 'smtp' } }), true);
  assert.equal(testMoeglich({ env: { host: 'h' }, kutu: true }), true);
  assert.equal(testMoeglich({ env: { host: 'h' }, kutu: false }), false);
  assert.equal(testMoeglich({}), false);
});

test('anfrageKoerper: Passwort nur wenn eingegeben, Serverfelder nur bei „Andere"', () => {
  const k = anfrageKoerper('ionos', { absender_email: ' a@b.de ', absender_name: 'P', passwort: '', smtp_host: 'boese' });
  assert.deepEqual(k, { preset: 'ionos', absender_email: 'a@b.de', absender_name: 'P' });
  const a = anfrageKoerper('andere', { absender_email: 'a@b.de', passwort: 'x', smtp_host: ' mail.b.de ', smtp_port: '465', smtp_sicherheit: 'ssl', smtp_benutzer: 'u' });
  assert.equal(a.passwort, 'x'); assert.equal(a.smtp_port, 465); assert.equal(a.smtp_host, 'mail.b.de');
});

test('anfrage: Bearer-Token, Fehler mit Code und Hinweis', async () => {
  let gesehen;
  const fetchImpl = async (url, opt) => { gesehen = { url, opt }; return { ok: false, status: 502, json: async () => ({ error: 'abgelehnt', code: 'EAUTH', hinweis: 'App-Passwort' }) }; };
  await assert.rejects(anfrage({ apiBase: '/api', getToken: async () => 'T', fetchImpl }, 'POST', '/mailversand/test'),
    e => e.code === 'EAUTH' && e.status === 502 && e.daten.hinweis === 'App-Passwort');
  assert.equal(gesehen.url, '/api/mailversand/test'); assert.equal(gesehen.opt.headers.Authorization, 'Bearer T');
});

test('Einrichten-Link und Anbieterliste', () => {
  assert.match(einrichtenLinkHtml(), /data-mailversand-link="1"/);
  assert.ok(!einrichtenLinkHtml('<b>x</b>').includes('<b>'));
  assert.deepEqual(ANBIETER_REIHENFOLGE.slice(0, 2), ['outlook', 'gmail']);
  assert.equal(ANBIETER_REIHENFOLGE.at(-1), 'andere');
});
