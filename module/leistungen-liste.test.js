import { test } from 'node:test';
import assert from 'node:assert/strict';

import { kostentraegerTyp, gruppiereLeistungen, TYP_GRUPPEN } from './leistungen-liste.js';

test('gepflegte Spalte gewinnt', () => {
  assert.equal(kostentraegerTyp({ kostentraeger_typ: 'bg', gkv_position_nr: 'X0501' }), 'bg');
  assert.equal(kostentraegerTyp({ kostentraeger_typ: 'selbstzahler' }), 'selbstzahler');
});

test('ohne Spalte greift die alte implizite Regel', () => {
  // Genau der Fall vor der Migration: die Spalte existiert nicht, jeder
  // Datensatz liefert undefined. Ohne Rückfall wäre die Liste leer.
  assert.equal(kostentraegerTyp({ gkv_position_nr: 'X0501' }), 'gkv');
  assert.equal(kostentraegerTyp({ gkv_position_nr: '' }), 'privat');
  assert.equal(kostentraegerTyp({ gkv_position_nr: '   ' }), 'privat');
  assert.equal(kostentraegerTyp({}), 'privat');
});

test('interne Leistungen stehen ueber allem', () => {
  // Ein Blocker ist keine abrechenbare Leistung, auch nicht mit Positionsnummer.
  assert.equal(kostentraegerTyp({ is_internal: true, gkv_position_nr: 'X0501' }), 'intern');
  assert.equal(kostentraegerTyp({ is_internal: true, kostentraeger_typ: 'gkv' }), 'intern');
});

test('unbekannter Wert faellt auf die Regel zurueck, statt eine Geistergruppe zu bilden', () => {
  assert.equal(kostentraegerTyp({ kostentraeger_typ: 'quatsch', gkv_position_nr: 'X1' }), 'gkv');
  assert.equal(kostentraegerTyp({ kostentraeger_typ: 'quatsch' }), 'privat');
});

test('nichts uebergeben stuerzt nicht ab', () => {
  assert.equal(kostentraegerTyp(null), 'privat');
  assert.equal(kostentraegerTyp(undefined), 'privat');
});

test('Gruppen kommen in fester Reihenfolge, leere fallen weg', () => {
  const gruppen = gruppiereLeistungen([
    { id: '1', title: 'Privatleistung' },
    { id: '2', title: 'KG', gkv_position_nr: 'X0501' },
    { id: '3', title: 'Pause', is_internal: true },
  ]);
  assert.deepEqual(gruppen.map(g => g.typ), ['gkv', 'privat', 'intern']);
  // Selbstzahler und BG hat diese Praxis nicht — dann sollen sie auch nicht
  // als leere Tabelle erscheinen.
  assert.equal(gruppen.some(g => g.typ === 'bg'), false);
});

test('innerhalb einer Gruppe wird nach Name sortiert', () => {
  const [gruppe] = gruppiereLeistungen([
    { id: '1', title: 'Zehenpflege' },
    { id: '2', title: 'Änderung' },
    { id: '3', title: 'Beratung' },
  ]);
  assert.deepEqual(gruppe.leistungen.map(l => l.title), ['Änderung', 'Beratung', 'Zehenpflege']);
});

test('leere Eingabe ergibt keine Gruppen', () => {
  assert.deepEqual(gruppiereLeistungen([]), []);
  assert.deepEqual(gruppiereLeistungen(), []);
});

test('jede Leistung landet in genau einer Gruppe', () => {
  const leistungen = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    title: 'L' + i,
    gkv_position_nr: i % 3 === 0 ? 'X1' : null,
    is_internal: i % 7 === 0,
    kostentraeger_typ: i % 5 === 0 ? 'bg' : null,
  }));
  const summe = gruppiereLeistungen(leistungen).reduce((n, g) => n + g.leistungen.length, 0);
  assert.equal(summe, leistungen.length);
});

test('die Gruppendefinitionen sind vollstaendig', () => {
  for (const g of TYP_GRUPPEN) {
    assert.ok(g.typ && g.label && g.hinweis, g.typ);
  }
  // Die vier abrechenbaren Typen müssen exakt denen des DB-Constraints
  // entsprechen (sql-melih/2026-08-25-kostentraeger-typ.sql).
  const abrechenbar = TYP_GRUPPEN.map(g => g.typ).filter(t => t !== 'intern');
  assert.deepEqual(abrechenbar, ['gkv', 'privat', 'selbstzahler', 'bg']);
});
