import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const libIpPfad = path.join(repoRoot, 'onprem', 'lib-ip.sh');
const installPfad = path.join(repoRoot, 'onprem', 'install.sh');
const updatePfad = path.join(repoRoot, 'onprem', 'update.sh');

const libIpPosix = libIpPfad.replace(/\\/g, '/');

function runBash(t, cmd) {
  const res = spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });
  if (res.error && res.error.code === 'ENOENT') {
    t.skip('bash nicht gefunden');
    return null;
  }
  return res;
}

// ── Strukturtests (nur Dateien lesen) ────────────────────────────────────────

test('lib-ip.sh: definiert ip_modus_yaz() und ip_timer_kur()', () => {
  const inhalt = fs.readFileSync(libIpPfad, 'utf8');
  assert.match(inhalt, /^\s*ip_modus_yaz\s*\(\s*\)/m, 'lib-ip.sh muss ip_modus_yaz() definieren');
  assert.match(inhalt, /^\s*ip_timer_kur\s*\(\s*\)/m, 'lib-ip.sh muss ip_timer_kur() definieren');
});

test('lib-ip.sh: in ip_timer_kur haben daemon-reload und enable --now jeweils || return in derselben Zeile; Prüfung id -u vorhanden', () => {
  const inhalt = fs.readFileSync(libIpPfad, 'utf8');
  const timerKurMatch = inhalt.match(/ip_timer_kur\s*\(\s*\)\s*\{[\s\S]*?\n\}/);
  assert.ok(timerKurMatch, 'ip_timer_kur() Funktion muss vorhanden sein');
  const timerKurBody = timerKurMatch[0];

  assert.match(timerKurBody, /id\s+-u/, 'ip_timer_kur muss id -u prüfen');
  assert.match(timerKurBody, /daemon-reload[^\n]*\|\|\s*return/, 'daemon-reload muss || return auf derselben Zeile haben');
  assert.match(timerKurBody, /enable\s+--now[^\n]*\|\|\s*return/, 'enable --now muss || return auf derselben Zeile haben');
});

test('install.sh: enthält kein volumes/ip/modus.tmp und kein praxura-ip.service mehr; ruft ip_modus_yaz und ip_timer_kur', () => {
  const inhalt = fs.readFileSync(installPfad, 'utf8');
  assert.ok(!inhalt.includes('volumes/ip/modus.tmp'), 'install.sh darf kein volumes/ip/modus.tmp mehr enthalten');
  assert.ok(!inhalt.includes('praxura-ip.service'), 'install.sh darf kein praxura-ip.service mehr enthalten');
  assert.match(inhalt, /\bip_modus_yaz\b/, 'install.sh muss ip_modus_yaz aufrufen');
  assert.match(inhalt, /\bip_timer_kur\b/, 'install.sh muss ip_timer_kur aufrufen');
});

test('update.sh: ip_timer_kur kommt nach Schritt 7 und vor compose up -d; MERKEZ_URL vor registriert geprüft', () => {
  const inhalt = fs.readFileSync(updatePfad, 'utf8');

  // Schritt 7 Schleife („Yeni dosyaları yaz")
  const schritt7Start = inhalt.indexOf('Schritt 7 — Yeni dosyaları yaz');
  assert.ok(schritt7Start !== -1, 'update.sh muss Schritt 7 Überschrift enthalten');
  const schritt7Schleife = inhalt.indexOf('for yol in $degisen_dosyalar; do', schritt7Start);
  assert.ok(schritt7Schleife !== -1, 'update.sh muss Schritt 7 Schleife enthalten');

  const timerKurPos = inhalt.indexOf('ip_timer_kur');
  assert.ok(timerKurPos !== -1, 'update.sh muss ip_timer_kur aufrufen');

  const composeUpPos = inhalt.indexOf('docker compose up -d --remove-orphans');
  assert.ok(composeUpPos !== -1, 'update.sh muss docker compose up -d --remove-orphans enthalten');

  assert.ok(timerKurPos > schritt7Schleife, 'ip_timer_kur muss textlich nach Schritt 7 stehen');
  assert.ok(timerKurPos < composeUpPos, 'ip_timer_kur muss textlich vor docker compose up -d stehen');

  // Prüfung im selben Schritt (7c): MERKEZ_URL und "registriert"
  const schritt7cStart = inhalt.lastIndexOf('# ── Schritt 7c', timerKurPos);
  assert.ok(schritt7cStart !== -1, 'update.sh muss Schritt 7c vor ip_timer_kur enthalten');
  const schritt7cBlock = inhalt.slice(schritt7cStart, timerKurPos);

  const merkezUrlPos = schritt7cBlock.indexOf('MERKEZ_URL');
  const registriertPos = schritt7cBlock.indexOf('"registriert"');

  assert.ok(merkezUrlPos !== -1, 'MERKEZ_URL muss im selben Schritt vor ip_timer_kur geprüft werden');
  assert.ok(registriertPos !== -1, '"registriert" muss im selben Schritt vor ip_timer_kur geprüft werden');
  assert.ok(merkezUrlPos < registriertPos, 'MERKEZ_URL-Prüfung muss vor der "registriert"-Prüfung stehen');
});

