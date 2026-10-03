-- Migration 0059_podologie_empfangsnachweise.sql
-- Append-only paper-receipt inspection log for Podologie treatments with HPNR 78040.
-- SaaS: angewandt 03.10.2026 (MCP: 20261003193551, podologie_empfangsnachweise_0059).

BEGIN;

-- 1. Table public.podologie_empfangsnachweise
CREATE TABLE IF NOT EXISTS public.podologie_empfangsnachweise (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_seq bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
    owner_id uuid NOT NULL,
    behandlung_id uuid NOT NULL REFERENCES public.podologie_behandlungen(id) ON DELETE RESTRICT,
    behandlungsdatum date NOT NULL,
    hpnr_code text NOT NULL CHECK (hpnr_code = '78040'),
    therapeuteninitialen text,
    status text NOT NULL CHECK (status IN ('bestaetigt', 'widerrufen')),
    geprueft_von uuid NOT NULL,
    geprueft_am timestamptz NOT NULL,
    dokument_id bigint,
    grund text,
    vorgaenger_id uuid REFERENCES public.podologie_empfangsnachweise(id) ON DELETE RESTRICT
);

-- 2. Index for timeline inspection per treatment
CREATE INDEX IF NOT EXISTS podologie_empfangsnachweise_behandlung_event_idx
    ON public.podologie_empfangsnachweise (behandlung_id, event_seq DESC);

-- 3. Row Level Security: Authenticated owner or team member read-only
ALTER TABLE public.podologie_empfangsnachweise ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS podologie_empfangsnachweise_select_policy ON public.podologie_empfangsnachweise;
CREATE POLICY podologie_empfangsnachweise_select_policy
    ON public.podologie_empfangsnachweise
    FOR SELECT
    TO authenticated, service_role
    USING (
        owner_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = (SELECT auth.uid())
              AND profiles.owner_id = podologie_empfangsnachweise.owner_id
        )
    );

-- 4. Revocations and Grants on Table and Identity Sequence
REVOKE ALL ON TABLE public.podologie_empfangsnachweise FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.podologie_empfangsnachweise TO authenticated, service_role;

DO $$
DECLARE
    seq_name text;
BEGIN
    seq_name := pg_catalog.pg_get_serial_sequence('public.podologie_empfangsnachweise', 'event_seq');
    IF seq_name IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON SEQUENCE ' || seq_name || ' FROM PUBLIC, anon, authenticated, service_role';
    END IF;
END;
$$;

-- 5. Immutability Trigger: Prohibit all UPDATE and DELETE regardless of role
CREATE OR REPLACE FUNCTION public.podologie_empfangsnachweise_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'podologie_empfangsnachweise is strictly append-only: UPDATE and DELETE are forbidden'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_podologie_empfangsnachweise_no_mutation ON public.podologie_empfangsnachweise;
CREATE TRIGGER trg_podologie_empfangsnachweise_no_mutation
    BEFORE UPDATE OR DELETE ON public.podologie_empfangsnachweise
    FOR EACH ROW
    EXECUTE FUNCTION public.podologie_empfangsnachweise_prevent_mutation();

-- 6. RPC public.podologie_empfangsnachweis_append
CREATE OR REPLACE FUNCTION public.podologie_empfangsnachweis_append(
    p_owner_id uuid,
    p_pruefer_id uuid,
    p_behandlung_id uuid,
    p_status text,
    p_therapeuteninitialen text DEFAULT NULL,
    p_dokument_id bigint DEFAULT NULL,
    p_grund text DEFAULT NULL
) RETURNS public.podologie_empfangsnachweise
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_behandlung public.podologie_behandlungen%ROWTYPE;
    v_prev public.podologie_empfangsnachweise%ROWTYPE;
    v_initialen text;
    v_grund text;
    v_dokument_id bigint;
    v_vorgaenger_id uuid := NULL;
    v_now timestamptz;
    v_result public.podologie_empfangsnachweise%ROWTYPE;
