import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

// Nur eigens erzeugter Container, keine Ports/Volumes, keine bestehende Datenbank.
const enabled = process.env.PRAXURA_QUOTA_PG_TEST === '1';
const migration = new URL('./migrations/0102_termin_mitteilungen_tagesdeckel.sql', import.meta.url);
const migration110 = new URL('./migrations/0110_terminerinnerung_vortag.sql', import.meta.url);
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const booking = n => `md5('booking-${n}')::uuid`;
const row = (n, tenant = owner) => `('${tenant}', ${booking(n)}, 'sondertag_geschlossen', '2026-12-24T09:00:00Z', 'fehler', 'IN_ARBEIT')`;
const insert = (n, tenant = owner) => `INSERT INTO public.termin_mitteilungen(owner_id,booking_id,anlass,termin_beginn,status,fehler_code) VALUES ${row(n, tenant)};`;

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

test('F12 PostgreSQL: atomarer Tagesdeckel in getrennten Sessions', { skip: !enabled, timeout: 60000 }, async t => {
  const name = `praxura-quota-test-${process.pid}`;
  const sql = text => command(['exec', '-i', name, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-At'], text);
  const ok = async text => { const r = await sql(text); assert.equal(r.code, 0, r.err); return r.out; };
  const started = await command(['run', '--rm', '--detach', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17.11']);
  assert.equal(started.code, 0, started.err);
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      // Der Init-Server lauscht nur am Socket und startet danach neu; TCP prueft den finalen Server.
      const r = await command(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']);
      if (r.code === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(ready, 'isolierter PostgreSQL startet');
    await ok(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE TABLE public.profiles(id uuid PRIMARY KEY);
      CREATE TABLE public.bookings(id uuid PRIMARY KEY);
      CREATE TABLE public.custom_days(id uuid PRIMARY KEY);
      CREATE FUNCTION public.auth_tenant_id() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
      INSERT INTO public.profiles VALUES ('${owner}'), ('${other}');
      INSERT INTO public.bookings SELECT md5('booking-'||n)::uuid FROM generate_series(1,1100) n;`);
    await ok(await readFile(new URL('./migrations/0101_termin_mitteilungen.sql', import.meta.url), 'utf8'));
    await ok(await readFile(migration, 'utf8'));
    await ok(await readFile(migration, 'utf8')); // Wiederholung erzeugt keinen zweiten Trigger.
    // 0110 (Terminerinnerung): Anlass-Liste + Deckel je Anlass + Praxis-Schalter. Zweimal = idempotent.
    await ok(await readFile(migration110, 'utf8'));
    await ok(await readFile(migration110, 'utf8'));
    await ok('GRANT SELECT,INSERT,UPDATE ON public.termin_mitteilungen TO service_role;');
    const reset = () => ok('TRUNCATE public.termin_mitteilungen;');
    const seed = count => ok(`INSERT INTO public.termin_mitteilungen(owner_id,booking_id,anlass,termin_beginn,status)
      SELECT '${owner}', md5('booking-'||n)::uuid, 'sondertag_geschlossen', '2026-12-24T09:00:00Z', 'gesendet' FROM generate_series(1,${count}) n;`);
    const waitLock = async () => {
      for (let i = 0; i < 100; i++) {
        if (await ok("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND granted;") !== '0') return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.fail('erste Session haelt keinen Lock');
    };

    await t.test('499 + zwei parallele Claims: genau einer erlaubt, Count bleibt 500', async () => {
      await reset(); await seed(499);
      const first = sql(`BEGIN; ${insert(500)} SELECT pg_sleep(0.8); COMMIT;`);
      await waitLock();
      const second = sql(insert(501));
      const results = await Promise.all([first, second]);
      assert.equal(results[0].code, 0, results[0].err);
      assert.notEqual(results[1].code, 0); assert.match(results[1].err, /PT429/);
      assert.equal(await ok('SELECT count(*) FROM public.termin_mitteilungen;'), '500');
    });
    await t.test('gleicher Schluessel bleibt UNIQUE-Konflikt, auch an voller Grenze', async () => {
      const r = await sql(insert(500));
      assert.notEqual(r.code, 0); assert.match(r.err, /23505/);
      assert.equal(await ok('SELECT count(*) FROM public.termin_mitteilungen;'), '500');
    });
    await t.test('anderer Mandant unabhaengig; Retry UPDATE verbraucht keinen neuen Platz', async () => {
      await ok(insert(501, other));
      assert.equal(await ok(`WITH retry AS (UPDATE public.termin_mitteilungen SET status='fehler',fehler_code='IN_ARBEIT' WHERE owner_id='${owner}' AND booking_id=${booking(500)} RETURNING id) SELECT count(*) FROM retry;`), '1');
      assert.equal(await ok(`SELECT count(*) FROM public.termin_mitteilungen WHERE owner_id='${other}';`), '1');
    });
    await t.test('gleichzeitige gleiche Buchung bekommt nur eine Protokollzeile', async () => {
      await reset();
      const first = sql(`BEGIN; ${insert(1)} SELECT pg_sleep(0.8); COMMIT;`);
      await waitLock();
      const second = sql(insert(1));
      const results = await Promise.all([first, second]);
      assert.equal(results[0].code, 0, results[0].err);
      assert.notEqual(results[1].code, 0); assert.match(results[1].err, /23505/);
      assert.equal(await ok('SELECT count(*) FROM public.termin_mitteilungen;'), '1');
    });
    await t.test('Mehrzeilen-Insert rollt vollstaendig zurueck', async () => {
      await reset(); await seed(499);
      const r = await sql(`INSERT INTO public.termin_mitteilungen(owner_id,booking_id,anlass,termin_beginn,status,fehler_code) VALUES ${row(500)},${row(501)};`);
      assert.notEqual(r.code, 0); assert.match(r.err, /PT429/);
      assert.equal(await ok('SELECT count(*) FROM public.termin_mitteilungen;'), '499');
    });
    await t.test('Backdating wird ersetzt; anderer Snapshot fail-closed', async () => {
      await reset();
      await ok(`INSERT INTO public.termin_mitteilungen(owner_id,booking_id,anlass,termin_beginn,status,created_at) VALUES ('${owner}',${booking(1)},'sondertag_geschlossen',now(),'fehler','2000-01-01');`);
      assert.equal(await ok("SELECT created_at > now()-interval '1 minute' FROM public.termin_mitteilungen;"), 't');
      const r = await sql(`BEGIN ISOLATION LEVEL REPEATABLE READ; ${insert(2)} COMMIT;`);
      assert.notEqual(r.code, 0); assert.match(r.err, /40001/);
      assert.equal(await ok('SELECT count(*) FROM public.termin_mitteilungen;'), '1');
    });
    await t.test('Locktimeout erlaubt keinen Insert', async () => {
      await reset();
      const first = sql(`BEGIN; ${insert(1)} SELECT pg_sleep(0.8); COMMIT;`);
      await waitLock();
      const second = await sql(`SET lock_timeout='50ms'; ${insert(2)}`);
      assert.notEqual(second.code, 0); assert.match(second.err, /55P03/);
      assert.equal((await first).code, 0);
      assert.equal(await ok('SELECT count(*) FROM public.termin_mitteilungen;'), '1');
    });
    await t.test('service_role schreibt; Browserrollen duerfen weder schreiben noch Funktion ausfuehren', async () => {
      await reset(); await ok(`SET ROLE service_role; ${insert(1)}`);
      assert.equal(await ok("SELECT has_function_privilege('anon','public.termin_mitteilungen_tagesdeckel()','execute'),has_function_privilege('authenticated','public.termin_mitteilungen_tagesdeckel()','execute');"), 'f|f');
      const r = await sql(`SET ROLE authenticated; ${insert(2)}`);
      assert.notEqual(r.code, 0); assert.match(r.err, /42501/);
    });
    await t.test('0110: Deckel zaehlt je Anlass – volle Sondertag-Grenze sperrt Erinnerungen nicht (G-6)', async () => {
      await reset(); await seed(500);
      const erinnerung = n => `INSERT INTO public.termin_mitteilungen(owner_id,booking_id,anlass,termin_beginn,status,fehler_code) VALUES ('${owner}', ${booking(n)}, 'erinnerung_vortag', '2026-12-24T09:00:00Z', 'fehler', 'IN_ARBEIT');`;
      await ok(erinnerung(501));
      const sondertag = await sql(insert(501));
      assert.notEqual(sondertag.code, 0); assert.match(sondertag.err, /PT429/); // Sondertag bleibt bei 500
    });
    await t.test('0110: Erinnerungen haben eigene Grenze 1000; Sondertag unbeeinflusst', async () => {
      await reset();
      await ok(`INSERT INTO public.termin_mitteilungen(owner_id,booking_id,anlass,termin_beginn,status)
        SELECT '${owner}', md5('booking-'||n)::uuid, 'erinnerung_vortag', '2026-12-24T09:00:00Z', 'gesendet' FROM generate_series(1,999) n;`);
      await ok(`INSERT INTO public.termin_mitteilungen(owner_id,booking_id,anlass,termin_beginn,status,fehler_code) VALUES ('${owner}', ${booking(1000)}, 'erinnerung_vortag', '2026-12-24T09:00:00Z', 'fehler', 'IN_ARBEIT');`);
      const zuviel = await sql(`INSERT INTO public.termin_mitteilungen(owner_id,booking_id,anlass,termin_beginn,status,fehler_code) VALUES ('${owner}', ${booking(1001)}, 'erinnerung_vortag', '2026-12-24T09:00:00Z', 'fehler', 'IN_ARBEIT');`);
      assert.notEqual(zuviel.code, 0); assert.match(zuviel.err, /PT429/);
      await ok(insert(1001)); // Sondertag-Zeile geht trotz 1000 Erinnerungen
    });
    await t.test('0110: gleicher Schluessel je Anlass eigenstaendig; Erinnerung zweimal = UNIQUE-Konflikt (G-1)', async () => {
      await reset();
      const erinnerung = `INSERT INTO public.termin_mitteilungen(owner_id,booking_id,anlass,termin_beginn,status,fehler_code) VALUES ('${owner}', ${booking(1)}, 'erinnerung_vortag', '2026-12-24T09:00:00Z', 'fehler', 'IN_ARBEIT');`;
      await ok(erinnerung); await ok(insert(1)); // gleiche Buchung, anderer Anlass: erlaubt
      const doppelt = await sql(erinnerung);
      assert.notEqual(doppelt.code, 0); assert.match(doppelt.err, /23505/);
      // verschobener Termin (neuer termin_beginn) = neue Erinnerung erlaubt
      await ok(erinnerung.replace('2026-12-24T09:00:00Z', '2026-12-24T10:00:00Z'));
      assert.equal(await ok("SELECT count(*) FROM public.termin_mitteilungen WHERE anlass='erinnerung_vortag';"), '2');
    });
    await t.test('0110: unbekannter Anlass wird abgelehnt; Schalter Standard AUS', async () => {
      await reset();
      const r = await sql(`INSERT INTO public.termin_mitteilungen(owner_id,booking_id,anlass,termin_beginn,status) VALUES ('${owner}', ${booking(1)}, 'werbung', now(), 'gesendet');`);
      assert.notEqual(r.code, 0); assert.match(r.err, /23514/);
      assert.equal(await ok(`SELECT terminerinnerung_aktiv FROM public.profiles WHERE id='${owner}';`), 'f');
    });
    t.diagnostic('Nur 0101/0102/0110 mit synthetischen Abhaengigkeiten getestet; keine volle 0000-0102-Ketten-/Zaehlerfreigabe.');
  } finally {
    const cleanup = await command(['rm', '--force', name]);
    assert.equal(cleanup.code, 0, cleanup.err);
  }
});

test('F12 Backend: atomare Quota-Ablehnung stoppt Transport und behaelt Teilzaehler', async () => {
  process.env.SUPABASE_URL ||= 'http://127.0.0.1:9';
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key';
  const { sendeLauf } = await import('../routes/sondertag-mitteilung.js');
  let inserts = 0, transports = 0;
  const supabase = { from() {
    let op = 'count';
    const q = {
      select() { return q; }, eq() { return q; }, gte() { return q; },
      insert() { op = 'insert'; return q; }, update() { op = 'update'; return q; },
      maybeSingle() { return Promise.resolve(op === 'insert' && ++inserts === 2 ? { data: null, error: { code: 'PT429' } } : { data: { id: 'synthetic' }, error: null }); },
      then(a,b) { return Promise.resolve({ count: 498, error: null }).then(a,b); },
    }; return q;
  } };
  const r = await sendeLauf(supabase, { tenantId: owner, userId: owner, ids: ['one','two'],
    lage: { weg: 'smtp', profil: {}, mail: ['one','two'].map(id => ({ termin: { id, start_time:'2026-12-24T09:00:00Z' }, tag:{}, email:'qa@example.invalid' })) },
    transportFabrik: () => ({ async sendMail() { transports++; } }),
  });
  assert.equal(r.status,429); assert.equal(r.body.code,'TAGESDECKEL');
  assert.equal(r.body.gesendet,1); assert.equal(transports,1);
});
