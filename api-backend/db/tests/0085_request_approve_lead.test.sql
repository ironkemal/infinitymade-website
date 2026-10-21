-- 0085: optionale lead_id in approve_booking_request_atomic — fremde Akte abgewiesen, eigene geschrieben.
-- Run only against disposable PostgreSQL after the complete migration chain.
-- Synthetic fixtures only; every data change rolls back.
BEGIN;
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.profiles(id,role) VALUES ('11111111-1111-4111-8111-111111111111','owner'), ('22222222-2222-4222-8222-222222222222','owner') ON CONFLICT(id) DO UPDATE SET role='owner';
INSERT INTO public.leads(id,owner_id,title) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','QA eigen'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','22222222-2222-4222-8222-222222222222','QA fremd');
INSERT INTO public.booking_requests(id,owner_id,payment_type,updated_at) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','11111111-1111-4111-8111-111111111111','selbstzahler','2026-01-01T00:00:00Z');
DO $$ DECLARE o uuid := '11111111-1111-4111-8111-111111111111'; base jsonb; BEGIN
  base := jsonb_build_object('owner_id',o,'user_id',o,'customer_name','QA synthetic','start_time','2026-12-01T10:00:00Z','end_time','2026-12-01T10:30:00Z');
  BEGIN
    PERFORM public.approve_booking_request_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',o,o,'2026-01-01T00:00:00Z',o,'{}',
      jsonb_build_array(base || '{"lead_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"}'),'{}');
    RAISE EXCEPTION 'foreign lead allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.bookings WHERE customer_name = 'QA synthetic') THEN RAISE EXCEPTION 'booking persisted after foreign lead'; END IF;
  PERFORM public.approve_booking_request_atomic('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',o,o,'2026-01-01T00:00:00Z',o,'{}',
    jsonb_build_array(base || '{"lead_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"}'),'{}');
  IF (SELECT lead_id FROM public.bookings WHERE customer_name = 'QA synthetic') IS DISTINCT FROM 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid THEN RAISE EXCEPTION 'own lead_id not written'; END IF;
END $$;
ROLLBACK;
