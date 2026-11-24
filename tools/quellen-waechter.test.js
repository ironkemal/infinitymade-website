// Quellen-Wächter (W-A06, onprem O-256) — ohne Netz, mit eingespeistem Holer.
//   node --test tools/quellen-waechter.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { links, normalisiere, vergleiche, hostErlaubt, lauf, ladeKonfig, holeSeite, rssSpur, textSpur, dekodiere, spur, uebernehme } from './quellen-waechter.mjs';

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

test('lauf: befunde und blindListe Struktur und Inhalte', async () => {
  const qMod = quelle({
    id: 'q-mod',
    ref: 'R-01',
    wichtig: 'kritisch',
    ne: 'Testquelle',
    url: 'https://www.gkv-spitzenverband.de/seite-mod.html',
    folge: 'Folge-Info',
    bekannt: ['www.gkv-spitzenverband.de/x/alt.pdf'],
  });
  const quellen = [
    qMod,
    quelle({ id: 'q-cfg', url: 'https://evil.example/x' }),
    quelle({ id: 'q-err', url: 'https://www.gkv-spitzenverband.de/timeout.html' }),
    quelle({ id: 'q-zero', url: 'https://www.g-ba.de/richtlinien/12/' }),
    quelle({
      id: 'q-umbau',
      url: 'https://www.bfarm.de/DE/Kodiersysteme/Services/Downloads/_node.html',
      bekannt: ['a', 'b', 'c', 'd'].map(x => `www.bfarm.de/${x}.pdf`),
      muster: '\\.pdf$',
    }),
  ];
  const r = await lauf({
    quellen,
    holer: async url => {
      if (url.includes('seite-mod.html')) return html('/x/alt.pdf', '/x/neu.pdf');
      if (url.includes('timeout.html')) throw new Error('Timeout');
      if (url.includes('g-ba.de')) return html('/kein-treffer.html');
      if (url.includes('bfarm.de')) return html('/a.pdf', '/neu.pdf');
      return '';
    },
  });

  assert.equal(r.geaendert, 1);
  assert.equal(r.blind, 4);

  // befunde nur für geaendert
  assert.equal(r.befunde.length, 1);
  assert.deepEqual(r.befunde[0], {
    id: 'q-mod',
    ref: 'R-01',
    wichtig: 'kritisch',
    ne: 'Testquelle',
    url: 'https://www.gkv-spitzenverband.de/seite-mod.html',
    folge: 'Folge-Info',
    art: 'links',
    neu: ['www.gkv-spitzenverband.de/x/neu.pdf'],
    weg: [],
  });

  // blindListe mit allen 4 Ursachen
  assert.deepEqual(r.blindListe, [
    { id: 'q-cfg', wichtig: 'kritisch', sebep: 'konfig', url: 'https://evil.example/x' },
    { id: 'q-err', wichtig: 'kritisch', sebep: 'abruf', url: 'https://www.gkv-spitzenverband.de/timeout.html' },
    { id: 'q-zero', wichtig: 'kritisch', sebep: 'null-treffer', url: 'https://www.g-ba.de/richtlinien/12/' },
    { id: 'q-umbau', wichtig: 'kritisch', sebep: 'umbau', url: 'https://www.bfarm.de/DE/Kodiersysteme/Services/Downloads/_node.html' },
  ]);
});

test('CLI: --json schreibt strukturierte Datei und kann mit --out kombiniert werden', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'qw-json-'));
  const jsonDatei = join(tmpDir, 'bericht.json');
  const outDir = join(tmpDir, 'meldungen');
  const tempKonfig = join(tmpDir, 'test-konfig.json');

  const testQuelle = {
    id: 't1',
    ref: 'Z-00',
    wichtig: 'kritisch',
    ne: 'Test Quelle',
    url: URL_A,
    muster: '\\.pdf$',
    folge: 'Folge',
    bekannt: ['www.gkv-spitzenverband.de/heilmittel/a.pdf'],
  };
  writeFileSync(tempKonfig, JSON.stringify({ quellen: [testQuelle] }, null, 2));

  execFileSync(process.execPath, [
    'tools/quellen-waechter.mjs',
    `--konfig=${tempKonfig}`,
    `--json=${jsonDatei}`,
    `--out=${outDir}`,
  ], {
    env: {
      ...process.env,
      QW_MOCK_BODY: html('/heilmittel/a.pdf', '/heilmittel/b.pdf'),
    },
  });

  assert.ok(existsSync(jsonDatei));
  const inhalt = JSON.parse(readFileSync(jsonDatei, 'utf8'));
  assert.ok(inhalt.stand && !isNaN(Date.parse(inhalt.stand)));
  assert.equal(inhalt.geaendert, 1);
  assert.equal(inhalt.blind, 0);
  assert.equal(inhalt.befunde.length, 1);
  assert.equal(inhalt.befunde[0].id, 't1');
  assert.deepEqual(inhalt.befunde[0].neu, ['www.gkv-spitzenverband.de/heilmittel/b.pdf']);
  assert.deepEqual(inhalt.blindListe, []);

  // verify --out was also written
  assert.ok(existsSync(join(outDir, 'msg-01.txt')));

  rmSync(tmpDir, { recursive: true, force: true });
});

