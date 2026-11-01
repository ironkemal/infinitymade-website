-- 0097: employee_standort_plan — Mandantengrenze, Rollen, Eindeutigkeit, kein anon.
-- Run only against disposable PostgreSQL after the complete migration chain.
-- Synthetic fixtures only; every data change rolls back.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'), ('11111111-1111-4111-8111-111111111112'),
  ('11111111-1111-4111-8111-111111111113'), ('22222222-2222-4222-8222-222222222222'),
  ('22222222-2222-4222-8222-222222222223');
INSERT INTO public.profiles(id,role) VALUES
  ('11111111-1111-4111-8111-111111111111','owner'), ('22222222-2222-4222-8222-222222222222','owner')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
INSERT INTO public.profiles(id,role,owner_id) VALUES
  ('11111111-1111-4111-8111-111111111112','employee','11111111-1111-4111-8111-111111111111'),
  ('11111111-1111-4111-8111-111111111113','employee','11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222223','employee','22222222-2222-4222-8222-222222222222')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, owner_id = EXCLUDED.owner_id;
INSERT INTO public.businesses(id,owner_id,business_name,is_default) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','QA Standort 1',true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-4111-8111-111111111111','QA Standort 2',false),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','22222222-2222-4222-8222-222222222222','QA fremd',true);

CREATE FUNCTION pg_temp.als(id uuid) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claim.sub', id::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.als(uuid) TO authenticated, anon;

-- ── anon: kein Tabellenrecht ────────────────────────────────────────────────
DO $$ BEGIN
  IF has_table_privilege('anon','public.employee_standort_plan','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN
    RAISE EXCEPTION 'anon hat Rechte auf employee_standort_plan';
  END IF;
  IF has_table_privilege('authenticated','public.employee_standort_plan','TRUNCATE') THEN
    RAISE EXCEPTION 'authenticated darf TRUNCATE';
  END IF;
END $$;

-- ── Inhaber schreibt: Wochenmuster, Einzeltag, zwei Standorte am selben Tag ─
SET LOCAL ROLE authenticated;
SELECT pg_temp.als('11111111-1111-4111-8111-111111111111');
INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday,datum) VALUES
  ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1,NULL),
  ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',1,NULL),
  ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',NULL,'2026-11-09'),
  ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111113','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',2,NULL),
  ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',3,NULL);

-- Upsert-Ziel fuer PostgREST onConflict
INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday)
  VALUES ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1)
  ON CONFLICT (employee_id, business_id, weekday, datum) DO UPDATE SET updated_at = now();

DO $$ BEGIN
  INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday)
    VALUES ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1);
  RAISE EXCEPTION 'Doppeltes Wochenmuster erlaubt';
EXCEPTION WHEN unique_violation THEN NULL; END $$;
DO $$ BEGIN
  INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,datum)
    VALUES ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','2026-11-09');
  RAISE EXCEPTION 'Doppelter Einzeltag erlaubt';
EXCEPTION WHEN unique_violation THEN NULL; END $$;
DO $$ BEGIN
  INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday,datum)
    VALUES ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',4,'2026-11-12');
  RAISE EXCEPTION 'weekday und datum zugleich erlaubt';
EXCEPTION WHEN check_violation THEN NULL; END $$;
DO $$ BEGIN
  INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id)
    VALUES ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
  RAISE EXCEPTION 'weder weekday noch datum erlaubt';
EXCEPTION WHEN check_violation THEN NULL; END $$;
DO $$ BEGIN
  INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday)
    VALUES ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',7);
  RAISE EXCEPTION 'weekday 7 erlaubt';
EXCEPTION WHEN check_violation THEN NULL; END $$;

-- Mandantengrenze: fremder Standort, fremder Mitarbeiter, fremder owner_id
DO $$ BEGIN
  INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday)
    VALUES ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',5);
  RAISE EXCEPTION 'fremder Standort erlaubt';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN
  INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday)
    VALUES ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222223','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',5);
  RAISE EXCEPTION 'fremder Mitarbeiter erlaubt';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN
  INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday)
    VALUES ('22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222223','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',5);
  RAISE EXCEPTION 'fremder owner_id erlaubt';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN
  UPDATE public.employee_standort_plan SET business_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
    WHERE employee_id = '11111111-1111-4111-8111-111111111113';
  RAISE EXCEPTION 'Umhaengen auf fremden Standort erlaubt';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN
  UPDATE public.employee_standort_plan SET employee_id = '22222222-2222-4222-8222-222222222223'
    WHERE employee_id = '11111111-1111-4111-8111-111111111113';
  RAISE EXCEPTION 'Umhaengen auf fremden Mitarbeiter erlaubt';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN
  UPDATE public.employee_standort_plan SET owner_id = '22222222-2222-4222-8222-222222222222'
    WHERE employee_id = '11111111-1111-4111-8111-111111111113';
  RAISE EXCEPTION 'Umhaengen auf fremden owner_id erlaubt';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- updated_at-Trigger
