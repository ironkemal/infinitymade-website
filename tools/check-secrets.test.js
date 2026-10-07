import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MUSTER,
  pruefeText,
  ladeAllowlist,
  sollDateiUebersprungenWerden,
  istBinaer,
} from './check-secrets.mjs';

test('1. JWT-Muster wird erkannt', () => {
  const jwt =
    'ey' + 'JhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'ey' + 'JzdWIiOiIxMjM0NTY3ODkwIn0.' +
    'd' + 'GFnMTIzNDU2Nzg5MDEyMzQ1';
  const funde = pruefeText('const token = "' + jwt + '";', 'src/auth.js');
  assert.equal(funde.length, 1);
  assert.equal(funde[0].muster, 'JWT');
  assert.equal(funde[0].zeile, 1);
});

test('2. Stripe Secret Key (sk_live und rk_test) wird erkannt', () => {
  const skLive = 's' + 'k_' + 'live_' + '1234567890123456';
  const rkTest = 'r' + 'k_' + 'test_' + 'abcdefghijklmnop';

  const funde1 = pruefeText('const key = "' + skLive + '";', 'src/billing.js');
  assert.equal(funde1.length, 1);
  assert.equal(funde1[0].muster, 'Stripe geheim');

  const funde2 = pruefeText('const key = "' + rkTest + '";', 'src/billing.js');
  assert.equal(funde2.length, 1);
  assert.equal(funde2[0].muster, 'Stripe geheim');
});

test('3. Stripe Webhook Secret (whsec_) wird erkannt', () => {
  const whsec = 'w' + 'hsec_' + '1234567890123456';
  const funde = pruefeText('const endpointSecret = "' + whsec + '";', 'src/webhook.js');
  assert.equal(funde.length, 1);
  assert.equal(funde[0].muster, 'Stripe Webhook');
});

test('4. GitHub Tokens (ghp_ und github_pat_) werden erkannt', () => {
  const ghp = 'g' + 'hp_' + '123456789012345678901234567890';
  const ghpat = 'g' + 'ithub_pat_' + '123456789012345678901234567890';

  const funde1 = pruefeText('const ghToken = "' + ghp + '";', 'src/vcs.js');
  assert.equal(funde1.length, 1);
  assert.equal(funde1[0].muster, 'GitHub');

  const funde2 = pruefeText('const pat = "' + ghpat + '";', 'src/vcs.js');
  assert.equal(funde2.length, 1);
  assert.equal(funde2[0].muster, 'GitHub');
});

test('5. AWS Access Key ID (AKIA...) wird erkannt', () => {
  const aws = 'A' + 'KIA' + '1234567890ABCDEF';
  const funde = pruefeText('const awsKey = "' + aws + '";', 'src/s3.js');
  assert.equal(funde.length, 1);
  assert.equal(funde[0].muster, 'AWS');
});

test('6. Google API Key (AIza...) wird erkannt', () => {
  const google = 'A' + 'Iza' + '12345678901234567890123456789012345';
  const funde = pruefeText('const gKey = "' + google + '";', 'src/maps.js');
  assert.equal(funde.length, 1);
  assert.equal(funde[0].muster, 'Google API');
});

test('7. Slack Token (xoxb-...) wird erkannt', () => {
  const slack = 'x' + 'oxb-' + '123456789012';
  const funde = pruefeText('const bot = "' + slack + '";', 'src/slack.js');
  assert.equal(funde.length, 1);
  assert.equal(funde[0].muster, 'Slack');
});

test('8. OpenAI und Anthropic Keys (sk-proj-, sk-ant-, sk-) werden erkannt', () => {
  const skProj = 's' + 'k-proj-' + '12345678901234567890123456789012';
  const skAnt = 's' + 'k-ant-' + '12345678901234567890123456789012';
  const skLegacy = 's' + 'k-' + '12345678901234567890123456789012';

  const funde1 = pruefeText('const openAi = "' + skProj + '";', 'src/ai.js');
  assert.equal(funde1.length, 1);
  assert.equal(funde1[0].muster, 'OpenAI/Anthropic');

  const funde2 = pruefeText('const claude = "' + skAnt + '";', 'src/ai.js');
  assert.equal(funde2.length, 1);
  assert.equal(funde2[0].muster, 'OpenAI/Anthropic');

  const funde3 = pruefeText('const legacy = "' + skLegacy + '";', 'src/ai.js');
  assert.equal(funde3.length, 1);
  assert.equal(funde3[0].muster, 'OpenAI/Anthropic');
});

test('9. Privater kryptografischer Schlüssel wird erkannt', () => {
  const keyHeader = '---' + '--BEGIN ' + 'RSA PRIVATE ' + 'KEY-----';
  const funde = pruefeText(keyHeader + '\nMIIEowIBAAKCAQEA...', 'src/cert.pem');
  assert.equal(funde.length, 1);
  assert.equal(funde[0].muster, 'Privater Schlüssel');
});

