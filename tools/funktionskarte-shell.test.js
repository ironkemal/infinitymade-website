import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  shellFunktionenFinden,
  shellQuellen,
  shellAufrufe,
} from './funktionskarte-shell.mjs';

test('bash: einzeilige Definition endet auf derselben Zeile', () => {
  const code = `log() { printf '%s\\n' "$*"; }`;
  const fns = shellFunktionenFinden(code, 'install.sh', 'bash');
  assert.equal(fns.length, 1);
  assert.equal(fns[0].name, 'log');
  assert.equal(fns[0].kind, 'bash-function');
  assert.equal(fns[0].lang, 'bash');
  assert.equal(fns[0].start, 1);
  assert.equal(fns[0].end, 1);
  assert.equal(fns[0].lines, 1);
});

test('bash: mehrzeilig mit ${VAR}, # mit { im Kommentar und Heredoc mit }-Zeile', () => {
  const code = [
    'complex_fn() {',
    '  echo "${VAR}"',
    '  # Kommentar mit { Klammer',
    '  cat <<\'EOF\'',
    '  }',
    'EOF',
    '  echo "weiter"',
    '}'
  ].join('\n');

  const fns = shellFunktionenFinden(code, 'test.sh', 'bash');
  assert.equal(fns.length, 1);
  assert.equal(fns[0].name, 'complex_fn');
  assert.equal(fns[0].kind, 'bash-function');
  assert.equal(fns[0].start, 1);
  assert.equal(fns[0].end, 8);
  assert.equal(fns[0].lines, 8);
});

test('bash: Heredoc-Inhalt erzeugt keine Funktionsdefinition', () => {
  const code = [
    'cat <<EOF',
    'foo() {',
    '  echo "nicht als funktion werten"',
    '}',
    'EOF'
  ].join('\n');

  const fns = shellFunktionenFinden(code, 'test.sh', 'bash');
  assert.equal(fns.length, 0);
});

test('bash: function name { Syntax wird erkannt', () => {
  const code = [
    'function name {',
    '  echo "funktioniert"',
    '}'
  ].join('\n');

  const fns = shellFunktionenFinden(code, 'test.sh', 'bash');
  assert.equal(fns.length, 1);
  assert.equal(fns[0].name, 'name');
  assert.equal(fns[0].kind, 'bash-function');
  assert.equal(fns[0].start, 1);
  assert.equal(fns[0].end, 3);
});

test('shellQuellen findet lib-ip.sh aus source "$SCRIPT_DIR/lib-ip.sh" und ignoriert # source x.sh', () => {
  const code = [
    '# source auskommentiert.sh',
    '# shellcheck source=./lib-ip.sh',
    'source "$SCRIPT_DIR/lib-ip.sh"',
    '. ./lib-health.sh',
    '# . noch_eine_auskommentiert.sh'
  ].join('\n');

  const quellen = shellQuellen(code);
  assert.deepEqual(quellen, ['lib-ip.sh', 'lib-health.sh']);
});

test('shellAufrufe: echte Befehle erkennen, falsche Treffer ausschließen', () => {
  const body = `
  ok "x"
  x="$(setup_jeton_neu)"
  if setup_abgeschlossen_lesen; then
    echo log
  fi
  # warn "dies ist ein kommentar"
  console.log("kein bash treffer")
`;
  const bekannte = new Set(['ok', 'setup_jeton_neu', 'setup_abgeschlossen_lesen', 'log', 'warn']);
  const treffer = shellAufrufe(body, bekannte, 'andereFunktion', 'bash');

  assert.ok(treffer.includes('ok'), 'ok "x" muss erkannt werden');
  assert.ok(treffer.includes('setup_jeton_neu'), '$(setup_jeton_neu) muss erkannt werden');
  assert.ok(treffer.includes('setup_abgeschlossen_lesen'), 'if setup_abgeschlossen_lesen muss erkannt werden');
  assert.ok(!treffer.includes('log'), 'echo log und console.log( duerfen log nicht matchen');
  assert.ok(!treffer.includes('warn'), '# warn darf nicht gematcht werden');
  assert.deepEqual(treffer, ['ok', 'setup_abgeschlossen_lesen', 'setup_jeton_neu']);
});

test('PowerShell: function BoxEnv([string]$k) { erkannt, Aufruf $x = BoxEnv \'SITE_URL\' gefunden', () => {
  const code = `
function BoxEnv([string]$k) {
  $env:WSL_UTF8 = '1'
}
`;
  const fns = shellFunktionenFinden(code, 'praxura-installieren.ps1', 'ps1');
  assert.equal(fns.length, 1);
  assert.equal(fns[0].name, 'BoxEnv');
  assert.equal(fns[0].kind, 'ps-function');
  assert.equal(fns[0].lang, 'ps1');

  const body = "$x = BoxEnv 'SITE_URL'";
  const treffer = shellAufrufe(body, new Set(['BoxEnv']), null, 'ps1');
  assert.deepEqual(treffer, ['BoxEnv']);
});

test('Spiegel-Hinweis aus # Spiegel von install.sh env_get ueber der Definition', () => {
  const code = [
    '# Spiegel von install.sh env_get',
    '_sj_env_lesen() {',
    '  echo "lesen"',
    '}'
  ].join('\n');

  const fns = shellFunktionenFinden(code, 'lib-setup-jeton.sh', 'bash');
  assert.equal(fns.length, 1);
  assert.equal(fns[0].name, '_sj_env_lesen');
  assert.equal(fns[0].spiegelHinweis, 'Spiegel von install.sh env_get');
});

test('Integrations-Check gegen onprem/lib-setup-jeton.sh', () => {
  const dateiPfad = join(process.cwd(), 'onprem', 'lib-setup-jeton.sh');
  const src = readFileSync(dateiPfad, 'utf8');
  const fns = shellFunktionenFinden(src, 'onprem/lib-setup-jeton.sh', 'bash');
  const namen = fns.map(f => f.name).sort();
  assert.deepEqual(namen, [
    '_sj_env_lesen',
    '_sj_env_setzen',
    'setup_abgeschlossen_lesen',
    'setup_jeton_aufraeumen',
    'setup_jeton_neu',
  ]);
});
