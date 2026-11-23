// Box-Test 22.11.2026, Problem 2: „Ein automatischer Test schlägt an, sobald ein fremder Host eingebaut wird.“
// Prüfer: tools/fremde-hosts.mjs (auch in tools/check-onprem.sh). onprem-Freigabe 23.11.2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pruefe, hosts, geladeneHosts, cspFremdhosts, ohneKommentare, ERLAUBT } from './fremde-hosts.mjs';

test('Repo-Stand: Box-Frontend und -Backend ohne unbekannte oder ungeschaltete Fremdhosts', () => {
  const { fehler, dateien } = pruefe();
  assert.deepEqual(fehler, []);
  assert.ok(dateien.frontend > 100 && dateien.backend > 100, 'Dockerfile-COPY-Listen wurden gelesen');
});

test('Gegenprobe: eingebauter Fremdhost in einer Box-Datei → rot', () => {
  const { fehler } = pruefe({ extra: { 'module/gegenprobe.js': "const x = 'https://tracker.example.com/pixel';" } });
  assert.ok(fehler.some(f => f.includes('unbekannter Host tracker.example.com')), fehler.join('\n'));
});

test('Gegenprobe: erlaubter Verweis-Host als Skriptquelle → rot (nur Klasse „laden“ darf laden)', () => {
  const { fehler } = pruefe({ extra: { 'gegenprobe.html': '<script src="https://www.google.com/x.js"></script>' } });
  assert.ok(fehler.some(f => f.includes('lädt automatisch von www.google.com')), fehler.join('\n'));
});

test('Ladekontexte werden erkannt, Links und Kommentare nicht', () => {
  for (const [code, host] of [
    ['<img src="https://a.example">', 'a.example'], ['el.src = "https://b.example/x"', 'b.example'],
    ['fetch("https://c.example/api")', 'c.example'], ['import("https://d.example/m.js")', 'd.example'],
    ['@import url("https://e.example/s.css");', 'e.example'], ['background:url(https://f.example/i.png)', 'f.example'],
    ['new WebSocket("wss://g.example/ws")', 'g.example'], ['navigator.sendBeacon("https://h.example")', 'h.example'],
    ['<link rel="preconnect" href="https://i.example">', 'i.example'], ['<img srcset="https://j.example/a.png 2x">', 'j.example'],
  ]) assert.deepEqual(geladeneHosts(code), [host], code);
  assert.deepEqual(geladeneHosts('<a href="https://k.example">Link</a>'), []);
  assert.deepEqual(geladeneHosts('// src="https://l.example/x.js"\n/* fetch("https://m.example") */'), []);
  assert.deepEqual(hosts('const u = "https://n.example"; // https://o.example'), ['n.example']);
  assert.equal(ohneKommentare('a = "https://p.example";'), 'a = "https://p.example";', 'https:// ist kein Kommentar');
});

test('Box-CSP: feste Hosts rot, Platzhalter und ACME-Zeilen außerhalb des Headers nicht', () => {
  const caddy = `acme_ca https://acme-v02.api.letsencrypt.org/directory
    header Content-Security-Policy "default-src 'self'; connect-src 'self' {$SUPABASE_PUBLIC_URL}; frame-ancestors https:;"`;
  assert.deepEqual(cspFremdhosts(caddy), []);
  assert.deepEqual(cspFremdhosts(caddy + `\n header Content-Security-Policy "script-src https://cdn.example"`), ['cdn.example']);
});

test('jede Allowlist-Zeile hat Klasse und Begründung; nur-SaaS nennt ihre env-Namen', () => {
  for (const [h, e] of Object.entries(ERLAUBT)) {
    assert.ok(['verweis', 'laden', 'box', 'nur-saas'].includes(e.klasse), h);
    assert.ok(e.grund.length > 10, h);
    if (e.klasse === 'nur-saas') assert.ok(e.env?.length, h);
  }
});
