// Tests für den Migrations-Runner.
//
// Geprüft wird die Logik, die OHNE Postgres läuft: Dateien lesen, Reihenfolge,
// Prüfsummen, Plan. Genau dort sitzen die Fehler, die still bleiben — ein
// Verbindungsfehler schreit von selbst, eine übersprungene Datei nicht.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrationenLesen, pruefeVersionen, planErstellen, runMigrations, runMigrationsMitGeduld, istStartrennen } from './migrate.js';

/** @param {Record<string, string>} dateien */
function verzeichnisMit(dateien) {
  const dir = mkdtempSync(join(tmpdir(), 'praxura-migrate-'));
  for (const [name, inhalt] of Object.entries(dateien)) {
    writeFileSync(join(dir, name), inhalt, 'utf8');
  }
  return dir;
}

test('migrationenLesen: sortiert nach Version, nicht nach Lesereihenfolge', () => {
  const dir = verzeichnisMit({
    '0010_zehn.sql': 'select 10;',
    '0002_zwei.sql': 'select 2;',
    '0001_eins.sql': 'select 1;'
  });
  try {
    const d = migrationenLesen(dir);
    assert.deepEqual(d.map(x => x.version), ['0001', '0002', '0010']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('migrationenLesen: Nicht-SQL wird ignoriert, README stört nicht', () => {
  const dir = verzeichnisMit({
    '0001_eins.sql': 'select 1;',
    'README.md': '# Protokoll'
  });
  try {
    assert.equal(migrationenLesen(dir).length, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('migrationenLesen: falsch benannte .sql-Datei wirft — niemals still überspringen', () => {
  const dir = verzeichnisMit({ 'zuzahlung-fix.sql': 'select 1;' });
  try {
    assert.throws(() => migrationenLesen(dir), /unerwartetem Namen/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('migrationenLesen: fehlendes Verzeichnis ist leer, kein Absturz', () => {
  assert.deepEqual(migrationenLesen(join(tmpdir(), 'gibt-es-nicht-praxura-xyz')), []);
});

test('migrationenLesen: Prüfsumme hängt am Inhalt, nicht am Namen', () => {
  const a = verzeichnisMit({ '0001_a.sql': 'select 1;' });
  const b = verzeichnisMit({ '0001_b.sql': 'select 1;' });
  const c = verzeichnisMit({ '0001_a.sql': 'select 2;' });
  try {
    assert.equal(migrationenLesen(a)[0].checksum, migrationenLesen(b)[0].checksum);
    assert.notEqual(migrationenLesen(a)[0].checksum, migrationenLesen(c)[0].checksum);
  } finally {
    for (const d of [a, b, c]) rmSync(d, { recursive: true, force: true });
  }
});

test('migrationenLesen: -- no-transaction wird erkannt', () => {
  const dir = verzeichnisMit({
    '0001_normal.sql': 'select 1;',
    '0002_gleichzeitig.sql': '-- no-transaction\nCREATE INDEX CONCURRENTLY i ON t(x);'
  });
  try {
    const d = migrationenLesen(dir);
    assert.equal(d[0].transaktional, true);
    assert.equal(d[1].transaktional, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('migrationenLesen: "no-transaction" im Fliesstext zählt NICHT', () => {
  // Sonst schaltet ein Kommentar wie "hier wäre no-transaction nötig gewesen"
  // die Transaktion ab, ohne dass es jemand merkt.
  const dir = verzeichnisMit({
    '0001_text.sql': '-- frueher lief das hier ohne no-transaction, siehe Notiz\nselect 1;'
  });
  try {
    assert.equal(migrationenLesen(dir)[0].transaktional, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pruefeVersionen: doppelte Nummer wird abgelehnt', () => {
  const doppelt = [
    { version: '0001', name: '0001_a.sql' },
    { version: '0001', name: '0001_b.sql' }
  ];
  assert.equal(pruefeVersionen(doppelt).ok, false);
  assert.match(/** @type {string} */ (pruefeVersionen(doppelt).grund), /doppelt/);
});

test('pruefeVersionen: Lücken sind erlaubt (verworfene Migration)', () => {
  assert.equal(pruefeVersionen([{ version: '0001', name: 'a' }, { version: '0003', name: 'c' }]).ok, true);
});

test('planErstellen: offene Migrationen werden gefunden', () => {
  const dateien = [
    { version: '0000', name: 'b.sql', checksum: 'aa' },
    { version: '0001', name: 'x.sql', checksum: 'bb' }
  ];
  const plan = planErstellen(dateien, [{ version: '0000', name: 'b.sql', checksum: 'aa' }]);
  assert.deepEqual(plan.offen.map(o => o.version), ['0001']);
  assert.equal(plan.veraendert.length, 0);
  assert.equal(plan.unbekannt.length, 0);
});

test('planErstellen: nachträglich geänderte Datei wird erkannt', () => {
  const plan = planErstellen(
    [{ version: '0001', name: 'x.sql', checksum: 'NEU' }],
    [{ version: '0001', name: 'x.sql', checksum: 'ALT' }]
  );
  assert.equal(plan.veraendert.length, 1);
  assert.equal(plan.veraendert[0].erwartet, 'ALT');
});

test('planErstellen: Buch kennt mehr als das Image — Downgrade wird sichtbar', () => {
  const plan = planErstellen(
    [{ version: '0001', name: 'x.sql', checksum: 'a' }],
    [
      { version: '0001', name: 'x.sql', checksum: 'a' },
      { version: '0002', name: 'y.sql', checksum: 'b' }
    ]
  );
  assert.deepEqual(plan.unbekannt, ['0002']);
});

test('planErstellen: alles angewandt -> nichts offen', () => {
  const plan = planErstellen(
    [{ version: '0001', name: 'x.sql', checksum: 'a' }],
    [{ version: '0001', name: 'x.sql', checksum: 'a' }]
  );
  assert.equal(plan.offen.length, 0);
});

test('runMigrations: ohne DATABASE_URL wird übersprungen, nicht geworfen', async () => {
  // Das ist der heutige SaaS-Pfad: solange die Variable dort nicht gesetzt ist,
  // ändert sich nichts. Diese Zusage wird hier festgenagelt.
  const r = await runMigrations({ databaseUrl: '', verzeichnis: '/egal', log: () => {} });
  assert.equal(r.status, 'uebersprungen');
  assert.deepEqual(r.angewandt, []);
});

test('runMigrations: doppelte Version stoppt VOR jedem DB-Zugriff', async () => {
  // databaseUrl ist absichtlich Unsinn: käme es zum Verbindungsversuch, wäre der
  // Fehler 'verbindung'. Erwartet wird 'reihenfolge' — der Plan schlägt vorher zu.
  const dir = verzeichnisMit({ '0001_a.sql': 'select 1;', '0001_b.sql': 'select 2;' });
  try {
    const r = await runMigrations({
      databaseUrl: 'postgres://nirgendwo:1/x',
      verzeichnis: dir,
      log: () => {}
    });
    assert.equal(r.status, 'fehler');
    assert.equal((/** @type {any} */ (r.fehler)).art, 'reihenfolge');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('runMigrations: leeres Verzeichnis ist ok, kein Fehler', async () => {
  const dir = verzeichnisMit({});
  try {
    const r = await runMigrations({ databaseUrl: 'postgres://x/y', verzeichnis: dir, log: () => {} });
    assert.equal(r.status, 'ok');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── O-194: Startrennen nach Host-Neustart ───────────────────────────────────
/**
 * @param {string | null} code
 * @param {any[]} [angewandt]
 */
const verbindung = (code, angewandt = []) => ({ status: 'fehler', angewandt, fehler: { art: 'verbindung', code, text: 'x' } });

test('istStartrennen: nur Netz-/Startcodes ohne gelaufene Migration', () => {
  assert.equal(istStartrennen(verbindung('ECONNREFUSED')), true);
  assert.equal(istStartrennen(verbindung('57P03')), true);
  assert.equal(istStartrennen(verbindung('28P01')), false); // falsches Passwort heilt nicht durch Warten
  assert.equal(istStartrennen(verbindung(null)), false);
  assert.equal(istStartrennen(verbindung('ECONNRESET', [{ version: '0001' }])), false);
  assert.equal(istStartrennen({ status: 'fehler', angewandt: [], fehler: { art: 'pruefsumme' } }), false);
  assert.equal(istStartrennen({ status: 'ok', angewandt: [] }), false);
  assert.equal(istStartrennen({ status: 'uebersprungen', angewandt: [] }), false);
});

test('MitGeduld: DB kommt beim dritten Versuch → ok, zwei Pausen', async () => {
  const antworten = [verbindung('ECONNREFUSED'), verbindung('57P03'), { status: 'ok', angewandt: [] }];
  /** @type {number[]} */
  const pausen = [];
  let aufrufe = 0;
  const r = await runMigrationsMitGeduld({ log: () => {} }, {
    pausenMs: [10, 20, 30], lauf: async () => antworten[aufrufe++], warte: async (ms) => { pausen.push(ms); },
  });
  assert.equal(r.status, 'ok');
  assert.equal(aufrufe, 3);
  assert.deepEqual(pausen, [10, 20]);
});

test('MitGeduld: DB bleibt weg → nach allen Versuchen der Fehler, kein Wurf', async () => {
  let aufrufe = 0;
  const r = await runMigrationsMitGeduld({ log: () => {} }, {
    pausenMs: [1, 1], lauf: async () => { aufrufe++; return verbindung('ECONNREFUSED'); }, warte: async () => {},
  });
  assert.equal((/** @type {any} */ (r.fehler)).art, 'verbindung');
  assert.equal(aufrufe, 3);
});

test('MitGeduld: echter Fehler und SaaS-Pfad werden NICHT wiederholt', async () => {
  for (const erst of [
    { status: 'fehler', angewandt: [], fehler: { art: 'pruefsumme' } },
    verbindung('28P01'),
    { status: 'uebersprungen', angewandt: [] },
    { status: 'ok', angewandt: [] },
  ]) {
    let aufrufe = 0;
    const r = await runMigrationsMitGeduld({ log: () => {} }, { pausenMs: [1, 1], lauf: async () => { aufrufe++; return erst; }, warte: async () => { throw new Error('darf nicht warten'); } });
    assert.equal(aufrufe, 1);
    assert.equal(r, erst);
  }
});

test('MitGeduld: Pausen bleiben unter der start_period des Box-Healthchecks (120 s)', async () => {
  const { VERBINDUNG_PAUSEN_MS } = await import('./migrate.js');
  const schlimmstenfalls = VERBINDUNG_PAUSEN_MS.reduce((a, b) => a + b, 0) + (VERBINDUNG_PAUSEN_MS.length + 1) * 5000;
  assert.ok(schlimmstenfalls < 120_000, `${schlimmstenfalls} ms`);
});

test('runMigrations: DB verschluckt Pakete → nach ~5 s verbindung/ETIMEDOUT, kein Minuten-Haenger', async () => {
  // 10.255.255.1 ist nicht routbar: SYN ohne Antwort — der O-190-Fall.
  const dir = verzeichnisMit({ '0001_a.sql': 'select 1;' });
  try {
    const start = Date.now();
    const r = await runMigrations({ databaseUrl: 'postgres://u:p@10.255.255.1:5432/x', verzeichnis: dir, log: () => {} });
    assert.equal(r.status, 'fehler');
    assert.equal((/** @type {any} */ (r.fehler)).art, 'verbindung');
    assert.ok(Date.now() - start < 9000, `dauerte ${Date.now() - start} ms`);
    assert.equal(istStartrennen(r), true, `code ${(/** @type {any} */ (r.fehler)).code}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── O-129: SaaS-Statuszeile in allen neuen Migrationen + git-mv-Gate ────────

const HIER = dirname(fileURLToPath(import.meta.url));
const ECHTES_MIG_VERZ = join(HIER, 'migrations');
const REPO_WURZEL = resolve(HIER, '..', '..');
const SAAS_ZEILE_RE = /^-- SaaS: (angewandt|angewendet) \d{2}\.\d{2}\.\d{4}|^-- SaaS: nicht angewandt \(box-only\): .+/m;

// Unveränderbare Altdateien ab 0054 (Runner hält SHA-256 inkl. Kommentare),
// deren Live-Stand am 24.11.2026 zentral in onprem/REGISTER.md unter O-129 belegt wurde.
const O129_ALT_AUSNAHMEN = new Set([
  '0103_raum_details.sql',
  '0104_raum_automatik.sql',
  '0105_mail_signaturen.sql',
  '0124_physio_sitzungen.sql',
  '0125_abwesenheit_zeitraum.sql',
  '0126_messreihen_eingabe.sql',
  '0127_raumbelegung_gruppenraum.sql',
  '0128_sitzungsabschluss_atomar.sql',
  '0129_raum_einzelbelegung.sql',
]);

test('O-129 (CI-Schutz): jede Migration ab 0054 trägt eine gültige -- SaaS:-Zeile im Kopf', () => {
  const alle = migrationenLesen(ECHTES_MIG_VERZ);
  const verletzungen = [];
  for (const m of alle) {
    if (Number(m.version) < 54 || O129_ALT_AUSNAHMEN.has(m.name)) continue;
    const kopf = readFileSync(join(ECHTES_MIG_VERZ, m.name), 'utf8').split('\n').slice(0, 40).join('\n');
    if (!SAAS_ZEILE_RE.test(kopf)) verletzungen.push(m.name);
  }
  assert.deepEqual(
    verletzungen,
    [],
    `Fehlende/ungültige SaaS-Kopfzeile (kein „ausstehend“ erlaubt): ${verletzungen.join(', ')}`
  );
});

test('O-129 (Kapı): check-onprem.sh erkennt per git mv verschobene Entwürfe (--no-renames)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'praxura-o129-gate-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
    const entwurf = '-- SaaS: ausstehend (Freigabe erforderlich).\nSELECT 1;\n';
    execFileSync('mkdir', ['-p', 'db/entwuerfe', 'api-backend/db/migrations', 'tools', 'onprem/volumes/db'], { cwd: dir });
    writeFileSync(join(dir, 'db/entwuerfe/0999_probe.sql'), entwurf, 'utf8');
    writeFileSync(join(dir, 'api-backend/db/erwartete-zaehler.json'), '{"bis_version":"0999"}\n', 'utf8');
    writeFileSync(join(dir, 'tools/.onprem-baseline'), 'vercel_fn=0\n', 'utf8');
    writeFileSync(join(dir, 'onprem/docker-compose.yml'), '# no-pg-net\n', 'utf8');
    writeFileSync(join(dir, 'onprem/volumes/db/no-pg-net.sql'), '-- ok\n', 'utf8');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });

    // Negativprobe: git mv aus db/entwuerfe/ mit „ausstehend“ MUSS abgelehnt werden
    execFileSync('git', ['mv', 'db/entwuerfe/0999_probe.sql', 'api-backend/db/migrations/0999_probe.sql'], { cwd: dir });
    let fehlgeschlagen = false;
    let stderrText = '';
    try {
      execFileSync('sh', [join(REPO_WURZEL, 'tools/check-onprem.sh')], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      fehlgeschlagen = true;
      stderrText = String((/** @type {any} */ (err)).stderr || '');
    }
    assert.equal(fehlgeschlagen, true, 'check-onprem.sh muss git-mv mit ausstehend-Zeile ablehnen');
    assert.match(stderrText, /0999_probe\.sql/);

    // Positivprobe: mit gültiger SaaS-Zeile wird dieselbe verschobene Datei akzeptiert
    writeFileSync(
      join(dir, 'api-backend/db/migrations/0999_probe.sql'),
      '-- SaaS: angewandt 24.11.2026\nSELECT 1;\n',
      'utf8'
    );
    execFileSync('git', ['add', 'api-backend/db/migrations/0999_probe.sql'], { cwd: dir });
    execFileSync('sh', [join(REPO_WURZEL, 'tools/check-onprem.sh')], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
