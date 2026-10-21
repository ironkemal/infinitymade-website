// install.sh --fenster (Konsey 2026-10-13, Stufe 2): das Windows-Einrichtungsfenster
// beantwortet die Fragen über die stdin-Pipe. Diese Tests halten die Zusagen an
// guvenlik/onprem fest, damit spätere Änderungen sie nicht still aufweichen:
//  - jede Frage läuft über frage() (sonst hinge die Einrichtung ohne Terminal)
//  - die Terminal-Pflicht gilt weiter, ausser bei ausdrücklichem --fenster
//  - Antworten nur über fd 3, alle anderen Befehle lesen /dev/null
//  - Geheimnisse gehen als GEHEIM-Zeilen nur ins Schlüssel-Fenster, nie ins Log
//  - install.ps1 schreibt keine Antwort in die Kommandozeile von wsl.exe
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sh = fs.readFileSync(path.join(repoRoot, 'onprem', 'install.sh'), 'utf8');
const ps = fs.readFileSync(path.join(repoRoot, 'installieren', 'install.ps1'), 'latin1');

test('install.sh fragt nur über frage() (ausser in frage() selbst)', () => {
  const ohneFrage = sh.replace(/\nfrage\(\) \{[\s\S]*?\n\}\n/, '\n');
  assert.equal((ohneFrage.match(/read -r -p/g) || []).length, 0);
  assert.ok((sh.match(/^\s*frage [a-z_A-Z]+ [a-z_]+ "/gm) || []).length >= 14);
});

test('Terminal-Pflicht bleibt ohne --fenster bestehen', () => {
  assert.match(sh, /if \[ "\$FENSTER" -eq 1 \]; then\n[\s\S]*?exec 3<&0 0<\/dev\/null\nelif \[ "\$NEUER_JETON" -ne 1 \] && \[ ! -t 0 \]; then/);
  assert.match(sh, /\[ "\$arg" = "--fenster" \] && FENSTER=1/);
});

test('frage() liest im Fenster-Modus nur von fd 3 und bricht bei EOF ab', () => {
  const f = sh.match(/\nfrage\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(f, /read -r "\$1" <&3/);
  assert.match(f, /fail "Einrichtung abgebrochen"/);
});

test('reveal_once schreibt nie ins Log, im Fenster-Modus als GEHEIM-Zeile', () => {
  const r = sh.match(/\nreveal_once\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.ok(!/\btee\b|LOG_FILE/.test(r.replace(/#.*$/gm, '')));
  assert.match(r, /@@PRAXURA GEHEIM/);
});

test('install.ps1: GEHEIM-Zeilen nur in den Schlüssel-Dialog, Antworten nur über stdin', () => {
  const box = ps.match(/function BoxImFenster \{[\s\S]*?\n\}\n/)[0];
  assert.match(box, /StartsWith\('@@PRAXURA GEHEIM/);
  assert.ok(!/GEHEIM[^\n]*(Log |Enqueue)/.test(box), 'GEHEIM darf nicht ins Protokoll');
  const args = box.match(/\$psi\.Arguments = (.*)/)[1];
  assert.ok(!/\$antwort|\$code|\$geheim/i.test(args), 'keine Antwort in der Kommandozeile');
  assert.match(box, /RedirectStandardInput = \$true/);
  assert.match(ps, /'gesichert'[\s\S]*?-abbrechbar \$false[\s\S]*?-eq 'GESICHERT'/);
});
