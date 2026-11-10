-- 0116 (S-64): selbststaendiger Logiktest mit Minimal-Stubs (auth, profiles, businesses, custom_days) — laeuft auf LEERER Wegwerf-DB.
-- Lauf: psql -v ON_ERROR_STOP=1 -f 0116_custom_days_team_read_logic.test.sql  (im Ordner api-backend/db/tests ausfuehren; Migration wird per \ir ../migrations/ eingebunden).
-- Enthaelt am Ende eine Simulation von 0117 (DROP der offenen Policy) und prueft anon=0 Rohzeilen, Team nur eigene Zeilen.
\set ON_ERROR_STOP on
-- minimale Stubs (isolierter Test der Logik, keine Vollkette)
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.uid',true),'')::uuid $$;
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, owner_id uuid);
CREATE TABLE public.businesses(id uuid DEFAULT gen_random_uuid(), owner_id uuid, booking_slug text);
CREATE TABLE public.custom_days(id uuid DEFAULT gen_random_uuid(), owner_id uuid, date date NOT NULL, type text NOT NULL, note text, start_time time, end_time time, business_id uuid);
CREATE FUNCTION public.auth_tenant_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT COALESCE(p.owner_id,p.id) FROM profiles p WHERE p.id = auth.uid() $$;
GRANT EXECUTE ON FUNCTION public.auth_tenant_id() TO authenticated;
ALTER TABLE public.custom_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY custom_days_owner_all ON public.custom_days FOR ALL TO PUBLIC USING (auth.uid()=owner_id) WITH CHECK (auth.uid()=owner_id);
CREATE POLICY custom_days_public_read ON public.custom_days FOR SELECT TO PUBLIC USING (true);
GRANT SELECT,INSERT ON public.custom_days, public.businesses, public.profiles TO anon, authenticated;
INSERT INTO auth.users VALUES ('a0000000-0000-4000-8000-000000000001'),('b0000000-0000-4000-8000-000000000002'),('c0000000-0000-4000-8000-000000000003');
INSERT INTO public.profiles VALUES ('a0000000-0000-4000-8000-000000000001',NULL),('b0000000-0000-4000-8000-000000000002',NULL),('c0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001');
INSERT INTO public.businesses(owner_id,booking_slug) VALUES ('a0000000-0000-4000-8000-000000000001','praxis-a');
INSERT INTO public.custom_days(owner_id,date,type,note) VALUES
 ('a0000000-0000-4000-8000-000000000001','2026-12-10','closed','Krankheit Frau X'),
 ('b0000000-0000-4000-8000-000000000002','2026-12-10','closed','Geheim B');
\ir ../migrations/0116_custom_days_team_read.sql
-- Policies nach 0116 (noch OHNE 0117): Team-Policy existiert
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='custom_days_team_read') THEN RAISE EXCEPTION 'Team-Policy fehlt'; END IF; END $$;
-- Funktion: anon sieht Praxis A ohne note, Praxis B (ohne slug) nichts, Bereich >92 Tage nichts
SET ROLE anon;
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.public_sondertage('a0000000-0000-4000-8000-000000000001','2026-12-01','2026-12-31');
  IF n<>1 THEN RAISE EXCEPTION 'A: erwartet 1, war %',n; END IF;
  SELECT count(*) INTO n FROM public.public_sondertage('b0000000-0000-4000-8000-000000000002','2026-12-01','2026-12-31');
  IF n<>0 THEN RAISE EXCEPTION 'B ohne Slug muss leer sein, war %',n; END IF;
  SELECT count(*) INTO n FROM public.public_sondertage('a0000000-0000-4000-8000-000000000001','2026-01-01','2026-12-31');
  IF n<>0 THEN RAISE EXCEPTION '>92 Tage muss leer sein, war %',n; END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_name='public_sondertage')<>0 THEN NULL; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN IF has_function_privilege('anon','public.public_sondertage(uuid,date,date)','EXECUTE') IS NOT TRUE THEN RAISE EXCEPTION 'anon braucht EXECUTE'; END IF; END $$;
-- Rueckgabespalten enthalten kein note
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_proc p, unnest(p.proargnames) a WHERE p.proname='public_sondertage' AND a='note') THEN RAISE EXCEPTION 'note darf nicht zurueckkommen'; END IF; END $$;
-- Nach 0117-Simulation: offene Policy weg → anon sieht keine Rohzeilen, Team sieht eigene, fremde nicht
DROP POLICY custom_days_public_read ON public.custom_days;
SET ROLE anon; DO $$ BEGIN IF (SELECT count(*) FROM public.custom_days)<>0 THEN RAISE EXCEPTION 'anon darf keine Rohzeilen lesen'; END IF; END $$; RESET ROLE;
SET ROLE authenticated; SET request.uid='c0000000-0000-4000-8000-000000000003';
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.custom_days; IF n<>1 THEN RAISE EXCEPTION 'Mitarbeiter sieht 1 (Inhaber), war %',n; END IF;
  IF EXISTS (SELECT 1 FROM public.custom_days WHERE owner_id='b0000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'fremde Praxis sichtbar'; END IF;
END $$;
RESET ROLE;
\echo OK 0116 logic PASS
