import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { kostentraegerTyp, gruppiereLeistungen, TYP_GRUPPEN, normalisiereTyp, ABRECHENBARE_TYPEN } from './leistungen-liste.js';

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
  // entsprechen (supabase/migrations/20260902090000_services_kostentraeger_typ.sql).
  const abrechenbar = TYP_GRUPPEN.map(g => g.typ).filter(t => t !== 'intern');
  assert.deepEqual(abrechenbar, ['gkv', 'privat', 'selbstzahler', 'bg']);
});

test('normalisiereTyp laesst nur die vier abrechenbaren Typen durch', () => {
  assert.equal(normalisiereTyp('gkv'), 'gkv');
  assert.equal(normalisiereTyp('privat'), 'privat');
  assert.equal(normalisiereTyp('selbstzahler'), 'selbstzahler');
  assert.equal(normalisiereTyp('bg'), 'bg');
});

test('normalisiereTyp macht aus allem Unbrauchbaren null', () => {
  // null heisst "automatisch bestimmen" — die Leistung wird gespeichert und
  // hergeleitet, statt dass PostgREST das ganze UPDATE abweist.
  assert.equal(normalisiereTyp(''), null);
  assert.equal(normalisiereTyp('   '), null);
  assert.equal(normalisiereTyp(null), null);
  assert.equal(normalisiereTyp(undefined), null);
  assert.equal(normalisiereTyp('quatsch'), null);
});

test('normalisiereTyp laesst intern NICHT durch', () => {
  // Das DB-CHECK kennt 'intern' nicht — darueber entscheidet is_internal.
  assert.equal(normalisiereTyp('intern'), null);
});

test('normalisiereTyp fasst Gross- und Kleinschreibung zusammen', () => {
  assert.equal(normalisiereTyp('GKV'), 'gkv');
  assert.equal(normalisiereTyp(' Selbstzahler '), 'selbstzahler');
});

test('ABRECHENBARE_TYPEN deckt sich mit dem DB-CHECK', () => {
  // Aendert sich eine der beiden Seiten, muss die andere mit —
  // supabase/migrations/20260902090000_services_kostentraeger_typ.sql
  assert.deepEqual(ABRECHENBARE_TYPEN, ['gkv', 'privat', 'selbstzahler', 'bg']);
});

test('die <option>-Liste in dashboard.html deckt sich mit ABRECHENBARE_TYPEN', () => {
  // Dritte Kopie derselben Werteliste: TYP_GRUPPEN (hier), das DB-CHECK (in der
  // Migration) und das Auswahlfeld in dashboard.html. Die ersten beiden pinnt
  // der Test darueber. Diese Kopie sah bisher niemand.
  //
  // Was passiert, wenn sie driftet: openServiceEdit setzt `select.value` auf
  // einen Wert ohne passende Option, der Browser macht daraus still '', und der
  // naechste Speichervorgang schreibt null. Der gepflegte Typ waere ohne jede
  // Meldung weg.
  const html = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
  const block = html.slice(html.indexOf('id="srvKostentraegerTyp"'));
  const select = block.slice(0, block.indexOf('</select>'));
  const werte = [...select.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]);

  assert.deepEqual(werte, ['', ...ABRECHENBARE_TYPEN],
    'erste Option ist "automatisch" (leer), danach exakt die abrechenbaren Typen');
});
