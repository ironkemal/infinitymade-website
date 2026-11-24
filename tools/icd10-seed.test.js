// ICD-10-GM Jahreswechsel (Z-08 / W-A02): Rohdatei → icd10_titles-Seed.
//   node --test tools/icd10-seed.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseKodes, literal, buildInserts, buildMigration, extractInserts } from './icd10-seed.mjs';

const ROH_2026 = 'wissensbank/gemeinsam/icd-10-gm/Klassifikationsdateien/icd10gm2026syst_kodes.txt';
const SEED_2026 = 'api-backend/db/migrations/0013_seed_icd10_titles.sql';

test('2026-Rohdatei ergibt byte-gleich die INSERT-Blöcke von 0013 (aus der Live-Tabelle)', () => {
  const rows = parseKodes(readFileSync(ROH_2026, 'utf8'));
  assert.equal(rows.length, 16905);
  assert.equal(buildInserts(rows), extractInserts(readFileSync(SEED_2026, 'utf8')));
});

test('Feldzuordnung: F6/F9/F4/F1/F2/F8/F5', () => {
  const [r] = parseKodes('4;T;X;01;A00;A00.0;A00.0;A000;Cholera durch Vibrio;Cholera;x;;P;P\n');
  assert.deepEqual(r, {
    code: 'A00.0', titel: 'Cholera durch Vibrio', kapitel: 1, ebene: 4,
    terminal: true, code_plain: 'A000', gruppe: 'A00',
  });
});

test('literal: wie format(%L) — Apostroph verdoppelt, Bool t/f, Zahl in Anführung', () => {
  assert.equal(literal("Crohn'sche"), "'Crohn''sche'");
  assert.equal(literal(false), "'f'");
  assert.equal(literal(3), "'3'");
  assert.throws(() => literal('a\\b'), /Backslash/);
});

test('Rohdatei-Fehler brechen ab statt still falsche Zeilen zu liefern', () => {
  assert.throws(() => parseKodes('4;X;X;01;A00;A00.0;A00.0;A000;T;T;;\n'), /weder T noch N/);
  assert.throws(() => parseKodes('4;T;X;01;A00;A00.0;A00.0;A000;T;T;;\n4;T;X;01;A00;A00.0;A00.0;A000;T;T;;\n'), /doppelt/);
  assert.throws(() => parseKodes('4;T;X\n'), /Felder/);
});

test('Migration: kein DELETE, Zeilenzahl-Tor, Jahr im Kopf', () => {
  const sql = buildMigration(parseKodes('3;N;X;01;A00;A00.-;A00;A00;Cholera;Cholera;;\n'), '2027');
  assert.ok(!/\bDELETE\b/i.test(sql.replace(/^--.*$/gm, '')));
  assert.match(sql, /IF n < 1 THEN RAISE EXCEPTION/);
  assert.match(sql, /ICD-10-GM 2027/);
});