test('uebernehme: erfolgreiche Übernahme aktualisiert q.bekannt in Live-Reihenfolge', async () => {
  const q = quelle({
    bekannt: ['www.gkv-spitzenverband.de/x/a.pdf', 'www.gkv-spitzenverband.de/x/b.pdf'],
  });
  const konfig = { quellen: [q] };
  const neu = ['www.gkv-spitzenverband.de/x/c.pdf'];
  const weg = ['www.gkv-spitzenverband.de/x/b.pdf'];

  const r = await uebernehme({
    konfig,
    id: 'q1',
    neu,
    weg,
    holer: async () => html('/x/a.pdf', '/x/c.pdf'),
  });
  assert.deepEqual(r, { ok: true, id: 'q1', eklendi: 1, cikarildi: 1 });
  assert.deepEqual(q.bekannt, [
    'www.gkv-spitzenverband.de/x/a.pdf',
    'www.gkv-spitzenverband.de/x/c.pdf',
  ]);
});

test('uebernehme: Seite seit Befund geändert -> Fehler "kaynak vakadan sonra yine değişti" und nichts geändert', async () => {
  const startBekannt = ['www.gkv-spitzenverband.de/x/a.pdf', 'www.gkv-spitzenverband.de/x/b.pdf'];
  const q = quelle({ bekannt: [...startBekannt] });
  const konfig = { quellen: [q] };
  const neu = ['www.gkv-spitzenverband.de/x/c.pdf'];
  const weg = ['www.gkv-spitzenverband.de/x/b.pdf'];

  await assert.rejects(
    uebernehme({
      konfig,
      id: 'q1',
      neu,
      weg,
      holer: async () => html('/x/a.pdf', '/x/c.pdf', '/x/d.pdf'),
    }),
    /kaynak vakadan sonra yine değişti/
  );
  // konfig unverändert
  assert.deepEqual(q.bekannt, startBekannt);
});

test('uebernehme: Validierungsfehler (unbekannt, muster, host, weg, neu)', async () => {
  const q = quelle({
    bekannt: ['www.gkv-spitzenverband.de/x/a.pdf'],
    muster: '\\.pdf$',
  });
  const konfig = { quellen: [q] };

  // 1. unbekannte id
  await assert.rejects(
    uebernehme({ konfig, id: 'unbekannt', neu: [], weg: [] }),
    /unbekannte Quelle/
  );

  // 2. muster uymayan neu
  await assert.rejects(
    uebernehme({
      konfig,
      id: 'q1',
      neu: ['www.gkv-spitzenverband.de/x/datei.zip'],
      weg: [],
    }),
    /muster/i
  );

  // 3. izinsiz host
  await assert.rejects(
    uebernehme({
      konfig,
      id: 'q1',
      neu: ['evil.example.com/x/b.pdf'],
      weg: [],
    }),
    /host/i
  );

  // 4. normalisiere formatında olmayan (z.B. https:// oder Query)
  await assert.rejects(
    uebernehme({
      konfig,
      id: 'q1',
      neu: ['https://www.gkv-spitzenverband.de/x/b.pdf'],
      weg: [],
    }),
    /normalisiere/
  );

  // 5. weg'de bekannt'ta olmayan
  await assert.rejects(
    uebernehme({
      konfig,
      id: 'q1',
      neu: [],
      weg: ['www.gkv-spitzenverband.de/x/nicht-vorhanden.pdf'],
    }),
    /bekannt/
  );

  // 6. neu'da zaten bekannt olan
  await assert.rejects(
    uebernehme({
      konfig,
      id: 'q1',
      neu: ['www.gkv-spitzenverband.de/x/a.pdf'],
      weg: [],
    }),
    /bekannt/
  );
});

