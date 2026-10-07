// O-173 / K2b.18 a (07.10.2026) — verschlüsselte Sicherung (age). Auf der WSL-Testbox gemessen
// (fortschritte/2026-10-07.md); diese Tests halten die Verdrahtung und zwei echte Fehler fest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (...p) => fs.readFileSync(path.join(repoRoot, ...p), 'utf8');

test('backup.sh: fail-closed ohne BACKUP_EMPFAENGER/age, kein Schalter für Klartext', () => {
  const s = lies('onprem', 'backup.sh');
  assert.match(s, /BACKUP_EMPFAENGER/);
  assert.match(s, /install\.sh --sicherungsschluessel/);
  assert.doesNotMatch(s, /UNVERSCHLUESSELT_ERLAUBT|ALLOW_PLAINTEXT|--ohne-verschluesselung/i);
  assert.match(s, /trap [^\n]*EXIT INT TERM/, 'Arbeitsordner auch bei Ctrl+C/SIGTERM aufräumen');
  assert.match(s, /\.backup-tmp/, 'Klartext nur auf der Box-Platte');
});

test('restore.sh: Klartext-Altsicherung nur mit --altsicherung + KLARTEXT-WIEDERHERSTELLEN; Prüfungen vor WIEDERHERSTELLEN', () => {
  const s = lies('onprem', 'restore.sh');
  assert.match(s, /--altsicherung/);
  assert.match(s, /KLARTEXT-WIEDERHERSTELLEN/);
  const iOnay = s.indexOf("read -r ONAY\n");
  for (const marker of ['HMAC', 'Nicht deklarierte Sicherungsdatei', 'Falscher Sicherungsschlüssel']) {
    const i = s.indexOf(marker);
    assert.ok(i > 0 && i < iOnay, `${marker} muss vor der Bestätigung geprüft werden`);
  }
  assert.doesNotMatch(s, /<<<\s*"\$PRIV_KEY"|<<\s*\S*\n[^\n]*\$PRIV_KEY/, 'kein Here-String/Heredoc für den Schlüssel');
});

test('install.sh: age-Schlüssel gemeinsam mit DEK angezeigt, --sicherungsschluessel nicht mit anderen Modi', () => {
  const s = lies('onprem', 'install.sh');
  assert.match(s, /--sicherungsschluessel/);
  assert.match(s, /age-keygen/);
  assert.match(s, /set_env BACKUP_EMPFAENGER/);
  assert.doesNotMatch(s, /\b(log|ok|warn|fail) [^\n]*\$\{?(AGE_SECRET|PRIV)/, 'privater Schlüssel nie über log()');
  assert.match(lies('onprem', '.env.template'), /^BACKUP_EMPFAENGER=$/m);
});

// Echter Fehler (Testbox 07.10.2026): "[^\",}\r]" in grep -E schloss den Buchstaben r aus
// und schnitt age1…-Schlüssel ab → HMAC einer echten Sicherung passte nie.
// Und: fehlendes Feld beendete restore.sh unter pipefail ohne Meldung.
test('Verhalten: restore.sh meta_alan liest Werte mit "r" vollständig und überlebt fehlende Felder', (t) => {
  const s = lies('onprem', 'restore.sh');
  const start = s.indexOf('meta_alan() {');
  const ende = s.indexOf('\n}', start) + 2;
  const fn = s.slice(start, ende);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-meta-'));
  fs.writeFileSync(path.join(dir, 'backup.meta.json'),
    '{\r\n  "backup_empfaenger": "age1rrrxyzrrr",\r\n  "sebep": "nightly"\r\n}\r\n');
  const fnDatei = path.join(dir, 'fn.sh');
  fs.writeFileSync(fnDatei, fn);
  const posix = (p) => p.replace(/\\/g, '/');
  const cmd = `set -euo pipefail; YEDEK_DIR="${posix(dir)}"; source "${posix(fnDatei)}"; a="$(meta_alan backup_empfaenger)"; b="$(meta_alan sebep)"; c="$(meta_alan verschluesselung)"; printf '%s|%s|%s' "$a" "$b" "$c"`;
  const res = spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  if (res.error && res.error.code === 'ENOENT') { t.skip('bash nicht gefunden'); return; }
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, 'age1rrrxyzrrr|nightly|');
});

test('install.sh: Backup-Timer wird erst NACH der GESICHERT-Bestätigung eingeschaltet (guvenlik 07.10)', () => {
  const s = lies('onprem', 'install.sh');
  const iBest = s.lastIndexOf('= "GESICHERT" ] && break');
  const iOn = s.indexOf('systemctl enable --now praxura-backup.timer');
  assert.ok(iBest > 0 && iOn > iBest, 'enable --now praxura-backup.timer muss nach der Bestätigung stehen');
  assert.equal((s.match(/enable --now praxura-backup\.timer/g) || []).length, 2, 'Befehl + Hinweistext, sonst nirgends');
});
