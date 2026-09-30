// O-139: Seed-Generator für die beiden Annahmestellen-Tabellen.
//   node --test tools/seed-generieren.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABLES, buildQuery, zukunftSperreSql } from './seed-generieren.mjs';

for (const tabelle of ['kostentraeger_annahmestellen', 'kostentraeger_anschriften']) {
  test(`${tabelle}: valid_from/valid_to sind im Seed, ON CONFLICT überschreibt valid_from NICHT`, () => {
    const cfg = TABLES[tabelle];
    assert.ok(cfg.columns.includes('valid_from') && cfg.columns.includes('valid_to'));
    const sql = buildQuery(tabelle, cfg);
    const setTeil = sql.slice(sql.indexOf('DO UPDATE SET'));
    assert.ok(!/valid_from\s*=\s*EXCLUDED/.test(setTeil), 'valid_from darf nicht im DO UPDATE SET stehen');
    assert.ok(/valid_to=EXCLUDED\.valid_to/.test(setTeil), 'valid_to (Ende aus dem Ladewerkzeug) wird mitgeführt');
    assert.ok(/quelle_stand=EXCLUDED\.quelle_stand/.test(setTeil));
  });

  test(`${tabelle}: Adim-2-Sperre ist konfiguriert (Zukunfts-valid_from -> kein Seed)`, () => {
    assert.equal(TABLES[tabelle].zukunftSperre, 'valid_from');
  });
}

test('zukunftSperreSql vergleicht gegen den Berliner Tag', () => {
  const sql = zukunftSperreSql('kostentraeger_annahmestellen', 'valid_from');
  assert.match(sql, /valid_from > \(now\(\) AT TIME ZONE 'Europe\/Berlin'\)::date/);
});

test('andere Tabellen behalten das bisherige ON CONFLICT-Verhalten', () => {
  const sql = buildQuery('krankenkassen', TABLES.krankenkassen);
  assert.ok(/name=EXCLUDED\.name/.test(sql));
});