test('10. Azure / allgemeine Schlüssel-Zuweisung wird erkannt', () => {
  const longSecret = '123456789012345678901234';
  const zeile1 = 'a' + 'pi_key' + ' = "' + longSecret + '";';
  const zeile2 = 'p' + 'assword' + ': \'' + longSecret + '\'';
  const zeile3 = 'p' + 'asswort' + ' := "' + longSecret + '"';

  const funde1 = pruefeText(zeile1, 'src/config.js');
  assert.equal(funde1.length, 1);
  assert.equal(funde1[0].muster, 'Azure/allgemein Schlüssel-Zuweisung');

  const funde2 = pruefeText(zeile2, 'src/config.js');
  assert.equal(funde2.length, 1);
  assert.equal(funde2[0].muster, 'Azure/allgemein Schlüssel-Zuweisung');

  const funde3 = pruefeText(zeile3, 'src/config.js');
  assert.equal(funde3.length, 1);
  assert.equal(funde3[0].muster, 'Azure/allgemein Schlüssel-Zuweisung');
});

test('11. Verbindungs-URLs mit Passwort werden erkannt', () => {
  const postgres = 'p' + 'ostgresql://praxura_admin:' + 'strenggeheim123' + '@localhost:5432/praxura';
  const mysql = 'm' + 'ysql://root:' + 'passwort123' + '@db.praxura.de/production';
  const mongodb = 'm' + 'ongodb+srv://clusteruser:' + 'geheim123' + '@cluster0.example.com/db';
  const redis = 'r' + 'edis://default:' + 'redispw123' + '@127.0.0.1:6379';
  const smtps = 's' + 'mtps://mailer:' + 'smtpgeheim' + '@mail.praxura.de';

  for (const url of [postgres, mysql, mongodb, redis, smtps]) {
    const funde = pruefeText('const dbUrl = "' + url + '";', 'src/db.js');
    assert.equal(funde.length, 1, `URL nicht erkannt: ${url}`);
    assert.equal(funde[0].muster, 'Verbindungs-URL mit Passwort');
  }
});

test('12. Marker secret-scan: ignore in derselben Zeile verhindert Fund', () => {
  const secret = 's' + 'k_' + 'live_' + '1234567890abcdef1234';
  const ignorierteZeile = 'const testKey = "' + secret + '"; // secret-scan: ignore';
  const normaleZeile = 'const testKey = "' + secret + '";';

  const fundeIgnoriert = pruefeText(ignorierteZeile, 'src/test.js');
  assert.equal(fundeIgnoriert.length, 0);

  const fundeNormal = pruefeText(normaleZeile, 'src/test.js');
  assert.equal(fundeNormal.length, 1);
});

test('13. Allowlist-Hash (SHA-256) verhindert Fund', () => {
  const secret = 's' + 'k_' + 'live_' + '1234567890abcdef1234';
  const zeile = 'const key = "' + secret + '";';

  // Ohne Allowlist: Fund
  const fundeVorher = pruefeText(zeile, 'src/api.js', new Set());
  assert.equal(fundeVorher.length, 1);

  // Mit Allowlist (SHA-256 des exakten Treffers): Kein Fund
  const hash = createHash('sha256').update(secret, 'utf8').digest('hex');
  const allowlist = new Set([hash]);
  const fundeNachher = pruefeText(zeile, 'src/api.js', allowlist);
  assert.equal(fundeNachher.length, 0);
});

test('14. Auszug maskiert den Treffer (erste 6 Zeichen + …) und gibt nie den vollen Wert preis', () => {
  const secret = 'A' + 'Iza' + '12345678901234567890123456789012345';
  const zeile = 'const googleKey = "' + secret + '";';

  const funde = pruefeText(zeile, 'src/google.js');
  assert.equal(funde.length, 1);
  const fund = funde[0];

  assert.equal(fund.auszug, secret.slice(0, 6) + '…');
  assert.ok(!fund.auszug.includes(secret));
  assert.ok(fund.auszug.endsWith('…'));
  assert.equal(fund.auszug.length, 7); // 6 Zeichen + 1 Ellipsis-Zeichen
});

test('15. Harmlose Zeilen erzeugen KEINEN Fund', () => {
  const harmloseZeilen = [
    'const token = req.headers.authorization;',
    'const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;',
    'const stripeKey = process.env.STRIPE_SECRET_KEY;',
    'const apiKey = null;',
    'const password = getPasswordFromVault();',
    'const token = bearerHeader ? bearerHeader.split(" ")[1] : null;',
    '// Hier wird der API-Schlüssel beschrieben: api_key oder secret',
    'if (process.env.OPENAI_API_KEY) {',
    '  console.log("OpenAI aktiv");',
    '}',
  ].join('\n');

  const funde = pruefeText(harmloseZeilen, 'api-backend/auth.js');
  assert.deepEqual(funde, []);
});

