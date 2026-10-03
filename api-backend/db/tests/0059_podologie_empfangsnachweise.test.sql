-- Isolated PostgreSQL 16 Test Suite for 0059_podologie_empfangsnachweise.sql
-- Runs on synthetic minimal fixtures; does not touch live production data.

\set ON_ERROR_STOP on
\set VERBOSITY verbose

-- 1. Setup synthetic environment, roles, and auth schema
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
    ELSE
        ALTER ROLE service_role BYPASSRLS;
    END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

-- 2. Synthetic prerequisite tables matching production signatures
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid,
    role text NOT NULL CHECK (role IN ('owner', 'employee'))
);
GRANT SELECT ON public.profiles TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.prescriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL
);
GRANT SELECT ON public.prescriptions TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.podologie_behandlungen (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid,
    verordnung_id uuid REFERENCES public.prescriptions(id) ON DELETE SET NULL,
    behandlungsdatum date NOT NULL,
    hpnr_codes text[],
    diagnosegruppe text,
    lokalisation text,
    notizen text,
    betrag_gkv numeric(8,2),
    created_at timestamptz DEFAULT now(),
    invoice_id uuid,
    employee_id uuid,
    storniert_am timestamptz,
    storniert_von uuid,
    storno_grund text,
    therapiezeit_min smallint
);
GRANT SELECT, UPDATE ON public.podologie_behandlungen TO service_role;

-- Exact production GoBD migration: exercise original functions, triggers and CHECK.
\ir ../migrations/0026_podologie_behandlungen_storno.sql

