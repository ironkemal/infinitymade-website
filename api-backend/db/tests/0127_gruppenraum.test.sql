-- Synthetische Prüfung nach 0127, ausschließlich in isolierter Testdatenbank.
BEGIN;
DO $$
DECLARE
  owner_id_test uuid := gen_random_uuid();
  person uuid := gen_random_uuid();
  raum uuid := gen_random_uuid();
  gruppe uuid := gen_random_uuid();
  zweiter uuid := gen_random_uuid();
  dritter uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id) VALUES (owner_id_test),(person),(zweiter),(dritter);
  UPDATE public.profiles SET role='owner' WHERE id=owner_id_test;
  UPDATE public.profiles SET role='employee',owner_id=owner_id_test WHERE id IN (person,zweiter,dritter);
  INSERT INTO rooms (id,owner_id,name,plaetze,ausstattung)
  VALUES (raum,owner_id_test,'Chrome1911 Einzel',2,'{}'),(gruppe,owner_id_test,'Chrome1911 Gruppe',2,'{Gruppenraum}');
  INSERT INTO bookings (owner_id,user_id,room_id,customer_name,start_time,end_time) VALUES
    (owner_id_test,person,raum,'Chrome1911','2026-12-10 09:00Z','2026-12-10 09:25Z');
  BEGIN
    INSERT INTO bookings (owner_id,user_id,room_id,customer_name,start_time,end_time) VALUES
      (owner_id_test,zweiter,raum,'Chrome1911','2026-12-10 09:15Z','2026-12-10 09:40Z');
    RAISE EXCEPTION 'Test fehlgeschlagen' USING ERRCODE='22000';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Kein freier Raum%' THEN RAISE; END IF;
  END;
  INSERT INTO bookings (owner_id,user_id,room_id,customer_name,start_time,end_time) VALUES
    (owner_id_test,person,raum,'Chrome1911','2026-12-10 09:25Z','2026-12-10 09:50Z'),
    (owner_id_test,zweiter,gruppe,'Chrome1911','2026-12-10 09:00Z','2026-12-10 09:25Z'),
    (owner_id_test,dritter,gruppe,'Chrome1911','2026-12-10 09:00Z','2026-12-10 09:25Z');
  BEGIN
    INSERT INTO bookings (owner_id,user_id,room_id,customer_name,start_time,end_time) VALUES
      (owner_id_test,owner_id_test,gruppe,'Chrome1911','2026-12-10 09:00Z','2026-12-10 09:25Z');
    RAISE EXCEPTION 'Gruppenraum überfüllt' USING ERRCODE='22000';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Kein freier Raum%' THEN RAISE; END IF;
  END;
END;
$$;
ROLLBACK;
