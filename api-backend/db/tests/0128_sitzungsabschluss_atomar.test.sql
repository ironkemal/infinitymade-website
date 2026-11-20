-- Nur in einer leeren Testdatenbank. Alle Änderungen liegen in einer Transaktion.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '19111111-1111-4111-8111-111111111111'::uuid $$;
CREATE FUNCTION public.auth_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT auth.uid() $$;
CREATE TABLE public.bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid DEFAULT auth.uid(), user_id uuid DEFAULT auth.uid(),
  start_time timestamptz DEFAULT '2020-10-25T23:05:00Z', status text DEFAULT 'confirmed', no_show boolean DEFAULT false,
  hausbesuch boolean, fahrt_status text, is_group boolean, group_parent_id uuid, verordnung_id uuid);
CREATE TABLE public.prescriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid DEFAULT auth.uid(), therapie_bereich text DEFAULT 'physio',
  status text DEFAULT 'confirmed', behandlungsbeginn date, anzahl_einheiten integer DEFAULT 6, heilmittel_items jsonb,
  doppelbehandlung boolean, ergaenzend_position text DEFAULT 'Chrome1911', ergaenzend_einheiten integer DEFAULT 1, vorrangig_einheiten integer,
  abrechnung_status text, abrechnung_status_manuell_am timestamptz);
CREATE TABLE public.prescription_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), prescription_id uuid REFERENCES public.prescriptions,
  booking_id uuid REFERENCES public.bookings, session_number integer, status text DEFAULT 'planned', done_at timestamptz, notes text, ergaenzend_erbracht boolean DEFAULT false);
\ir ../migrations/0128_sitzungsabschluss_atomar.sql
CREATE FUNCTION public.chrome1911_fehler() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('chrome1911.schreibfehler',true)='ja' THEN RAISE EXCEPTION USING ERRCODE='CH191',MESSAGE='Chrome1911 Schreibfehler'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER chrome1911_fehler BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.chrome1911_fehler();
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.prescription_sessions,public.bookings,public.prescriptions TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  b public.bookings%ROWTYPE;
  r uuid;
  ids uuid[];
BEGIN
  IF has_function_privilege('anon','public.sitzung_abschliessen(uuid,timestamptz,text)','EXECUTE') THEN RAISE EXCEPTION 'anon'; END IF;
  INSERT INTO public.bookings DEFAULT VALUES RETURNING * INTO b;
  BEGIN
    PERFORM public.sitzung_abschliessen(b.id,b.start_time,NULL); RAISE EXCEPTION 'Leerer Termin akzeptiert';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN ASSERT SQLERRM='KEINE_SITZUNG'; END;
  INSERT INTO public.prescriptions DEFAULT VALUES RETURNING id INTO r;
  INSERT INTO public.prescription_sessions(prescription_id,booking_id,session_number) VALUES(r,b.id,1),(r,b.id,2);
  PERFORM set_config('chrome1911.schreibfehler','ja',true);
  BEGIN
    PERFORM public.sitzung_abschliessen(b.id,b.start_time,'Chrome1911 Notiz'); RAISE EXCEPTION 'Schreibfehler erwartet';
  EXCEPTION WHEN SQLSTATE 'CH191' THEN NULL; END;
  ASSERT NOT EXISTS(SELECT FROM public.prescription_sessions WHERE status<>'planned' OR ergaenzend_erbracht OR done_at IS NOT NULL OR notes IS NOT NULL);
  ASSERT (SELECT behandlungsbeginn IS NULL AND status='confirmed' AND abrechnung_status IS NULL FROM public.prescriptions WHERE id=r);
  ASSERT (SELECT status='confirmed' FROM public.bookings WHERE id=b.id);
  PERFORM set_config('chrome1911.schreibfehler','nein',true);
  ids := public.sitzung_abschliessen(b.id,b.start_time,'Chrome1911 Notiz');
  ASSERT ids=ARRAY[r];
  ASSERT (SELECT status='completed' FROM public.bookings WHERE id=b.id);
  ASSERT (SELECT count(*)=2 FROM public.prescription_sessions WHERE status='done' AND done_at=b.start_time);
  ASSERT (SELECT count(*)=1 FROM public.prescription_sessions WHERE ergaenzend_erbracht);
  ASSERT (SELECT behandlungsbeginn=DATE '2020-10-26' AND status='in_therapy' FROM public.prescriptions WHERE id=r);
  UPDATE public.prescriptions SET behandlungsbeginn=NULL WHERE id=r;
  PERFORM public.sitzung_abschliessen(b.id,b.start_time,'Chrome1911 erneut');
  ASSERT (SELECT behandlungsbeginn=DATE '2020-10-26' FROM public.prescriptions WHERE id=r);
  ASSERT NOT EXISTS(SELECT FROM public.prescription_sessions WHERE notes IS DISTINCT FROM 'Chrome1911 Notiz');
  UPDATE public.prescriptions SET status='parsed' WHERE id=r;
  BEGIN
    PERFORM public.sitzung_abschliessen(b.id,b.start_time,NULL); RAISE EXCEPTION 'Entwurf akzeptiert';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN ASSERT SQLERRM='ENTWURF'; END;
  UPDATE public.prescriptions SET status='in_therapy' WHERE id=r;
  UPDATE public.bookings SET start_time=now()+interval '1 day' WHERE id=b.id RETURNING * INTO b;
  BEGIN
    PERFORM public.sitzung_abschliessen(b.id,b.start_time,NULL); RAISE EXCEPTION 'Zukunft akzeptiert';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN ASSERT SQLERRM='ZUKUNFT'; END;
  UPDATE public.bookings SET owner_id=gen_random_uuid() WHERE id=b.id;
  BEGIN
    PERFORM public.sitzung_abschliessen(b.id,b.start_time,NULL); RAISE EXCEPTION 'Fremdtermin akzeptiert';
  EXCEPTION WHEN SQLSTATE 'PT404' THEN ASSERT SQLERRM='TERMIN_FEHLT'; END;
END $$;
ROLLBACK;
