// Quellen-Wächter (W-A06, onprem O-256) — ohne Netz, mit eingespeistem Holer.
//   node --test tools/quellen-waechter.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { links, normalisiere, vergleiche, hostErlaubt, lauf, ladeKonfig, holeSeite, rssSpur, textSpur, dekodiere, spur } from './quellen-waechter.mjs';

const URL_A = 'https://www.gkv-spitzenverband.de/heilmittel/seite.html';
const html = (...hrefs) => hrefs.map(h => `<a href="${h}">x</a>`).join('\n');

/** @param {Partial<import('./quellen-waechter.mjs').Quelle>} q */
const quelle = q => ({ id: 'q1', ne: 'Test', ref: 'Z-00', url: URL_A, muster: '\\.pdf$', wichtig: 'kritisch', folge: 'Folge', bekannt: [], ...q });

test('links: relativ → absolut, Query/jsessionid weg, &amp; dekodiert, sortiert, ohne Dubletten', () => {
  const h = html('/media/b.pdf?__blob=publicationFile&amp;v=2', 'a.pdf;jsessionid=ABC', '/media/b.pdf', 'mailto:x@y.de', '/seite.html');
  assert.deepEqual(links(h, URL_A, '\\.pdf$'), [
    'www.gkv-spitzenverband.de/heilmittel/a.pdf',
    'www.gkv-spitzenverband.de/media/b.pdf',
  ]);
  assert.equal(normalisiere('https://www.bfarm.de/x/y.zip;jsessionid=1?a=b#c'), 'www.bfarm.de/x/y.zip');
});

test('hostErlaubt: nur https + feste Liste', () => {
  assert.ok(hostErlaubt('https://www.g-ba.de/richtlinien/12/'));
  assert.ok(!hostErlaubt('http://www.g-ba.de/'));
  assert.ok(!hostErlaubt('https://evil.example/'));
  assert.ok(!hostErlaubt('kein url'));
});

test('holeSeite verweigert fremde Hosts ohne Netzanfrage', async () => {
  await assert.rejects(holeSeite('https://evil.example/'), /Host nicht erlaubt/);
});

test('vergleiche: neu und weg', () => {
  assert.deepEqual(vergleiche(['a', 'c'], ['a', 'b']), { neu: ['c'], weg: ['b'] });
});

test('lauf: unverändert = Stille', async () => {
  const r = await lauf({ quellen: [quelle({ bekannt: ['www.gkv-spitzenverband.de/x/a.pdf'] })], holer: async () => html('/x/a.pdf') });
  assert.deepEqual(r.meldungen, []);
});

test('lauf: neue Fassung wird gemeldet, mit Folge und Erledigungshinweis', async () => {
  const r = await lauf({
    quellen: [quelle({ bekannt: ['www.gkv-spitzenverband.de/x/a.pdf'] })],
    holer: async () => html('/x/a.pdf', '/x/b-2027.pdf'),
  });
  assert.equal(r.geaendert, 1);
  const m = r.meldungen.join('\n');
  assert.match(m, /\[KRITISCH\] q1/);
  assert.match(m, /NEU \(1\):\n {2}\+ www\.gkv-spitzenverband\.de\/x\/b-2027\.pdf/);
  assert.match(m, /--baseline=<id>/);
});

test('lauf: Seite tot / 0 Treffer / Host verboten = BLIND, andere Quellen trotzdem gemeldet', async () => {
  const r = await lauf({
    quellen: [
      quelle({ id: 'tot' }),
      quelle({ id: 'leer' }),
      quelle({ id: 'fremd', url: 'https://evil.example/x' }),
      quelle({ id: 'gut', bekannt: [] }),
    ],
    holer: async url => {
      if (url === URL_A) throw new Error('HTTP 503');
      return '';
    },
  });
  assert.equal(r.blind, 4); // tot, leer und gut haben dieselbe URL (→ 503), fremd ist Konfig-Fehler
  const m = r.meldungen.join('\n');
  assert.match(m, /tot[\s\S]*BLIND: Seite nicht abrufbar \(HTTP 503\)/);
  assert.match(m, /fremd[\s\S]*KONFIG-FEHLER/);
});

test('lauf: 0 Treffer nach Laden = BLIND mit Musterhinweis', async () => {
  const r = await lauf({ quellen: [quelle({})], holer: async () => html('/nur/seite.html') });
  assert.match(r.meldungen.join('\n'), /0 Treffer für das Muster/);
});

