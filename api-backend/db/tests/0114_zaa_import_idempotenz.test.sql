-- 0114: ZAA-Import-Hash — gleiche Datei zweimal ändert nichts, andere Datei normal, alte 7-Argument-Aufrufe unverändert.
-- Only disposable PostgreSQL after the complete migration chain (0000..0114+); never a live database.
-- Synthetic fixtures, everything rolled back. Hashes are synthetic hex strings, no real file.
\set ON_ERROR_STOP on
-- Catalog row in its own transaction: 0113 rejects mixed catalog+tenant write transactions (PHYSIO_MIXED_*).
INSERT INTO public.kostentraeger(ik,name) VALUES ('100000091','SYNTHETIC ZAA') ON CONFLICT DO NOTHING;
BEGIN;
CREATE FUNCTION pg_temp.ok(c boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF c IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; RAISE NOTICE 'PASS: %', label; END $$;
CREATE FUNCTION pg_temp.err(q text, code text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE caught boolean := false; BEGIN
  BEGIN EXECUTE q; EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> code THEN RAISE EXCEPTION 'FAIL: % expected %, got %: %', label, code, SQLSTATE, SQLERRM; END IF;
    caught := true;
  END;
  PERFORM pg_temp.ok(caught, label);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean,text), pg_temp.err(text,text,text) TO service_role;

INSERT INTO auth.users(id) VALUES ('a1111111-1111-4111-8111-111111111111');
UPDATE public.profiles SET role='owner', is_active=true WHERE id='a1111111-1111-4111-8111-111111111111';
INSERT INTO public.abrechnung(id,owner_id,kostentraeger_ik,status)
  VALUES ('a2222222-2222-4222-8222-222222222222','a1111111-1111-4111-8111-111111111111','100000091','gesendet');
INSERT INTO public.prescriptions(id,owner_id,status,rezeptart,therapie_bereich,abrechnung_id,abrechnung_status)
  VALUES ('a3333333-3333-4333-8333-333333333333','a1111111-1111-4111-8111-111111111111','billed','kassen','physio',
          'a2222222-2222-4222-8222-222222222222','gesendet');
CREATE TEMP TABLE zaa_ctx(k text PRIMARY KEY, v text);
GRANT ALL ON zaa_ctx TO service_role;

-- One call exactly like PostgREST sends it (named arguments, service_role).
CREATE FUNCTION pg_temp.anwenden(p_hash text, p_tag date DEFAULT DATE '2026-11-05') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE u text; BEGIN
  SELECT updated_at::text INTO u FROM public.abrechnung WHERE id='a2222222-2222-4222-8222-222222222222';
  IF p_hash IS NULL THEN
    RETURN public.zaa_fehler_anwenden(p_owner => 'a1111111-1111-4111-8111-111111111111', p_abrechnung => 'a2222222-2222-4222-8222-222222222222',
      p_expected_updated_at => u, p_fehler => '[{"prescription_id":"a3333333-3333-4333-8333-333333333333","fehler_code":"SYN1","fehler_text":"synthetic","belegnummer_kasse":"B-1"}]',
      p_gruende => '[{"prescription_id":"a3333333-3333-4333-8333-333333333333","grund":"SYN1 synthetic"}]', p_vord_status => 'rejected', p_datum => p_tag);
  END IF;
  RETURN public.zaa_fehler_anwenden(p_owner => 'a1111111-1111-4111-8111-111111111111', p_abrechnung => 'a2222222-2222-4222-8222-222222222222',
    p_expected_updated_at => u, p_fehler => '[{"prescription_id":"a3333333-3333-4333-8333-333333333333","fehler_code":"SYN1","fehler_text":"synthetic","belegnummer_kasse":"B-1"}]',
    p_gruende => '[{"prescription_id":"a3333333-3333-4333-8333-333333333333","grund":"SYN1 synthetic"}]', p_vord_status => 'rejected', p_datum => p_tag, p_sha256 => p_hash);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.anwenden(text,date) TO service_role;

SELECT pg_temp.ok(to_regprocedure('public.zaa_fehler_anwenden(uuid,uuid,text,jsonb,jsonb,text,date)') IS NULL
  AND (SELECT count(*) FROM pg_proc WHERE proname='zaa_fehler_anwenden' AND pronamespace='public'::regnamespace)=1,
  'exactly one overload, old 7-parameter signature replaced');

SET LOCAL ROLE service_role;
-- Old caller (:stable, no hash) still works through the DEFAULT, writes no zaa_import row.
SELECT pg_temp.ok((pg_temp.anwenden(NULL)->>'konflikt')::boolean = false, '7-argument named call unchanged');
RESET ROLE;
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.zaa_import), 'no hash -> no import row');