// ── Verhaltenstests mit echtem bash ──────────────────────────────────────────

test('Verhalten: ip_modus_yaz <dir> "" -> Exit 1, keine Datei modus', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-ip-test-'));
  try {
    const tmpDirPosix = tmpDir.replace(/\\/g, '/');
    const cmd = `source "${libIpPosix}" && ip_modus_yaz "${tmpDirPosix}" ""`;
    const res = runBash(t, cmd);
    if (!res) return;

    assert.equal(res.status, 1, 'ip_modus_yaz mit leerer IP muss Exit 1 liefern');
    const modusPfad = path.join(tmpDir, 'modus');
    assert.ok(!fs.existsSync(modusPfad), 'Datei modus darf bei leerer IP nicht existieren');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Verhalten: ip_modus_yaz <dir>/neu 192.168.2.111 -> Exit 0, stdout lan, modus = lan\\n, lan-ip = 192.168.2.111\\n, Verzeichnis angelegt', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-ip-test-'));
  try {
    const neuDir = path.join(tmpDir, 'neu');
    const neuDirPosix = neuDir.replace(/\\/g, '/');
    const cmd = `source "${libIpPosix}" && ip_modus_yaz "${neuDirPosix}" "192.168.2.111"`;
    const res = runBash(t, cmd);
    if (!res) return;

    assert.equal(res.status, 0, 'Exit-Code muss 0 sein');
    assert.equal(res.stdout, 'lan', 'stdout muss "lan" sein');
    assert.ok(fs.existsSync(neuDir), 'Verzeichnis /neu muss angelegt worden sein');

    const modusInhalt = fs.readFileSync(path.join(neuDir, 'modus'), 'utf8');
    assert.equal(modusInhalt, 'lan\n', 'modus-Datei muss "lan\\n" enthalten');

    const lanIpInhalt = fs.readFileSync(path.join(neuDir, 'lan-ip'), 'utf8');
    assert.equal(lanIpInhalt, '192.168.2.111\n', 'lan-ip-Datei muss "192.168.2.111\\n" enthalten');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Verhalten: ip_modus_yaz <dir> 203.0.113.7 -> Exit 0, stdout internet, modus = internet\\n, keine lan-ip', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-ip-test-'));
  try {
    const tmpDirPosix = tmpDir.replace(/\\/g, '/');
    const cmd = `source "${libIpPosix}" && ip_modus_yaz "${tmpDirPosix}" "203.0.113.7"`;
    const res = runBash(t, cmd);
    if (!res) return;

    assert.equal(res.status, 0, 'Exit-Code muss 0 sein');
    assert.equal(res.stdout, 'internet', 'stdout muss "internet" sein');

    const modusInhalt = fs.readFileSync(path.join(tmpDir, 'modus'), 'utf8');
    assert.equal(modusInhalt, 'internet\n', 'modus-Datei muss "internet\\n" enthalten');

    assert.ok(!fs.existsSync(path.join(tmpDir, 'lan-ip')), 'lan-ip-Datei darf bei Modus internet nicht existieren');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Verhalten: ip_timer_kur <dir-ohne-volumes/ip/modus> -> Exit 2', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-ip-test-'));
  try {
    const tmpDirPosix = tmpDir.replace(/\\/g, '/');
    const cmd = `source "${libIpPosix}" && ip_timer_kur "${tmpDirPosix}"`;
    const res = runBash(t, cmd);
    if (!res) return;

    assert.equal(res.status, 2, 'ip_timer_kur ohne volumes/ip/modus muss Exit 2 liefern');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