CREATE TABLE IF NOT EXISTS public.prescription_documents (
    id bigint PRIMARY KEY,
    owner_id uuid NOT NULL,
    business_id uuid,
    prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
    patient_id uuid,
    art text NOT NULL DEFAULT 'sonstiges'::text,
    storage_path text NOT NULL DEFAULT 'synthetic/path',
    dateiname text,
    mime_type text,
    groesse_bytes integer,
    notiz text,
    uploaded_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prescription_documents TO service_role;

-- 3. Execute Migration
\ir ../migrations/0059_podologie_empfangsnachweise.sql

-- 4. Seed Synthetic Fixtures
DO $$
DECLARE
    v_owner_a uuid := '00000059-0000-0000-0000-000000000001'::uuid;
    v_owner_b uuid := '00000059-0000-0000-0000-000000000002'::uuid;
    v_emp_a   uuid := '00000059-0000-0000-0000-000000000003'::uuid;
    v_presc_a uuid := '00000059-0000-0000-0000-000000000011'::uuid;
    v_presc_a2 uuid := '00000059-0000-0000-0000-000000000012'::uuid;
    v_presc_b uuid := '00000059-0000-0000-0000-000000000021'::uuid;
BEGIN
    -- Clean local test tables
    DELETE FROM public.podologie_empfangsnachweise;
    DELETE FROM public.prescription_documents;
    DELETE FROM public.podologie_behandlungen;
    DELETE FROM public.prescriptions;
    DELETE FROM public.profiles;

    -- Profiles
    INSERT INTO public.profiles (id, owner_id, role) VALUES
        (v_owner_a, NULL, 'owner'),
        (v_owner_b, NULL, 'owner'),
        (v_emp_a, v_owner_a, 'employee');

    -- Prescriptions
    INSERT INTO public.prescriptions (id, owner_id) VALUES
        (v_presc_a, v_owner_a),
        (v_presc_a2, v_owner_a),
        (v_presc_b, v_owner_b);

    -- Documents
    INSERT INTO public.prescription_documents (id, owner_id, prescription_id, art, dateiname) VALUES
        (59001, v_owner_a, v_presc_a, 'sonstiges', 'empfang_a1.pdf'),
        (59002, v_owner_a, v_presc_a2, 'sonstiges', 'empfang_a2_other.pdf'),
        (59021, v_owner_b, v_presc_b, 'sonstiges', 'empfang_b1.pdf');

    -- Treatments
    INSERT INTO public.podologie_behandlungen (
        id, owner_id, verordnung_id, behandlungsdatum, hpnr_codes, notizen
    ) VALUES (
        '00000059-0000-0000-0000-000000000101'::uuid, v_owner_a, v_presc_a, '2026-10-01', ARRAY['78040', '78010'], 'Behandlung A1'
    ), (
        '00000059-0000-0000-0000-000000000102'::uuid, v_owner_a, v_presc_a, '2026-10-01', ARRAY['78010'], 'Behandlung ohne 78040'
    ), (
        '00000059-0000-0000-0000-000000000103'::uuid, v_owner_a, v_presc_a, '2026-10-01', ARRAY['78040'], 'Stornierte Behandlung'
    ), (
        '00000059-0000-0000-0000-000000000104'::uuid, v_owner_a, NULL, '2026-10-01', ARRAY['78040'], 'Ohne Verordnung'
    ), (
        '00000059-0000-0000-0000-000000000105'::uuid, v_owner_a, v_presc_a, '2026-10-02', ARRAY['78040'], 'Behandlung A5'
    ), (
        '00000059-0000-0000-0000-000000000201'::uuid, v_owner_b, v_presc_b, '2026-10-01', ARRAY['78040'], 'Behandlung B1'
    );

    UPDATE public.podologie_behandlungen
    SET storniert_am = now(), storno_grund = 'Patient abgesagt'
    WHERE id = '00000059-0000-0000-0000-000000000103'::uuid;
END;
$$;

-- 5. Execution Tests as service_role
SET ROLE service_role;

-- Test 5.1: Assert initial state has no events
DO $$
DECLARE
    v_cnt int;
BEGIN
    SELECT count(*) INTO v_cnt FROM public.podologie_empfangsnachweise;
    IF v_cnt <> 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Initial table should be empty, got %', v_cnt;
    END IF;
END;
$$;

-- Test 5.2: Append confirmation snapshot
DO $$
DECLARE
    v_row public.podologie_empfangsnachweise%ROWTYPE;
    v_owner_a uuid := '00000059-0000-0000-0000-000000000001'::uuid;
    v_treat_a1 uuid := '00000059-0000-0000-0000-000000000101'::uuid;
BEGIN
    v_row := public.podologie_empfangsnachweis_append(
        v_owner_a, v_owner_a, v_treat_a1, 'bestaetigt', 'MD', 59001, 'Erstpruefung Beleg'
    );

    IF v_row.status <> 'bestaetigt' THEN
        RAISE EXCEPTION 'TEST FAILED: expected status bestaetigt, got %', v_row.status;
    END IF;
    IF v_row.therapeuteninitialen <> 'MD' THEN
        RAISE EXCEPTION 'TEST FAILED: expected initials MD, got %', v_row.therapeuteninitialen;
    END IF;
    IF v_row.dokument_id <> 59001 THEN
        RAISE EXCEPTION 'TEST FAILED: expected dokument_id 59001, got %', v_row.dokument_id;
    END IF;
    IF v_row.hpnr_code <> '78040' THEN
        RAISE EXCEPTION 'TEST FAILED: expected hpnr_code 78040, got %', v_row.hpnr_code;
    END IF;
    IF v_row.behandlungsdatum <> '2026-10-01'::date THEN
        RAISE EXCEPTION 'TEST FAILED: expected date 2026-10-01, got %', v_row.behandlungsdatum;
    END IF;
    IF v_row.vorgaenger_id IS NOT NULL THEN
        RAISE EXCEPTION 'TEST FAILED: first event must have null vorgaenger_id';
    END IF;
    IF v_row.geprueft_von <> v_owner_a THEN
        RAISE EXCEPTION 'TEST FAILED: geprueft_von mismatch';
    END IF;
    IF v_row.geprueft_am IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: geprueft_am must be populated';
    END IF;
END;
$$;

-- Test 5.3: Append confirmation correction with predecessor linkage
DO $$
DECLARE
    v_row public.podologie_empfangsnachweise%ROWTYPE;
    v_first_id uuid;
    v_owner_a uuid := '00000059-0000-0000-0000-000000000001'::uuid;
    v_treat_a1 uuid := '00000059-0000-0000-0000-000000000101'::uuid;
BEGIN
    SELECT id INTO v_first_id
    FROM public.podologie_empfangsnachweise
    WHERE behandlung_id = v_treat_a1
    ORDER BY event_seq ASC
    LIMIT 1;

    v_row := public.podologie_empfangsnachweis_append(
        v_owner_a, v_owner_a, v_treat_a1, 'bestaetigt', 'KD', 59001, 'Korrektur Initialen'
    );

    IF v_row.vorgaenger_id <> v_first_id THEN
        RAISE EXCEPTION 'TEST FAILED: predecessor must point to first event %, got %', v_first_id, v_row.vorgaenger_id;
    END IF;
    IF v_row.therapeuteninitialen <> 'KD' THEN
        RAISE EXCEPTION 'TEST FAILED: expected updated initials KD, got %', v_row.therapeuteninitialen;
    END IF;
    IF v_row.status <> 'bestaetigt' THEN
        RAISE EXCEPTION 'TEST FAILED: expected status bestaetigt';
    END IF;
END;
$$;

-- Test 5.4: Withdrawal validations and predecessor preservation
DO $$
DECLARE
    v_row public.podologie_empfangsnachweise%ROWTYPE;
    v_second_id uuid;
    v_owner_a uuid := '00000059-0000-0000-0000-000000000001'::uuid;
    v_treat_a1 uuid := '00000059-0000-0000-0000-000000000101'::uuid;
    v_passed boolean := false;
BEGIN
    -- Withdrawal without reason must fail (23514)
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            v_owner_a, v_owner_a, v_treat_a1, 'widerrufen', NULL, NULL, NULL
        );
    EXCEPTION
        WHEN SQLSTATE '23514' THEN
            v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: withdrawal without reason did not fail with 23514';
    END IF;

    -- Withdrawal with blank reason must fail (23514)
    v_passed := false;
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            v_owner_a, v_owner_a, v_treat_a1, 'widerrufen', NULL, NULL, '   '
        );
    EXCEPTION
        WHEN SQLSTATE '23514' THEN
            v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: withdrawal with blank reason did not fail with 23514';
    END IF;

    -- Valid withdrawal with null initials/document must preserve predecessor values
    SELECT id INTO v_second_id
    FROM public.podologie_empfangsnachweise
    WHERE behandlung_id = v_treat_a1
    ORDER BY event_seq DESC
    LIMIT 1;

    v_row := public.podologie_empfangsnachweis_append(
        v_owner_a, v_owner_a, v_treat_a1, 'widerrufen', NULL, NULL, 'Nachpruefung unleserlich'
    );

    IF v_row.status <> 'widerrufen' THEN
        RAISE EXCEPTION 'TEST FAILED: expected status widerrufen, got %', v_row.status;
    END IF;
    IF v_row.therapeuteninitialen <> 'KD' THEN
        RAISE EXCEPTION 'TEST FAILED: expected preserved initials KD, got %', v_row.therapeuteninitialen;
    END IF;
    IF v_row.dokument_id <> 59001 THEN
        RAISE EXCEPTION 'TEST FAILED: expected preserved dokument_id 59001, got %', v_row.dokument_id;
    END IF;
    IF v_row.vorgaenger_id <> v_second_id THEN
        RAISE EXCEPTION 'TEST FAILED: expected vorgaenger_id %, got %', v_second_id, v_row.vorgaenger_id;
    END IF;
