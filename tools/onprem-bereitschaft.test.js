// O-193 (0.6.0): update.sh/install.sh lesen nach der Gesundheit /health/ready.
// Seit O-190 (c) zählt der Wartungsmodus als „healthy" — ohne diese Prüfung
// meldete update.sh `ok`, obwohl die Migration gescheitert war.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = path.join(repoRoot, 'onprem', 'lib-health.sh');
const libPosix = lib.split(path.sep).join('/');

function einordnen(t, eingabe) {
  const res = spawnSync('bash', ['-c', `source "${libPosix}"; bereitschaft_einordnen "$1"`, '_', eingabe], { encoding: 'utf8' });
  if (res.error && res.error.code === 'ENOENT') { t.skip('bash nicht gefunden'); return null; }
  return res.stdout.trim();
}

test('bereitschaft_einordnen: 200 = ok, Schemafehler aus der Weißliste endgültig, Rest nicht_bereit', (t) => {
  const faelle = [
    ['200 - -', 'ok'],
    ['503 schema_migration migration', 'schema_fehler migration'],
    ['503 schema_migration pruefsumme', 'schema_fehler pruefsumme'],
    ['503 schema_migration downgrade', 'schema_fehler downgrade'],
    ['503 schema_migration reihenfolge', 'schema_fehler reihenfolge'],
    // O-190-Fall: Runner kam nicht zur DB → Rückroll-Zweig, nicht schema_fehler
    ['503 schema_migration verbindung', 'nicht_bereit'],
    ['503 schema_migration erfunden', 'nicht_bereit'],
    ['503 datenbank -', 'nicht_bereit'],
    ['0 - -', 'nicht_bereit'],
    ['', 'nicht_bereit'],
  ];
  for (const [ein, aus] of faelle) {
    const ist = einordnen(t, ein);
    if (ist === null) return;
    assert.equal(ist, aus, ein);
  }
});

test('Weißliste deckt genau die art-Werte von migrate.js außer verbindung', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'api-backend', 'db', 'migrate.js'), 'utf8');
  const arten = new Set([...src.matchAll(/art:\s*'([a-z_]+)'/g)].map((m) => m[1]));
  arten.delete('verbindung');
  const libSrc = fs.readFileSync(lib, 'utf8');
  const zeile = libSrc.match(/^\s*(\S+)\) echo "schema_fehler \$art"/m);
  assert.ok(zeile, 'case-Zeile gefunden');
  assert.deepEqual(new Set(zeile[1].split('|')), arten);
});

test('update.sh und install.sh rufen bereitschaft_pruefen; Status kennt schema_fehler', () => {
  const update = fs.readFileSync(path.join(repoRoot, 'onprem', 'update.sh'), 'utf8');
  const install = fs.readFileSync(path.join(repoRoot, 'onprem', 'install.sh'), 'utf8');
  const libIp = fs.readFileSync(path.join(repoRoot, 'onprem', 'lib-ip.sh'), 'utf8');
  const mail = fs.readFileSync(path.join(repoRoot, 'api-backend', 'setup', 'update-alarm-mail.mjs'), 'utf8');
  assert.match(update, /bereitschaft_pruefen 60/);
  assert.match(update, /sonuc="schema_fehler"/);
  assert.match(install, /bereitschaft_pruefen 60/);
  assert.match(libIp, /\|schema_fehler\|/);
  assert.match(mail, /schema_fehler:/);
  // Keine Fehlermeldung in die Statusdatei — nur art
  assert.doesNotMatch(update, /migration_(text|detail|meldung)/);
});

// Übergang 0.5.2 → 0.6.0 (onprem §7AS): update.sh ersetzt sich selbst, lädt aber
// oben die lib-health.sh, die vor dem Update auf der Platte lag. Der Block vor
// Schritt 10 muss die frische Bibliothek nachladen und ohne sie nicht abstürzen.
function uebergangsBlock() {
  const update = fs.readFileSync(path.join(repoRoot, 'onprem', 'update.sh'), 'utf8');
  const m = update.match(/# UEBERGANG-LIB-HEALTH-ANFANG\n([\s\S]*?)# UEBERGANG-LIB-HEALTH-ENDE/);
  assert.ok(m, 'Übergangsblock in update.sh gefunden');
  assert.ok(update.indexOf(m[0]) < update.indexOf('hazir="$(bereitschaft_pruefen 60)"'), 'Block steht vor dem ersten Aufruf');
  return m[1];
}

function laufeUebergang(t, neueLib) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-uebergang-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const alteLib = 'warte_auf_gesundheit() { return 0; }\n';
  fs.writeFileSync(path.join(dir, 'alt.sh'), alteLib);
  fs.writeFileSync(path.join(dir, 'lib-health.sh'), neueLib ?? alteLib);
  const skript = [
    'set -euo pipefail',
    'SCRIPT_DIR="$1"',
    'source "$SCRIPT_DIR/alt.sh"',
    uebergangsBlock(),
    'echo "ergebnis=$(bereitschaft_pruefen 60)"',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'lauf.sh'), skript);
  const posix = (p) => p.split(path.sep).join('/');
  const res = spawnSync('bash', [posix(path.join(dir, 'lauf.sh')), posix(dir)], { encoding: 'utf8' });
  if (res.error && res.error.code === 'ENOENT') { t.skip('bash nicht gefunden'); return null; }
  return res;
}

test('Übergang: alte lib-health.sh auf der Platte → kein Absturz, nicht_bereit', (t) => {
  const res = laufeUebergang(t, null);
  if (res === null) return;
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout.trim(), 'ergebnis=nicht_bereit');
});

test('Übergang: frische lib-health.sh aus Schritt 7 wird nachgeladen', (t) => {
  const res = laufeUebergang(t, 'bereitschaft_pruefen() { echo "ok"; }\n');
  if (res === null) return;
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout.trim(), 'ergebnis=ok');
});
