// onprem O-217 (22.10.2026): deinstallieren.sh — die Reihenfolge ist die Sicherung.
// Beta-Test: Timer nach `down -v` → Update baute die Box mit leeren Volumes neu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const s = fs.readFileSync(path.join(repoRoot, 'onprem/deinstallieren.sh'), 'utf8');
// Erst ab main() suchen — der Kopfkommentar nennt dieselben Schritte.
const ablauf = s.indexOf('main() {');
const pos = (needle) => {
  const i = s.indexOf(needle, ablauf);
  assert.ok(i >= 0, `fehlt: ${needle}`);
  return i;
};

test('bash -n: Syntax gültig', () => {
  execFileSync('bash', ['-n', path.join(repoRoot, 'onprem/deinstallieren.sh')]);
});

test('Reihenfolge: Sperre → Sicherung → Rettung → ENTFERNEN → Timer → down → rm', () => {
  const sperre = pos('flock -n 9');
  const sicherung = pos('backup.sh" --sebep manuel');
  const rettung = pos('praxura-sicherung-');
  const bestaetigung = pos('genau tippen: ENTFERNEN');
  const timer = pos('systemctl disable --now "$u.timer"');
  const down = pos('docker compose down -v --remove-orphans --rmi all');
  const rm = pos('rm -rf -- "$SCRIPT_DIR"');
  assert.ok(sperre < sicherung && sicherung < rettung && rettung < bestaetigung
    && bestaetigung < timer && timer < down && down < rm);
});

test('Timer UND Dienste aller drei Units werden gestoppt', () => {
  assert.match(s, /UNITS="praxura-update praxura-backup praxura-ip"/);
  assert.match(s, /systemctl stop "\$u\.service"/);
});

test('nur Projekt praxura: kein -p, COMPOSE_PROJECT_NAME entfernt, name: praxura geprüft', () => {
  assert.match(s, /env -u COMPOSE_PROJECT_NAME docker compose down/);
  assert.ok(!/docker compose -p /.test(s));
  assert.match(s, /grep -q '\^name: praxura\$'/);
});

test('Sicherung läuft mit gehaltener Sperre (sonst wartet backup.sh auf sich selbst)', () => {
  assert.match(s, /PRAXURA_LOCK_HELD=1 bash "\$SCRIPT_DIR\/backup\.sh"/);
});

test('Ablauf in main(), Aufruf in der letzten Zeile (Skript löscht seinen Ordner)', () => {
  assert.equal(s.trimEnd().split('\n').pop(), 'main "$@"');
});

test('im Bundle: Manifest, Dockerfile, Workflow-Trigger und Smoke-Liste', () => {
  const lies = (p) => fs.readFileSync(path.join(repoRoot, p), 'utf8');
  assert.match(lies('onprem/manifest.json'), /"deinstallieren\.sh"/);
  assert.match(lies('api-backend/Dockerfile'), /COPY --from=onprem .*deinstallieren\.sh/);
  const wf = lies('.github/workflows/publish-calendar-api.yml');
  assert.match(wf, /- 'onprem\/deinstallieren\.sh'/);
  assert.match(wf, /BUNDLE_DATEIEN=".*deinstallieren\.sh/);
});
