-- Synthetischer Test zu Entwurf 0134_booking_raum_leistung_standort.sql (BOX-P0-01).
-- Prüft: (1) Globale Leistung (business_id IS NULL) bei aktivem Standort erlaubt,
--        (2) Fremd-Standort ohne data_sharing_settings.services = true gesperrt,
--        (3) Fremd-Standort MIT data_sharing_settings.services = true erlaubt,
--        (4) Fremd-Mandant bleibt strikt gesperrt.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  praxis uuid := gen_random_uuid();
  fremd_praxis uuid := gen_random_uuid();
  standort_a uuid;
  standort_b uuid;
  svc_global uuid;
  svc_a uuid;
  svc_fremd uuid;
BEGIN
  INSERT INTO auth.users (id) VALUES (praxis), (fremd_praxis);
  UPDATE public.profiles SET role = 'owner' WHERE id IN (praxis, fremd_praxis);

  INSERT INTO public.businesses (owner_id, business_name) VALUES (praxis, 'Standort A') RETURNING id INTO standort_a;
  INSERT INTO public.businesses (owner_id, business_name) VALUES (praxis, 'Standort B') RETURNING id INTO standort_b;

  INSERT INTO public.services (user_id, owner_id, business_id, title, duration_minutes)
  VALUES (praxis, praxis, NULL, 'KG Global', 25) RETURNING id INTO svc_global;

  INSERT INTO public.services (user_id, owner_id, business_id, title, duration_minutes)
  VALUES (praxis, praxis, standort_a, 'KG Standort A', 25) RETURNING id INTO svc_a;

  INSERT INTO public.services (user_id, owner_id, business_id, title, duration_minutes)
  VALUES (fremd_praxis, fremd_praxis, NULL, 'KG Fremd', 25) RETURNING id INTO svc_fremd;

  -- 1. Globale Leistung (business_id IS NULL) an Standort A muss erlaubt sein (BOX-P0-01)
  INSERT INTO public.bookings (owner_id, user_id, business_id, service_id, customer_name, start_time, end_time)
  VALUES (praxis, praxis, standort_a, svc_global, 'QA Global', '2026-12-12 09:00Z', '2026-12-12 09:25Z');

  -- 2. Leistung von Standort A an Standort B OHNE Freigabe muss abgelehnt werden
  BEGIN
    INSERT INTO public.bookings (owner_id, user_id, business_id, service_id, customer_name, start_time, end_time)
    VALUES (praxis, praxis, standort_b, svc_a, 'QA Fremdstandort', '2026-12-12 10:00Z', '2026-12-12 10:25Z');
    RAISE EXCEPTION 'Leistung von Standort A durfte ohne Sharing nicht an Standort B gebucht werden' USING ERRCODE = '22000';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'Leistung gehört nicht%' THEN RAISE; END IF;
  END;

  -- 3. Leistung von Standort A an Standort B MIT data_sharing_settings.services = true muss erlaubt sein
  INSERT INTO public.data_sharing_settings (owner_id, services)
  VALUES (praxis, true)
  ON CONFLICT (owner_id) DO UPDATE SET services = true;

  INSERT INTO public.bookings (owner_id, user_id, business_id, service_id, customer_name, start_time, end_time)
  VALUES (praxis, praxis, standort_b, svc_a, 'QA Shared', '2026-12-12 11:00Z', '2026-12-12 11:25Z');

  -- 4. Fremd-Mandant bleibt auch mit Sharing strikt gesperrt
  BEGIN
    INSERT INTO public.bookings (owner_id, user_id, business_id, service_id, customer_name, start_time, end_time)
    VALUES (praxis, praxis, standort_a, svc_fremd, 'QA Fremdmandant', '2026-12-12 12:00Z', '2026-12-12 12:25Z');
    RAISE EXCEPTION 'Leistung eines fremden Mandanten durfte nicht gebucht werden' USING ERRCODE = '22000';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'Leistung gehört nicht%' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'PASS 0134: Global erlaubt, Fremdstandort ohne Sharing gesperrt, mit Sharing erlaubt, Fremdmandant gesperrt';
END;
$$;
ROLLBACK;