test('16. Pfad-Filterung überspringt node_modules, vendor, archive, *.min.js, package-lock.json und check-secrets selbst', () => {
  const secret = 's' + 'k_' + 'live_' + '1234567890abcdef1234';
  const uebersprungenePfade = [
    'node_modules/my-pkg/index.js',
    'sub/node_modules/pkg/lib.js',
    'vendor/sentry/bundle.js',
    'tools/vendor/tool.js',
    'archive/old-code/server.js',
    'public/bundle.min.js',
    'package-lock.json',
    'tools/check-secrets.mjs',
    'tools/check-secrets.test.js',
    'tools/check-secrets-v2.mjs',
  ];

  for (const pfad of uebersprungenePfade) {
    assert.equal(
      sollDateiUebersprungenWerden(pfad),
      true,
      `Pfad sollte übersprungen werden: ${pfad}`
    );
    const funde = pruefeText(secret, pfad);
    assert.equal(
      funde.length,
      0,
      `Dateipfad sollte von pruefeText ignoriert werden: ${pfad}`
    );
  }

  // Normale Datei wird nicht übersprungen
  assert.equal(sollDateiUebersprungenWerden('src/app.js'), false);
  const fundeApp = pruefeText(secret, 'src/app.js');
  assert.equal(fundeApp.length, 1);
});

test('17. Binärdateien mit Null-Byte in den ersten 8000 Bytes werden übersprungen', () => {
  const secret = 's' + 'k_' + 'live_' + '1234567890abcdef1234';
  const binaerText = 'Header\0Data' + secret;
  assert.equal(istBinaer(binaerText), true);
  assert.equal(pruefeText(binaerText, 'bild.png').length, 0);

  const normalerText = 'Header Data ' + secret;
  assert.equal(istBinaer(normalerText), false);
  assert.equal(pruefeText(normalerText, 'bild.png').length, 1);
});

test('18. MUSTER enthält alle 12 geforderten Mustertypen mit name, re und grund', () => {
  assert.equal(MUSTER.length, 12);
  const erwarteteNamen = [
    'JWT',
    'Stripe geheim',
    'Stripe Webhook',
    'GitHub',
    'AWS',
    'Google API',
    'Slack',
    'OpenAI/Anthropic',
    'Privater Schlüssel',
    'age-Sicherungsschlüssel',
    'Azure/allgemein Schlüssel-Zuweisung',
    'Verbindungs-URL mit Passwort',
  ];

  for (const name of erwarteteNamen) {
    const eintrag = MUSTER.find((m) => m.name === name);
    assert.ok(eintrag, `Muster fehlt: ${name}`);
    assert.ok(eintrag.re instanceof RegExp, `Regex fehlt bei: ${name}`);
    assert.ok(typeof eintrag.grund === 'string' && eintrag.grund.length > 5, `Grund fehlt bei: ${name}`);
  }
});

test('19. ladeAllowlist liest Hashes und ignoriert Kommentare und Leerzeilen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'allowlist-test-'));
  const testDatei = join(dir, '.secret-allowlist');
  const hash1 = 'a'.repeat(64);
  const hash2 = 'B'.repeat(64);

  const inhalt = [
    '# Dies ist ein Kommentar',
    '',
    `${hash1} # Hash 1 mit Kommentar`,
    '   ',
    hash2, // Grossbuchstaben sollen normalisiert werden
  ].join('\n');

  writeFileSync(testDatei, inhalt, 'utf8');

  try {
    const allowlist = ladeAllowlist(testDatei);
    assert.equal(allowlist.size, 2);
    assert.ok(allowlist.has(hash1.toLowerCase()));
    assert.ok(allowlist.has(hash2.toLowerCase()));
  } finally {
    unlinkSync(testDatei);
  }
});

test('20. Verbindungs-URL mit Variable oder Platzhalter ist kein Fund', () => {
  const s = new Set();
  assert.equal(pruefeText('URL=postgres' + 'ql://u:${DB_PASSWORD}@h:5432/x', 'a.yml', s).length, 0);
  assert.equal(pruefeText('# postgres' + '://user:PASSWORT@host', 'a.sh', s).length, 0);
  assert.equal(pruefeText('URL=postgres' + '://u:geheim' + 'Wort99@h/x', 'a.yml', s).length, 1);
});

test('age-Sicherungsschlüssel wird erkannt, öffentlicher age1-Schlüssel nicht (O-173)', async () => {
  const { MUSTER } = await import('./check-secrets.mjs');
  const m = MUSTER.find((x) => x.name === 'age-Sicherungsschlüssel');
  assert.ok(m);
  assert.ok(m.re.test('AGE-SECRET-KEY-1' + 'Q'.repeat(58)));
  assert.ok(!m.re.test('age1' + 'q'.repeat(58)));
  assert.ok(!m.re.test('AGE-SECRET-KEY-1…'), 'Platzhalter in Doku ist kein Treffer');
});
