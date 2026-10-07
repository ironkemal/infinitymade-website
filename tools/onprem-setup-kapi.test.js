// K2b.7a (07.10.2026) — Einrichtungs-Tor, Jeton-Ablauf, Jeton-Hygiene, Caddy-Sperrliste.
// Bedingungen: guvenlik S-50 (1, 2), onprem O-161 K2b.7 (1–6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const lies = (...p) => fs.readFileSync(path.join(repoRoot, ...p), 'utf8');

const { setupKapisi, jetonAbgelaufen, JETON_GUELTIG_TAGE } = await import(
  pathToFileURL(path.join(repoRoot, 'api-backend', 'setup', 'kapi.js')).href
);

function fakeRes() {
  return {
    code: 200, body: null,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
async function durchKapi(kapi, method, pfad) {
  const res = fakeRes();
  let weiter = false;
  await kapi({ method, path: pfad }, res, () => { weiter = true; });
  return { res, weiter };
}

// ── Ablauf ───────────────────────────────────────────────────────────────────

test('jetonAbgelaufen: 14 Tage, leer/ungültig = kein Ablauf (alte Box)', () => {
  assert.equal(JETON_GUELTIG_TAGE, 14);
  const jetzt = Date.UTC(2026, 9, 7);
  const sek = (tage) => String(Math.floor((jetzt - tage * 86400_000) / 1000));
  assert.equal(jetonAbgelaufen(sek(13), jetzt), false);
  assert.equal(jetonAbgelaufen(sek(15), jetzt), true);
  for (const v of [undefined, null, '', '  ', 'abc', '0', '-5']) {
    assert.equal(jetonAbgelaufen(v, jetzt), false, `Wert ${JSON.stringify(v)}`);
  }
});

// ── Tor ──────────────────────────────────────────────────────────────────────

test('setupKapisi: nach Abschluss 410 für alles außer GET /status', async () => {
  const kapi = setupKapisi({ istAbgeschlossen: async () => true, seit: () => '' });
  assert.equal((await durchKapi(kapi, 'GET', '/status')).weiter, true);
  for (const [m, p] of [['POST', '/verify'], ['POST', '/test-smtp'], ['POST', '/status'], ['GET', '/irgendwas']]) {
    const { res, weiter } = await durchKapi(kapi, m, p);
    assert.equal(weiter, false, `${m} ${p}`);
    assert.equal(res.code, 410, `${m} ${p}`);
  }
});

test('setupKapisi: abgelaufen → 410 mit abgelaufen:true; frisch → weiter', async () => {
  const jetzt = Date.now();
  const alt = String(Math.floor(jetzt / 1000) - 15 * 86400);
  const frisch = String(Math.floor(jetzt / 1000) - 3600);
  const ab = await durchKapi(setupKapisi({ istAbgeschlossen: async () => false, seit: () => alt }), 'POST', '/verify');
  assert.equal(ab.res.code, 410);
  assert.equal(ab.res.body.abgelaufen, true);
  assert.match(ab.res.body.hinweis, /install\.sh --neuer-jeton/);
  const ok = await durchKapi(setupKapisi({ istAbgeschlossen: async () => false, seit: () => frisch }), 'POST', '/owner');
  assert.equal(ok.weiter, true);
  // /status bleibt auch abgelaufen erreichbar — setup.js liest dort abgelaufen:true
  const st = await durchKapi(setupKapisi({ istAbgeschlossen: async () => false, seit: () => alt }), 'GET', '/status');
  assert.equal(st.weiter, true);
});

test('setupKapisi: DB-Fehler (throw) ist NICHT "abgeschlossen" — Route bleibt erreichbar', async () => {
  const kapi = setupKapisi({ istAbgeschlossen: async () => { throw new Error('db weg'); }, seit: () => '' });
  assert.equal((await durchKapi(kapi, 'POST', '/verify')).weiter, true);
});

test('router.js: Tor ist die ERSTE Schicht, jede Route (auch künftige) liegt dahinter und ist nach Abschluss 410', async () => {
  process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test';
  const { default: router } = await import(
    pathToFileURL(path.join(repoRoot, 'api-backend', 'setup', 'router.js')).href
  );
  const stack = router.stack;
  assert.ok(!stack[0].route, 'erste Schicht darf keine Route sein');
  assert.equal(stack[0].name, 'setupKapi', 'erste Schicht muss das Tor sein');
  const routen = stack.filter((l) => l.route);
  assert.ok(routen.length >= 6, `erwartet ≥6 Routen, gefunden ${routen.length}`);

  const kapi = setupKapisi({ istAbgeschlossen: async () => true, seit: () => '' });
  for (const l of routen) {
    for (const m of Object.keys(l.route.methods)) {
      const methode = m.toUpperCase();
      const { res, weiter } = await durchKapi(kapi, methode, l.route.path);
      if (methode === 'GET' && l.route.path === '/status') {
        assert.equal(weiter, true);
      } else {
        assert.equal(res.code, 410, `${methode} ${l.route.path} muss nach Abschluss 410 sein`);
      }
    }
  }
});

// ── setup.js ─────────────────────────────────────────────────────────────────

test('setup.js: 404 bei /setup/status zeigt "bereits eingerichtet", abgelaufen eigener Text', () => {
  const s = lies('setup.js');
  assert.match(s, /res\.status === 404\) \{ zeigeGeschlossen\(false\)/);
  assert.match(s, /data\.abgelaufen\) zeigeGeschlossen\(true\)/);
  assert.equal((s.match(/zeigeGeschlossen\(!!data\.abgelaufen\)/g) || []).length, 3, 'verify/owner/branding');
  assert.match(s, /abgelaufenSub: .*install\.sh --neuer-jeton/);
});

// ── Caddy ────────────────────────────────────────────────────────────────────

test('Caddyfile: /auth/v1/admin*, signup*, invite* → 404, vor dem Kong-Handle', () => {
  const c = lies('onprem', 'Caddyfile').split(/\r?\n/).filter((z) => !/^\s*#/.test(z)).join('\n');
  const m = c.match(/@authgesperrt path ([^\n]+)/);
  assert.ok(m, 'Matcher @authgesperrt fehlt');
  for (const p of ['/auth/v1/admin*', '/auth/v1/signup*', '/auth/v1/invite*']) {
    assert.ok(m[1].split(/\s+/).includes(p), `${p} fehlt`);
  }
  assert.ok(!/recover|verify|token/.test(m[1]), 'recover/verify/token dürfen nicht gesperrt sein');
  assert.match(c, /handle @authgesperrt \{\s*respond 404\s*\}/);
  assert.ok(c.indexOf('handle @authgesperrt') < c.indexOf('handle @supabase'), 'Sperre muss vor @supabase stehen');
});

test('Browser-Code ruft keine gesperrten Auth-Pfade auf (Caddy-Sperre bricht nichts)', () => {
  const dateien = [
    ...fs.readdirSync(repoRoot).filter((f) => /\.(js|html)$/.test(f)),
    ...fs.readdirSync(path.join(repoRoot, 'module')).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js')).map((f) => `module/${f}`),
  ];
  const verboten = /auth\.signUp\(|auth\.admin\.|\/auth\/v1\/(admin|signup|invite)|inviteUserByEmail/;
  const treffer = dateien.filter((f) => verboten.test(lies(f)));
  assert.deepEqual(treffer, []);
});

// ── Bash: Verdrahtung ────────────────────────────────────────────────────────

test('install.sh: SETUP_TOKEN_SEIT direkt nach SETUP_TOKEN; --neuer-jeton vor Log-Leeren und vor ".env existiert bereits"', () => {
  const s = lies('onprem', 'install.sh');
  assert.match(s, /set_env SETUP_TOKEN "\$SETUP_TOKEN"\nset_env SETUP_TOKEN_SEIT "\$\(date \+%s\)"/);
  assert.match(s, /source "\$SCRIPT_DIR\/lib-setup-jeton\.sh"/);
  const iNeuer = s.indexOf('setup_jeton_neu');
  const iLeeren = s.indexOf(': > "$LOG_FILE"');
  const iEnvFail = s.indexOf('fail ".env existiert bereits"');
  const iAufr = s.indexOf('setup_jeton_aufraeumen');
  assert.ok(iNeuer > 0 && iAufr > 0 && iEnvFail > 0);
  assert.ok(iNeuer < iEnvFail, '--neuer-jeton muss vor dem .env-Abbruch laufen');
  assert.ok(iAufr < iEnvFail, 'Aufräumen muss vor dem .env-Abbruch laufen');
  assert.ok(iLeeren === -1 || s.indexOf('NEUER_JETON') < iLeeren, 'install.log darf im --neuer-jeton-Modus nicht geleert werden');
  assert.match(s, /if \[ "\$NEU" -eq 1 \] && \[ "\$NEUER_JETON" -eq 1 \]; then\n\s+fail /, '--neu + --neuer-jeton muss abgewiesen werden');
});

test('update.sh: Aufräumen vor Schritt 9 (up -d), lib frisch gesourct', () => {
  const s = lies('onprem', 'update.sh');
  const iAufr = s.indexOf('setup_jeton_aufraeumen');
  const iUp = s.indexOf('log "[9/11]');
  assert.ok(iAufr > 0 && iAufr < iUp, 'setup_jeton_aufraeumen muss vor [9/11] stehen');
  assert.ok(s.lastIndexOf('lib-setup-jeton.sh', iAufr) > s.indexOf('# ── Schritt 7 — Yeni dosyaları yaz'));
});

test('compose / Vorlage / Manifest kennen SETUP_TOKEN_SEIT bzw. die lib', () => {
  assert.match(lies('onprem', 'docker-compose.yml'), /SETUP_TOKEN_SEIT: \$\{SETUP_TOKEN_SEIT:-\}/);
  assert.match(lies('onprem', '.env.template'), /^SETUP_TOKEN_SEIT=$/m);
  assert.match(lies('tools', 'onprem-manifest.mjs'), /'lib-setup-jeton\.sh'/);
  assert.match(lies('onprem', 'manifest.json'), /"lib-setup-jeton\.sh"/);
});

test('praxura-installieren.ps1: -NeuerJeton ruft install.sh --neuer-jeton und öffnet den Link', () => {
  const s = lies('onprem', 'windows', 'praxura-installieren.ps1');
  assert.match(s, /\[switch\]\$NeuerJeton/);
  assert.match(s, /install\.sh" --neuer-jeton/);
});

// ── Bash: Verhalten (docker als Shell-Funktion vorgetäuscht) ─────────────────

const libPosix = path.join(repoRoot, 'onprem', 'lib-setup-jeton.sh').replace(/\\/g, '/');

function laufe(t, dockerAusgabe, envInhalt) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-jeton-'));
  const envPfad = path.join(dir, '.env');
  fs.writeFileSync(envPfad, envInhalt);
  const docker = dockerAusgabe === null
    ? 'docker() { return 1; }'
    : `docker() { printf '%s\\n' '${dockerAusgabe}'; }`;
  const cmd = `set -euo pipefail; ${docker}; ENV_FILE="${envPfad.replace(/\\/g, '/')}"; source "${libPosix}"; setup_jeton_aufraeumen`;
  const res = spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });
  if (res.error && res.error.code === 'ENOENT') { t.skip('bash nicht gefunden'); return null; }
  const env = fs.readFileSync(envPfad, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  return { res, env };
}

const ENV = 'POSTGRES_DB=postgres\nSETUP_TOKEN=abc123\nSETUP_TOKEN_SEIT=1700000000\nANDERES=x\n';

test('Verhalten: abgeschlossen=ja → beide Zeilen geleert, Rest unverändert', (t) => {
  const r = laufe(t, 'ja', ENV); if (!r) return;
  assert.equal(r.res.status, 0, r.res.stderr);
  assert.equal(r.res.stdout.trim(), 'geleert');
  assert.match(r.env, /^SETUP_TOKEN=$/m);
  assert.match(r.env, /^SETUP_TOKEN_SEIT=$/m);
  assert.match(r.env, /^ANDERES=x$/m);
});

test('Verhalten: nein → nichts geändert', (t) => {
  const r = laufe(t, 'nein', ENV); if (!r) return;
  assert.equal(r.res.stdout.trim(), 'offen');
  assert.equal(r.env, ENV);
});

test('Verhalten: DB nicht lesbar / Müll → Jeton bleibt (unbekannt)', (t) => {
  for (const aus of [null, '', 'ERROR: relation does not exist']) {
    const r = laufe(t, aus, ENV); if (!r) return;
    assert.equal(r.res.status, 0, r.res.stderr);
    assert.equal(r.res.stdout.trim(), 'unbekannt', `Ausgabe ${JSON.stringify(aus)}`);
    assert.equal(r.env, ENV);
  }
});

test('Verhalten: Jeton schon leer → leer, docker wird nicht gefragt', (t) => {
  const r = laufe(t, null, 'SETUP_TOKEN=\nSETUP_TOKEN_SEIT=\n'); if (!r) return;
  assert.equal(r.res.stdout.trim(), 'leer');
});

test('Verhalten: setup_jeton_neu schreibt 48-Hex-Jeton + SEIT, gibt den Jeton aus', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'praxura-jeton-neu-'));
  const envPfad = path.join(dir, '.env');
  fs.writeFileSync(envPfad, 'POSTGRES_DB=postgres\nSETUP_TOKEN=\nSETUP_TOKEN_SEIT=\n');
  const cmd = `set -euo pipefail; ENV_FILE="${envPfad.replace(/\\/g, '/')}"; source "${libPosix}"; setup_jeton_neu`;
  const res = spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });
  if (res.error && res.error.code === 'ENOENT') { t.skip('bash nicht gefunden'); return; }
  try {
    assert.equal(res.status, 0, res.stderr);
    const jeton = res.stdout.trim();
    assert.match(jeton, /^[0-9a-f]{48}$/);
    const env = fs.readFileSync(envPfad, 'utf8');
    assert.match(env, new RegExp(`^SETUP_TOKEN=${jeton}$`, 'm'));
    const seit = Number(env.match(/^SETUP_TOKEN_SEIT=(\d+)$/m)?.[1]);
    assert.ok(Math.abs(seit - Date.now() / 1000) < 120, 'SEIT muss jetzt sein');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── K2b.7b: GoTrue-Bremse, Schlüssel von Caddy ───────────────────────────────

test('K2b.7b: auth hat GOTRUE_RATE_LIMIT_HEADER + TOKEN_REFRESH fest in compose (nicht .env)', () => {
  const c = lies('onprem', 'docker-compose.yml');
  assert.match(c, /^\s+GOTRUE_RATE_LIMIT_HEADER: X-Praxura-Client-IP$/m);
  assert.match(c, /^\s+GOTRUE_RATE_LIMIT_TOKEN_REFRESH: "30"$/m);
  assert.doesNotMatch(lies('onprem', '.env.template'), /GOTRUE_RATE_LIMIT/);
});

test('K2b.7b: Caddy setzt X-Praxura-Client-IP aus {remote_host} im Kong-Proxy (überschreibt Client-Wert)', () => {
  const c = lies('onprem', 'Caddyfile').split(/\r?\n/).filter((z) => !/^\s*#/.test(z)).join('\n');
  const block = c.slice(c.indexOf('handle @supabase'), c.indexOf('@root'));
  assert.match(block, /reverse_proxy kong:8000 \{\s*header_up X-Praxura-Client-IP \{remote_host\}\s*\}/);
  assert.doesNotMatch(block, /X-Forwarded-For/, 'Schlüssel nicht aus fälschbarem XFF');
});

// ── K2b.18 b/c: Architektur-Abbruch, SSH-Passwort-Warnung ────────────────────

test('install.sh: x86_64-Prüfung im Hardware-Schritt, VOR Software/Docker; SSH-Passwort nur Warnung', () => {
  const s = lies('onprem', 'install.sh');
  const iArch = s.indexOf('[ "$ARCH" = "x86_64" ] || fail');
  assert.ok(iArch > s.indexOf('log "[1/17]') && iArch < s.indexOf('log "[2/17]'), 'Arch-Prüfung muss in Schritt 1 stehen');
  const ssh = s.slice(s.indexOf('if command -v sshd'), s.indexOf('log "[2/17]'));
  assert.match(ssh, /sshd -T 2>\/dev\/null \| grep -qi '\^passwordauthentication yes'/);
  assert.match(ssh, /warn "SSH erlaubt/);
  assert.doesNotMatch(ssh, /\bfail\b|sed -i|sshd_config/, 'nur warnen, nichts ändern (K10)');
});

test('praxura-installieren.ps1: bricht auf ARM vor jeder Installation ab (O-174)', () => {
  const s = lies('onprem', 'windows', 'praxura-installieren.ps1');
  const iArch = s.indexOf("if ($arch -ne 'AMD64')");
  assert.ok(iArch > 0 && iArch < s.indexOf('[2/11]'), 'Architektur-Prüfung in Schritt 1');
  assert.match(s, /PROCESSOR_ARCHITEW6432/);
});
