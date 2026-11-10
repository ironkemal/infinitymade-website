-- 0115: RESTRICTIVE Storage-Policy für den physio-v1-Teilbaum — PostgreSQL-RLS-Semantik, NICHT die Storage-API.
-- Only disposable PostgreSQL after the complete migration chain (0000..0115). storage.objects is whatever the
-- environment provides (real storage-api schema or a stub table with RLS); policies are evaluated by PostgreSQL.
-- Not tested: storage-api request path, createSignedUrl, byte serving. Synthetic rows only, rolled back.
\set ON_ERROR_STOP on
-- Catalog row in its own transaction: 0113 rejects mixed catalog+tenant write transactions (PHYSIO_MIXED_*).
INSERT INTO public.kostentraeger(ik,name) VALUES ('100000092','SYNTHETIC STORAGE') ON CONFLICT DO NOTHING;
BEGIN;
CREATE FUNCTION pg_temp.ok(c boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF c IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; RAISE NOTICE 'PASS: %', label; END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean,text) TO authenticated, anon;
CREATE FUNCTION pg_temp.als(u uuid) RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claim.sub', coalesce(u::text,''), true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.als(uuid) TO authenticated, anon;

-- U1 owner, U2 employee of U1, U3 foreign owner.
INSERT INTO auth.users(id) VALUES ('b1111111-1111-4111-8111-111111111111'),('b2222222-2222-4222-8222-222222222222'),('b3333333-3333-4333-8333-333333333333');
UPDATE public.profiles SET role='owner', is_active=true WHERE id IN ('b1111111-1111-4111-8111-111111111111','b3333333-3333-4333-8333-333333333333');
UPDATE public.profiles SET role='employee', owner_id='b1111111-1111-4111-8111-111111111111' WHERE id='b2222222-2222-4222-8222-222222222222';

-- H1: physio-v1 header that reaches 'published' (direct synthetic writes as table owner, same guards as RPCs).
INSERT INTO public.abrechnung(id,owner_id,kostentraeger_ik,verarbeitungskennzeichen,publication_protocol,publication_state,publication_key,
  publication_payload,publication_payload_sha256,publication_input_sha256,publication_generation,publication_lease_until)
VALUES ('b4444444-4444-4444-8444-444444444441','b1111111-1111-4111-8111-111111111111','100000092','01','physio-v1','preparing',
  'synthetic-storage-0001','{}',repeat('1',64),repeat('2',64),1,clock_timestamp()+interval '1 hour'),
       ('b4444444-4444-4444-8444-444444444442','b1111111-1111-4111-8111-111111111111','100000092','01','physio-v1','preparing',
  'synthetic-storage-0002','{}',repeat('1',64),repeat('2',64),1,clock_timestamp()+interval '1 hour');
INSERT INTO public.abrechnung_artefakt_version(id,owner_id,abrechnung_id,storage_path,kind,role,sha256,upload_state)
VALUES ('b5555555-5555-4555-8555-555555555551','b1111111-1111-4111-8111-111111111111','b4444444-4444-4444-8444-444444444441',
        'b1111111-1111-4111-8111-111111111111/b4444444-4444-4444-8444-444444444441/physio-v1/1/dta','unsigned','dta',repeat('f',64),'uploaded'),
       ('b5555555-5555-4555-8555-555555555552','b1111111-1111-4111-8111-111111111111','b4444444-4444-4444-8444-444444444442',
        'b1111111-1111-4111-8111-111111111111/b4444444-4444-4444-8444-444444444442/physio-v1/1/dta','unsigned','dta',repeat('f',64),'uploaded');
UPDATE public.abrechnung_artefakt_version SET readback_sha256=repeat('f',64),readback_bytes=100,readback_package_sha256=repeat('e',64),readback_at=clock_timestamp()
  WHERE id='b5555555-5555-4555-8555-555555555551';
