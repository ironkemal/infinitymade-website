import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VORLAGE_SEEDS, fehlendeSeedZeilen, seedeVorlagen } from './vorlagen-seed.js';

function fake(ungueltig) {
  const gespeichert = [];
  return {
    gespeichert,
    from() {
      return {
        insert: async (x) => {
          const zeilen = Array.isArray(x) ? x : [x];
          if (zeilen.some(z => z.vorlage_type === ungueltig)) return { error: { message: 'check' } };
          gespeichert.push(...zeilen);
          return { error: null };
        },
      };
    },
  };
}

test('fehlendeSeedZeilen setzt owner_id und filtert', () => {
  const z = fehlendeSeedZeilen(['rechnung_ausfall'], 'o1');
  assert.equal(z.length, 1);
  assert.equal(z[0].owner_id, 'o1');
  assert.ok(DEFAULT_VORLAGE_SEEDS.some(s => s.vorlage_type === 'rechnung_ausfall'));
});

test('seedeVorlagen: alles gueltig, ein insert', async () => {
  const sb = fake(null);
  const r = await seedeVorlagen(sb, fehlendeSeedZeilen(['rechnung_bg', 'rzg_quittung'], 'o1'));
  assert.deepEqual(r, []);
  assert.equal(sb.gespeichert.length, 2);
});

test('seedeVorlagen: ein ungueltiger Typ reisst die anderen nicht mit', async () => {
  const sb = fake('rechnung_ausfall');
  const gemeldet = [];
  const r = await seedeVorlagen(sb, fehlendeSeedZeilen(['rechnung_bg', 'rechnung_ausfall', 'rzg_quittung'], 'o1'), t => gemeldet.push(t));
  assert.deepEqual(r, ['rechnung_ausfall']);
  assert.deepEqual(gemeldet, ['rechnung_ausfall']);
  assert.equal(sb.gespeichert.length, 2);
});

test('seedeVorlagen: leere Liste', async () => {
  assert.deepEqual(await seedeVorlagen(fake(null), []), []);
});
