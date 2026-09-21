// Ops #302 — „Komplex" findet in der Heilmittelsuche 78010 UND 78020.
//   node --test module/heilmittel-suche-komplex.test.js
//
// Geprüft wird nicht ein Zwischenstand im Code, sondern das, was wirklich in die
// Datenbank geht: die Ausgabe von `sync_heilmittel_katalog.js --sql` (dieselbe
// Vollausgabe wie in db/migrations/0038_…). Daraus wird die Suchregel der RPC
// search_heilmittel() nachgebildet (api-backend/db/migrations/0000_baseline.sql:
// 1849-1866) — die RPC selbst braucht eine echte Datenbank und wird nach dem
// Anwenden von 0038 einmal live gegengeprüft (siehe Ops #302).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { POD_KATALOG } from './verordnung-regeln.js';

const SYNC = fileURLToPath(new URL('../api-backend/sync_heilmittel_katalog.js', import.meta.url));

// Spaltenreihenfolge des INSERT (SPALTEN in sync_heilmittel_katalog.js).
const SPALTE = { code: 0, bereich: 1, label: 2, kuerzel: 3, kategorie: 4, ab: 9, bis: 10, deprecated: 11, ungueltigAb: 12 };

function seedZeilen() {
  const sql = execFileSync(process.execPath, [SYNC, '--sql'], { encoding: 'utf8' });
  return sql.split('\n').filter(z => z.startsWith("  ('")).map(z => {
    const w = (z.match(/NULL|'(?:[^']|'')*'/g) || []).map(t => (t === 'NULL' ? null : t.slice(1, -1).replace(/''/g, "'")));
    return Object.fromEntries(Object.entries(SPALTE).map(([k, i]) => [k, w[i]]));
  });
}

const ZEILEN = seedZeilen();
const PODO = ZEILEN.filter(z => z.bereich === 'podologie');

// Spiegel von search_heilmittel(): Stichtag + nicht abgelöst + LIKE auf code/kuerzel/label/kategorie.
function suche(q, datum, bereich = 'podologie') {
  const t = q.trim().toLowerCase();
  return ZEILEN
    .filter(z => z.bereich === bereich
      && z.ab <= datum && z.bis >= datum
      && z.deprecated === 'f'
      && (z.ungueltigAb === null || z.ungueltigAb > datum))
    .filter(z => z.code.toLowerCase().includes(t)
      || (z.kuerzel ?? '').toLowerCase().includes(t)
      || z.label.toLowerCase().includes(t)
      || (z.kategorie ?? '').toLowerCase().includes(t))
    .map(z => z.code)
    .sort();
}

test('Seed-Parser liest die ganze Vollausgabe (Schutz gegen leeren Test)', () => {
  assert.ok(ZEILEN.length >= 94, `nur ${ZEILEN.length} Zeilen gelesen`);
  assert.ok(PODO.length >= 30, `nur ${PODO.length} Podologie-Zeilen gelesen`);
  assert.ok(PODO.every(z => /^\d{4}-\d{2}-\d{2}$/.test(z.ab) && /^\d{4}-\d{2}-\d{2}$/.test(z.bis)));
});

test('„Komplex" findet 78010 und 78020 — nie 78020 allein, in beiden Preisfenstern', () => {
  for (const datum of ['2025-08-01', '2026-09-21']) {
    for (const q of ['Komplex', 'komplexbehandlung', 'Podologische Komplexbehandlung']) {
      assert.deepEqual(suche(q, datum), ['78010', '78020'], `${q} @ ${datum}`);
    }
  }
});

test('die Labels bleiben wortgleich mit Anlage 2 §2/§3 — „Komplex" steht in keinem Label', () => {
  for (const [code, label] of [['78010', 'Podologische Behandlung (klein)'], ['78020', 'Podologische Behandlung (groß)']]) {
    const zeilen = PODO.filter(z => z.code === code);
    assert.ok(zeilen.length >= 2, `${code}: mindestens ein Fenster je Preisrunde erwartet`);
    for (const z of zeilen) {
      assert.equal(z.label, label);
      assert.ok(!/komplex/i.test(z.label));
    }
  }
});

test('der Anker steht in JEDEM Preisfenster an 78010/78020 und sonst nirgends', () => {
  // Unabhängig von der Fensterzahl: kommt am 01.07.2027 ein drittes Fenster dazu, muss
  // der Anker mitwandern — sonst findet „Komplex" ab dann nichts mehr (Test wird rot).
  const ziel = PODO.filter(z => z.code === '78010' || z.code === '78020');
  assert.ok(ziel.length >= 4);
  assert.ok(ziel.every(z => z.kategorie !== null), 'Anker fehlt in einem Preisfenster');
  assert.ok(PODO.filter(z => !ziel.includes(z)).every(z => z.kategorie === null), 'Anker an fremder Position');
  assert.ok(ZEILEN.filter(z => z.bereich !== 'podologie').every(z => !/komplex/i.test(z.kategorie ?? '')));
});

test('der Anker ist wörtlich das Heilmittel c) der Verordnung (POD_KATALOG, HeilM-RL § 27a Abs. 4 Nr. 3)', () => {
  for (const dg of ['DF', 'NF', 'QF']) {
    const anker = new Set(PODO.filter(z => z.kategorie !== null).map(z => z.kategorie));
    assert.deepEqual([...anker], [POD_KATALOG[dg].c], `Diagnosegruppe ${dg}`);
  }
});

test('kuerzel bleibt in der Podologie leer — sonst zeigt das Dropdown `kuerzel || code` und die HPNR verschwindet', () => {
  assert.ok(PODO.every(z => z.kuerzel === null));
});

test('78003/78006 (Maßnahmen-HPNR, nicht abrechenbar) kommen nie in den Katalog', () => {
  assert.ok(PODO.every(z => !/^7800\d$/.test(z.code)));
});
