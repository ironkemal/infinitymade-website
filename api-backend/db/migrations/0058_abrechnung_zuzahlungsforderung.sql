-- 0058 — VKZ03 Zuzahlungsforderung: frozen source and audited proof.
-- SaaS: angewandt 03.10.2026
-- M1.1 / Ops #320, VKZ 03 Zuzahlungsforderung.
-- Sprint §2.3 applied: numbered migration, SaaS via MCP, schema metadata refreshed before commit.
-- Existing abrechnung header is reused: one VKZ03 file per original line.
-- No backfill: historical headers include VKZ04; NULL means unknown.
-- Source content comes from hash-verified original DTA, never today's recipe.
-- This migration protects structural linkage, not billing eligibility.
-- API must prove original VKZ01, passed check levels, notice, unpaid balance,
-- and unchanged original sender IK against original DTA before reservation.
--
-- Lifecycle: INSERT reserves atomically; unique conflict means existing claim.
-- Failure: keep header, mark verworfen. Retry resumes SAME id and linkage.
-- Success: finalize SAME header, immutable claim line, actual VKZ03 totals.
-- Resubmission downloads SAME artifacts. No DELETE or origin release.
-- A cancellation must not unlock another claim without explicit GKV lifecycle.
-- Storage/signature/encryption/status/payment updates remain allowed.
-- Existing header has updated_at + business default triggers, no GoBD lock:
-- db/REGISTER.md (abrechnung); db/SCHEMA-RLS.sql updated_at/business list.
--
-- Frozen intent JSON (VKZ03 only):
-- {grund:"1"|"2"|"5", nachweisDatum:"YYYY-MM-DD",
--  positionIndices:[0,1,...], bestaetigt:true,
--  mahnungId?:"UUID", nachweisDokumentId?:"positive bigint as string",
--  nachweisPruefung:{art,referenz,geprueftAm,geprueftZeitpunkt,
--                    prueferId,patientId,kostentraegerIk,bestaetigt,
--                    gueltigAb?,gueltigBis?,
--                    statusWechselDatum?,zahlungsaufforderungReferenz?,
--                    zahlungsaufforderungDatum?,originalAbzugBestaetigt?,
--                    versandDatum?,versandArt?,nachweisBeigefuegtBestaetigt?,
--                    erfolgloserEinzugBestaetigt?}}
-- nachweisPruefung is mandatory for ALL grounds ('1', '2', '5').
-- mahnungId required only for grund='2'. For grund='1', no mandatory Urbeleg
-- or document ID (GKV Umsetzungsempfehlungen, 13.02.2025, Frage 11).
-- Grund '2' (art='zahlungsaufforderung43c'): exactly 12 keys (8 common + 4 extras:
-- versandDatum, versandArt ('post'|'elektronisch'|'persoenlich'),
-- nachweisBeigefuegtBestaetigt:true, erfolgloserEinzugBestaetigt:true).
-- No gueltigAb/gueltigBis for grund 2 (period validation applies only to 1 and 5).
-- Grund 2 requires open notice (status='offen', no ausfallrechnung source) with
-- expired calendar payment deadline (< Berlin today) and versandDatum <= deadline.
-- Each supplied ID must link to the same owner's original prescription.
-- No names, notes, paths or free-text references.
-- positionIndices index frozen abrechnung_zeile.leistungen / original EHE
-- order (zero-based), NEVER today's appointment IDs or session numbers.
-- API validates submitted business input before reservation; DB restores
-- historical source NULL after today's default-location trigger.
-- Existing abrechnung_owner_all permits ordinary browser INSERTs and UPDATEs.
-- VKZ03 reservation, updates, and deletes specifically require backend
-- service_role or SQL-admin postgres; otherwise authenticated tenant users could
-- reserve sources without eligibility checks or tamper with status, totals,
-- storage paths, and signatures. No broad policy changes.
-- Immutable claim snapshot in abrechnung_zeile serves as durable completion
-- marker: once present, rewind to verworfen or erstellt is rejected, protecting
-- completed claims while permitting legitimate retry of incomplete reservations.
-- IDs are indirect person-linked metadata under existing retention/access;
-- this does not make the resulting claim anonymous.
-- API validates reason-specific legal evidence; boolean is user attestation,
-- never evidence of a verified status switch. Grund='5' requires verified
-- status-switch and historical liability; unconfirmed subset/partial claims
-- must be rejected. Dates and selection stay frozen across retry.
--
-- Expected structural delta: tables +0, columns +3, CHECK constraints +3,
-- FK constraints +1, indexes +1, functions +1, user triggers +1, policies +0.
-- FK creates internal RI triggers: excluded from project user-trigger count.
-- REGISTER role/column note and both dumps must be refreshed when applied.
-- Personally linked audit metadata in frozen JSON (patient ID, certificate refs); no new table, same retention and access scope remain applicable.

