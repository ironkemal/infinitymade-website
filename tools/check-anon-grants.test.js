import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pruefeDatei, pruefeDateien } from './check-anon-grants.mjs';

const MIG = join(dirname(fileURLToPath(import.meta.url)), '..', 'api-backend', 'db', 'migrations');

test('alle bestehenden Migrationen (ohne 0000) bestehen das Tor', () => {
  const dateien = readdirSync(MIG).filter((f) => /^\d{4}_.*\.sql$/.test(f)).map((f) => join(MIG, f));
  assert.deepEqual(pruefeDateien(dateien, (d) => readFileSync(d, 'utf8')), []);
});

test('(1) GRANT ON ALL TABLES TO anon → Befund', () => {
  const b = pruefeDatei('0099_x.sql', 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;');
  assert.equal(b[0].regel, 'alle_tabellen');
});

test('(2) Tabellenrecht auf profiles ohne Spaltenliste → Befund (auch TABLE und PUBLIC)', () => {
  assert.equal(pruefeDatei('0099_x.sql', 'GRANT SELECT ON public.profiles TO anon;')[0].regel, 'profiles_ohne_spaltenliste');
  assert.equal(pruefeDatei('0099_x.sql', 'grant all on table profiles to PUBLIC;')[0].regel, 'profiles_ohne_spaltenliste');
});

test('(2) Spaltengrant und authenticated-Grant sind erlaubt', () => {
  assert.deepEqual(pruefeDatei('0099_x.sql', 'GRANT SELECT (id, business_name) ON public.profiles TO anon;'), []);
  assert.deepEqual(pruefeDatei('0099_x.sql', 'GRANT SELECT ON public.profiles TO authenticated;'), []);
});

test('(3) Sicht ohne Spaltengrant → Befund; mit Spaltengrant → frei', () => {
  const sicht = 'CREATE OR REPLACE VIEW public.profiles_public WITH (security_invoker = true) AS SELECT id FROM profiles;';
  assert.equal(pruefeDatei('0099_x.sql', sicht)[0].regel, 'sicht_ohne_spaltengrant');
  assert.deepEqual(pruefeDatei('0099_x.sql', sicht + '\nGRANT SELECT (neu) ON public.profiles TO anon;'), []);
});

test('Kommentare und Strings zählen nicht', () => {
  assert.deepEqual(pruefeDatei('0099_x.sql', "-- GRANT SELECT ON profiles TO anon;\nSELECT 'GRANT ALL ON ALL TABLES IN SCHEMA public TO anon';"), []);
});

test('0000_baseline wird übersprungen', () => {
  assert.deepEqual(pruefeDateien(['x/0000_baseline.sql'], () => 'GRANT ALL ON TABLE public.profiles TO anon;'), []);
});
