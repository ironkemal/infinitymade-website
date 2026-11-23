// Vertrags- und Ausführungstests für onprem/PLAN-UPDATE-HALTBARKEIT.md
// (O-213 b/e, O-247, O-248 + Timer-Zeitzone Europe/Berlin).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const updateSh = fs.readFileSync(path.join(ROOT, 'onprem/update.sh'), 'utf8');
const alarmMailJs = fs.readFileSync(path.join(ROOT, 'api-backend/setup/update-alarm-mail.mjs'), 'utf8');
const composeYml = fs.readFileSync(path.join(ROOT, 'onprem/docker-compose.yml'), 'utf8');
const installSh = fs.readFileSync(path.join(ROOT, 'onprem/install.sh'), 'utf8');
const checkOnpremSh = path.join(ROOT, 'tools/check-onprem.sh');

test('O-213 (e): Disk-Tor schreibt Status und ruft mail_gonder_container speicher_voll vor exit 1', () => {
  const diskStart = updateSh.indexOf('platz_frei_pct=');
  const pullStart = updateSh.indexOf('# ── Schritt 1 — nur das eigene Image ziehen');
  assert.ok(diskStart > 0 && pullStart > diskStart, 'Disk-Tor-Abschnitt in onprem/update.sh nicht gefunden');

  const diskBlock = updateSh.slice(diskStart, pullStart);
  const posStand = diskBlock.indexOf('speicher_stand_schreiben');
  const posMail = diskBlock.indexOf('mail_gonder_container speicher_voll');
  const posExit = diskBlock.indexOf('exit 1');

  assert.ok(posStand > 0, 'Disk-Tor muss Status in STAND_FILE schreiben (speicher_stand_schreiben)');
  assert.ok(posMail > 0, 'Disk-Tor muss mail_gonder_container speicher_voll aufrufen');
  assert.ok(posExit > 0, 'Disk-Tor muss mit exit 1 abbrechen');
  assert.ok(posStand < posExit, 'Status-Schreiben muss vor exit 1 stehen');
  assert.ok(posMail < posExit, 'Alarm-Mail muss vor exit 1 stehen');
  assert.match(updateSh, /SPEICHER_STAND="\$STAND_DIR\/son-speicher-bildirim\.json"/);
  assert.match(diskBlock, /BILDIRIM_ARALIK_SANIYE/);
  assert.match(diskBlock, /rm -f "\$SPEICHER_STAND"/);
});

test('O-213 (e): update-alarm-mail.mjs hat festen deutschen Text fuer speicher_voll ohne Pfade/Logs', () => {
  const match = alarmMailJs.match(/speicher_voll:\s*'([^']+)'/);
  assert.ok(match, 'speicher_voll fehlt in METINLER (api-backend/setup/update-alarm-mail.mjs)');
  const text = match[1];
  assert.match(text, /Speicherplatz|8 %/i);
  assert.doesNotMatch(text, /\/opt\/|\/var\/|\$\{/);
});

test('O-213 (b): Image-Aufraeumen nur im ok-Pfad nach Gesundheit + Bereitschaft, ohne verbotene Prune-Flags', () => {
  // Verbotene Befehle im aktiven Code (ohne reine Kommentarzeilen) ausschliessen.
  const activeCode = updateSh
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
  assert.doesNotMatch(activeCode, /docker\s+system\s+prune/, 'docker system prune darf nicht in update.sh stehen');
  assert.doesNotMatch(activeCode, /docker\s+image\s+prune[^\n]*(?:-a\b|--all\b)/, 'docker image prune -a/--all verboten');
  assert.doesNotMatch(activeCode, /--filter[^\n]*until=/, '--filter until= verboten');

  // VORHER_IMAGES vor dem .env-Abgleich merken.
  const posVorher = updateSh.indexOf('VORHER_IMAGES=');
  const posEnvMerge = updateSh.indexOf('# ── .env birleştirme (J4)');
  assert.ok(posVorher > 0 && posEnvMerge > posVorher, 'VORHER_IMAGES muss vor .env-Abgleich erfasst werden');

  for (const key of [
    'VERSION_POSTGRES',
    'VERSION_GOTRUE',
    'VERSION_POSTGREST',
    'VERSION_REALTIME',
    'VERSION_STORAGE',
    'VERSION_KONG',
    'PRAXURA_API_IMAGE',
    'PRAXURA_FRONTEND_IMAGE',
  ]) {
    assert.ok(updateSh.includes(`env_wert ${key}`), `aktuelle_images_sammeln muss ${key} lesen`);
  }

  // Aufräumen darf erst nach Gesundheits- + Bereitschaftsprüfung und NUR im if [ "$sonuc" = "ok" ] Block stehen.
  const posHealth = updateSh.indexOf('warte_auf_gesundheit 180');
  const posReady = updateSh.indexOf('bereitschaft_pruefen 60');
  const posOkBlock = updateSh.indexOf('if [ "$sonuc" = "ok" ]; then');
  const posOkEnd = updateSh.indexOf('\nfi\n', posOkBlock);
  assert.ok(posHealth > 0 && posReady > posHealth && posOkBlock > posReady && posOkEnd > posOkBlock);

  const okBlock = updateSh.slice(posOkBlock, posOkEnd);
  assert.match(okBlock, /docker rmi "\$alt_img"/);
  assert.match(okBlock, /docker image prune -f/);

  // Sicherstellen, dass docker rmi und docker image prune -f sonst nirgends als Befehl vorkommen.
  const outsideOk = updateSh.slice(0, posOkBlock) + updateSh.slice(posOkEnd);
  assert.doesNotMatch(outsideOk, /^\s*docker\s+rmi\b/m, 'docker rmi darf nur im sonuc=ok Block laufen');
  assert.doesNotMatch(outsideOk, /^\s*docker\s+image\s+prune\s+-f\b/m, 'docker image prune -f darf nur im sonuc=ok Block laufen');
});