test('lauf: mehr als die Hälfte von bekannt weg = eine Seitenumbau-Warnung', async () => {
  const bekannt = ['a', 'b', 'c', 'd'].map(x => `www.gkv-spitzenverband.de/x/${x}.pdf`);
  const r = await lauf({ quellen: [quelle({ bekannt })], holer: async () => html('/x/a.pdf', '/y/neu.pdf') });
  assert.equal(r.geaendert, 0);
  assert.equal(r.blind, 1);
  assert.match(r.meldungen.join('\n'), /Seitenumbau\? 3 von 4/);
});

test('lauf: höchstens 20 Links pro Quelle in der Nachricht', async () => {
  const hrefs = Array.from({ length: 25 }, (_, i) => `/x/f${String(i).padStart(2, '0')}.pdf`);
  const r = await lauf({ quellen: [quelle({})], holer: async () => html(...hrefs) });
  const m = r.meldungen.join('\n');
  assert.equal((m.match(/^ {2}\+ /gm) || []).length, 20);
  assert.match(m, /… und 5 weitere/);
});

test('links: eingebettete JSON-URLs (GKV-SV nach Relaunch) und &quot;-Attribute', () => {
  const h = `<div data-x="{&quot;url&quot;:&quot;\\/media\\/podologie\\/anlage-2.pdf&quot;}"></div><script>{"url":"\\u002Fmedia\\/x.pdf"}</script>`;
  assert.deepEqual(links(h, URL_A, '\\.pdf$'), [
    'www.gkv-spitzenverband.de/media/podologie/anlage-2.pdf',
    'www.gkv-spitzenverband.de/media/x.pdf',
  ]);
});

test('rssSpur: Link + pubDate, CDATA, Muster filtert', () => {
  const xml = `<rss><channel>
    <item><title>a</title><link>https://www.gkv-datenaustausch.de/media/GGT.pdf</link><pubDate>Mon, 14 Sep 2020</pubDate></item>
    <item><link><![CDATA[https://www.gkv-datenaustausch.de/media/anders.html]]></link><pubDate>X</pubDate></item>
  </channel></rss>`;
  assert.deepEqual(rssSpur(xml, 'GGT\\.pdf$'), ['www.gkv-datenaustausch.de/media/GGT.pdf | Mon, 14 Sep 2020']);
});

test('textSpur: Tags weg, Entities dekodiert (gesetze-im-internet schreibt &#246;)', () => {
  const h = '<p>mindestens jedoch 5 Euro und h&#246;chstens 10 Euro</p><script>höchstens 99 Euro</script>';
  assert.deepEqual(textSpur(h, '((?:mindestens|höchstens)[^.;]{0,30}?\\d+ Euro)'), ['höchstens 10 Euro', 'mindestens jedoch 5 Euro']);
});

test('dekodiere: Zeichensatz aus Header oder meta', () => {
  const latin = Buffer.from('<meta charset="iso-8859-1">\xf6', 'latin1');
  assert.match(dekodiere(latin, 'text/html'), /ö$/);
  assert.match(dekodiere(Buffer.from('ö', 'utf8'), 'text/html; charset=utf-8'), /^ö$/);
});

test('spur: Art groesse ergibt eine Zeile mit Bytes, kaputte Antwort = 0 Treffer', async () => {
  const q = quelle({ art: 'groesse', url: 'https://www.kbv.de/x/liste.pdf' });
  assert.deepEqual(await spur(q, async () => '854441'), ['www.kbv.de/x/liste.pdf | 854441 Bytes']);
  assert.deepEqual(await spur(q, async () => ''), []);
});

test('Konfiguration im Repo ist gültig und jede URL steht in der Host-Liste', () => {
  const { quellen } = ladeKonfig();
  assert.ok(quellen.length > 0);
  for (const q of quellen) assert.ok(hostErlaubt(q.url), `${q.id}: ${q.url}`);
});

test('rein: Steuer-/Bidi-Zeichen weg, § und Umlaute bleiben, Länge begrenzt', async () => {
  const { rein } = await import('./quellen-waechter.mjs');
  assert.equal(rein('§302 — Grüße‮\u0007x'), '§302 — Grüße  x');
  assert.equal(rein('a'.repeat(400), 300).length, 300);
});
