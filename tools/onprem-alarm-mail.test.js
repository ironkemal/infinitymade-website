// O-185: Alarm-Mail ohne SMTP — Exit 3 statt 0, update.sh/backup.sh zählen das nicht als „gesendet".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = (...p) => readFileSync(join(kok, ...p), 'utf8').replace(/\r\n/g, '\n'); // Windows-Checkout: CRLF
const mjs = join(kok, 'api-backend', 'setup', 'update-alarm-mail.mjs');

function mailLauf(env) {
  const basis = { ...process.env };
  for (const k of Object.keys(basis)) if (k.startsWith('SMTP_')) delete basis[k];
  return spawnSync(process.execPath, [mjs, 'yedek_basarisiz', 'inhaber@example.de', 'Testpraxis'],
    { env: { ...basis, ...env }, encoding: 'utf8', timeout: 20000 });
}

test('update-alarm-mail.mjs: ohne SMTP_HOST Exit 3, SMTP nicht erreichbar Exit 1', () => {
  assert.equal(mailLauf({}).status, 3);
  assert.equal(mailLauf({ SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'x', SMTP_PASS: 'y' }).status, 1);
});

// bildirim_degerlendir aus update.sh herausschneiden und mit gestubbter Mail-Funktion fahren.
function funktion(quelle, name) {
  const s = quelle.indexOf(`\n${name}() {`);
  assert.ok(s >= 0, name + ' fehlt');
  let e = quelle.indexOf('\n}\n', s);
  while (quelle.startsWith('EOF', e + 3)) e = quelle.indexOf('\n}\n', e + 3); // "}" einer Heredoc-JSON-Zeile
  return quelle.slice(s + 1, e + 3);
}

test('update.sh bildirim_degerlendir: rc 0 stempelt, rc 3 und rc 1 nicht — son_sonuc immer', (t) => {
  if (spawnSync('bash', ['-c', 'true']).status !== 0) return t.skip('kein bash');
  const u = lies('onprem', 'update.sh');
  const fn = ['bildirim_alani_oku', 'bildirim_kaydet', 'bildirim_degerlendir'].map((n) => funktion(u, n)).join('\n');
  for (const [mrc, epochErwartet] of [[0, true], [3, false], [1, false]]) {
    const dir = mkdtempSync(join(tmpdir(), 'o185-'));
    try {
      const nf = join(dir, 'n.json').replace(/\\/g, '/');
      const skript = `set -eu
NOTIFY_FILE='${nf}'; BILDIRIM_ARALIK_SANIYE=604800
log() { :; }; ok() { :; }; warn() { :; }
mail_gonder_container() { return ${mrc}; }
printf '{ "son_sonuc": "ok", "son_basarili_gonderim_epoch": 0 }\\n' > "$NOTIFY_FILE"
${fn}
bildirim_degerlendir yedek_basarisiz
cat "$NOTIFY_FILE"`;
      const r = spawnSync('bash', ['-c', skript], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stdout, /"son_sonuc": "yedek_basarisiz"/, `rc ${mrc}: son_sonuc`);
      const epoch = Number(r.stdout.match(/"son_basarili_gonderim_epoch": (\d+)/)[1]);
      assert.equal(epoch > 0, epochErwartet, `rc ${mrc}: epoch ${epoch}`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('update.sh/backup.sh: rc 3 ohne run-Fallback, eigene Logzeile, Kopie-Vertrag nennt Exit 3', () => {
  const u = funktion(lies('onprem', 'update.sh'), 'mail_gonder_container');
  assert.match(u, /\|\| rc=\$\?\n\s+\[ "\$rc" -eq 0 \] && return 0\n\s+if \[ "\$rc" -eq 3 \]; then log "  Bildirim atlandı: SMTP kurulu değil[^\n]*return 3; fi/);
  const b = lies('onprem', 'backup.sh');
  assert.match(b, /if \[ "\$mrc" -ne 0 \] && \[ "\$mrc" -ne 3 \]; then\n\s+mrc=0\n\s+timeout 30 docker compose run/);
  assert.match(b, /Alarm-Mail übersprungen: SMTP nicht eingerichtet/);
  assert.match(b, /3 SMTP nicht eingerichtet/);
});
