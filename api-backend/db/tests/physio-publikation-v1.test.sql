-- Two run modes (disposable local PostgreSQL only, never a live database):
-- (1) FULL CHAIN (since 07.11.2026, migration 0113): apply 0000..0115 to an empty DB
--     after platform stubs (auth/storage/vault/roles), then run this file WITHOUT
--     physio_bootstrap. Proof script + stubs: see db/REGISTER.md -> prescription_session_abrechnungsanspruch.
-- (2) Legacy partial fixture (below): fixture now includes migration 0113 instead of the draft.
-- Reproducible isolated run from repository root (local image only):
-- docker run -d --pull=never --network none --tmpfs /var/lib/postgresql/data \
--   -e POSTGRES_HOST_AUTH_METHOD=trust --name praxura-physio-v1-probe postgres:17.11
-- docker exec praxura-physio-v1-probe mkdir -p /tmp/probe/api-backend/db/tests /tmp/probe/api-backend/db/migrations /tmp/probe/db/entwuerfe
-- Copy these four paths using docker cp PATH praxura-physio-v1-probe:/tmp/probe/PATH:
--   api-backend/db/tests/physio-publikation-v1.fixture.sql
--   api-backend/db/tests/physio-publikation-v1.test.sql
--   api-backend/db/migrations/0060_abrechnung_artefakt_version.sql
--   api-backend/db/migrations/0113_physio_publikation_v1.sql
-- docker exec praxura-physio-v1-probe pg_isready -U postgres
-- docker exec praxura-physio-v1-probe createdb -U postgres physio_proof
-- docker exec praxura-physio-v1-probe psql -U postgres -d physio_proof -v ON_ERROR_STOP=1 -v physio_bootstrap=1 -v physio_keep_fixture=1 -v physio_concurrency=1 -f /tmp/probe/api-backend/db/tests/physio-publikation-v1.test.sql
-- Fixture includes 0060 + 0113 exactly once. Omit keep_fixture/concurrency for
-- rollback-only unit proof. dblink uses local Unix sockets, no external DB.
-- Dispose ONLY this uniquely named synthetic container after collecting output:
-- docker rm -f praxura-physio-v1-probe
-- Local result log from 07.11.2026: /tmp/physio-publikation-v1-proof.log
-- Partial schema fixture; no full-chain / Storage API / production proof.
-- DISPOSABLE LOCAL POSTGRESQL ONLY. Requires schema + 0060 + isolated draft.
-- No Storage byte service tested: receipts below are synthetic backend assertions.
-- Defaults to ROLLBACK. -v physio_keep_fixture=1 commits SYNTHETIC fixtures only
-- for optional second-connection concurrency tests in a disposable database.
\set ON_ERROR_STOP on
\if :{?physio_bootstrap}
\ir physio-publikation-v1.fixture.sql
\endif
-- Catalog bootstrap is a separate transaction by the new lock protocol.
INSERT INTO public.kostentraeger(ik,name) VALUES('100000001','SYNTHETIC') ON CONFLICT DO NOTHING;
BEGIN;
CREATE FUNCTION public.qa_physio_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
CREATE FUNCTION public.qa_physio_error(q text,code text,label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE caught boolean:=false; BEGIN
 BEGIN EXECUTE q; EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE<>code THEN RAISE EXCEPTION 'FAIL: % expected %, got %: %',label,code,SQLSTATE,SQLERRM; END IF;
  caught:=true;
 END;
 PERFORM public.qa_physio_assert(caught,label);
END $$;
GRANT EXECUTE ON FUNCTION public.qa_physio_assert(boolean,text),public.qa_physio_error(text,text,text) TO service_role,authenticated;
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
-- Full chain: on_auth_user_created already created both profiles (handle_new_user).
INSERT INTO public.profiles(id,is_active,role,sector) VALUES
 ('11111111-1111-4111-8111-111111111111',true,'owner','physiotherapy'),('22222222-2222-4222-8222-222222222222',true,'owner','physiotherapy')
 ON CONFLICT (id) DO UPDATE SET is_active=EXCLUDED.is_active,role=EXCLUDED.role,sector=EXCLUDED.sector;
INSERT INTO public.terapeut_zertifikat(owner_id,ik_nummer) VALUES('11111111-1111-4111-8111-111111111111','100000002');
INSERT INTO public.leads(id,owner_id,title) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','SYNTHETIC');
INSERT INTO public.prescriptions(id,owner_id,patient_id,status,rezeptart,rezept_typ,therapie_bereich,kostentraeger_ik,krankenkasse_ik,heilmittel_position,anzahl_einheiten)
 VALUES('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
 'confirmed','kassen','standard','physio','100000001','100000001','X0501',1);
INSERT INTO public.prescription_sessions(id,prescription_id,session_number,status,done_at)
 VALUES('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444',1,'done','2026-11-01 10:00Z');
CREATE TEMP TABLE physio_ctx(k text PRIMARY KEY,v jsonb);
GRANT ALL ON physio_ctx TO service_role,authenticated;
INSERT INTO physio_ctx VALUES('payload','{"vkz":"01","bereich":"physio","prescription_ids":["44444444-4444-4444-8444-444444444444"],"session_ids":["55555555-5555-4555-8555-555555555555"],"kostentraeger_ik":"100000001","empfaenger_ik":"100000003"}');
SET LOCAL ROLE service_role;
INSERT INTO physio_ctx SELECT 'reserve',public.abrechnung_idempotency_reserve('11111111-1111-4111-8111-111111111111','synthetic-request-0001',v) FROM physio_ctx WHERE k='payload';
SELECT public.qa_physio_assert((v->>'generation')::int=1 AND (v->>'worker_granted')::boolean,'reserve generation 1') FROM physio_ctx WHERE k='reserve';
SELECT public.qa_physio_assert((public.abrechnung_idempotency_reserve('11111111-1111-4111-8111-111111111111','synthetic-request-0001',p.v)->>'abrechnungId')=r.v->>'abrechnungId','reserve retry same header') FROM physio_ctx p,physio_ctx r WHERE p.k='payload' AND r.k='reserve';
SELECT public.qa_physio_error(format('SELECT public.abrechnung_idempotency_reserve(%L,%L,%L::jsonb)',
 '11111111-1111-4111-8111-111111111111','synthetic-request-0001',(v||'{"extra":true}')::text),'40001','key payload conflict') FROM physio_ctx WHERE k='payload';
SELECT public.qa_physio_error(format('SELECT public.abrechnung_idempotency_reserve(%L,%L,%L::jsonb)',
 '22222222-2222-4222-8222-222222222222','synthetic-request-foreign',v::text),'40001','foreign owner source blocked') FROM physio_ctx WHERE k='payload';
INSERT INTO physio_ctx SELECT 'second',public.abrechnung_idempotency_reserve('11111111-1111-4111-8111-111111111111','synthetic-request-0002',v) FROM physio_ctx WHERE k='payload';
RESET ROLE;
-- Existing permissive INSERT grants must not bypass the new line guard.
GRANT INSERT ON public.abrechnung_zeile TO service_role,authenticated;
GRANT SELECT ON public.abrechnung TO authenticated,service_role;
SET LOCAL ROLE service_role;
SELECT public.qa_physio_error(format('INSERT INTO public.abrechnung_zeile(abrechnung_id,owner_id,kostentraeger_ik,einzel_rechnungsnummer) VALUES(%L,%L,%L,%L)',
 v->>'abrechnungId','11111111-1111-4111-8111-111111111111','100000001','SYNTHETIC'),'42501','service direct line insert blocked') FROM physio_ctx WHERE k='reserve';
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT public.qa_physio_error(format('INSERT INTO public.abrechnung_zeile(abrechnung_id,owner_id,kostentraeger_ik,einzel_rechnungsnummer) VALUES(%L,%L,%L,%L)',
 v->>'abrechnungId','11111111-1111-4111-8111-111111111111','100000001','SYNTHETIC'),'42501','browser direct line insert blocked') FROM physio_ctx WHERE k='reserve';
RESET ROLE;
-- Safe lease takeover. Only disposable fixture owner can force the clock boundary.
UPDATE public.abrechnung SET publication_lease_until=clock_timestamp()-interval '1 second' WHERE id=(SELECT (v->>'abrechnungId')::uuid FROM physio_ctx WHERE k='reserve');
SET LOCAL ROLE service_role;
INSERT INTO physio_ctx SELECT 'takeover',public.abrechnung_idempotency_reserve('11111111-1111-4111-8111-111111111111','synthetic-request-0001',v) FROM physio_ctx WHERE k='payload';
SELECT public.qa_physio_assert((v->>'generation')::int=2,'lease takeover generation 2') FROM physio_ctx WHERE k='takeover';
RESET ROLE;
-- Package binds every component to its original session; integer cents.
INSERT INTO physio_ctx VALUES('package','{"dateiname":"SYNTHETIC","dta_segment_count":10,"lines":[{"prescription_id":"44444444-4444-4444-8444-444444444444","belegnummer":"SYNTHETIC-B1","einzel_rechnungsnummer":"SYNTHETIC-E1","sort_order":0,"verordnungsdatum":"2026-10-30","heilmittel_position":"X0501","anzahl_einheiten":1,"brutto_cents":1000,"zuzahlung_cents":100,"leistungen":[{"session_id":"55555555-5555-4555-8555-555555555555","positionsnummer":"20501","anzahl":1,"einzelbetrag_cents":1000}]}]}');
CREATE TEMP TABLE physio_files(role text,id uuid,path text,sha text,bytes bigint);
GRANT ALL ON physio_files TO service_role;
SET LOCAL ROLE service_role;
INSERT INTO physio_files SELECT role,
 public.artefakt_reserve('11111111-1111-4111-8111-111111111111',(r.v->>'abrechnungId')::uuid,
 '11111111-1111-4111-8111-111111111111/'||(r.v->>'abrechnungId')||'/physio-v1/2/'||role,'unsigned',role,repeat('a',64)),
 '11111111-1111-4111-8111-111111111111/'||(r.v->>'abrechnungId')||'/physio-v1/2/'||role,repeat('a',64),
 CASE WHEN role='auftrag' THEN 348 ELSE 100 END FROM physio_ctx r CROSS JOIN (VALUES('dta'),('auftrag'),('begleit')) f(role) WHERE r.k='takeover';

SELECT public.artefakt_upload_done('11111111-1111-4111-8111-111111111111',id,true) FROM physio_files;
RESET ROLE;
INSERT INTO physio_ctx SELECT 'manifest',jsonb_agg(jsonb_build_object('id',id,'role',role,'path',path,'sha256',sha,'bytes',bytes) ORDER BY role) FROM physio_files;
CREATE FUNCTION public.qa_physio_finalize(p_generation bigint DEFAULT 2,p_owner uuid DEFAULT '11111111-1111-4111-8111-111111111111',p_second boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE h public.abrechnung%ROWTYPE; p jsonb; m jsonb; BEGIN
 SELECT * INTO h FROM public.abrechnung WHERE id=(SELECT (v->>'abrechnungId')::uuid FROM pg_temp.physio_ctx WHERE k=CASE WHEN p_second THEN 'second' ELSE 'takeover' END);
 SELECT v INTO p FROM pg_temp.physio_ctx WHERE k='package'; SELECT v INTO m FROM pg_temp.physio_ctx WHERE k='manifest';
 RETURN public.abrechnung_physio_finalize(p_owner,h.id,h.publication_key,h.publication_payload_sha256,h.publication_input_sha256,p_generation,h.updated_at::text,p,m);
END $$;
GRANT EXECUTE ON FUNCTION public.qa_physio_finalize(bigint,uuid,boolean) TO service_role;
SET LOCAL ROLE service_role;
SELECT public.qa_physio_error('SELECT public.qa_physio_finalize(1)','40001','stale generation blocked');
SELECT public.qa_physio_error('SELECT public.qa_physio_finalize(2,''22222222-2222-4222-8222-222222222222'')','42501','foreign finalize blocked');
SELECT public.qa_physio_error('SELECT public.qa_physio_finalize()','22023','missing readback receipt blocked');
RESET ROLE;
-- A different practice edit must not invalidate selected input.
UPDATE public.profiles SET business_name='SYNTHETIC OTHER' WHERE id='22222222-2222-4222-8222-222222222222';
SELECT public.qa_physio_assert(public.physio_v1_input_hash('11111111-1111-4111-8111-111111111111',p.v)=r.v->>'input_sha256','foreign practice edit excluded from input hash') FROM physio_ctx p,physio_ctx r WHERE p.k='payload' AND r.k='reserve';
INSERT INTO physio_ctx SELECT 'package_hash',to_jsonb(public.physio_v1_hash(v)) FROM physio_ctx WHERE k='package';
SET LOCAL ROLE service_role;
SELECT public.physio_artefakt_readback('11111111-1111-4111-8111-111111111111',f.id,2,f.sha,f.bytes,p.v #>> '{}') FROM physio_files f,physio_ctx p WHERE p.k='package_hash';
RESET ROLE;
-- Owner hash helper is deliberately not callable by service_role; backend uses
-- deterministic package hashing locally. Grant only inside synthetic test transaction.

-- A real source change invalidates a prepared, readback-confirmed package.
SAVEPOINT source_change;
UPDATE public.prescription_sessions SET done_at='2026-11-02 10:00Z' WHERE id='55555555-5555-4555-8555-555555555555';
SET LOCAL ROLE service_role;
SELECT public.qa_physio_error('SELECT public.qa_physio_finalize()','40001','changed persisted source blocked');
RESET ROLE;
ROLLBACK TO source_change;
RELEASE source_change;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SET LOCAL ROLE authenticated;
SELECT public.qa_physio_assert(NOT public.physio_storage_readable(v->0->>'path'),'preparing storage path unreadable') FROM physio_ctx WHERE k='manifest';
RESET ROLE;
CREATE FUNCTION public.qa_physio_fail_header() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.publication_state='published' THEN RAISE EXCEPTION 'SYNTHETIC_COMMIT_FAILURE'; END IF; RETURN NEW; END $$;
CREATE TRIGGER qa_physio_fail BEFORE UPDATE ON public.abrechnung FOR EACH ROW EXECUTE FUNCTION public.qa_physio_fail_header();
SET LOCAL ROLE service_role;
SELECT public.qa_physio_error('SELECT public.qa_physio_finalize()','P0001','late header failure rolls transaction back');
RESET ROLE;
SELECT public.qa_physio_assert(NOT EXISTS(SELECT 1 FROM public.prescription_session_abrechnungsanspruch),'rollback has no claims');
SELECT public.qa_physio_assert(NOT EXISTS(SELECT 1 FROM public.abrechnung_zeile),'rollback has no lines');
SELECT public.qa_physio_assert(NOT EXISTS(SELECT 1 FROM public.prescriptions WHERE belegnummer IS NOT NULL OR abrechnung_id IS NOT NULL),'rollback has no Rx changes');
SELECT public.qa_physio_assert(NOT EXISTS(SELECT 1 FROM public.abrechnung_artefakt_version WHERE state='published'),'rollback has no registry publication');
DROP TRIGGER qa_physio_fail ON public.abrechnung;
SET LOCAL ROLE service_role;
INSERT INTO physio_ctx VALUES('result',public.qa_physio_finalize());
SELECT public.qa_physio_assert(public.qa_physio_finalize()=v,'final retry returns identical committed result') FROM physio_ctx WHERE k='result';
SELECT public.qa_physio_assert(public.abrechnung_idempotency_reserve('11111111-1111-4111-8111-111111111111','synthetic-request-0001',p.v)=r.v,'reserve after commit returns committed result') FROM physio_ctx p,physio_ctx r WHERE p.k='payload' AND r.k='result';
-- Second prepared order shares the same session but cannot publish after the first.
SELECT public.qa_physio_error('SELECT public.qa_physio_finalize(1,''11111111-1111-4111-8111-111111111111'',true)','40001','second order cannot claim already billed session');
RESET ROLE;
SELECT public.qa_physio_assert((SELECT count(*) FROM public.prescription_session_abrechnungsanspruch)=1,'exactly one permanent session claim');
SELECT public.qa_physio_assert((SELECT count(*) FROM public.abrechnung_zeile)=1,'exactly one frozen line');
SELECT public.qa_physio_assert((SELECT count(*) FROM public.abrechnung_artefakt_version WHERE state='published')=3,'whole artifact package published');
SELECT public.qa_physio_assert((SELECT belegnummer FROM public.prescriptions WHERE id='44444444-4444-4444-8444-444444444444')='SYNTHETIC-B1','Rx beleg frozen with publication');
SET LOCAL ROLE authenticated;
SELECT public.qa_physio_assert(public.physio_storage_readable(v->0->>'path'),'published owner path readable') FROM physio_ctx WHERE k='manifest';
SELECT public.qa_physio_assert(NOT public.physio_storage_readable('11111111-1111-4111-8111-111111111111/unknown'),'unknown owner path remains blocked');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SET LOCAL ROLE authenticated;
SELECT public.qa_physio_assert(NOT public.physio_storage_readable(v->0->>'path'),'foreign owner cannot read publication') FROM physio_ctx WHERE k='manifest';
RESET ROLE;
-- Existing signature follow-up RPC contract still works after final publication.
SET LOCAL ROLE service_role;
INSERT INTO physio_ctx SELECT 'signed',to_jsonb(public.artefakt_reserve('11111111-1111-4111-8111-111111111111',
 (v->>'abrechnungId')::uuid,'11111111-1111-4111-8111-111111111111/'||(v->>'abrechnungId')||'/versuche/synthetic.p7m','signed','signed',repeat('b',64))) FROM physio_ctx WHERE k='takeover';
SELECT public.artefakt_upload_done('11111111-1111-4111-8111-111111111111',(v #>> '{}')::uuid,true) FROM physio_ctx WHERE k='signed';
SELECT public.qa_physio_assert(public.artefakt_publish('11111111-1111-4111-8111-111111111111',(c.v #>> '{}')::uuid,h.updated_at::text,
 jsonb_build_object('signed_storage_path','11111111-1111-4111-8111-111111111111/'||h.id::text||'/versuche/synthetic.p7m','signed_sha256',repeat('b',64))),
 'existing signature CAS can follow publication') FROM public.abrechnung h,physio_ctx c,physio_ctx t WHERE c.k='signed' AND t.k='takeover' AND h.id=(t.v->>'abrechnungId')::uuid;
RESET ROLE;
SELECT public.qa_physio_assert(NOT has_function_privilege('authenticated','public.abrechnung_physio_finalize(uuid,uuid,text,text,text,bigint,text,jsonb,jsonb)','EXECUTE') AND
 NOT has_function_privilege('anon','public.abrechnung_idempotency_reserve(uuid,text,jsonb,text)','EXECUTE') AND
 has_function_privilege('service_role','public.abrechnung_idempotency_reserve(uuid,text,jsonb,text)','EXECUTE'),'RPC grants restricted');
SELECT public.qa_physio_assert(NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
 AND (p.proname LIKE 'physio\_v1\_%' OR p.proname IN ('abrechnung_idempotency_reserve','physio_artefakt_readback','abrechnung_physio_finalize','abrechnung_physio_abort','physio_storage_readable'))
 AND (has_function_privilege('anon',p.oid,'EXECUTE') OR (has_function_privilege('authenticated',p.oid,'EXECUTE')
  AND p.proname NOT IN ('physio_storage_readable','physio_v1_is_protocol_header')))),
 'all 0113 functions: anon none, authenticated only storage_readable + is_protocol_header (despite default privileges)');
-- No permanent claim may disappear because its worker lease elapsed.
UPDATE public.abrechnung SET publication_lease_until=clock_timestamp()-interval '1 hour' WHERE publication_state='preparing';
SELECT public.qa_physio_assert((SELECT count(*) FROM public.prescription_session_abrechnungsanspruch)=1,'lease expiry never releases permanent claim');
CREATE FUNCTION public.qa_physio_error_any(q text,codes text[],label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE caught boolean:=false; BEGIN
 BEGIN EXECUTE q; EXCEPTION WHEN OTHERS THEN
  IF NOT SQLSTATE=ANY(codes) THEN RAISE EXCEPTION 'FAIL: % expected %, got %: %',label,codes,SQLSTATE,SQLERRM; END IF;
  caught:=true;
 END;
 PERFORM public.qa_physio_assert(caught,label);
END $$;
GRANT EXECUTE ON FUNCTION public.qa_physio_error_any(text,text[],text) TO service_role;
-- ── Abort (0113 abrechnung_physio_abort): owner-/key-/generation-bound, idempotent ──
-- 'second' (key 0002) is still preparing, generation 1, lease expired just above.
CREATE FUNCTION public.qa_physio_abort(p_gen bigint DEFAULT 1,p_owner uuid DEFAULT '11111111-1111-4111-8111-111111111111',
 p_key text DEFAULT 'synthetic-request-0002',p_grund text DEFAULT 'SYNTHETIC_WORKER_FAILED',p_ctx text DEFAULT 'second')
 RETURNS jsonb LANGUAGE sql AS $$ SELECT public.abrechnung_physio_abort(p_owner,(SELECT (v->>'abrechnungId')::uuid FROM pg_temp.physio_ctx WHERE k=p_ctx),p_key,p_gen,p_grund) $$;
GRANT EXECUTE ON FUNCTION public.qa_physio_abort(bigint,uuid,text,text,text) TO service_role,authenticated;
SET LOCAL ROLE service_role;
SELECT public.qa_physio_error('SELECT public.qa_physio_abort(1,''11111111-1111-4111-8111-111111111111'',''synthetic-request-0002'',''freitext mit name'')','22023','abort reason must be PHI-free code');
SELECT public.qa_physio_error('SELECT public.qa_physio_abort(0)','22023','abort generation must be positive');
SELECT public.qa_physio_error('SELECT public.qa_physio_abort(1,''22222222-2222-4222-8222-222222222222'')','42501','foreign owner cannot abort');
SELECT public.qa_physio_error('SELECT public.qa_physio_abort(1,''11111111-1111-4111-8111-111111111111'',''synthetic-request-0001'')','40001','abort key must match header');
SELECT public.qa_physio_error('SELECT public.qa_physio_abort(2,''11111111-1111-4111-8111-111111111111'',''synthetic-request-0001'',''SYNTHETIC_X'',''takeover'')','55000','published header cannot be aborted');
RESET ROLE;
-- Simulated takeover: a successor worker now owns generation 2 (fixture-only direct write).
UPDATE public.abrechnung SET publication_generation=2 WHERE id=(SELECT (v->>'abrechnungId')::uuid FROM physio_ctx WHERE k='second');
SET LOCAL ROLE service_role;
SELECT public.qa_physio_error('SELECT public.qa_physio_abort(1)','40001','stale generation cannot abort successor');
INSERT INTO physio_ctx VALUES('abort',public.qa_physio_abort(2));
SELECT public.qa_physio_assert(v->>'state'='aborted' AND (v->>'wiederholt')::boolean=false AND (v->>'generation')::int=2
 AND (v->>'worker_granted')::boolean=false,'owning generation aborts after lease expiry') FROM physio_ctx WHERE k='abort';
SELECT public.qa_physio_assert((public.qa_physio_abort(2)->>'wiederholt')::boolean AND public.qa_physio_abort(2)->>'abrechnungId'=v->>'abrechnungId','abort retry idempotent') FROM physio_ctx WHERE k='abort';
SELECT public.qa_physio_assert((public.qa_physio_abort(1)->>'state')='aborted','aborted is terminal for any generation of the same key');
SELECT public.qa_physio_assert(public.abrechnung_idempotency_reserve('11111111-1111-4111-8111-111111111111','synthetic-request-0002',v)->>'state'='aborted','reserve after abort returns aborted, no worker') FROM physio_ctx WHERE k='payload';
SELECT public.qa_physio_error(format('SELECT public.artefakt_reserve(%L,%L::uuid,%L,''unsigned'',''dta'',%L)','11111111-1111-4111-8111-111111111111',v->>'abrechnungId',
 '11111111-1111-4111-8111-111111111111/'||(v->>'abrechnungId')||'/physio-v1/2/dta',repeat('e',64)),'P0001','aborted header accepts no new upload') FROM physio_ctx WHERE k='second';
SELECT public.qa_physio_error(format('SELECT public.abrechnung_physio_finalize(%L,%L,%L,%L,%L,2,%L,%L::jsonb,%L::jsonb)','11111111-1111-4111-8111-111111111111',h.id,h.publication_key,
 h.publication_payload_sha256,h.publication_input_sha256,h.updated_at::text,(SELECT v FROM physio_ctx WHERE k='package')::text,(SELECT v FROM physio_ctx WHERE k='manifest')::text),
 '40001','aborted header cannot finalize') FROM public.abrechnung h WHERE h.id=(SELECT (v->>'abrechnungId')::uuid FROM physio_ctx WHERE k='second');
SELECT public.qa_physio_error_any(format('UPDATE public.abrechnung SET status=''erstellt'' WHERE id=%L',v->>'abrechnungId'),ARRAY['P0001','42501'],'service role cannot rewrite aborted header directly (terminal in chain, no grant in fixture)') FROM physio_ctx WHERE k='second';
RESET ROLE;
SELECT public.qa_physio_error(format('UPDATE public.abrechnung SET status=''erstellt'' WHERE id=%L',v->>'abrechnungId'),'P0001','aborted header terminal even for table owner') FROM physio_ctx WHERE k='second';
SELECT public.qa_physio_assert(h.status='verworfen' AND h.verwerfungsgrund='SYNTHETIC_WORKER_FAILED' AND h.publication_state='aborted'
 AND h.publication_result IS NULL AND h.publication_lease_until<=clock_timestamp() AND h.datenaustauschreferenz IS NOT NULL,
 'aborted header verworfen with reason, number gap stays explained') FROM public.abrechnung h WHERE h.id=(SELECT (v->>'abrechnungId')::uuid FROM physio_ctx WHERE k='second');
SELECT public.qa_physio_assert((SELECT count(*) FROM public.prescription_session_abrechnungsanspruch)=1,'abort leaves the committed claim untouched');
SELECT public.qa_physio_assert(NOT has_function_privilege('authenticated','public.abrechnung_physio_abort(uuid,uuid,text,bigint,text)','EXECUTE')
 AND NOT has_function_privilege('anon','public.abrechnung_physio_abort(uuid,uuid,text,bigint,text)','EXECUTE')
 AND has_function_privilege('service_role','public.abrechnung_physio_abort(uuid,uuid,text,bigint,text)','EXECUTE'),'abort RPC service_role only');
-- Explicit guard lifecycle checks, all disposable synthetic data.
SELECT public.qa_physio_assert((SELECT physio_source_revision>0 FROM public.profiles WHERE id='11111111-1111-4111-8111-111111111111'),
 'new owner profile and its new Rx/session initialize revision safely');
SELECT public.qa_physio_error('UPDATE public.prescription_sessions SET done_at=''2026-11-03 10:00Z'' WHERE id=''55555555-5555-4555-8555-555555555555''','55000','claimed session change rejected after commit boundary');
SELECT public.qa_physio_error('DELETE FROM public.prescription_sessions WHERE id=''55555555-5555-4555-8555-555555555555''','55000','claimed session delete rejected');
SAVEPOINT masterdata_after_publish;
UPDATE public.leads SET city='SYNTHETIC NEW CITY' WHERE id='33333333-3333-4333-8333-333333333333';
SELECT public.qa_physio_assert(public.qa_physio_finalize()=v,'master data edit allowed; published result immutable') FROM physio_ctx WHERE k='result';
ROLLBACK TO masterdata_after_publish;
RELEASE masterdata_after_publish;
SELECT public.qa_physio_error('INSERT INTO public.prescription_sessions(prescription_id,session_number) VALUES(''99999999-9999-4999-8999-999999999999'',1)','23503','unknown Rx owner cannot bypass source guard');
SELECT public.qa_physio_error('UPDATE public.kostentraeger SET name=''SYNTHETIC MIXED'' WHERE ik=''100000001''','40001','tenant then catalog mixed write transaction rejected');
SAVEPOINT owner_transfer;
DO $$ DECLARE before_a bigint;before_b bigint;BEGIN
 SELECT physio_source_revision INTO before_a FROM public.profiles WHERE id='11111111-1111-4111-8111-111111111111';
 SELECT physio_source_revision INTO before_b FROM public.profiles WHERE id='22222222-2222-4222-8222-222222222222';
 UPDATE public.leads SET owner_id='22222222-2222-4222-8222-222222222222' WHERE id='33333333-3333-4333-8333-333333333333';
 PERFORM public.qa_physio_assert((SELECT physio_source_revision>before_a FROM public.profiles WHERE id='11111111-1111-4111-8111-111111111111') AND
  (SELECT physio_source_revision>before_b FROM public.profiles WHERE id='22222222-2222-4222-8222-222222222222'),'owner transfer invalidates both old and new tenant revisions');
END $$;
ROLLBACK TO owner_transfer;
RELEASE owner_transfer;
-- Old registered artifacts remain readable; unknown neighboring paths do not.
INSERT INTO public.abrechnung(id,owner_id,kostentraeger_ik,storage_path)
 VALUES('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','100000001','11111111-1111-4111-8111-111111111111/legacy/original.dta');
INSERT INTO public.abrechnung_artefakt_version(owner_id,abrechnung_id,storage_path,kind,role,legacy,state,upload_state)
 VALUES('11111111-1111-4111-8111-111111111111','77777777-7777-4777-8777-777777777777',
 '11111111-1111-4111-8111-111111111111/legacy/original.dta','unsigned','dta',true,'published','uploaded');
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SET LOCAL ROLE authenticated;
SELECT public.qa_physio_assert(public.physio_storage_readable('11111111-1111-4111-8111-111111111111/legacy/original.dta'),'registered legacy without invented hash stays readable');
SELECT public.qa_physio_assert(NOT public.physio_storage_readable('11111111-1111-4111-8111-111111111111/legacy/unknown.dta'),'unknown legacy neighbor stays blocked');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT public.qa_physio_assert(public.qa_physio_finalize()=v,'legacy addition leaves prior result unchanged') FROM physio_ctx WHERE k='result';
SELECT public.qa_physio_error(format('SELECT public.abrechnung_idempotency_reserve(%L,%L,%L::jsonb)',
 '11111111-1111-4111-8111-111111111111','synthetic-vkz-'||vkz||'-blocked',(p.v||jsonb_build_object('vkz',vkz))::text),
 '22023','VKZ '||vkz||' remains blocked') FROM physio_ctx p CROSS JOIN (VALUES('02'),('04'),('10')) f(vkz) WHERE p.k='payload';
RESET ROLE;
\if :{?physio_keep_fixture}
COMMIT;
\else
ROLLBACK;
\endif

-- Optional real two-connection proof, only after committed synthetic fixtures.
-- Invoke with -v physio_keep_fixture=1 -v physio_concurrency=1 in disposable DB.
\if :{?physio_concurrency}
CREATE EXTENSION dblink;
INSERT INTO public.prescriptions(id,owner_id,patient_id,status,rezeptart,rezept_typ,therapie_bereich,kostentraeger_ik,krankenkasse_ik,heilmittel_position,anzahl_einheiten)
 VALUES('64444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','confirmed','kassen','standard','physio','100000001','100000001','X0501',1);
INSERT INTO public.prescription_sessions(id,prescription_id,session_number,status,done_at)
 VALUES('65555555-5555-4555-8555-555555555555','64444444-4444-4444-8444-444444444444',1,'done','2026-11-01 10:00Z');
CREATE TABLE public.qa_physio_jobs(i integer PRIMARY KEY,payload jsonb,reserved jsonb,package jsonb,manifest jsonb);
GRANT SELECT ON public.qa_physio_jobs TO service_role;
INSERT INTO public.qa_physio_jobs(i,payload,package)
 SELECT 1,replace(replace(p.v::text,'44444444-4444-4444-8444-444444444444','64444444-4444-4444-8444-444444444444'),
 '55555555-5555-4555-8555-555555555555','65555555-5555-4555-8555-555555555555')::jsonb,
 replace(replace(k.v::text,'44444444-4444-4444-8444-444444444444','64444444-4444-4444-8444-444444444444'),
 '55555555-5555-4555-8555-555555555555','65555555-5555-4555-8555-555555555555')::jsonb FROM physio_ctx p,physio_ctx k WHERE p.k='payload' AND k.k='package';
SELECT dblink_connect('physio_c1','dbname='||current_database()||' application_name=physio_c1');
SELECT dblink_connect('physio_c2','dbname='||current_database()||' application_name=physio_c2');
SELECT dblink_exec('physio_c1','SET ROLE service_role'); SELECT dblink_exec('physio_c2','SET ROLE service_role');
SELECT dblink_connect('physio_catalog','dbname='||current_database()||' application_name=physio_catalog');
SELECT dblink_exec('physio_catalog','SET ROLE service_role');
GRANT SELECT,UPDATE ON public.profiles,public.kostentraeger TO service_role;
GRANT INSERT,UPDATE,DELETE ON public.prescription_sessions TO service_role;

DO $$ DECLARE q text; a jsonb;b jsonb; BEGIN
 SELECT format('WITH x AS MATERIALIZED (SELECT public.abrechnung_idempotency_reserve(%L,%L,%L::jsonb) r) SELECT r,pg_sleep(0.2)::text FROM x',
  '11111111-1111-4111-8111-111111111111','synthetic-concurrent01',payload::text) INTO q FROM public.qa_physio_jobs WHERE i=1;
 PERFORM dblink_send_query('physio_c1',q);PERFORM dblink_send_query('physio_c2',q);
 SELECT r INTO a FROM dblink_get_result('physio_c1') AS t(r jsonb,pause text);
 SELECT r INTO b FROM dblink_get_result('physio_c2') AS t(r jsonb,pause text);
 PERFORM public.qa_physio_assert(a->>'abrechnungId'=b->>'abrechnungId' AND
  (a->>'worker_granted')::boolean IS DISTINCT FROM (b->>'worker_granted')::boolean,'two connections reserve same key -> same header');
 UPDATE public.qa_physio_jobs SET reserved=a WHERE i=1;
END $$;
-- Drain the command completion before reusing libpq asynchronous connections.
SELECT * FROM dblink_get_result('physio_c1') AS t(r jsonb,pause text);
SELECT * FROM dblink_get_result('physio_c2') AS t(r jsonb,pause text);
-- Two connections abort the same preparing header: exactly one transition, one idempotent reply.
INSERT INTO public.qa_physio_jobs(i,payload,reserved)
 SELECT 9,payload,public.abrechnung_idempotency_reserve('11111111-1111-4111-8111-111111111111','synthetic-concurrent-abort',payload) FROM public.qa_physio_jobs WHERE i=1;
DO $$ DECLARE q text; a jsonb;b jsonb; BEGIN
 SELECT format('WITH x AS MATERIALIZED (SELECT public.abrechnung_physio_abort(%L,%L,%L,1,%L) r) SELECT r,pg_sleep(0.2)::text FROM x',
  '11111111-1111-4111-8111-111111111111',reserved->>'abrechnungId','synthetic-concurrent-abort','SYNTHETIC_PARALLEL') INTO q FROM public.qa_physio_jobs WHERE i=9;
 PERFORM dblink_send_query('physio_c1',q);PERFORM dblink_send_query('physio_c2',q);
 SELECT r INTO a FROM dblink_get_result('physio_c1') AS t(r jsonb,pause text);
 SELECT r INTO b FROM dblink_get_result('physio_c2') AS t(r jsonb,pause text);
 PERFORM public.qa_physio_assert(a->>'state'='aborted' AND b->>'state'='aborted' AND a->>'abrechnungId'=b->>'abrechnungId'
  AND (a->>'wiederholt')::boolean IS DISTINCT FROM (b->>'wiederholt')::boolean,'two connections abort same header -> one transition');
END $$;
SELECT * FROM dblink_get_result('physio_c1') AS t(r jsonb,pause text);
SELECT * FROM dblink_get_result('physio_c2') AS t(r jsonb,pause text);
DELETE FROM public.qa_physio_jobs WHERE i=9;
INSERT INTO public.qa_physio_jobs SELECT 2,payload,
 public.abrechnung_idempotency_reserve('11111111-1111-4111-8111-111111111111','synthetic-concurrent02',payload),package,NULL FROM public.qa_physio_jobs WHERE i=1;
DO $$ DECLARE j record; role text; id uuid; path text; m jsonb; BEGIN
 FOR j IN SELECT * FROM public.qa_physio_jobs ORDER BY i LOOP
  m:='[]';
  FOREACH role IN ARRAY ARRAY['dta','auftrag','begleit'] LOOP
   path:='11111111-1111-4111-8111-111111111111/'||(j.reserved->>'abrechnungId')||'/physio-v1/1/'||role;
   id:=public.artefakt_reserve('11111111-1111-4111-8111-111111111111',(j.reserved->>'abrechnungId')::uuid,path,'unsigned',role,repeat('c',64));
   PERFORM public.artefakt_upload_done('11111111-1111-4111-8111-111111111111',id,true);
   PERFORM public.physio_artefakt_readback('11111111-1111-4111-8111-111111111111',id,1,repeat('c',64),CASE WHEN role='auftrag' THEN 348 ELSE 100 END,public.physio_v1_hash(j.package));
   m:=m||jsonb_build_array(jsonb_build_object('id',id,'role',role,'path',path,'sha256',repeat('c',64),'bytes',CASE WHEN role='auftrag' THEN 348 ELSE 100 END));
  END LOOP;
  UPDATE public.qa_physio_jobs SET manifest=m WHERE i=j.i;
 END LOOP;
END $$;
CREATE FUNCTION public.qa_physio_job_finalize(i_job integer) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE j public.qa_physio_jobs%ROWTYPE;h public.abrechnung%ROWTYPE; BEGIN
 SELECT * INTO j FROM public.qa_physio_jobs WHERE i=i_job;
 SELECT * INTO h FROM public.abrechnung WHERE id=(j.reserved->>'abrechnungId')::uuid;
 RETURN public.abrechnung_physio_finalize(h.owner_id,h.id,h.publication_key,h.publication_payload_sha256,h.publication_input_sha256,1,h.updated_at::text,j.package,j.manifest);
END $$;
GRANT EXECUTE ON FUNCTION public.qa_physio_job_finalize(integer) TO service_role;
DO $$ DECLARE a jsonb;msg text;seen boolean:=false; BEGIN
 PERFORM dblink_send_query('physio_c1','WITH x AS MATERIALIZED (SELECT public.qa_physio_job_finalize(1) r) SELECT r,pg_sleep(1.5)::text FROM x');
 -- Observe c1 sleeping AFTER finalization while its SQL transaction still holds
 -- the owner lock; then issue c2 for a real overlapping transaction.
 FOR i IN 1..100 LOOP
  PERFORM pg_stat_clear_snapshot();
  IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='physio_c1' AND wait_event='PgSleep') THEN seen:=true;EXIT;END IF;
  PERFORM pg_sleep(0.01);
 END LOOP;
 PERFORM public.qa_physio_assert(seen,'first finalizer observed holding open transaction');
 PERFORM dblink_exec('physio_c2','SET statement_timeout=''200ms''');
 PERFORM dblink_exec('physio_c2','UPDATE public.profiles SET business_name=''SYNTHETIC FOREIGN NONBLOCKING'' WHERE id=''22222222-2222-4222-8222-222222222222''');
 PERFORM public.qa_physio_assert(EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='physio_c1' AND wait_event='PgSleep'),
  'foreign practice write commits while finalizer transaction still open');
 PERFORM dblink_exec('physio_c2','INSERT INTO public.prescription_sessions(id,prescription_id,session_number,status) VALUES(''85555555-5555-4555-8555-555555555555'',''64444444-4444-4444-8444-444444444444'',2,''planned'')',false);
 PERFORM public.qa_physio_assert(dblink_error_message('physio_c2') LIKE '%PHYSIO_SOURCE_OWNER_BUSY%',
  'same-owner source INSERT phantom fails fast while finalizing');
 PERFORM dblink_exec('physio_c2','SET statement_timeout=0');
 PERFORM dblink_send_query('physio_catalog','UPDATE public.kostentraeger SET name=''SYNTHETIC SERIALIZED CATALOG'' WHERE ik=''100000001'' RETURNING ik');
 seen:=false;
 FOR i IN 1..100 LOOP
  PERFORM pg_stat_clear_snapshot();
  IF EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='physio_catalog' AND wait_event_type='Lock') THEN seen:=true;EXIT;END IF;
  PERFORM pg_sleep(0.005);
 END LOOP;
 PERFORM public.qa_physio_assert(seen AND dblink_is_busy('physio_catalog')=1,'catalog writer waits for finalizer shared catalog lock');
 PERFORM dblink_send_query('physio_c2','SELECT public.qa_physio_job_finalize(2),null::text');
 SELECT r INTO a FROM dblink_get_result('physio_c1') AS t(r jsonb,pause text);
 PERFORM ik FROM dblink_get_result('physio_catalog') AS t(ik text);
 PERFORM public.qa_physio_assert((SELECT name FROM public.kostentraeger WHERE ik='100000001')='SYNTHETIC SERIALIZED CATALOG','catalog writer commits after finalizer');
 PERFORM r FROM dblink_get_result('physio_c2',false) AS t(r jsonb,pause text);
 msg:=dblink_error_message('physio_c2');
 PERFORM public.qa_physio_assert(a->>'state'='published' AND msg LIKE '%PHYSIO_INPUT_CHANGED%',
  'overlapping finalizers same session: one commit, other source conflict');
 PERFORM public.qa_physio_assert((SELECT count(*) FROM public.prescription_session_abrechnungsanspruch WHERE prescription_session_id='65555555-5555-4555-8555-555555555555')=1,
  'concurrent publication leaves one permanent claim');
 PERFORM public.qa_physio_assert(public.qa_physio_job_finalize(1)=a,'reply loss retry after concurrent commit stable');
END $$;
SELECT dblink_disconnect('physio_c1'); SELECT dblink_disconnect('physio_c2'); SELECT dblink_disconnect('physio_catalog');
\endif
