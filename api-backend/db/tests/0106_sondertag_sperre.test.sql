-- 0106: Sondertag sperrt neue Termine auf jedem Weg; bestehende bleiben bearbeit- und absagbar.
-- Run only against disposable PostgreSQL after the complete migration chain.
-- Synthetic fixtures only; every data change rolls back.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id) VALUES
  ('61111111-1111-4111-8111-111111111111'), ('61111111-1111-4111-8111-111111111112'),
  ('62222222-2222-4222-8222-222222222222');
INSERT INTO public.profiles(id,role) VALUES
  ('61111111-1111-4111-8111-111111111111','owner'), ('62222222-2222-4222-8222-222222222222','owner')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
INSERT INTO public.profiles(id,role,owner_id) VALUES
  ('61111111-1111-4111-8111-111111111112','employee','61111111-1111-4111-8111-111111111111')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, owner_id = EXCLUDED.owner_id;

-- Bestehender Termin am 10.12., BEVOR der Tag geschlossen wird
INSERT INTO public.bookings(id,user_id,owner_id,start_time,end_time,customer_name,status) VALUES
  ('6bbbbbbb-0000-4000-8000-000000000001','61111111-1111-4111-8111-111111111112','61111111-1111-4111-8111-111111111111',
   '2026-12-10 09:00+01','2026-12-10 09:20+01','QA Bestand','confirmed');

INSERT INTO public.custom_days(owner_id,date,type) VALUES
  ('61111111-1111-4111-8111-111111111111','2026-12-10','closed'),
  ('61111111-1111-4111-8111-111111111111','2026-12-24','holiday');
INSERT INTO public.custom_days(owner_id,date,type,start_time,end_time) VALUES
  ('61111111-1111-4111-8111-111111111111','2026-12-11','closed','08:00','12:00');

-- 1. Neuer Termin am geschlossenen Tag: gesperrt (service_role-Weg = Superuser hier)
DO $$ BEGIN
  INSERT INTO public.bookings(user_id,owner_id,start_time,end_time,customer_name)
    VALUES ('61111111-1111-4111-8111-111111111112','61111111-1111-4111-8111-111111111111','2026-12-10 14:00+01','2026-12-10 14:20+01','QA neu');
  RAISE EXCEPTION 'Termin am Sondertag angelegt';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Praxis geschlossen (Sondertag)%' THEN RAISE; END IF;
END $$;

-- 2. Feiertag ebenso
DO $$ BEGIN
  INSERT INTO public.bookings(user_id,owner_id,start_time,customer_name)
    VALUES ('61111111-1111-4111-8111-111111111112','61111111-1111-4111-8111-111111111111','2026-12-24 10:00+01','QA neu');
  RAISE EXCEPTION 'Termin am Feiertag angelegt';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Praxis geschlossen (Sondertag)%' THEN RAISE; END IF;
END $$;

-- 3. Berlin-Tag zählt: 23:30 UTC am 09.12. = 00:30 Berlin am 10.12. → gesperrt
DO $$ BEGIN
  INSERT INTO public.bookings(user_id,owner_id,start_time,customer_name)
    VALUES ('61111111-1111-4111-8111-111111111112','61111111-1111-4111-8111-111111111111','2026-12-09 23:30+00','QA neu');
  RAISE EXCEPTION 'Berlin-Tag nicht erkannt';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Praxis geschlossen (Sondertag)%' THEN RAISE; END IF;
END $$;

-- 4. Sonderöffnung (mit Zeiten) sperrt nicht; Vortag frei; fremder Mandant unberührt
INSERT INTO public.bookings(user_id,owner_id,start_time,end_time,customer_name) VALUES
  ('61111111-1111-4111-8111-111111111112','61111111-1111-4111-8111-111111111111','2026-12-11 09:00+01','2026-12-11 09:20+01','QA Sonderzeit'),
  ('61111111-1111-4111-8111-111111111112','61111111-1111-4111-8111-111111111111','2026-12-09 22:30+00','2026-12-09 22:50+00','QA Vortag'),
  ('62222222-2222-4222-8222-222222222222','62222222-2222-4222-8222-222222222222','2026-12-10 09:00+01','2026-12-10 09:20+01','QA fremd');

-- 5. Bestand: Notiz ändern (start_time unverändert im SET) und absagen geht
UPDATE public.bookings SET notes = 'geändert', start_time = start_time WHERE id = '6bbbbbbb-0000-4000-8000-000000000001';
UPDATE public.bookings SET status = 'cancelled' WHERE id = '6bbbbbbb-0000-4000-8000-000000000001';

-- 6. Verschieben AUF den Sondertag: gesperrt
DO $$ BEGIN
  UPDATE public.bookings SET start_time = '2026-12-24 11:00+01', end_time = '2026-12-24 11:20+01', status = 'confirmed'
   WHERE customer_name = 'QA Vortag';
  RAISE EXCEPTION 'Verschieben auf Sondertag erlaubt';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Praxis geschlossen (Sondertag)%' THEN RAISE; END IF;
END $$;

-- 7. Als angemeldete Mitarbeiterin (Browser-Weg, RLS aktiv): ebenso gesperrt
CREATE FUNCTION pg_temp.als(id uuid) RETURNS void LANGUAGE sql AS
  $$ SELECT set_config('request.jwt.claim.sub', id::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.als(uuid) TO authenticated;
SET LOCAL ROLE authenticated;
SELECT pg_temp.als('61111111-1111-4111-8111-111111111112');
DO $$ BEGIN
  INSERT INTO public.bookings(user_id,owner_id,start_time,customer_name)
    VALUES ('61111111-1111-4111-8111-111111111112','61111111-1111-4111-8111-111111111111','2026-12-10 15:00+01','QA Browser');
  RAISE EXCEPTION 'Browser-Weg umgeht Sondertag';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Praxis geschlossen (Sondertag)%' THEN RAISE; END IF;
END $$;
RESET ROLE;

\echo '0106 sondertag_sperre: ok'
ROLLBACK;
