import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const install = fs.readFileSync(new URL('../onprem/install.sh', import.meta.url), 'utf8');
const start = install.indexOf('# Caddy kann bereits gesund sein,');
const end = install.indexOf('ohne_key=', start);
assert.ok(start > 0 && end > start);
const tlsBlock = install.slice(start, end);

function run(t, mode, tlsArg, fail = false) {
  const script = `
set -euo pipefail
CADDY_TLS_MODUS_VALUE="$1"
CADDY_TLS_ARG_VALUE="$2"
CA_DIR=/tmp/praxura-test-ca
RESOLVE_ARG=--resolve
RESOLVE_VAL=box.example:443:127.0.0.1
SITE_URL=https://box.example
log() { :; }
ok() { :; }
fail() { echo TLS_REJECTED; exit 42; }
sleep() { :; }
curl() {
  printf 'CURL'; printf ' [%s]' "$@"; printf '\\n'
  ${fail ? 'SECONDS=301; return 60' : 'return 0'}
}
${tlsBlock}
echo TLS_ACCEPTED
`;
  const result = spawnSync('bash', ['-c', script, '_', mode, tlsArg], { encoding: 'utf8', timeout: 2000 });
  if (result.error?.code === 'ENOENT') { t.skip('bash nicht vorhanden'); return null; }
  assert.ifError(result.error);
  return result;
}

for (const [mode, tlsArg] of [['klassisch', 'internal'], ['klassisch', 'owner@example.test'], ['acmedns', 'internal']]) {
  test(`Installationsprüfung: ${mode}/${tlsArg} prüft Zertifikatskette mit begrenzter Anfrage`, (t) => {
    const result = run(t, mode, tlsArg);
    if (!result) return;
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /TLS_ACCEPTED/);
    assert.match(result.stdout, /\[--connect-timeout\] \[3\] \[--max-time\] \[5\]/);
    assert.match(result.stdout, /\[https:\/\/box.example\/login.html\]/);
    assert.doesNotMatch(result.stdout, /\[(-k|--insecure|-sk)\]/);
    assert.equal(result.stdout.includes('[--cacert] [/tmp/praxura-test-ca/root.crt]'), mode === 'klassisch' && tlsArg === 'internal');
  });
}

test('Ungültiges Zertifikat wird nach Frist abgelehnt; kein Schlüsselbeweis danach', (t) => {
  const result = run(t, 'acmedns', 'internal', true);
  if (!result) return;
  assert.equal(result.status, 42, result.stderr);
  assert.match(result.stdout, /TLS_REJECTED/);
  assert.doesNotMatch(result.stdout, /TLS_ACCEPTED/);
  assert.equal(result.stdout.match(/CURL/g)?.length, 1, 'abgelaufene Frist beendet Wiederholung');
});

test('Alle vier Schlüsselproben haben Verbindungs- und Gesamtfrist', () => {
  const requests = install.split('\n').filter((line) => /^(ohne_key|mit_key|mit_kaputtem_key|mit_service_key)=/.test(line));
  assert.equal(requests.length, 4);
  for (const line of requests) assert.match(line, /curl --connect-timeout 3 --max-time 5 /);
});
