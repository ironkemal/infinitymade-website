-- Run only against disposable PostgreSQL after the complete migration chain.
-- Synthetic fixtures only; every data change and forced failure rolls back.
BEGIN;
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.profiles(id,role) VALUES ('11111111-1111-4111-8111-111111111111','owner'), ('22222222-2222-4222-8222-222222222222','owner') ON CONFLICT(id) DO UPDATE SET role='owner';
INSERT INTO public.booking_requests(id,owner_id,payment_type,updated_at) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','11111111-1111-4111-8111-111111111111','selbstzahler','2026-01-01T00:00:00Z');
CREATE FUNCTION public.qa_approve_call(p_owner uuid DEFAULT '11111111-1111-4111-8111-111111111111',p_expected timestamptz DEFAULT '2026-01-01T00:00:00Z',p_rows jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.approve_booking_request_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',p_owner,p_owner,p_expected,p_owner,'{}',coalesce(p_rows,jsonb_build_array(jsonb_build_object('owner_id',p_owner,'user_id',p_owner,'customer_name','QA synthetic','start_time','2026-12-01T10:00:00Z','end_time','2026-12-01T10:30:00Z'))),'{}');
$$;
DO $$ BEGIN
 IF has_function_privilege('anon','public.approve_booking_request_atomic(uuid,uuid,uuid,timestamptz,uuid,jsonb,jsonb,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.approve_booking_request_atomic(uuid,uuid,uuid,timestamptz,uuid,jsonb,jsonb,jsonb)','EXECUTE') OR NOT has_function_privilege('service_role','public.approve_booking_request_atomic(uuid,uuid,uuid,timestamptz,uuid,jsonb,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'RPC ACL failed'; END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.approve_booking_request_atomic(uuid,uuid,uuid,timestamptz,uuid,jsonb,jsonb,jsonb)'::regprocedure) THEN RAISE EXCEPTION 'RPC must be invoker'; END IF;
 BEGIN PERFORM public.qa_approve_call('22222222-2222-4222-8222-222222222222'); RAISE EXCEPTION 'foreign request allowed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM public.qa_approve_call(p_expected=>'2025-01-01T00:00:00Z'); RAISE EXCEPTION 'stale request allowed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
-- NULL/malformed planning inputs fail with documented invalid-parameter codes.
DO $$ DECLARE row jsonb; bad jsonb; key text; BEGIN
 row := jsonb_build_object('owner_id','11111111-1111-4111-8111-111111111111','user_id','11111111-1111-4111-8111-111111111111','start_time','2026-12-01T10:00:00Z','end_time','2026-12-01T10:30:00Z');
 FOREACH key IN ARRAY ARRAY['owner_id','user_id','start_time','end_time'] LOOP
  bad := row - key;
  BEGIN PERFORM public.qa_approve_call(p_rows=>jsonb_build_array(bad)); RAISE EXCEPTION 'missing booking field allowed: %',key; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 END LOOP;
 BEGIN PERFORM public.qa_approve_call(p_rows=>'[]'); RAISE EXCEPTION 'empty bookings allowed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.approve_booking_request_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','2026-01-01','11111111-1111-4111-8111-111111111111',NULL,jsonb_build_array(row),'{}'); RAISE EXCEPTION 'NULL changes allowed'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.bookings WHERE owner_id='11111111-1111-4111-8111-111111111111') THEN RAISE EXCEPTION 'invalid planning persisted'; END IF;
END $$;
-- Request UPDATE failure must roll back preceding booking INSERT.
CREATE FUNCTION public.qa_reject_request() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic request failure'; END $$;
CREATE TRIGGER qa_reject_request BEFORE UPDATE ON public.booking_requests FOR EACH ROW EXECUTE FUNCTION public.qa_reject_request();
DO $$ BEGIN
 BEGIN PERFORM public.qa_approve_call(); RAISE EXCEPTION 'expected request update failure'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'synthetic request failure' THEN RAISE; END IF; END;
 IF EXISTS (SELECT 1 FROM public.bookings WHERE customer_name='QA synthetic') THEN RAISE EXCEPTION 'orphan booking after request failure'; END IF;
END $$;
DROP TRIGGER qa_reject_request ON public.booking_requests;
DROP FUNCTION public.qa_reject_request();
-- Exclusion on second booking must roll back the first booking as well.
DO $$ DECLARE rows jsonb := jsonb_build_array(jsonb_build_object('owner_id','11111111-1111-4111-8111-111111111111','user_id','11111111-1111-4111-8111-111111111111','customer_name','QA synthetic','start_time','2026-12-01T10:00:00Z','end_time','2026-12-01T10:30:00Z'),jsonb_build_object('owner_id','11111111-1111-4111-8111-111111111111','user_id','11111111-1111-4111-8111-111111111111','customer_name','QA synthetic','start_time','2026-12-01T10:15:00Z','end_time','2026-12-01T10:45:00Z'));
BEGIN
 BEGIN PERFORM public.qa_approve_call(p_rows=>rows); RAISE EXCEPTION 'overlap allowed'; EXCEPTION WHEN exclusion_violation THEN NULL; END;
 IF EXISTS (SELECT 1 FROM public.bookings WHERE customer_name='QA synthetic') THEN RAISE EXCEPTION 'partial series persisted'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.qa_approve_call(uuid,timestamptz,jsonb) TO service_role;
SET LOCAL ROLE service_role;
SELECT public.qa_approve_call();
RESET ROLE;
DO $$ BEGIN
 IF (SELECT status FROM public.booking_requests WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') <> 'approved' OR (SELECT count(*) FROM public.bookings WHERE customer_name='QA synthetic') <> 1 THEN RAISE EXCEPTION 'atomic approval missing'; END IF;
 BEGIN PERFORM public.qa_approve_call(); RAISE EXCEPTION 'duplicate approval allowed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
ROLLBACK;
