-- ============================================================================
-- Test Suite: 0059_podologie_empfangsnachweise.extra.test.sql
-- Target: public.podologie_empfangsnachweise & public.podologie_behandlungen
-- Preconditions: Runs AFTER existing base fixture test in PostgreSQL 16 DB
-- Synthetic Roles: anon, authenticated, service_role
-- ============================================================================

RESET ROLE;

-- ----------------------------------------------------------------------------
-- 1. Precondition & Base Fixture State Verification (Do not assume state)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    c_owner_id CONSTANT uuid := '00000059-0000-0000-0000-000000000001'::uuid;
    c_t1_id    CONSTANT uuid := '00000059-0000-0000-0000-000000000101'::uuid;
    c_t5_id    CONSTANT uuid := '00000059-0000-0000-0000-000000000105'::uuid;
    v_history text[];
BEGIN
    -- Verify Owner Profile exists and is root owner
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = c_owner_id AND role = 'owner' AND owner_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Fixture precondition failed: Owner % not found in profiles', c_owner_id;
    END IF;

    -- Verify Treatment rows exist
    IF NOT EXISTS (SELECT 1 FROM public.podologie_behandlungen WHERE id = c_t1_id) THEN
        RAISE EXCEPTION 'Fixture precondition failed: Treatment A1 (%) not found', c_t1_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.podologie_behandlungen WHERE id = c_t5_id) THEN
        RAISE EXCEPTION 'Fixture precondition failed: Treatment A5 (%) not found', c_t5_id;
    END IF;

    -- Verify treatment A1 history: confirmed -> corrected confirmation -> withdrawn
    SELECT array_agg(status ORDER BY event_seq ASC)
    INTO v_history
    FROM public.podologie_empfangsnachweise
    WHERE behandlung_id = c_t1_id;

    IF v_history IS NULL OR array_length(v_history, 1) < 3 THEN
        RAISE EXCEPTION 'Fixture state verification failed: A1 expected >= 3 history records, found %',
            COALESCE(array_length(v_history, 1), 0);
    END IF;

    IF v_history[1] <> 'bestaetigt' OR v_history[2] <> 'bestaetigt' OR v_history[3] <> 'widerrufen' THEN
        RAISE EXCEPTION 'Fixture state verification failed: A1 expected history [bestaetigt, bestaetigt, widerrufen], got %',
            v_history;
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Catalog ACL Privilege Checks (has_*_privilege checks across roles)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    seq_name text;
    rec record;
    has_priv boolean;
BEGIN
    RESET ROLE;

    seq_name := pg_catalog.pg_get_serial_sequence('public.podologie_empfangsnachweise', 'event_seq');
    IF seq_name IS NULL THEN
        RAISE EXCEPTION 'Catalog lookup failed: serial sequence for event_seq not found';
    END IF;

    -- Entire ACL table privilege checks
    FOR rec IN
        SELECT * FROM (VALUES
            ('anon', 'SELECT', false),
            ('anon', 'INSERT', false),
            ('anon', 'UPDATE', false),
            ('anon', 'DELETE', false),
            ('authenticated', 'SELECT', true),
            ('authenticated', 'INSERT', false),
            ('authenticated', 'UPDATE', false),
            ('authenticated', 'DELETE', false),
            ('service_role', 'SELECT', true),
            ('service_role', 'INSERT', false),
            ('service_role', 'UPDATE', false),
            ('service_role', 'DELETE', false)
        ) AS t(role_name, priv, expected)
    LOOP
        has_priv := has_table_privilege(rec.role_name, 'public.podologie_empfangsnachweise', rec.priv);
        IF has_priv <> rec.expected THEN
            RAISE EXCEPTION 'ACL table privilege mismatch: role %, privilege %, expected %, got %',
                rec.role_name, rec.priv, rec.expected, has_priv;
        END IF;
    END LOOP;

    -- Entire ACL sequence privilege checks
    FOR rec IN
        SELECT * FROM (VALUES
            ('anon', 'USAGE', false),
            ('anon', 'SELECT', false),
            ('anon', 'UPDATE', false),
            ('authenticated', 'USAGE', false),
            ('authenticated', 'SELECT', false),
            ('authenticated', 'UPDATE', false),
            ('service_role', 'USAGE', false),
            ('service_role', 'SELECT', false),
            ('service_role', 'UPDATE', false)
        ) AS s(role_name, priv, expected)
    LOOP
        has_priv := has_sequence_privilege(rec.role_name, seq_name, rec.priv);
        IF has_priv <> rec.expected THEN
            RAISE EXCEPTION 'ACL sequence privilege mismatch: role %, privilege %, expected %, got %',
                rec.role_name, rec.priv, rec.expected, has_priv;
        END IF;
    END LOOP;

    -- Entire ACL function execute checks
    FOR rec IN
        SELECT * FROM (VALUES
            ('anon', false),
            ('authenticated', false),
            ('service_role', true)
        ) AS f(role_name, expected)
    LOOP
        has_priv := has_function_privilege(rec.role_name, 'public.podologie_empfangsnachweis_append(uuid,uuid,uuid,text,text,bigint,text)', 'EXECUTE');
        IF has_priv <> rec.expected THEN
            RAISE EXCEPTION 'ACL function privilege mismatch: role %, expected EXECUTE=%, got %',
                rec.role_name, rec.expected, has_priv;
        END IF;
    END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Direct DML & Sequence Manipulation Denial (42501) for All Roles
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    c_owner CONSTANT uuid := '00000059-0000-0000-0000-000000000001'::uuid;
    c_t1    CONSTANT uuid := '00000059-0000-0000-0000-000000000101'::uuid;
    seq_name text;
    r_role text;
    r_op text;
    r_sql text;
    v_sqlstate text;
    v_sqlerrm text;
    v_succeeded boolean;
