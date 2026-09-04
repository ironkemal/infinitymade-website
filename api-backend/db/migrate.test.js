// Tests für den Migrations-Runner.
//
// Geprüft wird die Logik, die OHNE Postgres läuft: Dateien lesen, Reihenfolge,
// Prüfsummen, Plan. Genau dort sitzen die Fehler, die still bleiben — ein
// Verbindungsfehler schreit von selbst, eine übersprungene Datei nicht.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { migrationenLesen, pruefeVersionen, planErstellen, runMigrations } from './migrate.js';

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
  assert.match(pruefeVersionen(doppelt).grund, /doppelt/);
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
    assert.equal(r.fehler.art, 'reihenfolge');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('runMigrations: leeres Verzeichnis ist ok, kein Fehler', async () => {
  const dir = verzeichnisMit({});
  try {
    const r = await runMigrations({ databaseUrl: 'postgres://x/y', verzeichnis: dir, log: () => {} });
    assert.equal(r.status, 'ok');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
