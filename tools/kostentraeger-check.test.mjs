// node --test tools/kostentraeger-check.test.mjs  (offline, kein Netz)
import test from 'node:test';
import assert from 'node:assert/strict';
import { rssParsen, bekannteAusgaben, basisFuer, analysiere, nachrichten, lauf, DATEINAME_RE } from './kostentraeger-check.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const P = 'https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/sonstige_leistungserbringer/kostentraegerdateien_1/';
const item = (guid, d = 'g&uuml;ltig ab dem 01.10.2026- nicht barrierefrei -') =>
  `<item><guid><![CDATA[${guid}]]></guid><description><![CDATA[${d}]]></description></item>`;

test('RSS: gültige Links → Dateinamen, Datum', () => {
  const r = rssParsen(`<rss>${item(P + 'AO05Q426.ke0')}${item(P + 'BN050526.ke0', 'g&uuml;ltig ab dem 01.05.2026')}</rss>`);
  assert.deepEqual(r.eintraege.map(e => e.name), ['AO05Q426_KE0.txt', 'BN050526_KE0.txt']);
  assert.equal(r.eintraege[0].gueltigAb, '2026-10-01');
  assert.ok(r.eintraege.every(e => DATEINAME_RE.test(e.name)));
});

test('RSS: fremde Hosts, Traversal, Injection werden verworfen', () => {
  const bös = [
    'https://evil.example/media/AO05Q426.ke0',
    P + '../../etc/passwd.ke0',
    P + 'AO05Q426.ke0;rm -rf x',
    P + 'ao05q426.ke0',
    'http://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/sonstige_leistungserbringer/kostentraegerdateien_1/AO05Q426.ke0',
    P + 'AO05Q426.zip',
  ];
  const r = rssParsen(`<rss>${bös.map(b => item(b)).join('')}</rss>`);
  assert.equal(r.eintraege.length, 0);
  assert.equal(r.unerwartet.length, bös.length);
});

test('bekannte Ausgaben: AUSGABEN-Text + wissensbank, Basis = neueste mit gültig-ab <= Stichtag', () => {
  const text = "{ datei: 'AO05Q326_KE3.txt', gueltigAb: '2026-07-27' },\n{ datei: 'AO05Q426_KE0.txt', gueltigAb: '2026-10-01' },";
  const { ausgaben, bekannt } = bekannteAusgaben({ ladeText: text, wbNamen: ['EK05Q426_KE0.txt'] });
  assert.ok(bekannt.has('EK05Q426_KE0.TXT') && bekannt.has('AO05Q426_KE0.TXT'));
  assert.equal(basisFuer('AO05Q127_KE0.txt', ausgaben, '2026-09-30').name, 'AO05Q326_KE3.txt');
  assert.equal(basisFuer('AO05Q127_KE0.txt', ausgaben, '2026-10-02').name, 'AO05Q426_KE0.txt');
  assert.equal(basisFuer('ZZ05Q127_KE0.txt', ausgaben, '2026-10-02'), null);
});

const datei = (name = 'Kasse') =>
  "UNA:+,? 'UNB+UNOC:3+1+2+260701:1230+00402++X'IDK+100000001+99+" + name + "'VKG+02+100000002+5++07++01++00'VKG+09+100000009+5++21++01++00'IDK+100000002+99+Partner'";

test('Analyse: Zähler, IK-Kette, Papier, U+FFFD, lange VKG', () => {
  const a = analysiere(datei('Ka�se') + "IDK+100000003+99+X'VKG+02+100000002+5++07++01++00+++++x'");
  assert.equal(a.records, 3);
  assert.equal(a.iks.size, 3);
  assert.equal(a.ersatz, 1);
  assert.equal(a.vkgLang, 1);
  assert.deepEqual([...a.fehlPartner], ['100000009']); // Papier-Partner nicht als IDK in der Datei
  assert.equal(a.papier.get('100000001'), '100000009');
});

test('Nachrichten: teilt auf, Kopf/Fuß bleiben', () => {
  const m = nachrichten(['a'.repeat(3000), 'b'.repeat(3000)], 'KOPF', 'FUSS');
  assert.ok(m.length >= 2 && m.every(x => x.length <= 3800));
  assert.ok(m[0].startsWith('KOPF') && m.at(-1).endsWith('FUSS'));
});

test('lauf: RSS nicht lesbar → BLIND-Meldung; nichts Neues → Stille; Fehler einer Datei nur dort', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ktc-'));
  const ohne = { out: dir, ladeText: '', wbNamen: [] };
  const blind = await lauf({ ...ohne, rssDatei: join(dir, 'gibt-es-nicht.xml') });
  assert.match(blind.meldungen[0], /BLIND/);
  const leer = join(dir, 'leer.xml'); writeFileSync(leer, '<rss></rss>');
  assert.match((await lauf({ ...ohne, rssDatei: leer })).meldungen[0], /BLIND/);
  const rss = join(dir, 'r.xml'); writeFileSync(rss, `<rss>${item(P + 'AO05Q426.ke0')}</rss>`);
  const still = await lauf({ ...ohne, rssDatei: rss, wbNamen: ['AO05Q426_KE0.txt'] });
  assert.deepEqual(still.meldungen, []);
});
