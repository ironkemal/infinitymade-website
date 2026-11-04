import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import vm from 'node:vm';
import { urlaubsKennzahlen } from '../../module/anstellung.js';
import { istAbwesend } from '../../module/abwesenheit.js';

function command(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, out: out.trim(), err }));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

test('Urlaub: tatsächliche Schreibpayloads über PostgreSQL bis Saldo und Kalender', {
  skip: process.env.PRAXURA_URLAUB_DATUM_PG_TEST !== '1', timeout: 120000,
}, async t => {
  const source = await readFile(new URL('../../dashboard.js', import.meta.url), 'utf8');
  const writers = [...source.matchAll(/from\('time_offs'\)\.insert\(\{([\s\S]*?)\n\s*\}\)/g)];
  assert.equal(writers.length, 3, 'alle aktuellen Dashboard-Schreibpfade erfasst');
  const schema = await readFile(new URL('../../db/SCHEMA.sql', import.meta.url), 'utf8');
  const table = schema.slice(schema.indexOf('CREATE TABLE public.time_offs ('), schema.indexOf('--   FK approved_by'));
  assert.match(table, /start_date timestamp with time zone NOT NULL/);
  assert.match(table, /end_date timestamp with time zone NOT NULL/);
  const name = `praxura-urlaub-datum-${process.pid}`;
  const sql = async text => {
    const r = await command(['exec', '-i', name, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'], text);
    assert.equal(r.code, 0, r.err); return r.out;
  };
  const started = await command(['run', '--rm', '--detach', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17.11']);
  assert.equal(started.code, 0, started.err);
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if ((await command(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'])).code === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(ready);
    await sql("CREATE TABLE time_offs(start_date timestamptz NOT NULL,end_date timestamptz NOT NULL,type text DEFAULT 'urlaub');");
    for (const [index, writer] of writers.entries()) for (const zone of ['UTC', 'Europe/Berlin']) {
      await t.test(`Schreibpfad ${index + 1}, DB-Zeitzone ${zone}`, async () => {
        for (const day of ['2026-01-01', '2026-03-30', '2026-10-26', '2026-12-31']) {
          const payload = vm.runInNewContext(`({${writer[1]}})`, {
            empId: 'synthetic', getOwnerId: () => 'synthetic-owner', start: day, end: day,
            fromVal: day, toVal: day, typeVal: 'urlaub', reason: '', workDays: 1,
          });
          for (const value of [payload.start_date, payload.end_date]) assert.match(value, /^\d{4}-\d{2}-\d{2}(T00:00:00Z)?$/);
          const row = JSON.parse(await sql(`TRUNCATE time_offs; SET TIME ZONE '${zone}';
            INSERT INTO time_offs(start_date,end_date) VALUES ('${payload.start_date}','${payload.end_date}');
            SET TIME ZONE 'UTC'; SELECT row_to_json(t) FROM time_offs t;`));
          assert.equal(row.start_date.slice(0, 10), day, 'gewählter Tag bleibt nach Speicherung erhalten');
          assert.equal(row.end_date.slice(0, 10), day);
          const summary = urlaubsKennzahlen({ abwesenheiten: [row], anspruch: 28, arbeitstage: new Set([1, 2, 3, 4, 5]), jahr: 2026 });
          assert.equal(summary.verbraucht, 1); assert.equal(summary.rest, 27);
          assert.equal(istAbwesend([{ ...row, employee_id: 'synthetic' }], 'synthetic', day), true);
          const previous = new Date(`${day}T00:00:00Z`); previous.setUTCDate(previous.getUTCDate() - 1);
          assert.equal(istAbwesend([{ ...row, employee_id: 'synthetic' }], 'synthetic', previous.toISOString().slice(0, 10)), false);
        }
        const payload = vm.runInNewContext(`({${writer[1]}})`, {
          empId: 'synthetic', getOwnerId: () => 'synthetic-owner', start: '2025-12-29', end: '2026-01-05',
          fromVal: '2025-12-29', toVal: '2026-01-05', typeVal: 'urlaub', reason: '', workDays: 6,
        });
        const row = JSON.parse(await sql(`TRUNCATE time_offs; SET TIME ZONE '${zone}';
          INSERT INTO time_offs(start_date,end_date) VALUES ('${payload.start_date}','${payload.end_date}');
          SET TIME ZONE 'UTC'; SELECT row_to_json(t) FROM time_offs t;`));
        for (const [jahr, expected] of [[2025, 2], [2026, 1]]) {
          const summary = urlaubsKennzahlen({ abwesenheiten: [row], anspruch: 28, arbeitstage: new Set([1, 2]), jahr });
          assert.equal(summary.verbraucht, expected, `Teilzeit-Jahresüberhang ${jahr}`);
          assert.equal(summary.rest, 28 - expected);
        }
      });
    }
  } finally {
    await command(['rm', '--force', name]);
  }
});
