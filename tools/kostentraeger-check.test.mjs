// node --test tools/kostentraeger-check.test.mjs  (offline, kein Netz)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rssParsen, bekannteAusgaben, basisFuer, analysiere, nachrichten, lauf, DATEINAME_RE } from './kostentraeger-check.mjs';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const P = 'https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/sonstige_leistungserbringer/kostentraegerdateien_1/';
/**
 * @param {string} guid
 * @param {string} [d]
 */
const item = (guid, d = 'g&uuml;ltig ab dem 01.10.2026- nicht barrierefrei -') =>
  `<item><guid><![CDATA[${guid}]]></guid><description><![CDATA[${d}]]></description></item>`;

test('RSS: gültige Links → Dateinamen, Datum', () => {
  const r = rssParsen(`<rss>${item(P + 'AO05Q426.ke0')}${item(P + 'BN050526.ke0', 'g&uuml;ltig ab dem 01.05.2026')}</rss>`);
  assert.deepEqual(r.eintraege.map(e => e.name), ['AO05Q426_KE0.txt', 'BN050526_KE0.txt']);
  assert.equal(r.eintraege[0].gueltigAb, '2026-10-01');
  assert.ok(r.eintraege.every(e => DATEINAME_RE.test(e.name)));
});

test('RSS: doppelter Schrägstrich nach dem Host (Feed seit 11/2026) wird erkannt, Link normalisiert', () => {
  const doppelt = P.replace('.de/media/', '.de//media/');
  const r = rssParsen(`<rss>${item(doppelt + 'AO05Q426.ke2', 'g&uuml;ltig ab dem 01.11.2026- nicht barrierefrei -')}</rss>`);
  assert.deepEqual(r.eintraege.map(e => e.name), ['AO05Q426_KE2.txt']);
  assert.equal(r.eintraege[0].link, P + 'AO05Q426.ke2');
  assert.equal(r.eintraege[0].gueltigAb, '2026-11-01');
  assert.deepEqual(r.unerwartet, []);
  const bös = rssParsen(`<rss>${item('https://evil.example//media/dokumente/leistungserbringer_1/sonstige_leistungserbringer/kostentraegerdateien_1/AO05Q426.ke0')}${item('https://www.gkv-datenaustausch.de//evil/AO05Q426.ke0')}</rss>`);
  assert.equal(bös.eintraege.length, 0);
  assert.equal(bös.unerwartet.length, 2);
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

test('bekannte Ausgaben: ausgaben-Array + wissensbank, Basis = neueste mit gültig-ab <= Stichtag', () => {
  const liste = [
    { datei: 'AO05Q326_KE3.txt', gueltigAb: '2026-07-27' },
    { datei: 'AO05Q426_KE0.txt', gueltigAb: '2026-10-01' },
  ];
  const { ausgaben, bekannt } = bekannteAusgaben({ ausgaben: liste, wbNamen: ['EK05Q426_KE0.txt'] });
  assert.ok(bekannt.has('EK05Q426_KE0.TXT') && bekannt.has('AO05Q426_KE0.TXT'));
  assert.equal(basisFuer('AO05Q127_KE0.txt', ausgaben, '2026-09-30')?.name, 'AO05Q326_KE3.txt');
  assert.equal(basisFuer('AO05Q127_KE0.txt', ausgaben, '2026-10-02')?.name, 'AO05Q426_KE0.txt');
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
  assert.ok(m[0].startsWith('KOPF') && m.at(-1)?.endsWith('FUSS'));
});

test('lauf: RSS nicht lesbar → BLIND-Meldung; nichts Neues → Stille; Fehler einer Datei nur dort', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ktc-'));
  const ohne = { out: dir, ausgaben: [], wbNamen: [] };
  const blind = await lauf({ ...ohne, rssDatei: join(dir, 'gibt-es-nicht.xml') });
  assert.match(blind.meldungen[0], /BLIND/);
  const leer = join(dir, 'leer.xml'); writeFileSync(leer, '<rss></rss>');
  assert.match((await lauf({ ...ohne, rssDatei: leer })).meldungen[0], /BLIND/);
  const rss = join(dir, 'r.xml'); writeFileSync(rss, `<rss>${item(P + 'AO05Q426.ke0')}</rss>`);
  const still = await lauf({ ...ohne, rssDatei: rss, wbNamen: ['AO05Q426_KE0.txt'] });
  assert.deepEqual(still.meldungen, []);
});

test('Telegram-Workflow: jede Nachricht versuchen und Teilfehler melden', {
  skip: process.platform === 'win32' && 'Der Workflow läuft unter Linux-Bash.',
}, () => {
  const workflow = readFileSync(new URL('../.github/workflows/kostentraeger-check.yml', import.meta.url), 'utf8');
  const schritt = workflow.split('      - name: Telegram senden (falls Nachrichten vorliegen)\n')[1];
  const shell = schritt?.match(/^        run: \|\n((?:^ {10}[^\n]*\n?)+)/m)?.[1];
  assert.ok(shell, 'Telegram-Shellschritt fehlt');
  const fakeCurl = [
    'curl() {',
    '  local datei="${!#}"',
    '  datei="${datei##*/}"',
    '  printf "%s\\n" "$datei"',
    '  if [[ "$datei" == "$FAIL_FILE" ]]; then return 22; fi',
    '}',
  ].join('\n');

  const ordner = mkdtempSync(join(tmpdir(), 'kt-workflow-'));
  try {
    const bericht = join(ordner, 'kt');
    mkdirSync(bericht);
    const dateien = ['msg-01.txt', 'msg-02.txt'];
    const faelle = [
      { erwartet: [], fehler: '' },
      { erwartet: dateien, fehler: '' },
      { erwartet: dateien, fehler: dateien[0] },
      { erwartet: dateien, fehler: dateien[1] },
    ];
    for (const { erwartet, fehler } of faelle) {
      for (const datei of erwartet) writeFileSync(join(bericht, datei), 'Synthetischer Bericht');
      /** @type {import('node:child_process').SpawnSyncReturns<string>} */
      const ergebnis = spawnSync('/bin/bash', ['--noprofile', '--norc', '-e', '-c', fakeCurl + '\n' + shell], {
        env: { PATH: '/dev/null', RUNNER_TEMP: ordner, FAIL_FILE: fehler },
        encoding: 'utf8',
        timeout: 5000,
      });
      assert.ifError(ergebnis.error);
      assert.deepEqual(ergebnis.stdout.trim().split('\n').filter(Boolean), erwartet, fehler);
      assert.equal(ergebnis.status, fehler ? 1 : 0, ergebnis.stderr);
      assert.equal(ergebnis.stderr.trim(), fehler ? 'Telegram-Versand fehlgeschlagen: ' + fehler : '');
    }
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
});
