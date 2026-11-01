import test from 'node:test';
import assert from 'node:assert/strict';
import { leseTabellen, spaltenAusSelect, pruefeQuelle } from './check-select-spalten.mjs';

const SCHEMA = `
CREATE TABLE public.leads (
  id uuid NOT NULL,
  owner_id uuid NOT NULL,
  geburtsdatum date,
  metadata jsonb
);

CREATE TABLE public."fußstatus" (
  id uuid NOT NULL
);
`;
const tabellen = leseTabellen(SCHEMA);

test('leseTabellen: Spalten und Tabellennamen mit Umlaut', () => {
  assert.ok(tabellen.get('leads').has('geburtsdatum'));
  assert.ok(tabellen.has('fußstatus'));
});

test('spaltenAusSelect: Alias, Cast, JSON-Pfad, Einbettung und Stern', () => {
  assert.deepEqual(spaltenAusSelect('id, name:geburtsdatum, owner_id::text, metadata->>x'),
    ['id', 'geburtsdatum', 'owner_id', 'metadata']);
  assert.deepEqual(spaltenAusSelect('*, arzt:aerzte(name, lanr), id'), ['id']);
  assert.deepEqual(spaltenAusSelect('id, a(b, c(d))'), ['id']);
});

test('pruefeQuelle: der Fehler aus K10 wird gefunden', () => {
  const src = `const { data } = await s
    .from('leads')
    .select('id, birth_date')
    .eq('owner_id', o);`;
  assert.deepEqual(pruefeQuelle(src, tabellen), [{ zeile: 2, tabelle: 'leads', spalte: 'birth_date' }]);
});

test('pruefeQuelle: Filterspalte wird geprueft', () => {
  const funde = pruefeQuelle("s.from('leads').select('id').order('nachname');", tabellen);
  assert.equal(funde[0].spalte, 'nachname');
});

test('pruefeQuelle: richtige Abfrage, Storage-Bucket und Kommentar bleiben still', () => {
  assert.deepEqual(pruefeQuelle("s.from('leads').select('id, geburtsdatum').eq('owner_id', o);", tabellen), []);
  assert.deepEqual(pruefeQuelle("s.storage.from('belege').select('egal');", tabellen), []);
  assert.deepEqual(pruefeQuelle("// s.from('leads').select('birth_date');", tabellen), []);
});

test('pruefeQuelle: Filter der Folgeabfrage zaehlt nicht zur vorigen Tabelle', () => {
  const src = `await s.from('leads').select('id');
    await s.from('fußstatus').select('id');`;
  assert.deepEqual(pruefeQuelle(src, tabellen), []);
});
