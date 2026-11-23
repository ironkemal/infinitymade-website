// O-251 / Migration 0130 gegen echtes PostgreSQL 17 (Docker, ohne Netz, synthetische Daten).
// Opt-in wie die übrigen Integrationstests: PRAXURA_O251_PG_TEST=1 npm run test:backend
// Minimalschema nur mit den Spalten, die 0130 liest/schreibt; die Migration selbst läuft unverändert.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

/** @param {string[]} args @param {string} [input] */
function command(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', c => { out += c; });
    child.stderr.on('data', c => { err += c; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, out: out.trim(), err }));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

const SCHEMA = `
CREATE TABLE profiles (id uuid PRIMARY KEY, owner_id uuid, role text, is_active boolean DEFAULT true);
CREATE TABLE businesses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, business_name text, is_default boolean DEFAULT false);
CREATE UNIQUE INDEX uniq_businesses_default_per_owner ON businesses (owner_id) WHERE is_default;
CREATE TABLE employee_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid REFERENCES businesses(id) ON DELETE CASCADE, name text, is_default boolean, UNIQUE (business_id, name));
CREATE TABLE group_scopes (group_id uuid REFERENCES employee_groups(id) ON DELETE CASCADE, module text, has_access boolean, UNIQUE (group_id, module));
CREATE TABLE employee_business_assignments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid NOT NULL REFERENCES profiles(id), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE, group_id uuid REFERENCES employee_groups(id) ON DELETE SET NULL, UNIQUE (employee_id, business_id));
CREATE TABLE mitarbeiter_anstellung (employee_id uuid NOT NULL, owner_id uuid NOT NULL, austritt_am date);
`;
// Baseline-Zustand vor 0130: Funktion ohne Zuordnung + Trigger.
const BASELINE_TRIGGER = 'CREATE TRIGGER trg_seed_default_groups AFTER INSERT ON businesses FOR EACH ROW EXECUTE FUNCTION seed_default_groups_for_business();';

const id = (/** @type {number} */ n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const [OA, OB, E1, E2, E3, E4, E5, F1] = [1, 2, 11, 12, 13, 14, 15, 21].map(id);

test('0130: Backfill + Zuordnung beim ersten Standort, nur unzugeordnete aktive Mitarbeiter', {
  skip: process.env.PRAXURA_O251_PG_TEST !== '1', timeout: 120000,
}, async t => {
  const migration = await readFile(new URL('./migrations/0130_mitarbeiter_standort_zuordnung.sql', import.meta.url), 'utf8');
  const baseline = await readFile(new URL('./migrations/0000_baseline.sql', import.meta.url), 'utf8');
  const start = baseline.indexOf('CREATE FUNCTION public.seed_default_groups_for_business()');
  const altFunktion = baseline.slice(start, baseline.indexOf('END $$;', start) + 'END $$;'.length);
  assert.ok(start > 0 && altFunktion.includes('Sekreter'), 'alte Funktion aus der Baseline gelesen');

  const name = `praxura-o251-${process.pid}`;
  const sql = async (/** @type {string} */ text) => {
    const r = /** @type {any} */ (await command(['exec', '-i', name, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'], text));
    assert.equal(r.code, 0, r.err); return r.out;
  };
  const gestartet = /** @type {any} */ (await command(['run', '--rm', '--detach', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17.11']));
  assert.equal(gestartet.code, 0, gestartet.err);
  try {
    let bereit = false;
    for (let i = 0; i < 200 && !bereit; i++) {
      bereit = /** @type {any} */ (await command(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'])).code === 0;
      if (!bereit) await new Promise(r => setTimeout(r, 50));
    }
    assert.ok(bereit);
    await sql(SCHEMA + altFunktion + '\n' + BASELINE_TRIGGER);

    // Altbestand: Inhaber A hat schon einen Standard-Standort (Gruppen per alter Funktion).
    await sql(`
      INSERT INTO profiles VALUES ('${OA}',NULL,'owner',true),('${OB}',NULL,'owner',true),
        ('${E1}','${OA}','employee',true),   -- unzugeordnet → Backfill
        ('${E2}','${OA}','employee',true),   -- schon zugeordnet → bleibt
        ('${E3}','${OA}','employee',false),  -- inaktiv → nicht
        ('${E4}','${OA}','employee',true),   -- ausgetreten → nicht
        ('${E5}','${OA}','employee',NULL),   -- is_active NULL zählt als aktiv
        ('${F1}','${OB}','employee',true);   -- Inhaber B ohne Standort → erst beim Trigger
      INSERT INTO businesses (owner_id,business_name,is_default) VALUES ('${OA}','A Haupt',true),('${OA}','A Zweit',false);
      INSERT INTO employee_business_assignments (employee_id,business_id)
        SELECT '${E2}', id FROM businesses WHERE business_name='A Zweit';
      INSERT INTO mitarbeiter_anstellung VALUES ('${E4}','${OA}',current_date - 1);`);
    assert.equal(await sql('SELECT count(*) FROM employee_business_assignments'), '1', 'alte Funktion ordnet nicht zu');

    await sql(migration);

    await t.test('Backfill: E1 und E5 → Standard-Standort mit Gruppe „Mitarbeiter“', async () => {
      const zeilen = await sql(`SELECT e.employee_id||'|'||b.business_name||'|'||coalesce(g.name,'-') FROM employee_business_assignments e
        JOIN businesses b ON b.id=e.business_id LEFT JOIN employee_groups g ON g.id=e.group_id ORDER BY 1`);
      assert.deepEqual(zeilen.split('\n'), [`${E1}|A Haupt|Mitarbeiter`, `${E2}|A Zweit|-`, `${E5}|A Haupt|Mitarbeiter`]);
    });

    await t.test('Trigger: erster Standort von B ordnet F1 zu, Gruppe nicht NULL', async () => {
      await sql(`INSERT INTO businesses (owner_id,business_name,is_default) VALUES ('${OB}','B Haupt',true);`);
      assert.equal(await sql(`SELECT g.name FROM employee_business_assignments e JOIN employee_groups g ON g.id=e.group_id WHERE e.employee_id='${F1}'`), 'Mitarbeiter');
    });

    await t.test('zweiter Standort ordnet bereits Zugeordnete nicht erneut zu', async () => {
      await sql(`INSERT INTO businesses (owner_id,business_name) VALUES ('${OB}','B Zweit');`);
      assert.equal(await sql(`SELECT count(*) FROM employee_business_assignments WHERE employee_id='${F1}'`), '1');
      assert.equal(await sql(`SELECT count(*) FROM employee_groups g JOIN businesses b ON b.id=g.business_id WHERE b.business_name='B Zweit'`), '2', 'Gruppen weiter angelegt');
    });

    await t.test('erneuter Lauf ist idempotent, inaktive/ausgetretene bleiben draußen', async () => {
      await sql(migration);
      assert.equal(await sql('SELECT count(*) FROM employee_business_assignments'), '4');
      assert.equal(await sql(`SELECT count(*) FROM employee_business_assignments WHERE employee_id IN ('${E3}','${E4}')`), '0');
    });
  } finally {
    await command(['rm', '-f', name]);
  }
});