BEGIN
    -- Actor verification: caller must supply matching owner and pruefer UUID
    IF p_owner_id IS NULL OR p_pruefer_id IS NULL THEN
        RAISE EXCEPTION 'Owner ID and Pruefer ID must not be null'
            USING ERRCODE = '42501';
    END IF;

    IF p_owner_id IS DISTINCT FROM p_pruefer_id THEN
        RAISE EXCEPTION 'Owner ID and Pruefer ID must match'
            USING ERRCODE = '42501';
    END IF;

    -- Profile must be owner role without an upstream owner_id
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = p_owner_id
          AND role = 'owner'
          AND owner_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Pruefer must be an existing owner profile with owner_id IS NULL'
            USING ERRCODE = '42501';
    END IF;

    -- Treatment ID check
    IF p_behandlung_id IS NULL THEN
        RAISE EXCEPTION 'Treatment ID must not be null'
            USING ERRCODE = '23514';
    END IF;

    -- Status validation
    IF p_status IS NULL OR p_status NOT IN ('bestaetigt', 'widerrufen') THEN
        RAISE EXCEPTION 'Invalid status: %, expected bestaetigt or widerrufen', p_status
            USING ERRCODE = '23514';
    END IF;

    -- Parameter shape checks prior to locking
    IF p_status = 'bestaetigt' THEN
        IF p_therapeuteninitialen IS NULL THEN
            RAISE EXCEPTION 'Therapeuteninitialen must not be null for bestaetigt'
                USING ERRCODE = '23514';
        END IF;
        v_initialen := pg_catalog.btrim(p_therapeuteninitialen, E' \t\r\n');
        IF pg_catalog.length(v_initialen) < 1 OR pg_catalog.length(v_initialen) > 16 THEN
            RAISE EXCEPTION 'Therapeuteninitialen must be between 1 and 16 non-blank characters'
                USING ERRCODE = '23514';
        END IF;

        IF p_grund IS NOT NULL THEN
            v_grund := pg_catalog.btrim(p_grund, E' \t\r\n');
            IF pg_catalog.length(v_grund) > 500 THEN
                RAISE EXCEPTION 'Grund must not exceed 500 characters'
                    USING ERRCODE = '23514';
            END IF;
            IF pg_catalog.length(v_grund) = 0 THEN
                v_grund := NULL;
            END IF;
        ELSE
            v_grund := NULL;
        END IF;
    ELSIF p_status = 'widerrufen' THEN
        IF p_grund IS NULL THEN
            RAISE EXCEPTION 'Grund must not be null for widerrufen'
                USING ERRCODE = '23514';
        END IF;
        v_grund := pg_catalog.btrim(p_grund, E' \t\r\n');
        IF pg_catalog.length(v_grund) < 1 OR pg_catalog.length(v_grund) > 500 THEN
            RAISE EXCEPTION 'Grund for widerrufen must be between 1 and 500 non-blank characters'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Lock treatment row to serialize inspection events for this treatment
    SELECT *
    INTO v_behandlung
    FROM public.podologie_behandlungen
    WHERE id = p_behandlung_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Treatment % not found', p_behandlung_id
            USING ERRCODE = 'P0002';
    END IF;

    IF v_behandlung.owner_id IS DISTINCT FROM p_owner_id THEN
        RAISE EXCEPTION 'Treatment belongs to a different owner'
            USING ERRCODE = '42501';
    END IF;

    IF v_behandlung.storniert_am IS NOT NULL THEN
        RAISE EXCEPTION 'Treatment % is cancelled (storniert)', p_behandlung_id
            USING ERRCODE = '23514';
    END IF;

    IF v_behandlung.hpnr_codes IS NULL OR NOT (v_behandlung.hpnr_codes @> ARRAY['78040'::text]) THEN
        RAISE EXCEPTION 'Treatment does not contain 78040 in hpnr_codes'
            USING ERRCODE = '23514';
    END IF;

    IF v_behandlung.verordnung_id IS NULL THEN
        RAISE EXCEPTION 'Treatment verordnung_id must not be null'
            USING ERRCODE = '23514';
    END IF;

    -- Determine latest predecessor event for this treatment
    SELECT *
    INTO v_prev
    FROM public.podologie_empfangsnachweise
    WHERE behandlung_id = p_behandlung_id
    ORDER BY event_seq DESC
    LIMIT 1;

    IF FOUND THEN
        v_vorgaenger_id := v_prev.id;
    ELSE
        v_vorgaenger_id := NULL;
    END IF;

    -- Handle withdrawal predecessor inheritance and initial checks
    IF p_status = 'widerrufen' THEN
        IF v_vorgaenger_id IS NULL THEN
            RAISE EXCEPTION 'Withdrawal requires an existing predecessor event'
                USING ERRCODE = '23514';
        END IF;

        IF p_therapeuteninitialen IS NULL THEN
            v_initialen := v_prev.therapeuteninitialen;
        ELSE
            v_initialen := pg_catalog.btrim(p_therapeuteninitialen, E' \t\r\n');
            IF pg_catalog.length(v_initialen) < 1 OR pg_catalog.length(v_initialen) > 16 THEN
                RAISE EXCEPTION 'Therapeuteninitialen must be between 1 and 16 non-blank characters'
                    USING ERRCODE = '23514';
            END IF;
        END IF;

        IF p_dokument_id IS NULL THEN
            v_dokument_id := v_prev.dokument_id;
        ELSE
            v_dokument_id := p_dokument_id;
        END IF;
    ELSE
        v_dokument_id := p_dokument_id;
    END IF;

    -- Validate document existence if explicitly provided or non-null
    IF p_dokument_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.prescription_documents
            WHERE id = p_dokument_id
              AND owner_id = p_owner_id
              AND prescription_id = v_behandlung.verordnung_id
        ) THEN
            RAISE EXCEPTION 'Prescription document % not found for owner and verordnung', p_dokument_id
                USING ERRCODE = 'P0002';
        END IF;
    END IF;

    -- Derive current timestamp strictly after lock acquisition
    v_now := pg_catalog.clock_timestamp();

    -- Append new immutable inspection event
    INSERT INTO public.podologie_empfangsnachweise (
        owner_id,
        behandlung_id,
        behandlungsdatum,
        hpnr_code,
        therapeuteninitialen,
        status,
        geprueft_von,
        geprueft_am,
        dokument_id,
        grund,
        vorgaenger_id
    ) VALUES (
        p_owner_id,
        p_behandlung_id,
        v_behandlung.behandlungsdatum,
        '78040',
        v_initialen,
        p_status,
        p_pruefer_id,
        v_now,
        v_dokument_id,
        v_grund,
        v_vorgaenger_id
    ) RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

-- Revoke direct execution from public and users; grant strictly to service_role
REVOKE ALL ON FUNCTION public.podologie_empfangsnachweis_append(uuid, uuid, uuid, text, text, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.podologie_empfangsnachweis_append(uuid, uuid, uuid, text, text, bigint, text) TO service_role;

COMMIT;
