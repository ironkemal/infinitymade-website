-- Synthetischer Test auf isolierter Datenbank mit der Migrationskette bis 0129.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  praxis uuid := gen_random_uuid();
  therapeut uuid := gen_random_uuid();
  gruppe uuid;
  kind uuid;
  raum uuid;
  ersatz uuid;
  zugeteilt uuid;
BEGIN
  INSERT INTO auth.users (id) VALUES (praxis),(therapeut);
  UPDATE public.profiles SET role='owner' WHERE id=praxis;
  UPDATE public.profiles SET role='employee',owner_id=praxis WHERE id=therapeut;
  INSERT INTO public.rooms (owner_id,name,plaetze,ausstattung)
  VALUES (praxis,'Chrome1911 Gruppenraum',5,'{Gruppenraum}') RETURNING id INTO raum;

  INSERT INTO public.bookings (owner_id,user_id,room_id,customer_name,start_time,end_time,is_group,group_capacity)
  VALUES (praxis,praxis,raum,'Chrome1911 Gruppe','2026-12-10 09:00Z','2026-12-10 09:25Z',true,4)
  RETURNING id INTO gruppe;
  INSERT INTO public.bookings (owner_id,user_id,customer_name,start_time,end_time,group_parent_id)
  VALUES (praxis,praxis,'Chrome1911 Teilnahme','2026-12-10 09:00Z','2026-12-10 09:25Z',gruppe)
  RETURNING id INTO kind;
  IF (SELECT room_id FROM public.bookings WHERE id=kind) IS DISTINCT FROM raum THEN
    RAISE EXCEPTION 'Teilnahme erbt den Raum des Haupttermins';
  END IF;

  BEGIN
    INSERT INTO public.bookings (owner_id,user_id,room_id,customer_name,start_time,end_time)
    VALUES (praxis,therapeut,raum,'Chrome1911 Parallel','2026-12-10 09:15Z','2026-12-10 09:40Z');
    RAISE EXCEPTION 'Paralleler Termin im Gruppenraum wurde gespeichert' USING ERRCODE='22000';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Kein freier Raum%' THEN RAISE; END IF;
  END;

  INSERT INTO public.rooms (owner_id,name,ausstattung)
  VALUES (praxis,'Chrome1911 Ersatzraum','{Gruppenraum}') RETURNING id INTO ersatz;
  INSERT INTO public.bookings (owner_id,user_id,customer_name,start_time,end_time)
  VALUES (praxis,therapeut,'Chrome1911 Automatisch','2026-12-10 09:00Z','2026-12-10 09:15Z')
  RETURNING room_id INTO zugeteilt;
  IF zugeteilt IS DISTINCT FROM ersatz THEN
    RAISE EXCEPTION 'Automatische Zuweisung muss auf einen freien Raum ausweichen';
  END IF;

  INSERT INTO public.bookings (owner_id,user_id,room_id,customer_name,start_time,end_time)
  VALUES (praxis,therapeut,raum,'Chrome1911 Anschluss','2026-12-10 09:25Z','2026-12-10 09:50Z');
  RAISE NOTICE 'PASS Raum exklusiv, Teilnahme erbt Raum, Zuweisung weicht aus, Anschluss erlaubt';
END;
$$;
ROLLBACK;
