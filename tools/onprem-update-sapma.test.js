// O-218: echte update.sh-Blöcke, ausschließlich synthetische Dateien.
// Kein vollständiger Updaterlauf, kein Docker/Netz/Hostdienst, keine echte .env.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Für denselben Rot-Test gegen archivierte Baseline/Upstream, ohne Produktdateien
// umzuschreiben. Nur die eigenen, ausdrücklich benannten Quellbelege zulassen.
const sourcePath = process.env.ONPREM_SAPMA_SOURCE || path.join(repoRoot, 'onprem/update.sh');
if (process.env.ONPREM_SAPMA_SOURCE) {
  const evidence = path.join(repoRoot, 'Claude outputs/2026-10-23-ops-fortsetzung');
  assert.equal(path.dirname(sourcePath), evidence);
  assert.match(path.basename(sourcePath), /^upstream-impl-(baseline|candidate)\.sh$/);
}
const s = fs.readFileSync(sourcePath, 'utf8');
const sha = (value) => createHash('sha256').update(value).digest('hex');

function zwischen(anfang, ende, start = 0) {
  const a = s.indexOf(anfang, start);
  assert.ok(a >= 0, `Quellgrenze fehlt: ${anfang}`);
  const b = s.indexOf(ende, a + anfang.length);
  assert.ok(b > a, `Quellgrenze fehlt: ${ende}`);
  assert.equal(s.indexOf(anfang, a + anfang.length), -1, `Quellgrenze mehrdeutig: ${anfang}`);
  return s.slice(a, b);
}

