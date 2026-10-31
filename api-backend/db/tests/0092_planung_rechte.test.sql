-- 0092: Räume — Mandantengrenze, Rollen, Standort, Trigger.
-- Run only against disposable PostgreSQL after the complete migration chain.
-- Synthetic fixtures only; every data change rolls back.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'), ('11111111-1111-4111-8111-111111111112'),
  ('11111111-1111-4111-8111-111111111113'), ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.profiles(id,role) VALUES
  ('11111111-1111-4111-8111-111111111111','owner'), ('22222222-2222-4222-8222-222222222222','owner')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
INSERT INTO public.profiles(id,role,owner_id) VALUES
  ('11111111-1111-4111-8111-111111111112','employee','11111111-1111-4111-8111-111111111111'),
  ('11111111-1111-4111-8111-111111111113','employee','11111111-1111-4111-8111-111111111111')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, owner_id = EXCLUDED.owner_id;
INSERT INTO public.businesses(id,owner_id,business_name,is_default) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','QA Standort 1',true),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-4111-8111-111111111111','QA Standort 2',false),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','22222222-2222-4222-8222-222222222222','QA fremd',true);

CREATE FUNCTION pg_temp.als(id uuid) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claim.sub', id::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.als(uuid) TO authenticated, anon;

-- ── Räume: Inhaber schreibt, eigener Standort ──────────────────────────────
SET LOCAL ROLE authenticated;
SELECT pg_temp.als('11111111-1111-4111-8111-111111111111');
INSERT INTO public.rooms(id,owner_id,business_id,name) VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Raum 1'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','Raum 2');
DO $$ BEGIN
  INSERT INTO public.rooms(owner_id,business_id,name)
    VALUES ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','Fremder Standort');
  RAISE EXCEPTION 'Raum an fremdem Standort erlaubt';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN
  INSERT INTO public.rooms(owner_id,business_id,name)
    VALUES ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','RAUM 1');
  RAISE EXCEPTION 'Doppelter Name erlaubt';
EXCEPTION WHEN unique_violation THEN NULL; END $$;
INSERT INTO public.rooms(id,owner_id,name) VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3','11111111-1111-4111-8111-111111111111','Ohne Standortangabe');
DO $$ BEGIN
  IF (SELECT business_id FROM public.rooms WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc3')
     IS DISTINCT FROM 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' THEN RAISE EXCEPTION 'Default-Standort nicht gesetzt'; END IF;
END $$;

-- ── Räume: Mitarbeiter liest, schreibt nicht ───────────────────────────────
SELECT pg_temp.als('11111111-1111-4111-8111-111111111112');
DO $$ DECLARE n int; BEGIN
  IF (SELECT count(*) FROM public.rooms) <> 3 THEN RAISE EXCEPTION 'Mitarbeiter sieht Räume nicht'; END IF;
  UPDATE public.rooms SET name='Gekapert' WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'Mitarbeiter ändert Raum'; END IF;
  BEGIN
    INSERT INTO public.rooms(owner_id,name) VALUES ('11111111-1111-4111-8111-111111111111','Mitarbeiterraum');
    RAISE EXCEPTION 'Mitarbeiter legt Raum an';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- ── Räume: fremder Mandant und anon sehen nichts ───────────────────────────
SELECT pg_temp.als('22222222-2222-4222-8222-222222222222');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.rooms) <> 0 THEN RAISE EXCEPTION 'Fremder Mandant sieht Räume'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  PERFORM 1 FROM public.rooms;
  RAISE EXCEPTION 'anon liest rooms';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
RESET ROLE;

-- ── Termin mit Raum: Trigger ───────────────────────────────────────────────
INSERT INTO public.rooms(id,owner_id,business_id,name) VALUES
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1','22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','Fremdraum');
INSERT INTO public.bookings(id,user_id,owner_id,business_id,customer_name,start_time,end_time,status) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','11111111-1111-4111-8111-111111111112','11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','QA','2026-12-01T09:00:00Z','2026-12-01T09:30:00Z','confirmed');
UPDATE public.bookings SET room_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1' WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
DO $$ BEGIN
  UPDATE public.bookings SET room_id='dddddddd-dddd-4ddd-8ddd-ddddddddddd1' WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
  RAISE EXCEPTION 'Fremder Raum erlaubt';
EXCEPTION WHEN check_violation THEN NULL; END $$;
DO $$ BEGIN
  UPDATE public.bookings SET room_id='cccccccc-cccc-4ccc-8ccc-ccccccccccc2' WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
  RAISE EXCEPTION 'Raum eines anderen Standorts erlaubt';
EXCEPTION WHEN check_violation THEN NULL; END $$;
DO $$ BEGIN
  UPDATE public.bookings SET owner_id='22222222-2222-4222-8222-222222222222' WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
  RAISE EXCEPTION 'Mandantenwechsel mit Raum erlaubt';
EXCEPTION WHEN check_violation THEN NULL; END $$;
DO $$ BEGIN
  INSERT INTO public.bookings(user_id,owner_id,customer_name,start_time,end_time,status,room_id) VALUES
    ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','QA',
     '2026-12-01T10:00:00Z','2026-12-01T10:30:00Z','confirmed','dddddddd-dddd-4ddd-8ddd-ddddddddddd1');
  RAISE EXCEPTION 'Anlegen mit fremdem Raum erlaubt';
EXCEPTION WHEN check_violation THEN NULL; END $$;
-- Default-Standort kommt vor der Prüfung: Reihenfolge der Trigger.
INSERT INTO public.bookings(id,user_id,owner_id,customer_name,start_time,end_time,status,room_id) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','QA',
   '2026-12-01T11:00:00Z','2026-12-01T11:30:00Z','confirmed','cccccccc-cccc-4ccc-8ccc-ccccccccccc1');
-- Statusänderung erhält den Raum, Raumlöschung leert ihn.
UPDATE public.bookings SET status='cancelled' WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
DO $$ BEGIN
  IF (SELECT room_id FROM public.bookings WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1')
     IS DISTINCT FROM 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1' THEN RAISE EXCEPTION 'Status änderte den Raum'; END IF;
END $$;
DELETE FROM public.rooms WHERE id='cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
DO $$ BEGIN
  IF (SELECT room_id FROM public.bookings WHERE id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2') IS NOT NULL
    THEN RAISE EXCEPTION 'Raumlöschung ließ room_id stehen'; END IF;
END $$;

RESET ROLE;
SELECT 'ALLE PLANUNGSRECHTE GRUEN' AS ergebnis;
ROLLBACK;