END;
$$;

-- Test 5.5: Withdrawal with no predecessor must be rejected
DO $$
DECLARE
    v_owner_a uuid := '00000059-0000-0000-0000-000000000001'::uuid;
    v_treat_a5 uuid := '00000059-0000-0000-0000-000000000105'::uuid;
    v_passed boolean := false;
BEGIN
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            v_owner_a, v_owner_a, v_treat_a5, 'widerrufen', NULL, NULL, 'Abbruch ohne Vorgaenger'
        );
    EXCEPTION
        WHEN SQLSTATE '23514' THEN
            v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: withdrawal without predecessor did not fail with 23514';
    END IF;
END;
$$;

-- Test 5.6: Boundary and rejection cases
DO $$
DECLARE
    v_owner_a uuid := '00000059-0000-0000-0000-000000000001'::uuid;
    v_owner_b uuid := '00000059-0000-0000-0000-000000000002'::uuid;
    v_emp_a   uuid := '00000059-0000-0000-0000-000000000003'::uuid;
    v_treat_a1 uuid := '00000059-0000-0000-0000-000000000101'::uuid;
    v_treat_a2 uuid := '00000059-0000-0000-0000-000000000102'::uuid;
    v_treat_a3 uuid := '00000059-0000-0000-0000-000000000103'::uuid;
    v_treat_a4 uuid := '00000059-0000-0000-0000-000000000104'::uuid;
    v_treat_b1 uuid := '00000059-0000-0000-0000-000000000201'::uuid;
    v_fake_id  uuid := '00000059-0000-0000-0000-999999999999'::uuid;
    v_passed boolean;