BEGIN
    seq_name := pg_catalog.pg_get_serial_sequence('public.podologie_empfangsnachweise', 'event_seq');

    FOREACH r_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
    LOOP
        FOR r_op, r_sql IN VALUES
            ('INSERT', format('INSERT INTO public.podologie_empfangsnachweise (owner_id, behandlung_id, behandlungsdatum, hpnr_code, status, geprueft_von, geprueft_am) VALUES (%L::uuid, %L::uuid, ''2026-10-01''::date, ''78040'', ''bestaetigt'', %L::uuid, clock_timestamp())', c_owner, c_t1, c_owner)),
            ('UPDATE', format('UPDATE public.podologie_empfangsnachweise SET grund = ''tamper'' WHERE behandlung_id = %L::uuid', c_t1)),
            ('DELETE', format('DELETE FROM public.podologie_empfangsnachweise WHERE behandlung_id = %L::uuid', c_t1)),
            ('nextval', format('SELECT nextval(%L)', seq_name)),
            ('setval', format('SELECT setval(%L, 99999)', seq_name))
        LOOP
            EXECUTE format('SET ROLE %I', r_role);
            v_succeeded := false;
            v_sqlstate := NULL;
            v_sqlerrm := NULL;

            BEGIN
                EXECUTE r_sql;
                v_succeeded := true;
            EXCEPTION WHEN OTHERS THEN
                v_sqlstate := SQLSTATE;
                v_sqlerrm := SQLERRM;
            END;

            RESET ROLE;

            IF v_succeeded THEN
                RAISE EXCEPTION 'Security assertion failed: role % was able to perform direct % on podologie_empfangsnachweise',
                    r_role, r_op;
            END IF;

            IF v_sqlstate <> '42501' THEN
                RAISE EXCEPTION 'Security assertion failed: role % direct % expected SQLSTATE 42501, got % (%)',
                    r_role, r_op, v_sqlstate, v_sqlerrm;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. RPC Negative Validation (SET ROLE service_role, SQLSTATE 23514)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    c_owner CONSTANT uuid := '00000059-0000-0000-0000-000000000001'::uuid;
    c_t1    CONSTANT uuid := '00000059-0000-0000-0000-000000000101'::uuid;
    rec record;
    v_sqlstate text;
    v_sqlerrm text;
    v_succeeded boolean;