const helfer = zwischen('dateien_sha_icerik() {', '\n# O-82 — Bildirim');
const vergleichen = zwischen('ilk_kosu=1\n', '\n# ── Schritt 6');
const rueckrollen = zwischen('geri_yukle() {', '\n# ── .env birleştirme');
const anwenden = zwischen('# ── Schritt 7 — Yeni dosyaları yaz', '\n# ── İki kapı');
const abschluss = s.slice(s.indexOf('# ── Schritt 11 — Durum dosyası'));
assert.ok(abschluss.startsWith('# ── Schritt 11 — Durum dosyası'));
// Nur Fehlerkörper aus dem bestehenden Compose-Gate, niemals docker aufrufen.
const composeStart = s.indexOf('if ! docker compose config -q');
assert.ok(composeStart > 0);
const composeFehler = s.slice(s.indexOf('\n', composeStart) + 1, s.indexOf('\nfi', composeStart));
for (const block of [helfer, vergleichen, rueckrollen, anwenden, abschluss, composeFehler]) {
  assert.doesNotMatch(block, /^\s*(?:source|exec|eval|docker|curl|wget|systemctl|sudo)\b/m);
  assert.doesNotMatch(block, /\/Users\/|\/opt\//);
}

function binary(name) {
  // Linux-Updater braucht GNU-Semantik (mv -T). Auf macOS vorhandene echte
  // GNU-Werkzeuge verwenden; keine Shell-Nachbildung und kein Produktfallback.
  const gnuName = { mv: 'gmv', cp: 'gcp', mktemp: 'gmktemp' }[name];
  if (gnuName) {
    const gnu = path.join('/opt/homebrew/bin', gnuName);
    if (fs.existsSync(gnu)) return gnu;
  }
  for (const dir of ['/usr/bin', '/bin', '/sbin', '/opt/homebrew/bin', '/usr/local/bin']) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  assert.fail(`Benötigtes lokales Testwerkzeug fehlt: ${name}`);
}

function schreiben(root, relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function laufe(t, {
  disk = 'basis\n', basis = 'basis\n', neu = 'neu\n', rest,
  aktion = 'vergleich', resultat = 'ok', fehler = '', weitere = [],
} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-sapma-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const box = path.join(dir, 'box');
  const bundle = path.join(dir, 'paket/bundle');
  const stand = path.join(dir, 'stand');
  const bin = path.join(dir, 'bin');
  for (const d of [box, bundle, stand, bin, path.join(dir, 'snapshot')]) fs.mkdirSync(d, { recursive: true });
  // Frische Befehls-Whitelist: keine geerbte PATH/BASH_ENV/ENV/NODE_OPTIONS,
  // keine Docker-/Netz-/Hostprogramme erreichbar. Nur lokale Dateiarbeit.
  for (const cmd of ['sha256sum', 'awk', 'grep', 'sed', 'cat', 'mv', 'cp', 'rm', 'mkdir', 'dirname', 'mktemp', 'date']) {
    fs.symlinkSync(binary(cmd), path.join(bin, cmd));
  }
  const dateien = [{ yol: 'sample.conf', disk, basis, neu, rest }, ...weitere];
  const hashes = {};
  for (const f of dateien) {
    if (f.disk !== null) schreiben(box, f.yol, f.disk);
    schreiben(bundle, f.yol, f.neu);
    if (f.basis !== null) hashes[f.yol] = sha(f.basis);
    if (f.rest !== undefined) schreiben(box, `${f.yol}.neu.bekliyor`, f.rest);
    if (f.disk !== null) schreiben(path.join(dir, 'snapshot'), f.yol, f.disk);
  }
  schreiben(stand, 'dateien-sha.json', JSON.stringify(hashes));
  // geri_yukle hat einen festen .env-Pfad im Snapshot: ausschließlich erfunden.
  schreiben(path.join(dir, 'snapshot'), '.env', 'SYNTHETIC_ONLY=1\n');
  schreiben(box, 'environment.fixture', 'SYNTHETIC_ONLY=1\n');
  schreiben(bundle, 'environment.template.fixture', 'SYNTHETIC_ONLY=2\n');
  schreiben(box, 'fremd.neu.bekliyor', 'fremd erhalten\n');
  schreiben(box, 'sample.conf.neu.bekliyor.extra', 'andere Endung erhalten\n');
  if (fehler === 'rest_verzeichnis') {
    fs.mkdirSync(path.join(box, 'sample.conf.neu.bekliyor'));
    schreiben(box, 'sample.conf.neu.bekliyor/erhalten.txt', 'kein rekursives Löschen\n');
  }
  const manifest = `{"dateien":[\n${dateien.map((f) => `  { "yol": "${f.yol}", "sha256": "${sha(f.neu)}" }`).join(',\n')}\n]}\n`;
  schreiben(dir, 'manifest.json', manifest);
  if (fehler === 'quelle_fehlt') fs.unlinkSync(path.join(bundle, 'sample.conf'));
  const setup = `
set -euo pipefail
SCRIPT_DIR="$1/box"
BUNDLE_TMP="$1/paket"
STAND_DIR="$1/stand"
DATEIEN_SHA_FILE="$STAND_DIR/dateien-sha.json"
STAND_FILE="$STAND_DIR/praxura-stand.json"
MANIFEST="$1/manifest.json"
SNAPSHOT_DIR="$1/snapshot"
ENV_FILE="$SCRIPT_DIR/environment.fixture"
BIZIM_ENV="$BUNDLE_TMP/bundle/environment.template.fixture"
TABAN_ENV="$STAND_DIR/environment.template.fixture"
LOG_FILE="$1/update.log"
BUNDLE_SURUM="0.0.2"
catisan_anahtarlar=""
migration_art=""
log() { printf '%s\\n' "$*" >&2; }
ok() { log "[ok] $*"; }
warn() { log "[warn] $*"; }
fehler() { log "[fehler] $*"; }
bildirim_degerlendir() { :; }
owner_bilgisini_guncelle() { :; }
cd "$SCRIPT_DIR"
`;
  // Fehler tritt NACH partiellem Schreiben auf: damit ist atomarer Ersatz
  // messbar. Kein chmod-Test, der als root versehentlich grün würde.
  const injection = fehler === 'cleanup' ? `
rm() {
  case "$2" in
    "$SCRIPT_DIR/sample.conf.neu.bekliyor") printf 'INJECTED_CLEANUP_FAILURE\\n' >&2; return 76 ;;
  esac
  command rm "$@"
}
` : fehler === 'cp' ? `
cp() {
  case "$1" in
    "$BUNDLE_TMP"/bundle/*)
      printf 'PARTIAL' > "$2"
      printf 'INJECTED_COPY_FAILURE\\n' >&2
      return 73 ;;
  esac
  command cp "$@"
}
` : fehler === 'mv' ? `
mv() {
  local ziel
  for ziel; do :; done
  case "$ziel" in
    *.neu.bekliyor) printf 'INJECTED_RENAME_FAILURE\\n' >&2; return 74 ;;
  esac
  command mv "$@"
}
` : fehler === 'mktemp' ? `
mktemp() { printf 'INJECTED_MKTEMP_FAILURE\\n' >&2; return 75; }
` : '';
  let nachher = '\nprintf "CHANGED=%s\\n" "$degisen_dosyalar"\n';
  if (aktion !== 'vergleich') {
    nachher += `\n${rueckrollen}\n${anwenden}\n`;
    if (aktion === 'compose_fehler') nachher += composeFehler;
    else {
      if (aktion === 'rollback') nachher += '\ngeri_yukle\n';
      nachher += `\nsonuc="${resultat}"\n${abschluss}`;
    }
  }
  schreiben(dir, 'lauf.sh', `${setup}\n${injection}\n${helfer}\n${vergleichen}\n${nachher}`);
  const res = spawnSync(binary('bash'), ['--noprofile', '--norc', path.join(dir, 'lauf.sh'), dir], {
    cwd: dir,
    env: { PATH: bin, LANG: 'C', LC_ALL: 'C', TMPDIR: dir },
    encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(res.error);
  const lesen = (rel) => fs.readFileSync(path.join(box, rel));
  const existiert = (rel) => fs.existsSync(path.join(box, rel));
  const status = () => JSON.parse(fs.readFileSync(path.join(stand, 'praxura-stand.json'), 'utf8'));
  return { res, lesen, existiert, status, box, stand, manifest };
}

// Drei Upstream-Texttests: fachlich korrekte Konfliktbedingungen behalten;
// direkte cp-Zielformulierung für atomaren Ersatz öffnen, Schutz bleibt bestehen.
test('Sapma nur, wenn Disk ≠ letzte Fassung UND Disk ≠ neue Fassung', () => {
  const zeile = s.split('\n').find((z) => !z.includes('Sapma:') && /taban_sha" != "\$mevcut_sha"/.test(z));
  assert.ok(zeile, 'Bedingung der Sapma-Prüfung nicht gefunden');
  assert.match(zeile, /"\$mevcut_sha" != "\$yeni_sha"/);
});

test('Konflikt hebt NEUE Bundle-Fassung auf, niemals Disk-Fassung', () => {
  assert.match(vergleichen, /cp "\$BUNDLE_TMP\/bundle\/\$yol" /);
  assert.doesNotMatch(vergleichen, /cp "\$hedef" "\$hedef\.neu\.bekliyor"/);
});

test('Manifest-Reste ausschließlich im ok-Zweig Schritt 11 entfernen', () => {
  const start = abschluss.indexOf('if [ "$sonuc" = "ok" ]; then');
  assert.ok(start > 0);
  const okBlock = abschluss.slice(start, abschluss.indexOf('\nfi', start));
  assert.match(okBlock, /rm -f "\$SCRIPT_DIR\/\$yol\.neu\.bekliyor"/);
  assert.doesNotMatch(s.slice(0, s.indexOf(abschluss)), /rm -f "\$SCRIPT_DIR\/\$yol\.neu\.bekliyor"/);
  assert.match(okBlock, /"\$MANIFEST"/);
});

test('unveränderte Datei: keine Abweichung, keine Änderung', (t) => {
  const f = laufe(t, { neu: 'basis\n' });
  assert.equal(f.res.status, 0, f.res.stderr);
  assert.match(f.res.stdout, /^CHANGED=$/m);
  assert.equal(f.lesen('sample.conf').toString(), 'basis\n');
});

test('reguläres Update: neue Datei angewandt, erfolgreicher Status', (t) => {
  const f = laufe(t, { aktion: 'abschluss' });
  assert.equal(f.res.status, 0, f.res.stderr);
  assert.equal(f.lesen('sample.conf').toString(), 'neu\n');
  assert.equal(f.status().sonuc, 'ok');
  assert.equal(f.status().dateien['sample.conf'], sha('neu\n'));
});

test('bytegleicher Hotfix: kein Konflikt und kein erneutes Schreiben', (t) => {
  const f = laufe(t, { disk: 'neu\n' });
  assert.equal(f.res.status, 0, f.res.stderr);
  assert.match(f.res.stdout, /^CHANGED=$/m);
  assert.equal(f.existiert('sample.conf.neu.bekliyor'), false);
});

test('echter Konflikt: Kundenbytes bleiben, Resthash entspricht neuem Manifest', (t) => {
  const kunde = Buffer.from([0, 255, 10, 13, 65]);
  const neu = Buffer.from([0, 254, 10, 66]);
  const f = laufe(t, { disk: kunde, neu });
  assert.equal(f.res.status, 1);
  assert.deepEqual(f.lesen('sample.conf'), kunde);
  assert.equal(sha(f.lesen('sample.conf.neu.bekliyor')), JSON.parse(f.manifest).dateien[0].sha256);
  assert.equal(f.status().sonuc, 'konflikt');
  assert.equal(f.status().dateien['sample.conf'], sha('basis\n'));
});

test('mehrere Konflikte: auch verschachtelte neue Bundle-Fassung vollständig erhalten', (t) => {
  const f = laufe(t, { disk: 'kunde\n', weitere: [
    { yol: 'volumes/api/kong.yml', disk: 'kunde 2\n', basis: 'alt 2\n', neu: 'neu 2\n' },
  ] });
  assert.equal(f.res.status, 1);
  assert.equal(f.lesen('volumes/api/kong.yml').toString(), 'kunde 2\n');
  for (const entry of JSON.parse(f.manifest).dateien) assert.equal(sha(f.lesen(`${entry.yol}.neu.bekliyor`)), entry.sha256);
});

test('partieller Kopierfehler sichtbar: keine vollständige neue Restdatei behaupten', (t) => {
  const f = laufe(t, { disk: 'kunde\n', fehler: 'cp' });
  assert.equal(f.res.status, 1);
  assert.match(f.res.stderr, /INJECTED_COPY_FAILURE/);
  assert.match(f.res.stderr, /\[fehler\].*\.neu\.bekliyor/);
  assert.doesNotMatch(f.res.stderr, /\[ok\].*\.neu\.bekliyor/);
  assert.equal(f.existiert('sample.conf.neu.bekliyor'), false);
  assert.equal(f.lesen('sample.conf').toString(), 'kunde\n');
  assert.equal(f.status().sonuc, 'konflikt');
});

test('partieller Kopierfehler erhält vorherige Restbytes und kennzeichnet sie nicht als neu', (t) => {
  const f = laufe(t, { disk: 'kunde\n', rest: 'vorherige gute Vorlage\n', fehler: 'cp' });
  assert.equal(f.res.status, 1);
  assert.equal(f.lesen('sample.conf.neu.bekliyor').toString(), 'vorherige gute Vorlage\n');
  assert.match(f.res.stderr, /INJECTED_COPY_FAILURE/);
  assert.match(f.res.stderr, /\[fehler\].*\.neu\.bekliyor/);
  assert.doesNotMatch(f.res.stderr, /\[ok\].*\.neu\.bekliyor/);
  assert.deepEqual(fs.readdirSync(f.box).filter((n) => n.includes('.neu.bekliyor.tmp.')), []);
});

for (const fehler of ['mv', 'mktemp', 'quelle_fehlt']) {
  test(`${fehler}: vorhandene Restdatei bleibt, Fehler wird benannt`, (t) => {
    const f = laufe(t, { disk: 'kunde\n', rest: 'vorherige Vorlage\n', fehler });
    assert.equal(f.res.status, 1);
    assert.equal(f.lesen('sample.conf.neu.bekliyor').toString(), 'vorherige Vorlage\n');
    assert.match(f.res.stderr, /\[fehler\].*\.neu\.bekliyor/);
    assert.doesNotMatch(f.res.stderr, /\[ok\].*\.neu\.bekliyor/);
    assert.deepEqual(fs.readdirSync(f.box).filter((n) => n.includes('.neu.bekliyor.tmp.')), []);
    assert.equal(f.status().sonuc, 'konflikt');
  });
}

test('Folgelauf scheitert am Compose-Gate: Reste erhalten, Kundendatei zurückgerollt', (t) => {
  const f = laufe(t, { rest: 'frühere neue Fassung\n', aktion: 'compose_fehler' });
  assert.equal(f.res.status, 1);
  assert.equal(f.lesen('sample.conf.neu.bekliyor').toString(), 'frühere neue Fassung\n');
  assert.equal(f.lesen('sample.conf').toString(), 'basis\n');
  assert.equal(f.status().sonuc, 'geri_alindi');
});

for (const resultat of ['geri_alindi', 'bakim_modu', 'schema_fehler']) {
  test(`${resultat}: Schritt 11 erhält Reste und bisherigen Erfolg nicht vortäuschen`, (t) => {
    const f = laufe(t, { rest: 'frühere neue Fassung\n', aktion: resultat === 'schema_fehler' ? 'abschluss' : 'rollback', resultat });
    assert.equal(f.res.status, resultat === 'geri_alindi' ? 0 : 1, f.res.stderr);
    assert.equal(f.lesen('sample.conf.neu.bekliyor').toString(), 'frühere neue Fassung\n');
    assert.equal(f.lesen('fremd.neu.bekliyor').toString(), 'fremd erhalten\n');
    assert.equal(f.status().sonuc, resultat);
    assert.equal(f.lesen('sample.conf').toString(), resultat === 'schema_fehler' ? 'neu\n' : 'basis\n');
    assert.equal(f.status().dateien['sample.conf'], sha(resultat === 'schema_fehler' ? 'neu\n' : 'basis\n'));
  });
}

test('Erfolg entfernt nur exakte Manifest-Reste, auch in Unterordnern', (t) => {
  const f = laufe(t, { rest: 'alt\n', aktion: 'abschluss', weitere: [
    { yol: 'volumes/api/kong.yml', disk: 'gleich\n', basis: 'gleich\n', neu: 'gleich\n', rest: 'alt verschachtelt\n' },
  ] });
  assert.equal(f.res.status, 0, f.res.stderr);
  assert.equal(f.existiert('sample.conf.neu.bekliyor'), false);
  assert.equal(f.existiert('volumes/api/kong.yml.neu.bekliyor'), false);
  assert.equal(f.lesen('fremd.neu.bekliyor').toString(), 'fremd erhalten\n');
  assert.equal(f.lesen('sample.conf.neu.bekliyor.extra').toString(), 'andere Endung erhalten\n');
});

test('bytegleicher Hotfix: erfolgreicher Folgelauf räumt frühere Manifest-Reste auf', (t) => {
  const f = laufe(t, { disk: 'neu\n', rest: 'alte Restdatei\n', aktion: 'abschluss' });
  assert.equal(f.res.status, 0, f.res.stderr);
  assert.equal(f.existiert('sample.conf.neu.bekliyor'), false);
  assert.equal(f.lesen('sample.conf').toString(), 'neu\n');
});

test('Cleanupfehler: erfolgreicher Updatezustand wird geschrieben, Rest bleibt mit Warnung', (t) => {
  const f = laufe(t, { rest: 'alte Vorlage\n', aktion: 'abschluss', fehler: 'cleanup' });
  assert.equal(f.res.status, 0, f.res.stderr);
  assert.equal(f.status().sonuc, 'ok');
  assert.equal(f.lesen('sample.conf').toString(), 'neu\n');
  assert.equal(f.lesen('sample.conf.neu.bekliyor').toString(), 'alte Vorlage\n');
  assert.match(f.res.stderr, /INJECTED_CLEANUP_FAILURE/);
  assert.match(f.res.stderr, /\[warn\].*Konfliktvorlage konnte nicht entfernt werden/);
});

test('Restpfad ist Verzeichnis: kein rekursives Löschen und kein falscher Updateabbruch', (t) => {
  const f = laufe(t, { aktion: 'abschluss', fehler: 'rest_verzeichnis' });
  assert.equal(f.res.status, 0, f.res.stderr);
  assert.equal(f.status().sonuc, 'ok');
  assert.equal(f.lesen('sample.conf.neu.bekliyor/erhalten.txt').toString(), 'kein rekursives Löschen\n');
  assert.match(f.res.stderr, /\[warn\].*Konfliktvorlage konnte nicht entfernt werden/);
});