BEGIN
    -- Case A: Nonexistent treatment (P0002)
    v_passed := false;
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            v_owner_a, v_owner_a, v_fake_id, 'bestaetigt', 'MD', 59001, 'Nonexistent'
        );
    EXCEPTION
        WHEN SQLSTATE 'P0002' THEN v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: nonexistent treatment did not raise P0002';
    END IF;

    -- Case B: Treatment belongs to different owner (42501)
    v_passed := false;
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            v_owner_a, v_owner_a, v_treat_b1, 'bestaetigt', 'MD', 59001, 'Cross-tenant treatment'
        );
    EXCEPTION
        WHEN SQLSTATE '42501' THEN v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: cross-tenant treatment did not raise 42501';
    END IF;

    -- Case C: Actor mismatch owner_id <> pruefer_id (42501)
    v_passed := false;
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            v_owner_a, v_emp_a, v_treat_a1, 'bestaetigt', 'MD', 59001, 'Pruefer mismatch'
        );
    EXCEPTION
        WHEN SQLSTATE '42501' THEN v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: owner/pruefer mismatch did not raise 42501';
    END IF;

    -- Case D: Non-owner / team actor (employee) as pruefer (42501)
    v_passed := false;
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            v_emp_a, v_emp_a, v_treat_a1, 'bestaetigt', 'MD', 59001, 'Employee actor'
        );
    EXCEPTION
        WHEN SQLSTATE '42501' THEN v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: employee actor did not raise 42501';
    END IF;

    -- Case E: Treatment without 78040 in hpnr_codes (23514)
    v_passed := false;
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            v_owner_a, v_owner_a, v_treat_a2, 'bestaetigt', 'MD', 59001, 'No 78040'
        );
    EXCEPTION
        WHEN SQLSTATE '23514' THEN v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: treatment without 78040 did not raise 23514';
    END IF;

    -- Case F: Cancelled (storniert) treatment (23514)
    v_passed := false;
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            v_owner_a, v_owner_a, v_treat_a3, 'bestaetigt', 'MD', 59001, 'Storno'
        );
    EXCEPTION
        WHEN SQLSTATE '23514' THEN v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: cancelled treatment did not raise 23514';
    END IF;

    -- Case G: Null verordnung_id treatment (23514)
    v_passed := false;
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            v_owner_a, v_owner_a, v_treat_a4, 'bestaetigt', 'MD', 59001, 'Null verordnung'
        );
    EXCEPTION
        WHEN SQLSTATE '23514' THEN v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: treatment without verordnung_id did not raise 23514';
    END IF;

    -- Case H: Cross-tenant document (owner mismatch) (P0002)
    v_passed := false;
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            v_owner_a, v_owner_a, v_treat_a1, 'bestaetigt', 'MD', 59021, 'Doc owned by B'
        );
    EXCEPTION
        WHEN SQLSTATE 'P0002' THEN v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: cross-tenant document did not raise P0002';
    END IF;

    -- Case I: Cross-recipe document (same owner, different verordnung) (P0002)
    v_passed := false;
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            v_owner_a, v_owner_a, v_treat_a1, 'bestaetigt', 'MD', 59002, 'Doc for different verordnung'
        );
    EXCEPTION
        WHEN SQLSTATE 'P0002' THEN v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: cross-recipe document did not raise P0002';
    END IF;

    -- Case J: Invalid initials length bounds (23514)
    v_passed := false;
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            v_owner_a, v_owner_a, v_treat_a1, 'bestaetigt', 'TOOLONGINITIALS123', 59001, 'Too long'
        );
    EXCEPTION
        WHEN SQLSTATE '23514' THEN v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: initials exceeding 16 chars did not raise 23514';
    END IF;
END;
$$;

-- 6. Privilege and Permission Boundary Checks

-- Test 6.1: Direct INSERT by service_role is denied
DO $$
DECLARE
    v_passed boolean := false;
BEGIN
    BEGIN
        INSERT INTO public.podologie_empfangsnachweise (
            owner_id, behandlung_id, behandlungsdatum, hpnr_code, status, geprueft_von, geprueft_am
        ) VALUES (
            '00000059-0000-0000-0000-000000000001'::uuid,
            '00000059-0000-0000-0000-000000000101'::uuid,
            '2026-10-01',
            '78040',
            'bestaetigt',
            '00000059-0000-0000-0000-000000000001'::uuid,
            now()
        );
    EXCEPTION
        WHEN SQLSTATE '42501' THEN
            v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: service_role direct INSERT was not rejected with 42501';
    END IF;