BEGIN
    SET ROLE service_role;

    FOR rec IN
        SELECT * FROM (VALUES
            -- Initials validation: empty, tab-only, space+tab, newline, 17 chars
            ('bestaetigt_initial_empty', c_t1, 'bestaetigt', '', NULL::bigint, NULL::text),
            ('bestaetigt_initial_tab_only', c_t1, 'bestaetigt', E'\t', NULL::bigint, NULL::text),
            ('bestaetigt_initial_space_tab', c_t1, 'bestaetigt', E' \t ', NULL::bigint, NULL::text),
            ('bestaetigt_initial_newline', c_t1, 'bestaetigt', E'\n', NULL::bigint, NULL::text),
            ('bestaetigt_initial_17_chars', c_t1, 'bestaetigt', '12345678901234567', NULL::bigint, NULL::text),
            ('bestaetigt_initial_trimmed_17_chars', c_t1, 'bestaetigt', E'  12345678901234567  ', NULL::bigint, NULL::text),
            ('bestaetigt_reason_501_chars', c_t1, 'bestaetigt', 'AB', NULL::bigint, repeat('x', 501)),

            -- Withdrawal reason validation: null, empty, tab-only, space+tab, newline, 501 chars
            ('widerrufen_reason_null', c_t1, 'widerrufen', NULL::text, NULL::bigint, NULL::text),
            ('widerrufen_reason_empty', c_t1, 'widerrufen', NULL::text, NULL::bigint, ''),
            ('widerrufen_reason_tab_only', c_t1, 'widerrufen', NULL::text, NULL::bigint, E'\t'),
            ('widerrufen_reason_space_tab', c_t1, 'widerrufen', NULL::text, NULL::bigint, E' \t\t '),
            ('widerrufen_reason_newline', c_t1, 'widerrufen', NULL::text, NULL::bigint, E'\r\n'),
            ('widerrufen_reason_501_chars', c_t1, 'widerrufen', NULL::text, NULL::bigint, repeat('w', 501)),

            -- Withdrawal initials validation when explicitly provided
            ('widerrufen_initial_tab_only', c_t1, 'widerrufen', E'\t', NULL::bigint, 'Gueltiger Widerrufsgrund'),
            ('widerrufen_initial_17_chars', c_t1, 'widerrufen', '12345678901234567', NULL::bigint, 'Gueltiger Widerrufsgrund'),

            -- Invalid status and missing treatment
            ('status_invalid', c_t1, 'ungueltig', 'AB', NULL::bigint, NULL::text),
            ('status_empty', c_t1, '', 'AB', NULL::bigint, NULL::text),
            ('status_null', c_t1, NULL::text, 'AB', NULL::bigint, NULL::text),
            ('behandlung_null', NULL::uuid, 'bestaetigt', 'AB', NULL::bigint, NULL::text)
        ) AS t(label, behandlung_id, status, initialen, dok_id, grund)
    LOOP
        v_succeeded := false;
        v_sqlstate := NULL;
        v_sqlerrm := NULL;

        BEGIN
            PERFORM public.podologie_empfangsnachweis_append(
                c_owner,
                c_owner,
                rec.behandlung_id,
                rec.status,
                rec.initialen,
                rec.dok_id,
                rec.grund
            );
            v_succeeded := true;
        EXCEPTION WHEN OTHERS THEN
            v_sqlstate := SQLSTATE;
            v_sqlerrm := SQLERRM;
        END;

        IF v_succeeded THEN
            RAISE EXCEPTION 'RPC validation failed for case "%": call unexpectedly succeeded', rec.label;
        END IF;

        IF v_sqlstate <> '23514' THEN
            RAISE EXCEPTION 'RPC validation failed for case "%": expected SQLSTATE 23514, got % (%)',
                rec.label, v_sqlstate, v_sqlerrm;
        END IF;
    END LOOP;

    RESET ROLE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Migration 0026 Treatment Immutability & Storno Validation (RESET ROLE)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    c_t1 CONSTANT uuid := '00000059-0000-0000-0000-000000000101'::uuid;
    c_t5 CONSTANT uuid := '00000059-0000-0000-0000-000000000105'::uuid;
    v_target_id uuid;
    rec record;
    v_sqlstate text;
    v_sqlerrm text;
    v_succeeded boolean;
