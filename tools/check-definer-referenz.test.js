// guvenlik S-04b (KHS K1.7, 02.10.2026): prüft die GEMESSENE Rechtelage aus
// db/SECURITY-DEFINER-EXECUTE.json gegen die begründeten Ausnahmen. Das S-04-Tor
// (check-security-definer-grants.mjs) liest nur Migrationstext und hat drei
// bekannte Blindstellen — diese Prüfung sieht das Ergebnis in der Datenbank.
// Neu messen bei jedem „schema güncelle" (Abfrage steht in der JSON-Datei).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AUSNAHMEN } from './check-security-definer-grants.mjs';

const ref = JSON.parse(readFileSync(new URL('../db/SECURITY-DEFINER-EXECUTE.json', import.meta.url), 'utf8'));

// Werden in RLS-Policies aufgerufen und laufen dort als anon/authenticated —
// ohne EXECUTE würde jede Policy, die sie nutzt, mit 42501 scheitern.
const RLS_HELFER = new Map([
  ['auth_tenant_id', 'Mandanten-Auflösung COALESCE(owner_id, id) in den Team-Policies; liefert nur den eigenen Mandanten.'],
  ['is_admin', 'Admin-Prüfung in Policies; liefert nur ein Boolean für den Aufrufer selbst.'],
]);
// Gehören zu einer Extension, nicht zu uns (PostGIS).
const EXTENSION = new Map([
  ['st_estimatedextent', 'PostGIS; liest nur Tabellenstatistik.'],
]);

test('Referenz ist frisch genug aufgebaut', () => {
  assert.ok(Array.isArray(ref.funktionen) && ref.funktionen.length > 0);
  assert.match(ref.gemessen_am, /^\d{4}-\d{2}-\d{2}$/);
});

test('jede für anon/authenticated ausführbare DEFINER-Funktion ist begründet', () => {
  const ausnahmen = new Set(AUSNAHMEN.map((a) => a.name));
  const unbegruendet = ref.funktionen
    .map((f) => f.name)
    .filter((n) => !ausnahmen.has(n) && !RLS_HELFER.has(n) && !EXTENSION.has(n));
  assert.deepEqual(unbegruendet, [], 'Unbegründete EXECUTE-Rechte: ' + unbegruendet.join(', '));
});