END;
$$;

-- Test 6.2: Authenticated role cannot execute RPC
SET ROLE authenticated;
DO $$
DECLARE
    v_passed boolean := false;
BEGIN
    BEGIN
        PERFORM public.podologie_empfangsnachweis_append(
            '00000059-0000-0000-0000-000000000001'::uuid,
            '00000059-0000-0000-0000-000000000001'::uuid,
            '00000059-0000-0000-0000-000000000101'::uuid,
            'bestaetigt',
            'MD',
            59001,
            'Auth execute attempt'
        );
    EXCEPTION
        WHEN SQLSTATE '42501' THEN
            v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: authenticated RPC execution was not rejected with 42501';
    END IF;
END;
$$;

-- Test 6.3: Anon role cannot select
SET ROLE anon;
DO $$
DECLARE
    v_passed boolean := false;
BEGIN
    BEGIN
        PERFORM count(*) FROM public.podologie_empfangsnachweise;
    EXCEPTION
        WHEN SQLSTATE '42501' THEN
            v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: anon SELECT was not rejected with 42501';
    END IF;
END;
$$;

-- 7. RLS Tenant Isolation Checks under authenticated role
SET ROLE authenticated;

-- Test 7.1: Owner A sees own tenant rows
SET request.jwt.claim.sub = '00000059-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_cnt int;
BEGIN
    SELECT count(*) INTO v_cnt FROM public.podologie_empfangsnachweise;
    IF v_cnt <> 3 THEN
        RAISE EXCEPTION 'TEST FAILED: Owner A should see 3 rows, saw %', v_cnt;
    END IF;
END;
$$;

-- Test 7.2: Employee A (team member) sees Owner A rows
SET request.jwt.claim.sub = '00000059-0000-0000-0000-000000000003';
DO $$
DECLARE
    v_cnt int;
BEGIN
    SELECT count(*) INTO v_cnt FROM public.podologie_empfangsnachweise;
    IF v_cnt <> 3 THEN
        RAISE EXCEPTION 'TEST FAILED: Employee A should see 3 rows for tenant A, saw %', v_cnt;
    END IF;
END;
$$;

-- Test 7.3: Owner B sees zero rows of Owner A
SET request.jwt.claim.sub = '00000059-0000-0000-0000-000000000002';
DO $$
DECLARE
    v_cnt int;
BEGIN
    SELECT count(*) INTO v_cnt FROM public.podologie_empfangsnachweise;
    IF v_cnt <> 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Owner B should see 0 rows, saw %', v_cnt;
    END IF;
END;
$$;

-- 8. Immutability Protection: UPDATE and DELETE denied even for postgres role
RESET ROLE;

DO $$
DECLARE
    v_passed boolean := false;
BEGIN
    BEGIN
        UPDATE public.podologie_empfangsnachweise
        SET grund = 'Tampered reason'
        WHERE hpnr_code = '78040';
    EXCEPTION
        WHEN SQLSTATE '42501' THEN
            v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: UPDATE on podologie_empfangsnachweise was not blocked by trigger';
    END IF;
END;
$$;

DO $$
DECLARE
    v_passed boolean := false;
BEGIN
    BEGIN
        DELETE FROM public.podologie_empfangsnachweise;
    EXCEPTION
        WHEN SQLSTATE '42501' THEN
            v_passed := true;
    END;
    IF NOT v_passed THEN
        RAISE EXCEPTION 'TEST FAILED: DELETE on podologie_empfangsnachweise was not blocked by trigger';
    END IF;
END;
$$;

-- 9. Verify Treatment Table Immutability (0026 guarantee)
DO $$
DECLARE
    v_notizen text;
BEGIN
    SELECT notizen INTO v_notizen
    FROM public.podologie_behandlungen
    WHERE id = '00000059-0000-0000-0000-000000000101'::uuid;

    IF v_notizen <> 'Behandlung A1' THEN
        RAISE EXCEPTION 'TEST FAILED: podologie_behandlungen record was corrupted or altered';
    END IF;
END;
$$;

-- Cleanup by destroying the isolated fixture database, never by deleting immutable rows.