test('uebernehme: rss und groesse Format (link | iz)', async () => {
  // 1. rss Quelle
  const qRss = quelle({
    id: 'rss1',
    art: 'rss',
    url: 'https://www.gkv-datenaustausch.de/feed.xml',
    muster: 'GGT\\.pdf$',
    bekannt: ['www.gkv-datenaustausch.de/media/GGT.pdf | Mon, 14 Sep 2020'],
  });
  const konfigRss = { quellen: [qRss] };
  const neuRss = ['www.gkv-datenaustausch.de/media/GGT.pdf | Tue, 15 Sep 2020'];
  const wegRss = ['www.gkv-datenaustausch.de/media/GGT.pdf | Mon, 14 Sep 2020'];

  const rssXml = `<rss><channel><item>
    <link>https://www.gkv-datenaustausch.de/media/GGT.pdf</link>
    <pubDate>Tue, 15 Sep 2020</pubDate>
  </item></channel></rss>`;

  const resRss = await uebernehme({
    konfig: konfigRss,
    id: 'rss1',
    neu: neuRss,
    weg: wegRss,
    holer: async () => rssXml,
  });
  assert.deepEqual(resRss, { ok: true, id: 'rss1', eklendi: 1, cikarildi: 1 });
  assert.deepEqual(qRss.bekannt, ['www.gkv-datenaustausch.de/media/GGT.pdf | Tue, 15 Sep 2020']);

  // Fehler: rss Element ohne ' | '
  await assert.rejects(
    uebernehme({
      konfig: konfigRss,
      id: 'rss1',
      neu: ['www.gkv-datenaustausch.de/media/GGT.pdf'],
      weg: [],
    }),
    /link \| iz/
  );

  // 2. groesse Quelle
  const qGr = quelle({
    id: 'gr1',
    art: 'groesse',
    url: 'https://www.kbv.de/x/liste.pdf',
    muster: '.',
    bekannt: ['www.kbv.de/x/liste.pdf | 100 Bytes'],
  });
  const konfigGr = { quellen: [qGr] };
  const neuGr = ['www.kbv.de/x/liste.pdf | 200 Bytes'];
  const wegGr = ['www.kbv.de/x/liste.pdf | 100 Bytes'];

  const resGr = await uebernehme({
    konfig: konfigGr,
    id: 'gr1',
    neu: neuGr,
    weg: wegGr,
    holer: async () => '200',
  });
  assert.deepEqual(resGr, { ok: true, id: 'gr1', eklendi: 1, cikarildi: 1 });
  assert.deepEqual(qGr.bekannt, ['www.kbv.de/x/liste.pdf | 200 Bytes']);

  // Fehler: fremder Host in groesse
  await assert.rejects(
    uebernehme({
      konfig: konfigGr,
      id: 'gr1',
      neu: ['evil.example.com/x/liste.pdf | 200 Bytes'],
      weg: [],
    }),
    /host/i
  );
});

test('CLI: --uebernehme übernimmt Änderungen und beendet bei Fehler mit exit 1', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'qw-ueber-'));
  const tempKonfig = join(tmpDir, 'test-konfig.json');
  const neuFile = join(tmpDir, 'neu.txt');
  const wegFile = join(tmpDir, 'weg.txt');

  const testQuelle = {
    id: 't1',
    ref: 'Z-00',
    wichtig: 'kritisch',
    ne: 'Test Quelle',
    url: URL_A,
    muster: '\\.pdf$',
    folge: 'Folge',
    bekannt: ['www.gkv-spitzenverband.de/heilmittel/a.pdf'],
  };
  writeFileSync(tempKonfig, JSON.stringify({ quellen: [testQuelle] }, null, 2));
  writeFileSync(neuFile, 'www.gkv-spitzenverband.de/heilmittel/b.pdf\n');
  writeFileSync(wegFile, '');

  // Erfolg
  const stdout = execFileSync(process.execPath, [
    'tools/quellen-waechter.mjs',
    `--konfig=${tempKonfig}`,
    '--uebernehme=t1',
    `--neu-datei=${neuFile}`,
    `--weg-datei=${wegFile}`,
  ], {
    env: {
      ...process.env,
      QW_MOCK_BODY: html('/heilmittel/a.pdf', '/heilmittel/b.pdf'),
    },
    encoding: 'utf8',
  });
  assert.match(stdout, /t1: 1 eklendi, 0 çıkarıldı/);

  const nachher = JSON.parse(readFileSync(tempKonfig, 'utf8'));
  assert.deepEqual(nachher.quellen[0].bekannt, [
    'www.gkv-spitzenverband.de/heilmittel/a.pdf',
    'www.gkv-spitzenverband.de/heilmittel/b.pdf',
  ]);

  // Fehler: wenn Live-Zustand abweicht -> Exit 1
  assert.throws(() => {
    execFileSync(process.execPath, [
      'tools/quellen-waechter.mjs',
      `--konfig=${tempKonfig}`,
      '--uebernehme=t1',
      `--neu-datei=${neuFile}`,
      `--weg-datei=${wegFile}`,
    ], {
      env: {
        ...process.env,
        QW_MOCK_BODY: html('/heilmittel/a.pdf', '/heilmittel/c.pdf'),
      },
      stdio: 'pipe',
    });
  });

  rmSync(tmpDir, { recursive: true, force: true });
});

test('uebernehme: art text Quellen akzeptieren Capture-Group-Werte ohne Regex-Fehler', async () => {
  const q = {
    id: 'dguv-test',
    ref: 'D-01',
    wichtig: 'normal',
    ne: 'DGUV Handlungsanleitung',
    url: 'https://publikationen.dguv.de/regelwerk/handlungsanleitung/',
    art: 'text',
    muster: 'Ausgabedatum:\\s*(\\d{4}\\.\\d{2})',
    folge: 'Preise',
    bekannt: ['2025.01'],
  };
  const konfig = { quellen: [q] };
  const holer = async () => 'Ausgabedatum: 2026.01';

  const res = await uebernehme({
    konfig,
    id: 'dguv-test',
    neu: ['2026.01'],
    weg: ['2025.01'],
    holer,
  });

  assert.equal(res.ok, true);
  assert.equal(res.eklendi, 1);
  assert.equal(res.cikarildi, 1);
  assert.deepEqual(q.bekannt, ['2026.01']);
});