UPDATE public.abrechnung SET publication_package_sha256=repeat('e',64) WHERE id='b4444444-4444-4444-8444-444444444441';
UPDATE public.abrechnung_artefakt_version SET state='published',published_at=clock_timestamp() WHERE id='b5555555-5555-4555-8555-555555555551';
UPDATE public.abrechnung SET publication_state='published',publication_result='{"ok":true}',publication_at=clock_timestamp()
  WHERE id='b4444444-4444-4444-8444-444444444441';

INSERT INTO storage.objects(bucket_id,name) VALUES
 ('abrechnungen','b1111111-1111-4111-8111-111111111111/b4444444-4444-4444-8444-444444444441/physio-v1/1/dta'),      -- published
 ('abrechnungen','b1111111-1111-4111-8111-111111111111/b4444444-4444-4444-8444-444444444442/physio-v1/1/dta'),      -- preparing
 ('abrechnungen','b1111111-1111-4111-8111-111111111111/b4444444-4444-4444-8444-444444444441/physio-v1/1/unbekannt'),-- unregistered
 ('abrechnungen','b1111111-1111-4111-8111-111111111111/b4444444-4444-4444-8444-444444444441/physio-v1/0/dta'),      -- other generation
 ('abrechnungen','b1111111-1111-4111-8111-111111111111/legacy-abrechnung/original.dta'),                            -- legacy, [3] IS NULL
 ('abrechnungen','b1111111-1111-4111-8111-111111111111/legacy-abrechnung/versuche/x.p7m'),                          -- legacy, deep
 ('abrechnungen','b1111111-1111-4111-8111-111111111111/top.dta'),                                                   -- legacy, flat
 ('avatars','b1111111-1111-4111-8111-111111111111/avatar.png');

-- The draft expression NOT (bucket='abrechnungen' AND [3]='physio-v1') is NULL for <3-folder paths -> RLS denies.
SELECT pg_temp.ok((NOT ('abrechnungen'='abrechnungen' AND (storage.foldername('o/a/original.dta'))[3]='physio-v1')) IS NULL,
  'draft expression would have hidden legacy <owner>/<abrechnung>/datei paths (NULL)');

SELECT pg_temp.als('b1111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok((SELECT array_agg(name ORDER BY name) FROM storage.objects WHERE bucket_id='abrechnungen') = ARRAY[
  'b1111111-1111-4111-8111-111111111111/b4444444-4444-4444-8444-444444444441/physio-v1/1/dta',
  'b1111111-1111-4111-8111-111111111111/legacy-abrechnung/original.dta',
  'b1111111-1111-4111-8111-111111111111/legacy-abrechnung/versuche/x.p7m',
  'b1111111-1111-4111-8111-111111111111/top.dta'],
  'owner: published physio + all legacy paths visible; preparing/unregistered/other generation hidden');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='avatars'), 'other buckets unaffected');
RESET ROLE;

SELECT pg_temp.als('b2222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM storage.objects WHERE bucket_id='abrechnungen')=4
  AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE name LIKE '%444444444442/physio-v1/%'),
  'team member: same view as owner (restrictive policy cannot widen, only cut)');
RESET ROLE;

SELECT pg_temp.als('b3333333-3333-4333-8333-333333333333');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='abrechnungen'), 'foreign owner sees nothing');
RESET ROLE;

SELECT pg_temp.als(NULL);
SET LOCAL ROLE anon;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='avatars')
  AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='abrechnungen'),
  'anon: public avatars still readable without function-permission error, abrechnungen hidden');
RESET ROLE;

SELECT pg_temp.ok((SELECT permissive FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='abrechnungen_physio_direktlesen')='RESTRICTIVE'
  AND (SELECT roles FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='abrechnungen_physio_direktlesen')='{authenticated}'
  AND (SELECT count(*) FROM pg_proc WHERE proname='physio_storage_readable')=1,
  'one restrictive policy for authenticated, one readable function (merged, not duplicated)');
ROLLBACK;
