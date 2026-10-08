// O-178 / K2b.16 — „Über diese Software".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verbindungenHtml, herstellerHtml, rechtslinksFuerKutu, ueberSeiteStarten, RECHTEVERMERK } from './ueber.js';

test('Rechtevermerk ist bis K2b.16 offen (null) und erscheint dann NICHT auf der Seite', () => {
  // Wird dieser Test rot, ist T21 erledigt: Erwartung hier anpassen.
  assert.equal(RECHTEVERMERK, null);
  assert.doesNotMatch(herstellerHtml(), /©|vermerk/);
  assert.match(herstellerHtml(undefined, '© 2026 Test'), /class="vermerk">© 2026 Test/);
});

test('Verbindungstabelle escaped und markiert Betriebssystem-Zeilen', () => {
  const html = verbindungenHtml({ verbindungen: [
    { ziel: '<x>', zweck: 'a', wann: 'b', inhalt: 'c', von: 'Praxura' },
    { ziel: 'ntp', zweck: 'a', wann: 'b', inhalt: 'c', von: 'Betriebssystem' },
  ] });
  assert.match(html, /&lt;x&gt;/);
  assert.doesNotMatch(html, /<x>/);
  assert.match(html, /nicht Praxura/);
  assert.match(verbindungenHtml({ verbindungen: [] }), /Keine Außenverbindungen/);
});

function fakeDoc(ids, rechtsBloecke = []) {
  const els = Object.fromEntries(ids.map((id) => [id, {
    innerHTML: '', textContent: '', listeners: {},
    addEventListener(t, f) { this.listeners[t] = f; }, replaceChildren(c) { this.kind = c; },
  }]));
  return {
    els,
    getElementById: (id) => els[id] || null,
    querySelectorAll: () => rechtsBloecke,
    createElement: () => ({ textContent: '' }),
  };
}

test('Box: Rechtslinks werden durch „Über diese Software" ersetzt, SaaS unverändert', () => {
  const b = { innerHTML: '<a href="/impressum.html">Impressum</a>' };
  assert.equal(rechtslinksFuerKutu(false, fakeDoc([], [b])), 0);
  assert.match(b.innerHTML, /impressum/);
  assert.equal(rechtslinksFuerKutu(true, fakeDoc([], [b])), 1);
  assert.equal(b.innerHTML, '<a href="/ueber.html">Über diese Software</a>');
});

const IDS = ['hersteller', 'version', 'verbindungen', 'server-lizenzen', 'lizenzen-laden'];

test('ohne Anmeldung: Version sichtbar, Verbindungen/Lizenzen nur Hinweis, keine geschützte Anfrage', async () => {
  const doc = fakeDoc(IDS);
  const aufrufe = [];
  const fetchFn = async (url) => { aufrufe.push(url); return { ok: true, json: async () => ({ version: '0.4.0+abc1234' }) }; };
  await ueberSeiteStarten({ doc, apiBase: '/api', holeToken: async () => null, fetchFn });
  assert.equal(doc.els.version.textContent, '0.4.0+abc1234');
  assert.match(doc.els.verbindungen.innerHTML, /Anmeldung/);
  assert.deepEqual(aufrufe, ['/api/ueber']);
});

test('API nicht erreichbar: Seite zeigt statische Teile, Version „nicht abrufbar"', async () => {
  const doc = fakeDoc(IDS);
  await ueberSeiteStarten({ doc, apiBase: '/api', holeToken: async () => null, fetchFn: async () => { throw new Error('offline'); } });
  assert.equal(doc.els.version.textContent, 'nicht abrufbar');
  assert.match(doc.els.hersteller.innerHTML, /Yavuz Kemal Demir/);
});

test('angemeldet: Verbindungen mit Bearer-Token geladen', async () => {
  const doc = fakeDoc(IDS);
  const headers = [];
  const fetchFn = async (url, opt) => {
    headers.push(opt?.headers?.Authorization || null);
    if (url.endsWith('/verbindungen')) return { ok: true, json: async () => ({ verbindungen: [{ ziel: 'ghcr.io', zweck: 'z', wann: 'w', inhalt: 'i', von: 'Praxura' }] }) };
    return { ok: true, json: async () => ({ version: 'dev' }) };
  };
  await ueberSeiteStarten({ doc, apiBase: '/api', holeToken: async () => 'tok', fetchFn });
  assert.match(doc.els.verbindungen.innerHTML, /ghcr\.io/);
  assert.deepEqual(headers, [null, 'Bearer tok']);
});
