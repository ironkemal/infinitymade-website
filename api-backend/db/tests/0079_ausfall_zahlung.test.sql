-- Only disposable PostgreSQL, run after complete migration chain incl0079.
-- All fixtures synthetic and rolled back; ON_ERROR_STOP required.
BEGIN;
INSERT INTO auth.users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.profiles(id,role) VALUES
 ('11111111-1111-4111-8111-111111111111','owner'), ('22222222-2222-4222-8222-222222222222','owner')
 ON CONFLICT(id) DO UPDATE SET role='owner';
INSERT INTO public.ausfallrechnungen(id,owner_id,rechnung_nr,amount_eur,faellig_am) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111',10001,30,'2026-01-31'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-4111-8111-111111111111',10002,40,'2026-01-31');
DO $$ BEGIN
 IF has_function_privilege('anon','public.ausfall_status_buchen(uuid,uuid,uuid,text,text)','EXECUTE')
 OR has_function_privilege('authenticated','public.ausfall_status_buchen(uuid,uuid,uuid,text,text)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.ausfall_status_buchen(uuid,uuid,uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'RPC ACL failed'; END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.ausfall_status_buchen(uuid,uuid,uuid,text,text)'::regprocedure) THEN RAISE EXCEPTION 'RPC must not be definer'; END IF;
 BEGIN
  UPDATE public.ausfallrechnungen SET faellig_am='2026-02-01' WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  RAISE EXCEPTION 'due date unexpectedly mutable';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  PERFORM public.ausfall_status_buchen('22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','bezahlt','bar');
  RAISE EXCEPTION 'foreign owner unexpectedly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- Force journal insert failure; no status may survive.
CREATE FUNCTION public.qa_reject_af_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.type='ausfall' THEN RAISE EXCEPTION 'synthetic journal failure'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER qa_reject_af_ledger BEFORE INSERT ON public.belegliste FOR EACH ROW EXECUTE FUNCTION public.qa_reject_af_ledger();
DO $$ BEGIN
 BEGIN
  PERFORM public.ausfall_status_buchen('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','bezahlt','bar');
  RAISE EXCEPTION 'expected synthetic journal failure';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'synthetic journal failure' THEN RAISE; END IF;
 END;
 IF (SELECT status FROM public.ausfallrechnungen WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') <> 'offen' THEN RAISE EXCEPTION 'status changed despite failed journal'; END IF;
END $$;
DROP TRIGGER qa_reject_af_ledger ON public.belegliste;
DROP FUNCTION public.qa_reject_af_ledger();
-- Force the UPDATE after a successful ledger INSERT to fail: journal must roll back.
CREATE FUNCTION public.qa_reject_af_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic status failure'; END $$;
CREATE TRIGGER qa_reject_af_update BEFORE UPDATE ON public.ausfallrechnungen FOR EACH ROW EXECUTE FUNCTION public.qa_reject_af_update();
DO $$ BEGIN
 BEGIN
  PERFORM public.ausfall_status_buchen('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','bezahlt','bar');
  RAISE EXCEPTION 'expected synthetic status failure';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'synthetic status failure' THEN RAISE; END IF; END;
 IF EXISTS (SELECT 1 FROM public.belegliste WHERE owner_id='11111111-1111-4111-8111-111111111111' AND type='ausfall') THEN RAISE EXCEPTION 'ledger survived failed status update'; END IF;
END $$;
DROP TRIGGER qa_reject_af_update ON public.ausfallrechnungen;
DROP FUNCTION public.qa_reject_af_update();
SET LOCAL ROLE service_role;
SELECT public.ausfall_status_buchen('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','bezahlt','bar');
RESET ROLE;
DO $$ BEGIN
 IF (SELECT status FROM public.ausfallrechnungen WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') <> 'bezahlt' THEN RAISE EXCEPTION 'status not paid'; END IF;
 IF (SELECT count(*) FROM public.belegliste WHERE owner_id='11111111-1111-4111-8111-111111111111' AND type='ausfall' AND reference_text LIKE ('Ausfallhonorar erhalten (AF-' || (SELECT lpad(rechnung_nr::text,greatest(4,length(rechnung_nr::text)),'0') FROM public.ausfallrechnungen WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') || ')%')) <> 1 THEN RAISE EXCEPTION 'exactly one ledger required'; END IF;
 BEGIN
  PERFORM public.ausfall_status_buchen('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','bezahlt','bar');
  RAISE EXCEPTION 'paid retry unexpectedly allowed';
 EXCEPTION WHEN check_violation THEN NULL; END;
 PERFORM public.ausfall_status_buchen('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','abgeschrieben',NULL);
 PERFORM public.ausfall_status_buchen('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','bezahlt','paypal');
 IF (SELECT count(*) FROM public.belegliste WHERE owner_id='11111111-1111-4111-8111-111111111111' AND type='ausfall') <> 2 THEN RAISE EXCEPTION 'late payment missing'; END IF;
END $$;
ROLLBACK;
