import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const enabled = process.env.PRAXURA_RAUM_AUTOMATIK_PG_TEST === '1';
function command(args, input = '') {
  return new Promise(resolve => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', b => { out += b; }); child.stderr.on('data', b => { err += b; });
    child.on('error', e => resolve({ code: -1, out, err: e.message }));
    child.on('close', code => resolve({ code, out: out.trim(), err }));
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const q = n => `'${uuid(n)}'`;

test('Raumautomatik: echte PostgreSQL-Zuordnung und Parallelität', { skip: !enabled, timeout: 60000 }, async t => {
  const name = `praxura-raum-auto-test-${process.pid}`;
  const sql = text => command(['exec', '-i', name, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-At'], text);
  const ok = async text => { const r = await sql(text); assert.equal(r.code, 0, r.err); return r.out; };
  const reject = async (text, match = /Kein freier Raum/) => { const r = await sql(text); assert.notEqual(r.code, 0); assert.match(r.err, match); };
  const insert = (id, fields = '', values = '') => `INSERT INTO bookings(id,owner_id,business_id,service_id,start_time,end_time${fields}) VALUES (${q(id)},${q(1)},${q(2)},${q(3)},'2026-12-01T10:00Z','2026-12-01T10:30Z'${values});`;
  const room = (id = 10, equipment = "ARRAY['Liege']", capacity = 1, site = q(2), owner = q(1)) => `INSERT INTO rooms(id,owner_id,business_id,name,plaetze,ausstattung) VALUES (${q(id)},${owner},${site},'Raum ${id}',${capacity},${equipment});`;
  const reset = () => ok('TRUNCATE booking_leistungen,bookings,rooms;');
  const started = await command(['run', '--rm', '--detach', '--name', name, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17.11']);
  assert.equal(started.code, 0, started.err);
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if ((await command(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'])).code === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(ready);
    await ok(`CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE anon;
      CREATE TABLE rooms(id uuid PRIMARY KEY,owner_id uuid,business_id uuid,name text,plaetze int DEFAULT 1,aktiv boolean DEFAULT true,sort int DEFAULT 0);
      CREATE TABLE services(id uuid PRIMARY KEY,owner_id uuid,user_id uuid,business_id uuid,is_online_meeting boolean DEFAULT false);
      CREATE TABLE bookings(id uuid PRIMARY KEY,owner_id uuid,business_id uuid,service_id uuid,start_time timestamptz,end_time timestamptz,room_id uuid,group_parent_id uuid,hausbesuch boolean DEFAULT false,status text DEFAULT 'confirmed');
      CREATE TABLE booking_leistungen(id uuid PRIMARY KEY,booking_id uuid,service_id uuid);
      INSERT INTO services(id,owner_id,business_id) VALUES (${q(3)},${q(1)},${q(2)}),(${q(4)},${q(1)},${q(2)}),(${q(5)},${q(91)},${q(2)}),(${q(6)},${q(1)},${q(92)}),(${q(7)},${q(1)},NULL);`);
    await ok(await readFile(new URL('./migrations/0103_raum_details.sql', import.meta.url), 'utf8'));
    const migration = await readFile(new URL('./migrations/0104_raum_automatik.sql', import.meta.url), 'utf8');
    await ok(migration); await ok(migration);
    await ok(`UPDATE services SET raum_ausstattung=ARRAY['Liege'] WHERE id IN (${q(3)},${q(7)}); UPDATE services SET raum_ausstattung=ARRAY['Elektro'] WHERE id=${q(4)};`);

    await t.test('Ausstattung, Standort und Mandant filtern; inaktive Räume nie', async () => {
      await reset(); await ok(room(10, "ARRAY['Elektro']") + room(11, "ARRAY['Liege']", 1, q(92)) + room(12, "ARRAY['Liege']", 1, q(2), q(91)) + room(13) + room(14));
      await ok(`UPDATE rooms SET aktiv=false WHERE id=${q(13)};` + insert(20));
      assert.equal(await ok(`SELECT room_id,room_automatisch FROM bookings WHERE id=${q(20)};`), `${uuid(14)}|t`);
    });
    await t.test('Zwei parallele Buchungen letzter Platz: genau eine erfolgreich', async () => {
      await reset(); await ok(room());
      const first = sql(`BEGIN; ${insert(20)} SELECT pg_sleep(0.7); COMMIT;`);
      for (let i = 0; i < 100; i++) {
        if (await ok("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND granted;") !== '0') break;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      const results = await Promise.all([first, sql(insert(21))]);
      assert.equal(results[0].code, 0, results[0].err); assert.notEqual(results[1].code, 0); assert.match(results[1].err, /Kein freier Raum/);
      assert.equal(await ok('SELECT count(*) FROM bookings;'), '1');
    });
    await t.test('Kapazität2, angrenzende Intervalle, abgesagte Termine', async () => {
      await reset(); await ok(room(10, "ARRAY['Liege']", 2) + insert(20) + insert(21)); await reject(insert(22));
      await ok(`UPDATE bookings SET status='cancelled' WHERE id=${q(20)};` + insert(22));
      await ok(`UPDATE bookings SET start_time='2026-12-01T10:30Z',end_time='2026-12-01T11:00Z' WHERE id=${q(22)};`);
      assert.equal(await ok('SELECT count(*) FROM bookings WHERE room_id IS NOT NULL;'), '2');
    });
    await t.test('Fremder Mandant/Standort und Snapshot-Service werden abgewiesen', async () => {
      await reset(); await ok(room());
      for (const id of [5, 6]) await reject(insert(20).replace(q(3), q(id)), /Leistung gehört nicht/);
      await reject(insert(20, ',raum_service_ids', `,ARRAY[${q(5)}]::uuid[]`), /Leistung gehört nicht/);
    });
    await t.test('NULL-Standort passt nur zu NULL-Raum', async () => {
      await reset(); await ok(room(10) + room(11, "ARRAY['Liege']", 1, 'NULL'));
      await ok(insert(20).replace(q(2), 'NULL').replace(q(3), q(7)));
      assert.equal(await ok('SELECT room_id FROM bookings;'), uuid(11));
    });
    await t.test('Hausbesuch, online und no_show erhalten keinen Raum', async () => {
      await reset(); await ok(room() + insert(20, ',hausbesuch', ',true') + insert(21, ',status', ",'no_show'"));
      await ok(`UPDATE services SET is_online_meeting=true WHERE id=${q(3)};` + insert(22));
      assert.equal(await ok('SELECT count(*) FROM bookings WHERE room_id IS NOT NULL;'), '0');
      await ok(`UPDATE services SET is_online_meeting=false WHERE id=${q(3)};`);
    });
    await t.test('Gemischt online und vor Ort braucht weiterhin passende Ausstattung', async () => {
      await reset(); await ok(room(10, "ARRAY['Liege','Elektro']"));
      await ok(`UPDATE services SET is_online_meeting=true WHERE id=${q(4)};` + insert(20, ',raum_service_ids', `,ARRAY[${q(4)}]::uuid[]`));
      assert.equal(await ok('SELECT room_id FROM bookings;'), uuid(10));
      await ok(`UPDATE services SET is_online_meeting=false WHERE id=${q(4)};`);
    });
    await t.test('Ohne Räume legacy ohne Anforderungen; notwendige Ausstattung scheitert', async () => {
      await reset(); await reject(insert(20));
      await ok(`UPDATE services SET raum_ausstattung='{}' WHERE id=${q(3)};` + insert(20));
      assert.equal(await ok('SELECT room_id IS NULL FROM bookings;'), 't');
      await ok(`UPDATE services SET raum_ausstattung=ARRAY['Liege'] WHERE id=${q(3)};`);
    });
    await t.test('Gruppenchild erbt Raum und belegt keinen weiteren Platz', async () => {
      await reset(); await ok(room() + insert(20) + insert(21, ',group_parent_id', `,${q(20)}`));
      assert.equal(await ok('SELECT count(*) FROM bookings WHERE room_id IS NOT NULL;'), '2');
      await reject(insert(22));
      await reject(insert(23, ',group_parent_id,raum_service_ids', `,${q(20)},ARRAY[${q(5)}]::uuid[]`), /Leistung gehört nicht/);
    });
    await t.test('Manuelle Auswahl unverändert; automatische Wahl bei Zeitänderung neu geprüft', async () => {
      await reset(); await ok(room() + room(11) + insert(20) + insert(21));
      await ok(insert(22, ',room_id', `,${q(10)}`));
      assert.equal(await ok(`SELECT room_automatisch FROM bookings WHERE id=${q(22)};`), 'f');
      await ok(`UPDATE bookings SET start_time='2026-12-01T10:01Z' WHERE id=${q(21)};`);
      assert.equal(await ok(`SELECT room_id FROM bookings WHERE id=${q(21)};`), uuid(11));
      await ok(`UPDATE bookings SET room_automatisch=false,room_id=${q(11)} WHERE id=${q(21)};`);
      assert.equal(await ok(`SELECT room_automatisch FROM bookings WHERE id=${q(21)};`), 'f');
    });
    await t.test('Zusatzanforderungen vor erstem Insert verhindern Teilbuchung', async () => {
      await reset(); await ok(room());
      await reject(insert(20, ',raum_service_ids', `,ARRAY[${q(3)},${q(4)}]::uuid[]`));
      assert.equal(await ok('SELECT count(*) FROM bookings;'), '0');
      await ok(room(11, "ARRAY['Liege','Elektro']") + insert(20, ',raum_service_ids', `,ARRAY[${q(3)},${q(4)}]::uuid[]`));
      assert.equal(await ok('SELECT room_id FROM bookings;'), uuid(11));
    });
    await t.test('Nachträgliche Zusatzleistung prüft erneut und zieht Gruppenraum nach', async () => {
      await reset(); await ok(room() + room(11, "ARRAY['Liege','Elektro']") + insert(20) + insert(21, ',group_parent_id', `,${q(20)}`));
      await ok(`INSERT INTO booking_leistungen VALUES (${q(30)},${q(20)},${q(4)});`);
      assert.equal(await ok(`SELECT count(*) FROM bookings WHERE room_id=${q(11)};`), '2');
    });
    await t.test('Geplanter Leistungswechsel A nach B ignoriert entfernte alte Relation', async () => {
      await reset();
      await ok(`UPDATE services SET raum_ausstattung='{}' WHERE id=${q(3)};
        INSERT INTO services(id,owner_id,business_id,raum_ausstattung) VALUES (${q(8)},${q(1)},${q(2)},ARRAY['Liege']);`
        + room(10, "ARRAY['Elektro']") + room(11, "ARRAY['Liege']")
        + insert(20, ',raum_service_ids', `,ARRAY[${q(8)}]::uuid[]`));
      await ok(`INSERT INTO booking_leistungen VALUES (${q(30)},${q(20)},${q(8)});
        UPDATE bookings SET raum_service_ids=ARRAY[${q(4)}]::uuid[] WHERE id=${q(20)};`);
      assert.equal(await ok('SELECT room_id FROM bookings;'), uuid(10));
      await ok(`INSERT INTO booking_leistungen VALUES (${q(31)},${q(20)},${q(4)}); DELETE FROM booking_leistungen WHERE id=${q(30)};`);
      assert.equal(await ok('SELECT room_id FROM bookings;'), uuid(10));
      await ok(`UPDATE services SET raum_ausstattung=ARRAY['Liege'] WHERE id=${q(3)};`);
    });
    await t.test('Snapshot normalisiert Hauptleistung; Altclient-Hauptwechsel konserviert alte Hauptanforderung nicht', async () => {
      await reset(); await ok(room(10, "ARRAY['Liege']") + room(11, "ARRAY['Elektro']")
        + insert(20, ',raum_service_ids', `,ARRAY[${q(3)}]::uuid[]`));
      assert.equal(await ok('SELECT cardinality(raum_service_ids) FROM bookings;'), '0');
      await ok(`UPDATE bookings SET service_id=${q(4)} WHERE id=${q(20)};`);
      assert.equal(await ok('SELECT room_id FROM bookings;'), uuid(11));
    });
    await t.test('Snapshot NULL bleibt Altmodus; ungültige Arrays scheitern', async () => {
      await reset(); await ok(room() + insert(20));
      assert.equal(await ok('SELECT raum_service_ids IS NULL FROM bookings;'), 't');
      await reject(`UPDATE bookings SET raum_service_ids=ARRAY[NULL]::uuid[] WHERE id=${q(20)};`, /23514|Leistung gehört nicht/);
      await reject(`UPDATE bookings SET raum_service_ids=ARRAY(SELECT ${q(4)}::uuid FROM generate_series(1,31)) WHERE id=${q(20)};`, /23514|Kein freier Raum/);
      await reject(`UPDATE bookings SET raum_service_ids=ARRAY(SELECT ${q(3)}::uuid FROM generate_series(1,31)) WHERE id=${q(20)};`, /23514/);
    });
    await t.test('Funktionsrechte sind nicht öffentlich ausführbar', async () => {
      assert.equal(await ok("SELECT has_function_privilege('anon','public.booking_raum_automatisch()','execute'),has_function_privilege('authenticated','public.booking_raum_automatisch()','execute');"), 'f|f');
    });
    t.diagnostic('Minimalfixture, keine Live-Anwendung/volle Kette. Explizite manuelle Überbelegung bleibt möglich; geplante Zusatzleistungen müssen im Erstinsert als raum_service_ids vorliegen.');
  } finally { const cleanup = await command(['rm', '--force', name]); assert.equal(cleanup.code, 0, cleanup.err); }
});