SET LOCAL ROLE service_role;
SELECT pg_temp.ok((pg_temp.anwenden(repeat('a',64), DATE '2026-11-06')->>'wiederholt') IS NULL, 'first upload with hash applied');
RESET ROLE;
INSERT INTO zaa_ctx SELECT 'stand', jsonb_build_object('hdr', to_jsonb(h) - 'updated_at' , 'upd', h.updated_at,
  'rx', (SELECT jsonb_build_object('a', absetzung_am, 'g', absetzung_grund) FROM public.prescriptions WHERE id='a3333333-3333-4333-8333-333333333333'),
  'fehler', (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM public.zaa_fehler f WHERE f.abrechnung_id=h.id))::text
  FROM public.abrechnung h WHERE h.id='a2222222-2222-4222-8222-222222222222';
SELECT pg_temp.ok((SELECT count(*) FROM public.zaa_import WHERE abrechnung_id='a2222222-2222-4222-8222-222222222222' AND sha256=repeat('a',64))=1, 'import row written once');

SET LOCAL ROLE service_role;
SELECT pg_temp.ok((pg_temp.anwenden(repeat('a',64), DATE '2026-11-07')->>'wiederholt')::boolean, 'same file again -> wiederholt');
RESET ROLE;
SELECT pg_temp.ok((SELECT jsonb_build_object('hdr', to_jsonb(h) - 'updated_at', 'upd', h.updated_at,
  'rx', (SELECT jsonb_build_object('a', absetzung_am, 'g', absetzung_grund) FROM public.prescriptions WHERE id='a3333333-3333-4333-8333-333333333333'),
  'fehler', (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM public.zaa_fehler f WHERE f.abrechnung_id=h.id))
  FROM public.abrechnung h WHERE h.id='a2222222-2222-4222-8222-222222222222') = (SELECT v::jsonb FROM zaa_ctx WHERE k='stand'),
  'repeat changes nothing: header, updated_at, Rx absetzung_am, zaa_fehler identical');

SET LOCAL ROLE service_role;
SELECT pg_temp.ok((pg_temp.anwenden(repeat('b',64), DATE '2026-11-08')->>'wiederholt') IS NULL, 'different file applied normally');
RESET ROLE;
SELECT pg_temp.ok((SELECT absetzung_am FROM public.prescriptions WHERE id='a3333333-3333-4333-8333-333333333333') = DATE '2026-11-08'
  AND (SELECT count(*) FROM public.zaa_import)=2, 'different file moves absetzung_am, second import row');

SET LOCAL ROLE service_role;
SELECT pg_temp.err('SELECT pg_temp.anwenden(''ABC'')', '22023', 'malformed hash rejected');
SELECT pg_temp.ok((public.zaa_fehler_anwenden('a1111111-1111-4111-8111-111111111111','a2222222-2222-4222-8222-222222222222','2000-01-01T00:00:00Z',
  '[{"fehler_code":"SYN"}]','[]','rejected',DATE '2026-11-09',repeat('a',64))->>'konflikt')::boolean, 'stale CAS still reports konflikt before hash check');
SELECT pg_temp.err('INSERT INTO public.zaa_import(abrechnung_id,sha256) VALUES (''a2222222-2222-4222-8222-222222222222'',repeat(''c'',64))',
  '42501', 'service_role cannot mark a file applied without applying it');
SELECT pg_temp.ok((SELECT count(*) FROM public.zaa_import)=2, 'service_role may read import rows (Auskunft)');
RESET ROLE;
SELECT pg_temp.ok(NOT has_table_privilege('authenticated','public.zaa_import','SELECT,INSERT,UPDATE,DELETE')
  AND NOT has_table_privilege('anon','public.zaa_import','SELECT,INSERT,UPDATE,DELETE')
  AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.zaa_import'::regclass), 'no browser access, RLS on');
SELECT pg_temp.ok(has_function_privilege('service_role','public.zaa_fehler_anwenden(uuid,uuid,text,jsonb,jsonb,text,date,text)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.zaa_fehler_anwenden(uuid,uuid,text,jsonb,jsonb,text,date,text)','EXECUTE')
  AND NOT has_function_privilege('anon','public.zaa_fehler_anwenden(uuid,uuid,text,jsonb,jsonb,text,date,text)','EXECUTE'), 'RPC service_role only');
ROLLBACK;
