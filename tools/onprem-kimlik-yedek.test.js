import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const composePfad = path.join(repoRoot, 'onprem', 'docker-compose.yml');
const backupPfad = path.join(repoRoot, 'onprem', 'backup.sh');
const installPfad = path.join(repoRoot, 'onprem', 'install.sh');

/**
 * Hilfsfunktion: extrahiert den Compose-Dienstblock ab `^  name:$`
 * bis zur nächsten Zeile mit genau 2 Leerzeichen Einrückung + Bezeichner + `:`
 * oder einer Zeile ohne Einrückung. Nur innerhalb von `services:` (unter `volumes:`
 * stehen gleich eingerückte Volume-Namen), Kommentarzeilen zählen nicht.
 */
export function dienstBlock(text, name) {
  const alle = text.split(/\r?\n/);
  const start = alle.findIndex((z) => /^services:\s*$/.test(z));
  const ende = alle.findIndex((z, i) => i > start && /^[^\s#]/.test(z));
  const zeilen = alle.slice(start + 1, ende === -1 ? undefined : ende).filter((z) => !/^\s*#/.test(z));
  const startRegex = new RegExp(`^  ${name}:\\s*$`);
  const naechsterDienstRegex = /^  [a-zA-Z0-9_-]+:\s*$/;
  const topLevelRegex = /^[^\s#]/;

  let erfassen = false;
  const block = [];

  for (const zeile of zeilen) {
    if (!erfassen) {
      if (startRegex.test(zeile)) {
        erfassen = true;
        block.push(zeile);
      }
    } else {
      if (naechsterDienstRegex.test(zeile) || topLevelRegex.test(zeile)) {
        break;
      }
      block.push(zeile);
    }
  }
  return block.join('\n');
}

test('Compose: Dienst api bindet kimlik mit :ro ein und enthält kein acmedns', () => {
  const inhalt = fs.readFileSync(composePfad, 'utf8');
  const api = dienstBlock(inhalt, 'api');
  assert.ok(api, 'Dienst api muss in docker-compose.yml existieren');
  assert.match(api, /kimlik:[^\n]*:ro/, 'api muss kimlik mit :ro einbinden');
  assert.ok(!api.includes('acmedns'), 'api darf acmedns nicht enthalten');
});

test('Compose: Dienst caddy bindet acmedns mit :ro ein und enthält kein kimlik', () => {
  const inhalt = fs.readFileSync(composePfad, 'utf8');
  const caddy = dienstBlock(inhalt, 'caddy');
  assert.ok(caddy, 'Dienst caddy muss in docker-compose.yml existieren');
  assert.match(caddy, /acmedns:[^\n]*:ro/, 'caddy muss acmedns mit :ro einbinden');
  assert.ok(!caddy.includes('kimlik'), 'caddy darf kimlik nicht enthalten');
});

test('Compose: Dienst kayit hat profiles [kurulum], keine ports/depends_on, keine DB/Krypto-Geheimnisse', () => {
  const inhalt = fs.readFileSync(composePfad, 'utf8');
  const kayit = dienstBlock(inhalt, 'kayit');
  assert.ok(kayit, 'Dienst kayit muss in docker-compose.yml existieren');

  // profiles mit kurulum
  assert.match(kayit, /profiles:\s*\[[^\]]*"kurulum"[^\]]*\]/, 'kayit muss profiles: ["kurulum"] haben');

  // kein depends_on, keine ports
  assert.ok(!/^\s+depends_on:/m.test(kayit), 'kayit darf kein depends_on haben');
  assert.ok(!/^\s+ports:/m.test(kayit), 'kayit darf keine ports haben');

  // Environment darf keine der sensiblen Schlüssel enthalten
  const verboteneSchluessel = [
    'SERVICE_ROLE_KEY',
    'DATABASE_URL',
    'DATA_ENCRYPTION_KEY',
    'SETUP_TOKEN',
    'POSTGRES_PASSWORD',
  ];
  for (const schluessel of verboteneSchluessel) {
    assert.ok(!kayit.includes(schluessel), `kayit-Environment darf ${schluessel} nicht enthalten`);
  }
});

test('Compose: Kein anderer Dienst als api, kayit, caddy erwähnt kimlik oder acmedns', () => {
  const inhalt = fs.readFileSync(composePfad, 'utf8');
  const servicesTeil = inhalt.split(/^services:\s*$/m)[1].split(/^[^\s#]/m)[0];
  const alleDiensteMatches = servicesTeil.match(/^  ([a-zA-Z0-9_-]+):\s*$/gm) || [];
  assert.ok(alleDiensteMatches.length >= 8, 'Dienste unter services: nicht gefunden');
  const alleDienste = alleDiensteMatches.map((m) => m.trim().replace(/:$/, ''));

  const erlaubteDienste = new Set(['api', 'kayit', 'caddy']);

  for (const dienst of alleDienste) {
    if (!erlaubteDienste.has(dienst)) {
      const block = dienstBlock(inhalt, dienst);
      assert.ok(!block.includes('kimlik'), `Dienst ${dienst} darf kimlik nicht erwähnen`);
      assert.ok(!block.includes('acmedns'), `Dienst ${dienst} darf acmedns nicht erwähnen`);
    }
  }
});

test('backup.sh: Sicherungsquellen als Positivliste — weder kimlik noch acmedns noch /var/lib/praxura, bekannte Quellen vorhanden', () => {
  // Kommentarzeilen zählen nicht (eine Erklärung wie „kimlik wird nicht gesichert“ soll den Test nicht brechen).
  const inhalt = fs.readFileSync(backupPfad, 'utf8').split(/\r?\n/).filter((z) => !/^\s*#/.test(z)).join('\n');

  // Darf kimlik, acmedns oder /var/lib/praxura nicht enthalten
  assert.ok(!inhalt.includes('kimlik'), 'backup.sh darf kimlik nicht erwähnen');
  assert.ok(!inhalt.includes('acmedns'), 'backup.sh darf acmedns nicht erwähnen');
  assert.ok(!inhalt.includes('/var/lib/praxura'), 'backup.sh darf /var/lib/praxura nicht erwähnen');

  // Bekannte Quellen als Positivliste vorhanden
  assert.ok(inhalt.includes('volumes/storage'), 'backup.sh muss volumes/storage sichern');
  assert.ok(inhalt.includes('caddy:/data/caddy/pki'), 'backup.sh muss caddy PKI sichern');
  assert.ok(inhalt.includes('pg_dump'), 'backup.sh muss pg_dump ausführen');
  assert.ok(inhalt.includes('db.dump'), 'backup.sh muss db.dump schreiben');
});

test('install.sh: kein down -v/--volumes, erwähnt bei --neu-Löschen nicht kimlik/acmedns', () => {
  // Kommentarzeilen zählen nicht (der Kopfkommentar des --neu-Blocks erklärt `down -v`).
  const inhalt = fs.readFileSync(installPfad, 'utf8').split(/\r?\n/).filter((z) => !/^\s*#/.test(z)).join('\n');

  // Keine Zeile ruft docker compose down mit -v oder --volumes auf
  assert.ok(!/docker\s+compose\s+down[^\n]*(\s+-v\b|\s+--volumes\b)/.test(inhalt), 'install.sh darf kein docker compose down -v oder --volumes aufrufen');

  // Im --neu-Löschblock dürfen kimlik und acmedns nicht als zu löschende Volumes aufgeführt sein
  const neuMatch = inhalt.match(/NEU_BESTAETIGT[\s\S]*?ok "Alte Datenbank entfernt"/);
  assert.ok(neuMatch, '--neu Löschblock muss in install.sh vorhanden sein');
  const neuBlock = neuMatch[0];

  // Die Löschung läuft über eine Schleife (`docker volume rm $v_ids`) — darum den ganzen Block prüfen, nicht nur die rm-Zeile.
  assert.doesNotMatch(neuBlock, /\b(kimlik|acmedns)\b/, '--neu-Löschblock darf kimlik/acmedns nicht anfassen');
  assert.match(neuBlock, /docker\s+volume\s+rm/, '--neu-Löschblock muss Volumes gezielt entfernen');
  assert.ok(/db-config\s+caddy_data\s+caddy_config/.test(neuBlock), 'Löschung muss gezielt db-config, caddy_data, caddy_config ansprechen');
});

test('install.sh: Code wird nie per set_env geschrieben, nie als --code übergeben, read -r -s für Code, Volume-Init vor erstem up', () => {
  const inhalt = fs.readFileSync(installPfad, 'utf8');

  // Code wird nie per set_env geschrieben (set_env KAYIT_CODE kommt nicht vor)
  assert.ok(!/set_env\s+KAYIT_CODE\b/.test(inhalt), 'install.sh darf KAYIT_CODE nie per set_env schreiben');

  // Code wird nie als CLI-Argument --code übergeben
  assert.ok(!/--code\b/.test(inhalt), 'install.sh darf den Code nie per --code übergeben');

  // read -r -s für geheime Code-Eingabe vorhanden
  assert.match(inhalt, /read\s+[^;\n]*-r\s+[^;\n]*-s|read\s+[^;\n]*-s\s+[^;\n]*-r/, 'install.sh muss read -r -s für die Code-Eingabe verwenden');

  // set -u: ip_modus muss vor der ersten Verwendung gesetzt werden (K2b.6-Review: Absturz nach Registrierung)
  const posModusSetzen = inhalt.search(/^\s*ip_modus=/m);
  const posModusLesen = inhalt.indexOf('"$ip_modus"');
  assert.ok(posModusLesen === -1 || (posModusSetzen !== -1 && posModusSetzen < posModusLesen), 'ip_modus muss vor der Verwendung gesetzt werden');

  // --entrypoint true kayit kommt vor dem ersten docker compose up -d vor
  const posEntrypoint = inhalt.indexOf('--entrypoint true kayit');
  // nur Befehlszeilen zählen (Schritt 0 nennt `docker compose up -d` als Text in einer Meldung)
  const posComposeUp = inhalt.search(/^\s*(if\s+!\s+)?docker\s+compose\s+up\s+-d/m);
  assert.ok(posEntrypoint !== -1, 'install.sh muss --entrypoint true kayit enthalten');
  assert.ok(posComposeUp !== -1, 'install.sh muss docker compose up -d enthalten');
  assert.ok(posEntrypoint < posComposeUp, '--entrypoint true kayit muss vor dem ersten docker compose up -d vorkommen');
});

test('install.sh: enthält kein hostname -I mehr und sourct lib-ip.sh (K2b.6 / L2, L3)', () => {
  const inhalt = fs.readFileSync(installPfad, 'utf8');
  assert.ok(!inhalt.includes('hostname -I'), 'install.sh darf kein hostname -I mehr enthalten');
  assert.match(inhalt, /source\s+["']?\$SCRIPT_DIR\/lib-ip\.sh["']?/, 'install.sh muss lib-ip.sh sourcen');
});

test('ip-melden.sh: schreibt nur bei lan-Modus und nutzt mv atomar (K2b.6 / L1, L5)', () => {
  const ipMeldenPfad = path.join(repoRoot, 'onprem', 'ip-melden.sh');
  assert.ok(fs.existsSync(ipMeldenPfad), 'ip-melden.sh muss existieren');
  const inhalt = fs.readFileSync(ipMeldenPfad, 'utf8');

  // sourct lib-ip.sh
  assert.match(inhalt, /source\s+["']?\$SCRIPT_DIR\/lib-ip\.sh["']?/, 'ip-melden.sh muss lib-ip.sh sourcen');

  // Prüft auf lan-Modus
  assert.match(inhalt, /\[\s*"\$MODUS"\s*=\s*"lan"\s*\]/, 'ip-melden.sh muss auf lan-Modus prüfen');

  // Nutzt mv für atomaren Tausch
  assert.match(inhalt, /mv\s+(-f\s+)?["']?\$TMP_DATEI["']?\s+["']?\$LAN_IP_DATEI["']?/, 'ip-melden.sh muss mv für atomaren Tausch nutzen');
});

test('Compose: Dienst api bindet ./volumes/ip:/var/lib/praxura/ip:ro ein (K2b.6 / L5)', () => {
  const inhalt = fs.readFileSync(composePfad, 'utf8');
  const api = dienstBlock(inhalt, 'api');
  assert.ok(api, 'Dienst api muss in docker-compose.yml existieren');
  assert.match(api, /\.\/volumes\/ip:\/var\/lib\/praxura\/ip:ro/, 'api muss ./volumes/ip:/var/lib/praxura/ip:ro einbinden');
});

test('.gitignore: enthält onprem/volumes/ip/ (K2b.6 / L6)', () => {
  const gitignorePfad = path.join(repoRoot, '.gitignore');
  const inhalt = fs.readFileSync(gitignorePfad, 'utf8');
  assert.match(inhalt, /onprem\/volumes\/ip\//, '.gitignore muss onprem/volumes/ip/ enthalten');
});