BEGIN
    RESET ROLE;

    -- Target treatment for mutation validation
    SELECT id INTO v_target_id
    FROM public.podologie_behandlungen
    WHERE id IN (c_t1, c_t5) AND storniert_am IS NULL
    LIMIT 1;

    IF v_target_id IS NULL THEN
        RAISE EXCEPTION '0026 test setup failed: no non-storniert treatment found among fixture treatments';
    END IF;

    -- 5.1 Storno CHECK Constraint 23514 (podologie_behandlungen_storno_grund_chk)
    FOR rec IN
        SELECT * FROM (VALUES
            ('storno_empty', ''),
            ('storno_space', '   '),
            ('storno_null', NULL::text)
        ) AS t(label, grund)
    LOOP
        v_succeeded := false;
        v_sqlstate := NULL;
        v_sqlerrm := NULL;

        BEGIN
            UPDATE public.podologie_behandlungen
            SET storniert_am = clock_timestamp(),
                storno_grund = rec.grund
            WHERE id = v_target_id;
            v_succeeded := true;
        EXCEPTION WHEN OTHERS THEN
            v_sqlstate := SQLSTATE;
            v_sqlerrm := SQLERRM;
        END;

        IF v_succeeded THEN
            RAISE EXCEPTION '0026 Storno CHECK test "%" failed: update succeeded', rec.label;
        END IF;

        IF v_sqlstate <> '23514' THEN
            RAISE EXCEPTION '0026 Storno CHECK test "%" failed: expected 23514, got % (%)',
                rec.label, v_sqlstate, v_sqlerrm;
        END IF;
    END LOOP;

    -- 5.2 Immutable Content Fields UPDATE (P0001 with exact message substring)
    FOR rec IN
        SELECT * FROM (VALUES
            ('behandlungsdatum', format('UPDATE public.podologie_behandlungen SET behandlungsdatum = behandlungsdatum + 1 WHERE id = %L', v_target_id)),
            ('hpnr_codes', format('UPDATE public.podologie_behandlungen SET hpnr_codes = ARRAY[''78040'',''78049''] WHERE id = %L', v_target_id)),
            ('diagnosegruppe', format('UPDATE public.podologie_behandlungen SET diagnosegruppe = ''DF_MUTATED'' WHERE id = %L', v_target_id)),
            ('lokalisation', format('UPDATE public.podologie_behandlungen SET lokalisation = ''beidseits'' WHERE id = %L', v_target_id)),
            ('notizen', format('UPDATE public.podologie_behandlungen SET notizen = ''tamper_note'' WHERE id = %L', v_target_id)),
            ('betrag_gkv', format('UPDATE public.podologie_behandlungen SET betrag_gkv = 123.45 WHERE id = %L', v_target_id)),
            ('owner_id', format('UPDATE public.podologie_behandlungen SET owner_id = gen_random_uuid() WHERE id = %L', v_target_id)),
            ('created_at', format('UPDATE public.podologie_behandlungen SET created_at = clock_timestamp() WHERE id = %L', v_target_id))
        ) AS t(col_name, sql_cmd)
    LOOP
        v_succeeded := false;
        v_sqlstate := NULL;
        v_sqlerrm := NULL;

        BEGIN
            EXECUTE rec.sql_cmd;
            v_succeeded := true;
        EXCEPTION WHEN OTHERS THEN
            v_sqlstate := SQLSTATE;
            v_sqlerrm := SQLERRM;
        END;

        IF v_succeeded THEN
            RAISE EXCEPTION '0026 Immutability test for % failed: update succeeded', rec.col_name;
        END IF;

        IF v_sqlstate <> 'P0001' THEN
            RAISE EXCEPTION '0026 Immutability test for % failed: expected P0001, got % (%)',
                rec.col_name, v_sqlstate, v_sqlerrm;
        END IF;

        IF v_sqlerrm NOT LIKE '%Dokumentierte Behandlung ist unveraenderlich%' THEN
            RAISE EXCEPTION '0026 Immutability test for % failed: expected message substring "Dokumentierte Behandlung ist unveraenderlich", got %',
                rec.col_name, v_sqlerrm;
        END IF;
    END LOOP;

    -- 5.3 Reassigning verordnung_id to another UUID is forbidden (P0001 with substring)
    v_succeeded := false;
    v_sqlstate := NULL;
    v_sqlerrm := NULL;

    BEGIN
        EXECUTE format('UPDATE public.podologie_behandlungen SET verordnung_id = gen_random_uuid() WHERE id = %L', v_target_id);
        v_succeeded := true;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_sqlerrm := SQLERRM;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION '0026 verordnung_id immutability test failed: update unexpectedly succeeded';
    END IF;

    IF v_sqlstate <> 'P0001' OR v_sqlerrm NOT LIKE '%Die Zuordnung zur Verordnung ist festgeschrieben%' THEN
        RAISE EXCEPTION '0026 verordnung_id immutability test failed: expected P0001 with substring, got % (%)',
            v_sqlstate, v_sqlerrm;
    END IF;

    -- 5.4 Direct DELETE on podologie_behandlungen is forbidden (P0001 with substring)
    v_succeeded := false;
    v_sqlstate := NULL;
    v_sqlerrm := NULL;

    BEGIN
        EXECUTE format('DELETE FROM public.podologie_behandlungen WHERE id = %L', v_target_id);
        v_succeeded := true;
    EXCEPTION WHEN OTHERS THEN
        v_sqlstate := SQLSTATE;
        v_sqlerrm := SQLERRM;
    END;

    IF v_succeeded THEN
        RAISE EXCEPTION '0026 DELETE test failed: delete unexpectedly succeeded';
    END IF;

    IF v_sqlstate <> 'P0001' OR v_sqlerrm NOT LIKE '%Eine dokumentierte Behandlung kann nicht geloescht werden%' THEN
        RAISE EXCEPTION '0026 DELETE test failed: expected P0001 with substring, got % (%)',
            v_sqlstate, v_sqlerrm;
    END IF;
END;
$$;

RESET ROLE;
