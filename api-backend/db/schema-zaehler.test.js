import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zaehlerPruefen, erwarteteZaehlerLesen } from './schema-zaehler.js';

const erwartet = erwarteteZaehlerLesen(dirname(fileURLToPath(import.meta.url)));

// Sahte pg-Client: beantwortet jede Abfrage mit dem erwarteten Wert, außer den überschriebenen.
function sahteClient(ueberschreiben = {}) {
  return {
    async query(sql) {
      if (/pg_tables t/.test(sql)) return { rows: erwartet.zaehler.rls_kapali_tablolar.map((n) => ({ n })) };
      // Zuordnung über eindeutige Fragmente der SORGULAR
      const map = [
        ["has_table_privilege('anon','public.businesses'", 'anon_businesses_tablo_hakki'],
        ["attrelid='public.businesses'", 'anon_businesses_kolon'],
        ['has_table_privilege', 'anon_profiles_tablo_hakki'],
        ['has_column_privilege', 'anon_profiles_kolon'],
        ['pg_policies', 'rls_policy'], ['auth', 'auth_trigger'], ['pg_trigger', 'trigger'],
        ['pg_proc', 'fonksiyon'], ['pg_indexes', 'index'], ['storage.buckets', 'storage_bucket'],
        ['pg_publication_tables', 'publication_uye_tablo'], ['pg_extension', 'extension'],
        ['information_schema.tables', 'public_tablo'],
      ];
      const werte = { ...erwartet.zaehler, ...ueberschreiben };
      for (const [frag, name] of map) {
        if (frag === 'auth' && !/nspname = 'auth'/.test(sql)) continue;
        if (sql.includes(frag)) return { rows: [{ n: werte[name] }] };
      }
      throw new Error('unbekannte Abfrage: ' + sql.slice(0, 60));
    },
  };
}

test('erwartete Werte → ok', async () => {
  const r = await zaehlerPruefen(sahteClient(), erwartet, erwartet.bis_version);
  assert.equal(r.status, 'ok', JSON.stringify(r.abweichungen));
});

test('S-56 zurück (Tabellenrecht + 88 Spalten) → abweichung', async () => {
  const r = await zaehlerPruefen(sahteClient({ anon_profiles_tablo_hakki: true, anon_profiles_kolon: 88 }), erwartet, erwartet.bis_version);
  assert.equal(r.status, 'abweichung');
  assert.deepEqual(r.abweichungen.map((a) => a.name).sort(), ['anon_profiles_kolon', 'anon_profiles_tablo_hakki']);
});

test('S-57 zurück (businesses Tabellenrecht + 26 Spalten) → abweichung', async () => {
  const r = await zaehlerPruefen(sahteClient({ anon_businesses_tablo_hakki: true, anon_businesses_kolon: 26 }), erwartet, erwartet.bis_version);
  assert.equal(r.status, 'abweichung');
  assert.deepEqual(r.abweichungen.map((a) => a.name).sort(), ['anon_businesses_kolon', 'anon_businesses_tablo_hakki']);
});
