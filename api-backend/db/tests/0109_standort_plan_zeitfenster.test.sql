-- 0109: Zeitfenster am Standortplan — Form, Bestand, Rechte unverändert.
-- Run only against disposable PostgreSQL after the complete migration chain. Synthetic fixtures, rollback.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id) VALUES ('81111111-1111-4111-8111-111111111111'), ('81111111-1111-4111-8111-111111111112');
INSERT INTO public.profiles(id,role) VALUES ('81111111-1111-4111-8111-111111111111','owner') ON CONFLICT (id) DO UPDATE SET role='owner';
INSERT INTO public.profiles(id,role,owner_id) VALUES ('81111111-1111-4111-8111-111111111112','employee','81111111-1111-4111-8111-111111111111')
  ON CONFLICT (id) DO UPDATE SET role='employee', owner_id=EXCLUDED.owner_id;
INSERT INTO public.businesses(id,owner_id,business_name,is_default) VALUES
  ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','81111111-1111-4111-8111-111111111111','QA A',true),
  ('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','81111111-1111-4111-8111-111111111111','QA B',false);

CREATE FUNCTION pg_temp.als(id uuid) RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', id::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.als(uuid) TO authenticated;
SET LOCAL ROLE authenticated;
SELECT pg_temp.als('81111111-1111-4111-8111-111111111111');

-- Inhaber: Mo vormittags A, nachmittags B; Di ganztags A (Bestand ohne Fenster)
INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday,von,bis) VALUES
  ('81111111-1111-4111-8111-111111111111','81111111-1111-4111-8111-111111111112','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1,'08:00','12:00'),
  ('81111111-1111-4111-8111-111111111111','81111111-1111-4111-8111-111111111112','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',1,'14:00','18:00');
INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday) VALUES
  ('81111111-1111-4111-8111-111111111111','81111111-1111-4111-8111-111111111112','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',2);

-- Fenster ändern per UPDATE (die Oberfläche macht das so, Insert würde an UNIQUE scheitern)
UPDATE public.employee_standort_plan SET von='07:30', bis='12:30'
 WHERE employee_id='81111111-1111-4111-8111-111111111112' AND weekday=1 AND business_id='8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

DO $$ BEGIN
  INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday,von)
    VALUES ('81111111-1111-4111-8111-111111111111','81111111-1111-4111-8111-111111111112','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',3,'08:00');
  RAISE EXCEPTION 'Fenster nur mit Beginn erlaubt';
EXCEPTION WHEN check_violation THEN NULL; END $$;
DO $$ BEGIN
  INSERT INTO public.employee_standort_plan(owner_id,employee_id,business_id,weekday,von,bis)
    VALUES ('81111111-1111-4111-8111-111111111111','81111111-1111-4111-8111-111111111112','8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',3,'12:00','08:00');
  RAISE EXCEPTION 'Fenster rückwärts erlaubt';
EXCEPTION WHEN check_violation THEN NULL; END $$;

-- Mitarbeiterin liest eigene Zeilen samt Fenster, schreibt nichts
SELECT pg_temp.als('81111111-1111-4111-8111-111111111112');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.employee_standort_plan WHERE von IS NOT NULL) <> 2 THEN RAISE EXCEPTION 'Mitarbeiterin sieht ihre Fenster nicht'; END IF;
  UPDATE public.employee_standort_plan SET von='06:00' WHERE weekday=1;
  IF FOUND THEN RAISE EXCEPTION 'Mitarbeiterin konnte ihr Fenster ändern'; END IF;
END $$;
RESET ROLE;
\echo '0109 standort_plan_zeitfenster: ok'
ROLLBACK;
