import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const caddyfilePfad = path.join(repoRoot, 'onprem', 'Caddyfile');
const dockerfilePfad = path.join(repoRoot, 'onprem', 'frontend.Dockerfile');
const composePfad = path.join(repoRoot, 'onprem', 'docker-compose.yml');
const envTemplatePfad = path.join(repoRoot, 'onprem', '.env.template');
const backupPfad = path.join(repoRoot, 'onprem', 'backup.sh');
const installPfad = path.join(repoRoot, 'onprem', 'install.sh');
const ps1Pfad = path.join(repoRoot, 'installieren', 'install.ps1');

/**
 * Hilfsfunktion: extrahiert den Compose-Dienstblock ab `^  name:$`
 * bis zum nächsten Dienstblock oder Top-Level-Abschnitt.
 */
function dienstBlock(text, name) {
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

test('Caddyfile: importiert tls_{$CADDY_TLS_MODUS:klassisch}, kein tls {$CADDY_TLS_ARG} außerhalb von tls_klassisch', () => {
  const inhalt = fs.readFileSync(caddyfilePfad, 'utf8');

  // Enthält die Import-Direktive mit Default klassisch
  assert.ok(inhalt.includes('import tls_{$CADDY_TLS_MODUS:klassisch}'), 'Caddyfile muss import tls_{$CADDY_TLS_MODUS:klassisch} enthalten');

  // Snippets enden an der ersten Zeile, die nur aus `}` besteht (Spalte 0) — ein
  // lazy `[sS]*?}` bliebe an der Klammer von `{$…}` hängen.
  // Entferne das Snippet (tls_klassisch) {...} und prüfe, dass kein weiteres `tls {$CADDY_TLS_ARG}` vorkommt
  const ohneKlassisch = inhalt.replace(/^\(tls_klassisch\) \{\r?\n[\s\S]*?\r?\n\}/m, '');
  assert.doesNotMatch(ohneKlassisch, /^\s*tls\s+\{\$CADDY_TLS_ARG\}/m, 'Außerhalb von (tls_klassisch) darf kein tls {$CADDY_TLS_ARG} stehen');
});

test('Caddyfile: Snippet (tls_acmedns) nutzt Let\'s Encrypt + dns acmedns, schließt interne CA / ZeroSSL / Staging aus', () => {
  const inhalt = fs.readFileSync(caddyfilePfad, 'utf8');
  const acmednsMatch = inhalt.match(/^\(tls_acmedns\) \{\r?\n[\s\S]*?\r?\n\}/m);
  assert.ok(acmednsMatch, 'Snippet (tls_acmedns) muss im Caddyfile existieren');
  // Kommentarzeilen zählen nicht (K2b.4b: der test_dir-Kommentar erklärt die Staging-Schleife)
  const snippet = acmednsMatch[0].split(/\r?\n/).filter((z) => !/^\s*#/.test(z)).join('\n');

  // LE Directory und dns acmedns vorhanden
  assert.ok(snippet.includes('dir https://acme-v02.api.letsencrypt.org/directory'), 'Snippet muss LE-Directory enthalten');
  assert.match(snippet, /dns\s+acmedns\b/, 'Snippet muss dns acmedns enthalten');

  // Interne CA, ZeroSSL, Staging, local_certs verboten
  assert.doesNotMatch(snippet, /\binternal\b/i, 'tls_acmedns darf kein internal enthalten');
  assert.doesNotMatch(snippet, /\blocal_certs\b/i, 'tls_acmedns darf kein local_certs enthalten');
  assert.doesNotMatch(snippet, /\bzerossl\b/i, 'tls_acmedns darf kein zerossl enthalten');
  assert.doesNotMatch(snippet, /\bstaging\b/i, 'tls_acmedns darf kein staging enthalten');
});

test('frontend.Dockerfile: genau ein ARG VERSION_CADDY=, beide FROMs nutzen ${VERSION_CADDY}, feste Modulversion ohne @latest', () => {
  const inhalt = fs.readFileSync(dockerfilePfad, 'utf8');

  // Genau ein ARG VERSION_CADDY=
  const argMatches = inhalt.match(/^\s*ARG\s+VERSION_CADDY=/gm) || [];
  assert.equal(argMatches.length, 1, 'frontend.Dockerfile muss genau ein ARG VERSION_CADDY= enthalten');

  // Beide FROM-Zeilen nutzen ${VERSION_CADDY}
  const fromZeilen = inhalt.split(/\r?\n/).filter((z) => /^\s*FROM\b/i.test(z));
  assert.equal(fromZeilen.length, 2, 'frontend.Dockerfile muss genau zwei FROM-Zeilen (2 Stufen) haben');
  for (const from of fromZeilen) {
    assert.ok(from.includes('${VERSION_CADDY}'), `FROM-Zeile muss \${VERSION_CADDY} nutzen: ${from}`);
  }

  // Modul mit fester Version und ohne @latest
  assert.match(inhalt, /caddy-dns\/acmedns@v\d+\.\d+\.\d+/, 'frontend.Dockerfile muss caddy-dns/acmedns mit fester Version @v... pinnen');
  assert.ok(!inhalt.includes('@latest'), 'frontend.Dockerfile darf kein @latest enthalten');
});

test('docker-compose.yml: Dienst caddy enthält CADDY_TLS_MODUS: ${CADDY_TLS_MODUS:-klassisch}', () => {
  const inhalt = fs.readFileSync(composePfad, 'utf8');
  const caddy = dienstBlock(inhalt, 'caddy');
  assert.ok(caddy, 'Dienst caddy muss in docker-compose.yml existieren');
  assert.match(caddy, /CADDY_TLS_MODUS:\s*\$\{CADDY_TLS_MODUS:-klassisch\}/, 'caddy-Block muss CADDY_TLS_MODUS: ${CADDY_TLS_MODUS:-klassisch} enthalten');
});

test('.env.template: enthält CADDY_TLS_MODUS=klassisch und kein VERSION_CADDY=', () => {
  const inhalt = fs.readFileSync(envTemplatePfad, 'utf8');
  assert.match(inhalt, /^CADDY_TLS_MODUS=klassisch/m, '.env.template muss CADDY_TLS_MODUS=klassisch enthalten');
  assert.doesNotMatch(inhalt, /^VERSION_CADDY=/m, '.env.template darf kein VERSION_CADDY= enthalten');
});

test('backup.sh: CADDY_TLS_MODUS- / acmedns-Prüfung steht vor docker compose cp caddy:/data/caddy/pki', () => {
  const inhalt = fs.readFileSync(backupPfad, 'utf8');
  const cpPos = inhalt.indexOf('caddy:/data/caddy/pki');
  assert.ok(cpPos !== -1, 'backup.sh muss caddy:/data/caddy/pki enthalten');

  const abschnittVorCp = inhalt.slice(0, cpPos);
  const pkiAbschnittStart = abschnittVorCp.lastIndexOf('# ── 1b)');
  assert.ok(pkiAbschnittStart !== -1, 'backup.sh muss Abschnitt 1b enthalten');

  const abschnitt1b = abschnittVorCp.slice(pkiAbschnittStart);
  assert.match(abschnitt1b, /CADDY_TLS_MODUS/, 'Abschnitt 1b vor caddy:/data/caddy/pki muss CADDY_TLS_MODUS prüfen');
  assert.match(abschnitt1b, /"acmedns"/, 'Abschnitt 1b vor caddy:/data/caddy/pki muss auf acmedns prüfen');
});

test('install.sh: set_env CADDY_TLS_MODUS acmedns nur nach acmedns-Prüfung, CADDY_TLS_MODUS_VALUE initialisiert, vor erstem up', () => {
  const inhalt = fs.readFileSync(installPfad, 'utf8');

  // CADDY_TLS_MODUS_VALUE wird vor seiner ersten Verwendung initialisiert (set -u Schutz)
  const posZuweisung = inhalt.search(/^\s*CADDY_TLS_MODUS_VALUE=/m);
  const posErsteNutzung = inhalt.search(/["'\s]\$CADDY_TLS_MODUS_VALUE["'\s]/);
  assert.ok(posZuweisung !== -1, 'CADDY_TLS_MODUS_VALUE muss zugewiesen werden');
  assert.ok(posErsteNutzung !== -1, 'CADDY_TLS_MODUS_VALUE muss verwendet werden');
  assert.ok(posZuweisung < posErsteNutzung, 'CADDY_TLS_MODUS_VALUE muss VOR der ersten Verwendung initialisiert werden');

  // set_env CADDY_TLS_MODUS ...acmedns kommt nur in einem Zweig vor, der "acmedns":true aus --durum --json prüft
  const zeilen = inhalt.split(/\r?\n/);
  const treffer = zeilen.filter((z) => /set_env\s+CADDY_TLS_MODUS\s+["']?acmedns["']?/.test(z));
  assert.equal(treffer.length, 1, 'set_env CADDY_TLS_MODUS acmedns darf genau einmal im Skript vorkommen');
  const acmednsSetEnvZeilenIndex = zeilen.findIndex((z) => /set_env\s+CADDY_TLS_MODUS\s+["']?acmedns["']?/.test(z));
  assert.ok(acmednsSetEnvZeilenIndex !== -1, 'install.sh muss set_env CADDY_TLS_MODUS acmedns enthalten');

  // Untersuche den umgebenden Block vor dieser Zeile auf die Prüfung von "acmedns" und --durum --json
  const vorherigeZeilen = zeilen.slice(Math.max(0, acmednsSetEnvZeilenIndex - 10), acmednsSetEnvZeilenIndex).join('\n');
  assert.match(vorherigeZeilen, /kayit\s+--durum\s+--json/, 'set_env CADDY_TLS_MODUS acmedns muss nach kayit --durum --json aufgerufen werden');
  assert.match(vorherigeZeilen, /"acmedns"/, 'set_env CADDY_TLS_MODUS acmedns muss das acmedns-Feld aus durum prüfen');

  // Erstes docker compose up -d (Befehlszeile in Schritt 13, die den caddy-Dienst startet)
  // Robuste Erkennung: Wir suchen nach der Befehlszeile `docker compose up -d` in Schritt 13 (nicht Hilfetexte/Meldungen in Schritt 0)
  const posSetEnvAcmedns = inhalt.search(/set_env\s+CADDY_TLS_MODUS\s+["']?acmedns["']?/);
  const matchComposeUp = inhalt.search(/^\s*(if\s+!\s+)?docker\s+compose\s+up\s+-d(?!\s+(--no-deps\s+)?api\b)/m); // K2b.7a: 'up -d --no-deps api' (--neuer-jeton/Aufräumen) zählt nicht
  assert.ok(matchComposeUp !== -1, 'install.sh muss docker compose up -d enthalten');
  assert.ok(posSetEnvAcmedns < matchComposeUp, 'Erstes set_env CADDY_TLS_MODUS acmedns muss textlich VOR dem ersten echten docker compose up -d stehen');
});

test('praxura-installieren.ps1: beginnt mit UTF-8-BOM und Import-Certificate-Zweig hängt an CADDY_TLS_MODUS', () => {
  const buffer = fs.readFileSync(ps1Pfad);

  // UTF-8-BOM: 0xEF, 0xBB, 0xBF
  assert.equal(buffer[0], 0xEF, 'praxura-installieren.ps1 muss mit UTF-8-BOM beginnen (Byte 0)');
  assert.equal(buffer[1], 0xBB, 'praxura-installieren.ps1 muss mit UTF-8-BOM beginnen (Byte 1)');
  assert.equal(buffer[2], 0xBF, 'praxura-installieren.ps1 muss mit UTF-8-BOM beginnen (Byte 2)');

  const text = buffer.toString('utf8');
  const importCertPos = text.indexOf('Import-Certificate');
  assert.ok(importCertPos !== -1, 'praxura-installieren.ps1 muss Import-Certificate enthalten');

  // Der Abschnitt vor Import-Certificate in Schritt 9 muss CADDY_TLS_MODUS auswerten
  const schritt9Start = text.lastIndexOf('# ── 9', importCertPos);
  assert.ok(schritt9Start !== -1, 'Schritt 9 muss vor Import-Certificate existieren');
  const schritt9Text = text.slice(schritt9Start, importCertPos);
  assert.match(schritt9Text, /CADDY_TLS_MODUS/, 'Import-Certificate-Zweig muss CADDY_TLS_MODUS abfragen');
  assert.match(schritt9Text, /acmedns/, 'Import-Certificate-Zweig muss acmedns prüfen');
});

test('restore.sh: acmedns-Box spielt caddy-pki nicht zurück (guvenlik S-47 Bedingung 1)', () => {
  const inhalt = fs.readFileSync(path.join(repoRoot, 'onprem', 'restore.sh'), 'utf8');
  const posModus = inhalt.search(/env_wert CADDY_TLS_MODUS\)"\s*=\s*"acmedns"/);
  const posCp = inhalt.indexOf('caddy:/data/caddy/pki');
  assert.ok(posModus !== -1, 'restore.sh muss CADDY_TLS_MODUS=acmedns prüfen');
  assert.ok(posCp !== -1 && posModus < posCp, 'acmedns-Prüfung muss VOR dem Zurückspielen von caddy/pki stehen');
});

test('O-172: kein HSTS 2 Jahre mehr; update.sh senkt den Altwert und prüft den Zertifikatsablauf', () => {
  const inst = fs.readFileSync(path.join(repoRoot, 'onprem', 'install.sh'), 'utf8');
  const upd = fs.readFileSync(path.join(repoRoot, 'onprem', 'update.sh'), 'utf8');
  const mail = fs.readFileSync(path.join(repoRoot, 'api-backend', 'setup', 'update-alarm-mail.mjs'), 'utf8');
  assert.doesNotMatch(inst, /set_env HSTS_MAX_AGE "63072000"/);
  assert.match(upd, /HSTS_MAX_AGE\)" = "63072000" \]/, 'Senkung nur für den exakten Altwert');
  assert.match(upd, /-checkend 1814400/, '21 Tage');
  assert.match(upd, /= "internal" \]; \}; then return 0; fi/, 'internal (12-h-Blatt) wird nicht bewertet');
  // guvenlik S-47: frühe Ausstiege (Disk-Gate, Pull, Bundle) dürfen die Warnung nicht stummschalten
  const iPruef = upd.indexOf('zertifikat_pruefen || true');
  assert.ok(iPruef > upd.indexOf('if [ ! -f "$ENV_FILE" ]'), 'nach Lock/.env-Prüfung');
  assert.ok(iPruef < upd.indexOf('platz_frei_pct=$(df'), 'vor dem Disk-Gate');
  assert.ok(iPruef < upd.indexOf('# ── Schritt 1 — nur das eigene Image ziehen'), 'vor dem Pull');
  assert.ok(upd.indexOf('mail_gonder_container() {') < iPruef, 'Mailfunktion vorher definiert');
  assert.match(mail, /zertifikat_laeuft_ab:/);
});
