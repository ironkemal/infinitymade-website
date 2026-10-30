import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const healthFile = fileURLToPath(new URL('../onprem/lib-health.sh', import.meta.url));
const source = fs.readFileSync(healthFile, 'utf8');
test('Gesunde Container reichen nicht: gemeinsame Install-/Updateprüfung verlangt API-Readiness', () => {
  for (const ready of ['yes', 'no']) {
    const script = `
      # Bash3 auf macOS hat kein mapfile; nur diese Builtin-Kompatibilität ergänzen.
      if ! type mapfile >/dev/null 2>&1; then
        mapfile() { DIENSTE=(); while IFS= read -r line; do DIENSTE+=("$line"); done; }
      fi
      log() { :; }; ok() { echo READY; }; fail() { exit 9; }
      docker() {
        case "$1 $2" in
          'compose config') printf '%s\\n' db api ;;
          'compose ps') echo synthetic-container ;;
          'inspect --format') case "$3" in *State.Status*) echo running ;; *) echo healthy ;; esac ;;
          'compose exec') [ '${ready}' = yes ] ;;
          *) return 1 ;;
        esac
      }
      source "$1"
      warte_auf_gesundheit 2
    `;
    const result = spawnSync('bash', ['-c', script, 'readiness-test', healthFile], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, ready === 'yes' ? 0 : 1, result.stderr);
    assert.equal(result.stdout.includes('READY'), ready === 'yes');
  }
});
test('Readiness bleibt intern und begrenzt; Migrationsfehler darf keinen Erfolg ergeben', () => {
  assert.match(source, /docker compose exec -T api node/);
  assert.match(source, /\/health\/ready/);
  assert.match(source, /AbortSignal\.timeout\(5000\)/);
  assert.match(source, /status==='ready'/);
  assert.match(source, /SECONDS.*deadline/);
});
test('Installationsproben: sämtliche TLS-/JWT-Aufrufe begrenzt, Vertrauensprüfung ohne -k', () => {
  const install = fs.readFileSync(new URL('../onprem/install.sh', import.meta.url), 'utf8');
  const begin = install.indexOf('TESTPFAD=');
  const probes = install.slice(begin, install.indexOf('# ── Schritt 16', begin));
  const curls = probes.split('\n').filter(line => /\bcurl\b/.test(line));
  assert.equal(curls.length, 5);
  for (const line of curls) {
    assert.match(line, /--connect-timeout 3/);
    assert.match(line, /--max-time 5/);
  }
  assert.match(probes, /zert_deadline=\$\(\(SECONDS \+ 300\)\)/);
  const trusted = curls.find(line => line.includes('/login.html'));
  assert.ok(trusted);
  assert.doesNotMatch(trusted, /-k|-sk/);
  assert.match(probes, /--cacert "\$\{CA_DIR\}\/root\.crt"/);
});

test('Erstes Update lädt neuen Helper vor Prüfung; Rollback behält strenge Prüfung', () => {
  const update = fs.readFileSync(new URL('../onprem/update.sh', import.meta.url), 'utf8');
  const begin = update.indexOf('log "[10/11]');
  const step = update.slice(begin, update.indexOf('# ── Schritt 11', begin));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-helper-'));
  try {
    // Alte Datei wurde schon durch den Bundlehelper ersetzt; alte Funktion ist noch geladen.
    fs.writeFileSync(path.join(dir, 'lib-health.sh'), 'warte_auf_gesundheit() { return 1; }\n');
    const script = `SCRIPT_DIR="$1"; LOG_FILE=/dev/null; ilk_up_basarili=1;
      warte_auf_gesundheit() { return 0; }
      log() { :; }; warn() { :; }; docker() { return 0; }
      geri_yukle() { echo ROLLBACK; }
      fehler() { echo MAINTENANCE; }
      ${step}
      echo "$sonuc"`;
    const result = spawnSync('bash', ['-c', script, 'helper-test', dir], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ROLLBACK/);
    assert.match(result.stdout, /MAINTENANCE/);
    assert.match(result.stdout, /bakim_modu/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
