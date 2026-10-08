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
  assert.match(s, /trap bitis EXIT/, 'Aufräumen + Alarm bei EXIT (O-175)');
  assert.match(s, /trap 'exit 130' INT/, 'Ctrl+C beendet, EXIT-Trap räumt auf');
  assert.match(s, /trap 'exit 143' TERM/);
  assert.match(s, /bitis\(\) \{ local rc=\$\?; set \+e \+u \+o pipefail; temizle; sicherung_alarm "\$rc"; exit "\$rc"; \}/, 'Exit-Code vor dem Aufräumen festhalten');
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

// O-175 / K2b.18 d (07.10.2026) — alte Box ohne Schlüssel. WSL-Testbox gemessen:
// nightly ohne Schlüssel → rc 1 + 1 Alarm, zweiter Lauf still, manuel ohne Alarm;
// install-sicherungsschluessel.sh läuft ohne lib-Dateien; andere Modi brechen weiter ab.
test('update.sh: Schlüssel-Vorprüfung VOR backup.sh, Rettungskopie VOR geri_yukle, Aufräumen bei ok', () => {
  const s = lies('onprem', 'update.sh');
  const iPruef = s.indexOf("grep -qE '^age1[0-9a-z]{58}$'");
  const iKopie = s.indexOf('"$KURTARMA_SKRIPT" && chmod 700');
  const iGeri = s.indexOf('geri_yukle', iKopie);
  const iBackup = s.indexOf('bash "$SCRIPT_DIR/backup.sh" --sebep vor-migration');
  assert.ok(iPruef > 0 && iPruef < iBackup, 'Vorprüfung vor backup.sh');
  assert.ok(iKopie > iPruef && iGeri > iKopie && iGeri < iBackup, 'Kopie vor dem Zurückrollen');
  assert.match(s, /durumu_yaz "yedek_basarisiz" "\\"grund\\": \\"sicherungsschluessel_fehlt\\","/, 'bekannter Status für das alte Image');
  assert.match(s, /rm -f "\$SCRIPT_DIR\/install-sicherungsschluessel\.sh"/);
  assert.doesNotMatch(s, /age-keygen/, 'update.sh erzeugt nie selbst einen Schlüssel');
});

test('backup.sh: Alarm-Trap vor der Schlüsselprüfung, nur nightly, fester Text, 7-Tage-Ruhe', () => {
  const s = lies('onprem', 'backup.sh');
  const iTrap = s.indexOf('trap bitis_alarm EXIT');
  const iCheck = s.indexOf('BACKUP_EMPFAENGER nicht gesetzt');
  assert.ok(iTrap > 0 && iTrap < iCheck, 'Trap muss den häufigsten Fehler (kein Schlüssel) fangen');
  assert.match(s, /\[ "\$SEBEP" = "nightly" \] \|\| return 0/);
  assert.match(s, /son-sicherung-bildirim\.json/);
  assert.match(s, /7\*86400/);
  assert.doesNotMatch(s, /\$'\x01'|\x01/, 'kein Steuerzeichen (Escape-Schaden, 07.10 gemessen)');
  const m = lies('api-backend', 'setup', 'update-alarm-mail.mjs');
  for (const k of ['sicherung_fehlgeschlagen', 'sicherungsschluessel_fehlt']) assert.match(m, new RegExp(`${k}:`));
});

test('install.sh: --sicherungsschluessel ohne lib-Dateien lauffähig, sonst source wie bisher', () => {
  const s = lies('onprem', 'install.sh');
  assert.match(s, /if \[ "\$_NUR_SCHLUESSEL" -ne 1 \] \|\| \[ -f "\$SCRIPT_DIR\/lib-ip\.sh" \]; then source/);
  assert.match(s, /if \[ "\$_NUR_SCHLUESSEL" -ne 1 \] \|\| \[ -f "\$SCRIPT_DIR\/lib-setup-jeton\.sh" \]; then source/);
  const a = s.indexOf('# ── Modus: --sicherungsschluessel');
  const b = s.indexOf('exit 0\nfi', a);
  const zweig = s.slice(a, b);
  for (const fn of ['lan_ip_ermitteln', 'ip_modus_yaz', 'ip_timer_kur', '_sj_env_lesen', '_sj_env_setzen', 'setup_abgeschlossen_lesen', 'setup_jeton_aufraeumen', 'setup_jeton_neu']) {
    assert.ok(!zweig.includes(fn), `Schlüsselzweig darf ${fn} (lib) nicht rufen`);
  }
});

// K2b.3 (08.10.2026) — erste echte Box mit Code (WSL), drei gemessene Fehler + guvenlik S-47 Nachtrag.
test('Caddyfile acmedns: ohne Ausbreitungsprüfung, mit Pause', () => {
  const s = lies('onprem', 'Caddyfile');
  const blk = s.slice(s.indexOf('(tls_acmedns)'), s.indexOf('{$SITE_URL}'));
  assert.match(blk, /propagation_delay 20s/);
  assert.match(blk, /propagation_timeout -1/);
});

test('install.sh: TLS-Wartezeit vor dem Schlüsseltest, --neu-Port nur eigene Box, caddy_data bleibt mit Namensdienst', () => {
  const s = lies('onprem', 'install.sh');
  const iWarte = s.indexOf("Warte auf das Let's-Encrypt-Zertifikat");
  const iTest = s.indexOf('mit_key="$(curl');
  assert.ok(iWarte > 0 && iWarte < iTest, 'erst Zertifikat, dann Schlüsseltest');
  assert.match(s, /docker compose port caddy "\$port"/, 'nur der eigene Compose-Port wird übersprungen');
  assert.match(s, /if \[ "\$KAYIT_MODUS" != "adresse" \]; then\n\s+NEU_VOLUMES="db-config caddy_config"/);
});

// K2b.4b (08.10.2026): MERKEZ_URL nur über die Vorlage verteilt — war leer, dadurch liefen IP- und
// CAA-Abgleich auf KEINER Box (G7-Tor sah aus wie SaaS). Darf nie wieder still leer werden (onprem).
test('.env.template: MERKEZ_URL gesetzt und https://', () => {
  const s = lies('onprem', '.env.template');
  const m = s.match(/^MERKEZ_URL=(.*)$/m);
  assert.ok(m, 'MERKEZ_URL-Zeile fehlt');
  assert.match(m[1].trim(), /^https:\/\/[a-z0-9.-]+$/, 'MERKEZ_URL leer oder nicht https');
});
