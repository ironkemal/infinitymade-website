// O-178 / K2b.16 — „Über diese Software".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verbindungenHtml, herstellerHtml, rechtslinksFuerKutu, praxisFusszeileHtml, ueberSeiteStarten, RECHTEVERMERK } from './ueber.js';

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

test('Patientenseite (data-rechtslinks="praxis"): Praxisangaben in Box UND SaaS; ohne Impressum-URL nur Klartext', () => {
  const blk = () => ({ innerHTML: 'alt', getAttribute: () => 'praxis' });
  const praxis = { name: 'Praxis <Nord>', anschrift: 'Weg 1, 53721 Siegburg', impressumUrl: '', datenschutzHref: '#datenschutzhinweise' };
  const saas = blk();
  assert.equal(rechtslinksFuerKutu(false, fakeDoc([], [saas]), praxis), 1);
  assert.match(saas.innerHTML, /<span>Praxis &lt;Nord&gt; · Weg 1, 53721 Siegburg<\/span>/);
  assert.doesNotMatch(saas.innerHTML, /Impressum|ueber\.html|Cookie/);
  assert.match(saas.innerHTML, /href="#datenschutzhinweise"/);
  const box = blk();
  rechtslinksFuerKutu(true, fakeDoc([], [box]), praxis);
  assert.match(box.innerHTML, /Über diese Software/);
});

test('Patientenseite: https-URLs als externe Links mit noreferrer, javascript: wird verworfen', () => {
  const html = praxisFusszeileHtml({ name: 'P', anschrift: 'A', impressumUrl: 'https://praxis.de/impressum', datenschutzHref: 'https://praxis.de/ds' }, false);
  assert.match(html, /href="https:\/\/praxis\.de\/impressum" target="_blank" rel="noopener noreferrer">Impressum/);
  assert.match(html, /href="https:\/\/praxis\.de\/ds"[^>]*>Datenschutz</);
  assert.doesNotMatch(html, /<span>/);
  const boese = praxisFusszeileHtml({ name: 'P', anschrift: 'A', impressumUrl: 'javascript:alert(1)', datenschutzHref: 'http://x.de' }, false);
  assert.doesNotMatch(boese, /javascript|http:\/\/x/);
  assert.match(boese, /<span>P · A<\/span>/);
});

test('Patientenseite ohne Praxisdaten (noch nicht geladen): SaaS unverändert, Box nur „Über diese Software"', () => {
  const b = { innerHTML: 'alt', getAttribute: () => 'praxis' };
  assert.equal(rechtslinksFuerKutu(false, fakeDoc([], [b])), 0);
  assert.equal(b.innerHTML, 'alt');
});