DO $$ DECLARE vorher timestamptz; nachher timestamptz; BEGIN
  SELECT updated_at INTO vorher FROM public.employee_standort_plan
    WHERE employee_id = '11111111-1111-4111-8111-111111111113';
  PERFORM pg_sleep(0.01);
  UPDATE public.employee_standort_plan SET weekday = 4 WHERE employee_id = '11111111-1111-4111-8111-111111111113';
  SELECT updated_at INTO nachher FROM public.employee_standort_plan
    WHERE employee_id = '11111111-1111-4111-8111-111111111113';
  -- now() ist in einer Transaktion konstant; geprueft wird, dass der Trigger feuert und nicht kaputt ist.
  IF nachher IS NULL OR nachher < vorher THEN RAISE EXCEPTION 'updated_at kaputt'; END IF;
END $$;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.employee_standort_plan) <> 5 THEN
    RAISE EXCEPTION 'Inhaber sieht nicht alle 5 eigenen Zeilen';
  END IF;
END $$;

-- ── Mitarbeiter: liest nur eigene Zeilen, schreibt nie ──────────────────────
SELECT pg_temp.als('11111111-1111-4111-8111-111111111112');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.employee_standort_plan) <> 3 THEN
    RAISE EXCEPTION 'Mitarbeiter sieht nicht genau seine 3 Zeilen';
  END IF;
  IF EXISTS (SELECT 1 FROM public.employee_standort_plan
             WHERE employee_id <> '11111111-1111-4111-8111-111111111112') THEN
    RAISE EXCEPTION 'Mitarbeiter sieht Zeilen von Kollegen';
  END IF;
END $$;
DO $$ BEGIN
  INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday)
    VALUES ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111112','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',6);
  RAISE EXCEPTION 'Mitarbeiter darf schreiben';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ DECLARE n int; BEGIN
  UPDATE public.employee_standort_plan SET weekday = 0 WHERE weekday = 1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Mitarbeiter darf aendern'; END IF;
  DELETE FROM public.employee_standort_plan;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Mitarbeiter darf loeschen'; END IF;
END $$;

-- ── Fremder Inhaber und fremder Mitarbeiter sehen nichts ───────────────────
SELECT pg_temp.als('22222222-2222-4222-8222-222222222222');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.employee_standort_plan) THEN RAISE EXCEPTION 'fremder Inhaber sieht Zeilen'; END IF;
END $$;
DO $$ DECLARE n int; BEGIN
  UPDATE public.employee_standort_plan SET weekday = 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'fremder Inhaber darf aendern'; END IF;
  DELETE FROM public.employee_standort_plan;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'fremder Inhaber darf loeschen'; END IF;
END $$;
-- ON CONFLICT als fremder Inhaber: WITH CHECK greift vor dem Konflikt (fremder Mitarbeiter/Standort)
DO $$ BEGIN
  INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday)
    VALUES ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111112','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1)
    ON CONFLICT (employee_id, business_id, weekday, datum) DO UPDATE SET updated_at = now();
  RAISE EXCEPTION 'fremder Inhaber darf per ON CONFLICT schreiben';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
SELECT pg_temp.als('22222222-2222-4222-8222-222222222223');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.employee_standort_plan) THEN RAISE EXCEPTION 'fremder Mitarbeiter sieht Zeilen'; END IF;
END $$;

-- ── anon liest nichts ───────────────────────────────────────────────────────
SET LOCAL ROLE anon;
DO $$ BEGIN
  PERFORM 1 FROM public.employee_standort_plan;
  RAISE EXCEPTION 'anon darf lesen';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;

-- ── CASCADE: Standort weg = Planzeilen weg ──────────────────────────────────
RESET ROLE;
DELETE FROM public.businesses WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.employee_standort_plan
             WHERE business_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2') THEN
    RAISE EXCEPTION 'CASCADE auf businesses greift nicht';
  END IF;
END $$;

SELECT '0097 employee_standort_plan: OK' AS ergebnis;
ROLLBACK;
