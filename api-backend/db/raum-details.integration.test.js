import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

// Ausschließlich eigener Wegwerfcontainer ohne Ports, Volumes oder Netzwerk.
const enabled = process.env.PRAXURA_RAUM_DETAILS_PG_TEST === '1';
function command(args, input = '') {
  return new Promise(resolve => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', b => { out += b; });
    child.stderr.on('data', b => { err += b; });
    child.on('error', e => resolve({ code: -1, out, err: e.message }));
    child.on('close', code => resolve({ code, out: out.trim(), err }));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

test('Raumdetails: echte PostgreSQL-Constraints und wiederholbare Migration', { skip: !enabled, timeout: 60000 }, async t => {
  const name = `praxura-raum-details-test-${process.pid}`;
  const sql = text => command(['exec', '-i', name, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-At'], text);
  const ok = async text => { const r = await sql(text); assert.equal(r.code, 0, r.err); return r.out; };
  const start = await command(['run', '--rm', '--detach', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17.11']);
  assert.equal(start.code, 0, start.err);
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if ((await command(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'])).code === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(ready, 'isolierter PostgreSQL startet');
    await ok('CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE anon; CREATE TABLE public.rooms(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY); INSERT INTO public.rooms DEFAULT VALUES;');
    const migration = await readFile(new URL('./migrations/0103_raum_details.sql', import.meta.url), 'utf8');
    await ok(migration); await ok(migration);
    await t.test('Altbestand erhält leere Details, erlaubte Grenzwerte funktionieren', async () => {
      assert.equal(await ok("SELECT beschreibung = '', ausstattung = '{}'::text[] FROM public.rooms;"), 't|t');
      await ok("INSERT INTO public.rooms(beschreibung,ausstattung) VALUES (repeat('😀',2000), ARRAY[repeat('😀',80)]);");
      await ok("INSERT INTO public.rooms(ausstattung) SELECT array_agg('Punkt '||n) FROM generate_series(1,30)n;");
    });
    for (const [label, values] of [
      ['Beschreibung zu lang', "repeat('x',2001), '{}'::text[]"],
      ['leerer Punkt', "'', ARRAY['']"],
      ['Leerzeichen', "'', ARRAY[' Liege']"],
      ['Unicode-Leerzeichen', "'', ARRAY[U&'\\00A0Liege']"],
      ['Doppelung', "'', ARRAY['Liege','Liege']"],
      ['NULL-Punkt', "'', ARRAY[NULL]::text[]"],
      ['Punkt zu lang', "'', ARRAY[repeat('x',81)]"],
      ['zu viele Punkte', "'', ARRAY(SELECT n::text FROM generate_series(1,31)n)"],
      ['mehrdimensionale Liste', "'', ARRAY[['Liege'],['Waschbecken']]"],
    ]) await t.test(label, async () => {
      const result = await sql(`INSERT INTO public.rooms(beschreibung,ausstattung) VALUES (${values});`);
      assert.notEqual(result.code, 0, result.out);
      assert.match(result.err, /23514/);
    });
    await t.test('Prüffunktion nur für Schreibrollen, keine anon-Freigabe', async () => {
      assert.equal(await ok("SELECT has_function_privilege('anon','public.raum_ausstattung_gueltig(text[])','execute'),has_function_privilege('authenticated','public.raum_ausstattung_gueltig(text[])','execute');"), 'f|t');
    });
    t.diagnostic('Nur additive Migration auf Minimalfixture geprüft; keine Live-Anwendung oder vollständige Migrationsketten-Abnahme.');
  } finally {
    const cleanup = await command(['rm', '--force', name]);
    assert.equal(cleanup.code, 0, cleanup.err);
  }
});
