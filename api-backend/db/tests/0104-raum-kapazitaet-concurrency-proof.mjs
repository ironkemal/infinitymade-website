// Lokaler Nachweis für 0104_raum_automatik.sql (gleichzeitige Buchung auf letzter Raumkapazität).
// Nicht Teil der Standard-Testsuite; läuft gegen frisches lokales postgres:17.11 (--network none).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from '../../node_modules/pg/esm/index.mjs';
import { raumBuchungsFehler } from '../../lib/raum-automatik.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const MIG_0103 = readFileSync(resolve(DIR, '../migrations/0103_raum_details.sql'), 'utf8');
const MIG_0104 = readFileSync(resolve(DIR, '../migrations/0104_raum_automatik.sql'), 'utf8');

const MINIMAL_SCHEMA = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  business_id uuid,
  name text NOT NULL,
  plaetze integer NOT NULL DEFAULT 1,
  aktiv boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  user_id uuid,
  business_id uuid,
  title text NOT NULL,
  is_online_meeting boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  business_id uuid,
  service_id uuid,
  room_id uuid REFERENCES public.rooms(id),
  group_parent_id uuid REFERENCES public.bookings(id),
  hausbesuch boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'confirmed',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.booking_leistungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id)
);
`;

/** @param {any} config */
export async function proveConcurrentRoomCapacity(config) {
  const a = new pg.Client(config);
  const b = new pg.Client(config);
  await a.connect();
  await b.connect();

  const owner = randomUUID();
  const biz = randomUUID();
  const therA = randomUUID();
  const therB = randomUUID();
  const therC = randomUUID();
  const srvEinzel = randomUUID();
  const srvFango = randomUUID();
  const raumEinzel = randomUUID();
  const raumFango = randomUUID();

  try {
    await a.query(MINIMAL_SCHEMA);
    await a.query(MIG_0103);
    await a.query(MIG_0104);

    await a.query(
      "INSERT INTO public.rooms (id, owner_id, business_id, name, plaetze, aktiv, sort, ausstattung) VALUES ($1,$2,$3,'Raum 1',1,true,1,'{Liege}'), ($4,$2,$3,'Wärmekabine',2,true,2,'{Fango}')",
      [raumEinzel, owner, biz, raumFango],
    );
    await a.query(
      "INSERT INTO public.services (id, owner_id, user_id, business_id, title, raum_ausstattung) VALUES ($1,$2,$2,$3,'KG','{Liege}'), ($4,$2,$2,$3,'Fango','{Fango}')",
      [srvEinzel, owner, biz, srvFango],
    );

    const insertSql =
      "INSERT INTO public.bookings (owner_id, user_id, business_id, service_id, room_id, status, start_time, end_time) VALUES ($1,$2,$3,$4,NULL,'confirmed',$5,$6) RETURNING id, room_id, room_automatisch";
    const start1 = '2026-12-10T09:00:00Z';
    const end1 = '2026-12-10T09:30:00Z';

    // 1. Einzelplatz (plaetze = 1): paralleler Zugriff auf letzten Platz → A gewinnt, B blockiert und erhält P0001
    await a.query('BEGIN');
    const rA1 = await a.query(insertSql, [owner, therA, biz, srvEinzel, start1, end1]);
    assert.equal(rA1.rows[0].room_id, raumEinzel);
    assert.equal(rA1.rows[0].room_automatisch, true);

    let b1Fertig = false;
    const pB1 = b.query(insertSql, [owner, therB, biz, srvEinzel, start1, end1])
      .then(() => ({ ok: true, error: null }), error => ({ ok: false, error }))
      .finally(() => { b1Fertig = true; });
    await new Promise(r => setTimeout(r, 120));
    assert.equal(b1Fertig, false, 'Zweite Buchung muss am Standort-Advisory-Lock warten');

    await a.query('COMMIT');
    const resB1 = await pB1;
    assert.equal(resB1.ok, false, 'Zweite Buchung auf vollem 1-Platz-Raum muss abgelehnt werden');
    assert.equal(resB1.error.code, 'P0001');
    assert.match(String(raumBuchungsFehler(resB1.error)), /Kein freier Raum/);
    assert.equal(
      (await a.query('SELECT count(*)::int n FROM public.bookings WHERE room_id = $1', [raumEinzel])).rows[0].n,
      1,
    );

    // 2. Mehrplatz (plaetze = 2): 1 Platz belegt, 2 parallele Buchungen auf den 2. (letzten) Platz
    const start2 = '2026-12-10T10:00:00Z';
    const end2 = '2026-12-10T10:30:00Z';
    await a.query(insertSql, [owner, therC, biz, srvFango, start2, end2]);

    await a.query('BEGIN');
    const rA2 = await a.query(insertSql, [owner, therA, biz, srvFango, start2, end2]);
    assert.equal(rA2.rows[0].room_id, raumFango);
    assert.equal(rA2.rows[0].room_automatisch, true);

    let b2Fertig = false;
    const pB2 = b.query(insertSql, [owner, therB, biz, srvFango, start2, end2])
      .then(() => ({ ok: true, error: null }), error => ({ ok: false, error }))
      .finally(() => { b2Fertig = true; });
    await new Promise(r => setTimeout(r, 120));
    assert.equal(b2Fertig, false, 'Dritte Buchung auf 2-Platz-Raum muss warten');

    await a.query('COMMIT');
    const resB2 = await pB2;
    assert.equal(resB2.ok, false, 'Dritte Buchung auf 2-Platz-Raum muss abgelehnt werden');
    assert.equal(resB2.error.code, 'P0001');
    assert.equal(
      (await a.query('SELECT count(*)::int n FROM public.bookings WHERE room_id = $1', [raumFango])).rows[0].n,
      2,
    );

    // 3. Gegenprobe Rollback: wenn A zurückrollt, erhält B den letzten Platz sauber
    const start3 = '2026-12-10T11:00:00Z';
    const end3 = '2026-12-10T11:30:00Z';
    await a.query('BEGIN');
    await a.query(insertSql, [owner, therA, biz, srvEinzel, start3, end3]);

    let b3Fertig = false;
    const pB3 = b.query(insertSql, [owner, therB, biz, srvEinzel, start3, end3])
      .finally(() => { b3Fertig = true; });
    await new Promise(r => setTimeout(r, 120));
    assert.equal(b3Fertig, false, 'Wartende Buchung blockiert bis Rollback');

    await a.query('ROLLBACK');
    const rB3 = await pB3;
    assert.equal(rB3.rows[0].room_id, raumEinzel);
    assert.equal(rB3.rows[0].room_automatisch, true);

    console.log('PASS 0104_raum_automatik Concurrency: 1-Platz (1 OK / 1 P0001), 2-Platz (2 OK / 1 P0001), Rollback-Übernahme OK, raumBuchungsFehler -> 409');
  } finally {
    await a.query('ROLLBACK').catch(() => {});
    await b.query('ROLLBACK').catch(() => {});
    await Promise.all([a.end(), b.end()]);
  }
}

if (process.argv.includes('--run-disposable')) {
  assert.equal(process.env.PGHOST, '127.0.0.1', 'Nachweis benötigt lokales PostgreSQL');
  assert.equal(process.env.PRAXURA_DISPOSABLE_PROOF, 'yes', 'Explizite Freigabe für Wegwerf-DB fehlt');
  await proveConcurrentRoomCapacity({
    host: '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'postgres',
  });
}