test('O-247: onprem/docker-compose.yml setzt json-file Log-Limit (10m x 3) fuer alle 9 Dienste', () => {
  assert.match(
    composeYml,
    /x-praxura-logging:\s*&praxura-logging\s*\n\s+driver:\s*json-file\s*\n\s+options:\s*\n\s+max-size:\s*"10m"\s*\n\s+max-file:\s*"3"/,
    'x-praxura-logging Anker mit 10m x 3 fehlt'
  );

  // Alle Top-Level-Dienste unter services: parsen (2 Leerzeichen Einrückung).
  const servicesSection = composeYml.slice(
    composeYml.indexOf('\nservices:\n') + 1,
    composeYml.indexOf('\nnetworks:\n')
  );
  const serviceMatches = [...servicesSection.matchAll(/^  ([a-z0-9_-]+):\s*$/gm)];
  const serviceNames = serviceMatches.map((m) => m[1]);
  assert.deepEqual(
    serviceNames,
    ['db', 'auth', 'rest', 'realtime', 'storage', 'kong', 'api', 'kayit', 'caddy'],
    'Erwartete 9 Compose-Dienste weichen ab'
  );

  for (let i = 0; i < serviceMatches.length; i++) {
    const start = serviceMatches[i].index;
    const end = i + 1 < serviceMatches.length ? serviceMatches[i + 1].index : servicesSection.length;
    const block = servicesSection.slice(start, end);
    assert.match(
      block,
      /^\s{4}logging:\s*\*praxura-logging\s*$/m,
      `Dienst "${serviceNames[i]}" fehlt logging: *praxura-logging`
    );
  }
});

test('O-248: Postgres-Major-Tor in tools/check-onprem.sh blockiert 18.x und leer (auch mit SKIP_ONPREM_GATE=1), erlaubt 17.x', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-pg-gate-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: tmpDir });
    fs.mkdirSync(path.join(tmpDir, 'onprem'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'tools'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tools/.onprem-baseline'), '');

    const runGate = (envContent, extraEnv = {}) => {
      fs.writeFileSync(path.join(tmpDir, 'onprem/.env.template'), envContent);
      execFileSync('git', ['add', 'onprem/.env.template'], { cwd: tmpDir });
      return spawnSync('sh', [checkOnpremSh], {
        cwd: tmpDir,
        encoding: 'utf8',
        env: { ...process.env, ...extraEnv },
      });
    };

    // 18.1.0.1 -> abgelehnt
    const r18 = runGate('VERSION_POSTGRES=18.1.0.1\n');
    assert.notEqual(r18.status, 0, 'VERSION_POSTGRES=18.1.0.1 muss abgelehnt werden');
    assert.match(r18.stderr, /O-248/);

    // 18.1.0.1 auch mit SKIP_ONPREM_GATE=1 -> weiterhin abgelehnt (kein Skip-Schalter!)
    const r18Skip = runGate('VERSION_POSTGRES=18.1.0.1\n', { SKIP_ONPREM_GATE: '1' });
    assert.notEqual(r18Skip.status, 0, 'O-248 darf durch SKIP_ONPREM_GATE=1 nicht umgangen werden');
    assert.match(r18Skip.stderr, /O-248/);

    // leer -> abgelehnt
    const rEmpty = runGate('VERSION_POSTGRES=\n');
    assert.notEqual(rEmpty.status, 0, 'Leere VERSION_POSTGRES muss abgelehnt werden');
    assert.match(rEmpty.stderr, /O-248/);

    // 17.6.1.136 -> ok (mit SKIP_ONPREM_GATE=1 wird nach dem O-248-Tor sauber beendet)
    const r17 = runGate('VERSION_POSTGRES=17.6.1.136\n', { SKIP_ONPREM_GATE: '1' });
    assert.equal(r17.status, 0, `VERSION_POSTGRES=17.6.1.136 muss das O-248-Tor passieren: ${r17.stderr}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Timer-Zeitzone: install.sh setzt Europe/Berlin fuer Update- und Backup-Timer', () => {
  assert.match(installSh, /^OnCalendar=\*-\*-\* 02:00:00 Europe\/Berlin$/m);
  assert.match(installSh, /^OnCalendar=\*-\*-\* 01:00:00 Europe\/Berlin$/m);
});