BEGIN;

ALTER TABLE public.abrechnung
  ADD COLUMN verarbeitungskennzeichen text,
  ADD COLUMN zuzahlungsforderung_ursprung_id uuid,
  ADD COLUMN zuzahlungsforderung_daten jsonb,
  ADD CONSTRAINT abrechnung_verarbeitungskennzeichen_check
    CHECK (verarbeitungskennzeichen IN ('01', '02', '03', '04')),
  ADD CONSTRAINT abrechnung_zuzahlungsforderung_ursprung_fk
    FOREIGN KEY (zuzahlungsforderung_ursprung_id)
    REFERENCES public.abrechnung_zeile(id) ON DELETE RESTRICT,
  ADD CONSTRAINT abrechnung_zuzahlungsforderung_ursprung_check
    CHECK (
      (verarbeitungskennzeichen IS NOT DISTINCT FROM '03')
      = (zuzahlungsforderung_ursprung_id IS NOT NULL)
    ),
  ADD CONSTRAINT abrechnung_zuzahlungsforderung_daten_check
    CHECK (
      (verarbeitungskennzeichen IS NOT DISTINCT FROM '03')
      = (zuzahlungsforderung_daten IS NOT NULL)
    );

CREATE UNIQUE INDEX abrechnung_vkz03_ursprung_unique
  ON public.abrechnung (zuzahlungsforderung_ursprung_id)
  WHERE verarbeitungskennzeichen = '03';

CREATE FUNCTION public.pruefe_abrechnung_zuzahlungsforderung()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_business_id uuid;
  v_abrechnung_id uuid;
  v_herkunft text;
  v_original_vkz text;
  v_parent_owner_id uuid;
  v_parent_business_id uuid;
  v_prescription_id uuid;
  v_leistungen jsonb;
  v_daten jsonb;
  v_position jsonb;
  v_seen integer[] := ARRAY[]::integer[];
  v_index integer;
  v_proof_date date;
  v_original_kostentraeger_ik text;
  v_patient_id uuid;
  v_proof jsonb;
  v_gueltig_ab date;
  v_gueltig_bis date;
  v_geprueft_am date;
  v_geprueft_zeitpunkt timestamptz;
  v_status_wechsel_datum date;
  v_za_datum date;
  v_versand_datum date;
  v_mahnung_faelligkeit date;
  v_zeile_status text;
