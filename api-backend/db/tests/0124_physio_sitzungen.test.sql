-- Nur in einer leeren lokalen Testdatenbank mit psql -f ausführen.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE public.prescriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), therapie_bereich text DEFAULT 'physio', status text, abrechnung_status text, abrechnung_id uuid, belegnummer text, heilmittel_items jsonb, anzahl_einheiten integer, doppelbehandlung boolean, behandlungsbeginn date);
CREATE TABLE public.bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text);
CREATE TABLE public.prescription_sessions(prescription_id uuid REFERENCES public.prescriptions, session_number integer, heilmittel_index integer, status text DEFAULT 'planned', booking_id uuid REFERENCES public.bookings, done_at timestamptz, UNIQUE(prescription_id,session_number));
-- Altbestand vor der Migration
INSERT INTO public.prescriptions(status,anzahl_einheiten) VALUES ('confirmed',4),('billed',8),('parsed',2);
\ir ../migrations/0124_physio_sitzungen.sql
\ir ../physio-sitzungen-nachziehen.sql
\ir ../physio-sitzungen-nachziehen.sql
DO $$
DECLARE
  rx uuid;
  termin uuid;
BEGIN
  IF (SELECT count(*) FROM public.prescription_sessions) <> 4 THEN RAISE EXCEPTION 'Chrome1911 Backfill'; END IF;
  INSERT INTO public.prescriptions(status,heilmittel_items) VALUES ('parsed','[{"code":"KG","einheiten":4},{"code":"MT","einheiten":4,"doppelbehandlung":true}]') RETURNING id INTO rx;
  IF EXISTS (SELECT FROM public.prescription_sessions WHERE prescription_id=rx) THEN RAISE EXCEPTION 'Chrome1911 Entwurf'; END IF;
  UPDATE public.prescriptions SET status='confirmed' WHERE id=rx;
  IF (SELECT array_agg(heilmittel_index ORDER BY session_number) FROM public.prescription_sessions WHERE prescription_id=rx) IS DISTINCT FROM ARRAY[0,0,0,0,1,1] THEN RAISE EXCEPTION 'Chrome1911 Zuordnung'; END IF;
  INSERT INTO public.bookings(status) VALUES ('confirmed') RETURNING id INTO termin;
  UPDATE public.prescription_sessions SET booking_id=termin, status='done', done_at='2026-11-18T23:30:00Z' WHERE prescription_id=rx AND session_number=1;
  UPDATE public.bookings SET status='completed' WHERE id=termin;
  IF (SELECT behandlungsbeginn FROM public.prescriptions WHERE id=rx) IS DISTINCT FROM DATE '2026-11-19' THEN RAISE EXCEPTION 'Chrome1911 Beginn'; END IF;
  IF (SELECT count(*) FROM public.prescription_sessions WHERE prescription_id=rx AND status='done') <> 1 THEN RAISE EXCEPTION 'Chrome1911 Zaehler'; END IF;
END;
$$;
ROLLBACK;