BEGIN
  -- SECURITY INVOKER keeps current_user equal to effective PostgREST role.
  -- Do not use SECURITY DEFINER or trust user-editable request metadata.
  -- VKZ03 operations require backend execution (service_role or postgres).
  -- Existing abrechnung_owner_all allows authenticated tenant users to write
  -- ordinary headers, but VKZ03 reservations, updates, and deletes must be
  -- restricted to backend roles to prevent unauthorized status/totals/storage tampering.
  IF (TG_OP = 'DELETE' AND OLD.verarbeitungskennzeichen = '03')
     OR (TG_OP = 'UPDATE' AND (OLD.verarbeitungskennzeichen = '03' OR NEW.verarbeitungskennzeichen = '03'))
     OR (TG_OP = 'INSERT' AND NEW.verarbeitungskennzeichen = '03') THEN
    IF current_user NOT IN ('service_role', 'postgres') THEN
      RAISE EXCEPTION 'VKZ03 operations require backend execution'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.verarbeitungskennzeichen = '03' THEN
      RAISE EXCEPTION 'VKZ03 claim reservation must be retained; retry the same claim'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  -- Never relabel historical files or change established claim identity.
  -- NULL legacy headers also cannot be silently converted to VKZ03.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.verarbeitungskennzeichen IS DISTINCT FROM OLD.verarbeitungskennzeichen
       OR NEW.zuzahlungsforderung_ursprung_id
          IS DISTINCT FROM OLD.zuzahlungsforderung_ursprung_id
       OR NEW.zuzahlungsforderung_daten
          IS DISTINCT FROM OLD.zuzahlungsforderung_daten THEN
      RAISE EXCEPTION 'Abrechnung processing code and source linkage are immutable'
        USING ERRCODE = '23514';
    END IF;

    IF OLD.verarbeitungskennzeichen = '03' THEN
      IF (NEW.owner_id IS DISTINCT FROM OLD.owner_id
          OR NEW.business_id IS DISTINCT FROM OLD.business_id
          OR NEW.kostentraeger_ik IS DISTINCT FROM OLD.kostentraeger_ik
          OR NEW.id IS DISTINCT FROM OLD.id) THEN
        RAISE EXCEPTION 'VKZ03 claim tenant, location and identity are immutable'
          USING ERRCODE = '23514';
      END IF;

      -- Finalized claim rewind protection:
      -- Presence of immutable claim snapshot in abrechnung_zeile is the durable completion marker.
      IF EXISTS (SELECT 1 FROM public.abrechnung_zeile z WHERE z.abrechnung_id = OLD.id) THEN
        IF NEW.status = 'verworfen' THEN
          RAISE EXCEPTION 'VKZ03 finalized claim cannot be discarded (verworfen)'
            USING ERRCODE = '23514';
        END IF;

        IF OLD.status IS DISTINCT FROM 'erstellt' AND NEW.status = 'erstellt' THEN
          RAISE EXCEPTION 'VKZ03 finalized claim cannot rewind to erstellt'
            USING ERRCODE = '23514';
        END IF;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.verarbeitungskennzeichen IS DISTINCT FROM '03' THEN
    RETURN NEW;
  END IF;

  SELECT z.owner_id, z.business_id, z.abrechnung_id, z.herkunft,
         a.verarbeitungskennzeichen, z.prescription_id, z.leistungen,
         a.owner_id, a.business_id, a.kostentraeger_ik, z.status
    INTO v_owner_id, v_business_id, v_abrechnung_id, v_herkunft, v_original_vkz,
         v_prescription_id, v_leistungen, v_parent_owner_id, v_parent_business_id,
         v_original_kostentraeger_ik, v_zeile_status
    FROM public.abrechnung_zeile z
    JOIN public.abrechnung a ON a.id = z.abrechnung_id
   WHERE z.id = NEW.zuzahlungsforderung_ursprung_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VKZ03 original claim line not found or not accessible'
      USING ERRCODE = '23503';
  END IF;

  IF v_parent_owner_id IS DISTINCT FROM v_owner_id
     OR v_parent_business_id IS DISTINCT FROM v_business_id THEN
    RAISE EXCEPTION 'VKZ03 original header and line tenant or location mismatch'
      USING ERRCODE = '23514';
  END IF;

  -- Preserve original location identity even when NULL: the standard trigger
  -- has just supplied today's default, which is not historical evidence.
  IF TG_OP = 'INSERT' AND v_business_id IS NULL THEN
    NEW.business_id := NULL;
  END IF;

  IF NEW.owner_id IS DISTINCT FROM v_owner_id
     OR NEW.business_id IS DISTINCT FROM v_business_id THEN
    RAISE EXCEPTION 'VKZ03 original claim must belong to same tenant and location'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.kostentraeger_ik IS DISTINCT FROM v_original_kostentraeger_ik THEN
    RAISE EXCEPTION 'VKZ03 kostentraeger_ik must match original claim header'
      USING ERRCODE = '23514';
  END IF;

  IF v_abrechnung_id = NEW.id OR v_herkunft IS DISTINCT FROM 'einreichung'
     OR v_zeile_status IS DISTINCT FROM 'akzeptiert'
     OR (v_original_vkz IS NOT NULL AND v_original_vkz <> '01') THEN
    RAISE EXCEPTION 'VKZ03 requires a genuine original VKZ01 submission'
      USING ERRCODE = '23514';
  END IF;

  IF v_prescription_id IS NOT NULL THEN
    SELECT p.patient_id
      INTO v_patient_id
      FROM public.prescriptions p
     WHERE p.id = v_prescription_id
       AND p.owner_id = NEW.owner_id;
  END IF;

  -- Reservation proof metadata validation (INSERT only).
  v_daten := NEW.zuzahlungsforderung_daten;
  IF jsonb_typeof(v_daten) IS DISTINCT FROM 'object'
     OR (v_daten - ARRAY['grund', 'nachweisDatum', 'positionIndices',
                         'bestaetigt', 'mahnungId', 'nachweisDokumentId',
                         'nachweisPruefung']) <> '{}'::jsonb
     OR jsonb_typeof(v_daten->'grund') IS DISTINCT FROM 'string'
     OR (v_daten->>'grund') NOT IN ('1', '2', '5')
     OR v_daten->'bestaetigt' IS DISTINCT FROM 'true'::jsonb
     OR jsonb_typeof(v_daten->'nachweisDatum') IS DISTINCT FROM 'string'
     OR (v_daten->>'nachweisDatum') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     OR jsonb_typeof(v_daten->'positionIndices') IS DISTINCT FROM 'array'
     OR ((v_daten->>'grund') = '2' AND NOT (v_daten ? 'mahnungId'))
     OR NOT (v_daten ? 'nachweisPruefung') THEN
    RAISE EXCEPTION 'Invalid VKZ03 frozen intent metadata'
      USING ERRCODE = '23514';
  END IF;

  BEGIN
    v_proof_date := (v_daten->>'nachweisDatum')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Invalid VKZ03 proof date' USING ERRCODE = '23514';
  END;
  IF v_proof_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Berlin')::date THEN
    RAISE EXCEPTION 'VKZ03 proof date must not be in future'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_array_length(v_daten->'positionIndices') = 0
     OR jsonb_typeof(v_leistungen) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'VKZ03 requires original session indices'
      USING ERRCODE = '23514';
  END IF;
  FOR v_position IN SELECT value FROM jsonb_array_elements(v_daten->'positionIndices') LOOP
    IF jsonb_typeof(v_position) <> 'number'
       OR (v_position #>> '{}') !~ '^(0|[1-9][0-9]{0,5})$' THEN
      RAISE EXCEPTION 'Invalid VKZ03 original session index' USING ERRCODE = '23514';
    END IF;
    v_index := (v_position #>> '{}')::integer;
    IF v_index >= jsonb_array_length(v_leistungen) OR v_index = ANY(v_seen) THEN
      RAISE EXCEPTION 'VKZ03 original session index missing or duplicated'
        USING ERRCODE = '23514';
    END IF;
    v_seen := array_append(v_seen, v_index);
  END LOOP;

  IF v_daten ? 'nachweisDokumentId' THEN
    IF jsonb_typeof(v_daten->'nachweisDokumentId') IS DISTINCT FROM 'string'
       OR (v_daten->>'nachweisDokumentId') !~ '^[1-9][0-9]{0,17}$' THEN
      RAISE EXCEPTION 'Invalid VKZ03 proof document identifier' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.prescription_documents d
                    WHERE d.id = (v_daten->>'nachweisDokumentId')::bigint
                      AND d.owner_id = NEW.owner_id
                      AND d.prescription_id = v_prescription_id
                      AND (d.business_id IS NULL
                           OR d.business_id = v_business_id)
                      AND (d.patient_id IS NULL
                           OR d.patient_id = v_patient_id)) THEN
      RAISE EXCEPTION 'VKZ03 proof document must belong to original prescription'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  v_proof := v_daten->'nachweisPruefung';
  IF jsonb_typeof(v_proof) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid VKZ03 proof object' USING ERRCODE = '23514';
  END IF;

  IF (v_daten->>'grund') = '1' THEN
    IF (v_proof - ARRAY['art', 'referenz', 'gueltigAb', 'gueltigBis',
                        'geprueftAm', 'geprueftZeitpunkt', 'prueferId',
                        'patientId', 'kostentraegerIk', 'bestaetigt']) <> '{}'::jsonb
       OR NOT (v_proof ? 'art' AND v_proof ? 'referenz' AND v_proof ? 'gueltigAb'
               AND v_proof ? 'gueltigBis' AND v_proof ? 'geprueftAm'
               AND v_proof ? 'geprueftZeitpunkt' AND v_proof ? 'prueferId'
               AND v_proof ? 'patientId' AND v_proof ? 'kostentraegerIk'
               AND v_proof ? 'bestaetigt') THEN
      RAISE EXCEPTION 'Invalid VKZ03 proof metadata keys for grund 1'
        USING ERRCODE = '23514';
    END IF;

    IF (v_proof->>'art') IS DISTINCT FROM 'belastungsgrenze62' THEN
      RAISE EXCEPTION 'VKZ03 proof art must be belastungsgrenze62 for grund 1'
        USING ERRCODE = '23514';
    END IF;

  ELSIF (v_daten->>'grund') = '2' THEN
    IF (v_proof - ARRAY['art', 'referenz', 'geprueftAm', 'geprueftZeitpunkt',
                        'prueferId', 'patientId', 'kostentraegerIk', 'bestaetigt',
                        'versandDatum', 'versandArt', 'nachweisBeigefuegtBestaetigt',
                        'erfolgloserEinzugBestaetigt']) <> '{}'::jsonb
       OR NOT (v_proof ? 'art' AND v_proof ? 'referenz' AND v_proof ? 'geprueftAm'
               AND v_proof ? 'geprueftZeitpunkt' AND v_proof ? 'prueferId'
               AND v_proof ? 'patientId' AND v_proof ? 'kostentraegerIk'
               AND v_proof ? 'bestaetigt' AND v_proof ? 'versandDatum'
               AND v_proof ? 'versandArt' AND v_proof ? 'nachweisBeigefuegtBestaetigt'
               AND v_proof ? 'erfolgloserEinzugBestaetigt') THEN
      RAISE EXCEPTION 'Invalid VKZ03 proof metadata keys for grund 2'
        USING ERRCODE = '23514';
    END IF;

    IF (v_proof->>'art') IS DISTINCT FROM 'zahlungsaufforderung43c' THEN
      RAISE EXCEPTION 'VKZ03 proof art must be zahlungsaufforderung43c for grund 2'
        USING ERRCODE = '23514';
    END IF;

  ELSIF (v_daten->>'grund') = '5' THEN
    IF (v_proof - ARRAY['art', 'referenz', 'gueltigAb', 'gueltigBis',
                        'geprueftAm', 'geprueftZeitpunkt', 'prueferId',
                        'patientId', 'kostentraegerIk', 'bestaetigt',
                        'statusWechselDatum', 'zahlungsaufforderungReferenz',
                        'zahlungsaufforderungDatum', 'originalAbzugBestaetigt']) <> '{}'::jsonb
       OR NOT (v_proof ? 'art' AND v_proof ? 'referenz' AND v_proof ? 'gueltigAb'
               AND v_proof ? 'gueltigBis' AND v_proof ? 'geprueftAm'
               AND v_proof ? 'geprueftZeitpunkt' AND v_proof ? 'prueferId'
               AND v_proof ? 'patientId' AND v_proof ? 'kostentraegerIk'
               AND v_proof ? 'bestaetigt' AND v_proof ? 'statusWechselDatum'
               AND v_proof ? 'zahlungsaufforderungReferenz'
               AND v_proof ? 'zahlungsaufforderungDatum'
               AND v_proof ? 'originalAbzugBestaetigt') THEN
      RAISE EXCEPTION 'Invalid VKZ03 proof metadata keys for grund 5'
        USING ERRCODE = '23514';
    END IF;

    IF (v_proof->>'art') IS DISTINCT FROM 'statuswechsel_jahreswechsel' THEN
      RAISE EXCEPTION 'VKZ03 proof art must be statuswechsel_jahreswechsel for grund 5'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF jsonb_typeof(v_proof->'referenz') IS DISTINCT FROM 'string'
     OR (v_proof->>'referenz') = ''
     OR length(v_proof->>'referenz') > 240
     OR btrim(v_proof->>'referenz') <> (v_proof->>'referenz') THEN
    RAISE EXCEPTION 'Invalid VKZ03 proof reference'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_proof->'geprueftAm') IS DISTINCT FROM 'string'
     OR (v_proof->>'geprueftAm') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'Invalid VKZ03 proof geprueftAm date format'
      USING ERRCODE = '23514';
  END IF;

  BEGIN
    v_geprueft_am := (v_proof->>'geprueftAm')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Invalid VKZ03 proof geprueftAm date' USING ERRCODE = '23514';
  END;

  IF v_geprueft_am > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Berlin')::date THEN
    RAISE EXCEPTION 'VKZ03 proof geprueftAm date must not be in future'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_proof->'geprueftZeitpunkt') IS DISTINCT FROM 'string'
     OR (v_proof->>'geprueftZeitpunkt') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?Z$' THEN
    RAISE EXCEPTION 'Invalid VKZ03 proof inspection timestamp (strict UTC required)'
      USING ERRCODE = '23514';
  END IF;

  BEGIN
    v_geprueft_zeitpunkt := (v_proof->>'geprueftZeitpunkt')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Invalid VKZ03 proof inspection timestamp' USING ERRCODE = '23514';
  END;

  IF v_geprueft_zeitpunkt > CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'VKZ03 proof inspection timestamp must not be in future'
      USING ERRCODE = '23514';
  END IF;

  IF (v_geprueft_zeitpunkt AT TIME ZONE 'Europe/Berlin')::date <> v_geprueft_am THEN
    RAISE EXCEPTION 'VKZ03 proof inspection timestamp must match geprueftAm date in Europe/Berlin'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_proof->'prueferId') IS DISTINCT FROM 'string'
     OR (v_proof->>'prueferId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR (v_proof->>'prueferId')::uuid IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'VKZ03 proof prueferId must match owner'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_proof->'patientId') IS DISTINCT FROM 'string'
     OR (v_proof->>'patientId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR v_patient_id IS NULL
     OR (v_proof->>'patientId')::uuid IS DISTINCT FROM v_patient_id THEN
    RAISE EXCEPTION 'VKZ03 proof patientId must match original prescription'
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_proof->'kostentraegerIk') IS DISTINCT FROM 'string'
     OR (v_proof->>'kostentraegerIk') !~ '^[0-9]{9}$'
     OR (v_proof->>'kostentraegerIk') IS DISTINCT FROM v_original_kostentraeger_ik THEN
    RAISE EXCEPTION 'VKZ03 proof kostentraegerIk must match original claim header IK'
      USING ERRCODE = '23514';
  END IF;

  IF v_proof->'bestaetigt' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'VKZ03 proof confirmation must be strict boolean true'
      USING ERRCODE = '23514';
  END IF;

  -- Period validation applies ONLY to grounds 1 and 5 (ground 2 has no gueltigAb/gueltigBis)
  IF (v_daten->>'grund') IN ('1', '5') THEN
    IF jsonb_typeof(v_proof->'gueltigAb') IS DISTINCT FROM 'string'
       OR (v_proof->>'gueltigAb') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       OR jsonb_typeof(v_proof->'gueltigBis') IS DISTINCT FROM 'string'
       OR (v_proof->>'gueltigBis') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Invalid VKZ03 proof validity dates format'
        USING ERRCODE = '23514';
    END IF;

    BEGIN
      v_gueltig_ab := (v_proof->>'gueltigAb')::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Invalid VKZ03 proof gueltigAb date' USING ERRCODE = '23514';
    END;

    BEGIN
      v_gueltig_bis := (v_proof->>'gueltigBis')::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Invalid VKZ03 proof gueltigBis date' USING ERRCODE = '23514';
    END;

    IF v_gueltig_bis < v_gueltig_ab THEN
      RAISE EXCEPTION 'VKZ03 proof validity period end must be on or after start'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF (v_daten->>'grund') = '5' THEN
    IF jsonb_typeof(v_proof->'statusWechselDatum') IS DISTINCT FROM 'string'
       OR (v_proof->>'statusWechselDatum') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Invalid VKZ03 status change date format'
        USING ERRCODE = '23514';
    END IF;

    BEGIN
      v_status_wechsel_datum := (v_proof->>'statusWechselDatum')::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Invalid VKZ03 status change date' USING ERRCODE = '23514';
    END;

    IF v_status_wechsel_datum > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Berlin')::date THEN
      RAISE EXCEPTION 'VKZ03 status change date must not be in future'
        USING ERRCODE = '23514';
    END IF;

    IF v_status_wechsel_datum <= v_gueltig_bis THEN
      RAISE EXCEPTION 'VKZ03 status change date must be after exemption period end'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(v_proof->'zahlungsaufforderungReferenz') IS DISTINCT FROM 'string'
       OR (v_proof->>'zahlungsaufforderungReferenz') = ''
       OR length(v_proof->>'zahlungsaufforderungReferenz') > 240
       OR btrim(v_proof->>'zahlungsaufforderungReferenz') <> (v_proof->>'zahlungsaufforderungReferenz') THEN
      RAISE EXCEPTION 'Invalid VKZ03 payment request reference'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(v_proof->'zahlungsaufforderungDatum') IS DISTINCT FROM 'string'
       OR (v_proof->>'zahlungsaufforderungDatum') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Invalid VKZ03 payment request date format'
        USING ERRCODE = '23514';
    END IF;

    BEGIN
      v_za_datum := (v_proof->>'zahlungsaufforderungDatum')::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Invalid VKZ03 payment request date' USING ERRCODE = '23514';
    END;

    IF v_za_datum > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Berlin')::date THEN
      RAISE EXCEPTION 'VKZ03 payment request date must not be in future'
        USING ERRCODE = '23514';
    END IF;

    IF v_za_datum > v_proof_date THEN
      RAISE EXCEPTION 'VKZ03 payment request date must be on or before proof date'
        USING ERRCODE = '23514';
    END IF;

    IF v_za_datum < v_status_wechsel_datum THEN
      RAISE EXCEPTION 'VKZ03 payment request date must be on or after status change date'
        USING ERRCODE = '23514';
    END IF;

    IF v_proof->'originalAbzugBestaetigt' IS DISTINCT FROM 'true'::jsonb THEN
      RAISE EXCEPTION 'VKZ03 original deduction confirmation must be strict boolean true'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF (v_daten->>'grund') = '2' THEN
    IF jsonb_typeof(v_proof->'versandDatum') IS DISTINCT FROM 'string'
       OR (v_proof->>'versandDatum') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Invalid VKZ03 dispatch date format'
        USING ERRCODE = '23514';
    END IF;

    BEGIN
      v_versand_datum := (v_proof->>'versandDatum')::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Invalid VKZ03 dispatch date' USING ERRCODE = '23514';
    END;

    IF v_versand_datum > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Berlin')::date THEN
      RAISE EXCEPTION 'VKZ03 dispatch date must not be in future'
        USING ERRCODE = '23514';
    END IF;

    IF v_versand_datum <> v_proof_date OR v_versand_datum > v_geprueft_am THEN
      RAISE EXCEPTION 'VKZ03 dispatch date must match proof date'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(v_proof->'versandArt') IS DISTINCT FROM 'string'
       OR (v_proof->>'versandArt') NOT IN ('post', 'elektronisch', 'persoenlich') THEN
      RAISE EXCEPTION 'Invalid VKZ03 dispatch type'
        USING ERRCODE = '23514';
    END IF;

    IF v_proof->'nachweisBeigefuegtBestaetigt' IS DISTINCT FROM 'true'::jsonb THEN
      RAISE EXCEPTION 'VKZ03 proof attached confirmation must be strict boolean true'
        USING ERRCODE = '23514';
    END IF;

    IF v_proof->'erfolgloserEinzugBestaetigt' IS DISTINCT FROM 'true'::jsonb THEN
      RAISE EXCEPTION 'VKZ03 unsuccessful collection confirmation must be strict boolean true'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_daten ? 'mahnungId' THEN
    IF jsonb_typeof(v_daten->'mahnungId') IS DISTINCT FROM 'string'
       OR (v_daten->>'mahnungId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Invalid VKZ03 notice identifier' USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(m.neue_faelligkeit, m.original_faelligkeit)
      INTO v_mahnung_faelligkeit
      FROM public.mahnungen m
     WHERE m.id = (v_daten->>'mahnungId')::uuid
       AND m.owner_id = NEW.owner_id
       AND m.prescription_id = v_prescription_id
       AND m.patient_id = v_patient_id
       AND m.ausfallrechnung_id IS NULL
       AND m.status = 'offen';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'VKZ03 notice must belong to original prescription'
        USING ERRCODE = '23514';
    END IF;

    IF v_mahnung_faelligkeit IS NULL
       OR v_mahnung_faelligkeit >= (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Berlin')::date THEN
      RAISE EXCEPTION 'VKZ03 notice deadline has not expired'
        USING ERRCODE = '23514';
    END IF;

    IF (v_daten->>'grund') = '2' AND v_versand_datum > v_mahnung_faelligkeit THEN
      RAISE EXCEPTION 'VKZ03 dispatch date must be on or before notice deadline'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- PostgreSQL executes same-event triggers alphabetically. Run AFTER
-- trg_set_business_id so its default cannot change location after validation.
-- Historical source business_id=NULL is explicitly restored to NULL; a known
-- historical location must match exactly. Never adopt today's default location.
CREATE TRIGGER trg_z_pruefe_abrechnung_zuzahlungsforderung
  BEFORE INSERT OR UPDATE OR DELETE ON public.abrechnung
  FOR EACH ROW EXECUTE FUNCTION public.pruefe_abrechnung_zuzahlungsforderung();

-- Trigger execution does not require exposing this function as an RPC.
REVOKE ALL ON FUNCTION public.pruefe_abrechnung_zuzahlungsforderung()
  FROM PUBLIC, anon, authenticated;

COMMIT;
