-- ============================================================================
-- Synthetic Test Suite for Praxura M1.1 Schema Protection (VKZ 03)
-- Tests /tmp/praxura-m1-1-schema.sql on local PostgreSQL 16
-- ============================================================================

\set ON_ERROR_STOP on

-- Detect whether migration is already applied or if we need pre-migration setup
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'abrechnung'
     AND column_name = 'verarbeitungskennzeichen'
) AS has_migration \gset

\if :has_migration
  \echo '=== [PHASE 2: MIGRATION TESTS & ASSERTIONS] ==='
\else
  \echo '=== [PHASE 1: PRE-MIGRATION SYNTHETIC SETUP] ==='
\endif

\if :has_migration
-- ============================================================================
-- PHASE 2: RUN TEST ASSERTIONS AGAINST MIGRATED SCHEMA
-- ============================================================================

SET ROLE postgres;

-- Helper to track and report assertions
CREATE OR REPLACE FUNCTION public.assert_sqlstate(
  p_description text,
  p_sql text,
  p_expected_sqlstate text,
  p_role text DEFAULT 'postgres'
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_actual_sqlstate text;
  v_err_msg text;
BEGIN
  BEGIN
    EXECUTE format('SET ROLE %I', p_role);
    EXECUTE p_sql;
    RESET ROLE;
    IF p_expected_sqlstate IS NOT NULL THEN
      -- Use a distinct state so an expected P0001 cannot catch this assertion
      -- failure and falsely report that a forbidden statement was rejected.
      RAISE EXCEPTION 'Assertion FAILED [%]: Expected SQLSTATE %, but statement SUCCEEDED unexpectedly.',
        p_description, p_expected_sqlstate USING ERRCODE = 'XX000';
    ELSE
      RAISE NOTICE 'ASSERTION PASSED: % (Statement succeeded as expected)', p_description;
    END IF;
    RETURN;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_actual_sqlstate = RETURNED_SQLSTATE,
        v_err_msg = MESSAGE_TEXT;
      RESET ROLE;
      IF p_expected_sqlstate IS NULL THEN
        RAISE EXCEPTION 'Assertion FAILED [%]: Expected SUCCESS, but got SQLSTATE %: %',
          p_description, v_actual_sqlstate, v_err_msg;
      ELSIF v_actual_sqlstate <> p_expected_sqlstate THEN
        RAISE EXCEPTION 'Assertion FAILED [%]: Expected SQLSTATE %, but got %: %',
          p_description, p_expected_sqlstate, v_actual_sqlstate, v_err_msg;
      ELSE
        RAISE NOTICE 'ASSERTION PASSED: % (Got expected SQLSTATE %: %)',
          p_description, v_actual_sqlstate, v_err_msg;
      END IF;
  END;
END;
$$;

-- ----------------------------------------------------------------------------
-- SEED TEST DATA
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_biz1 uuid := '22222222-2222-2222-2222-222222222222';
  v_rx1 uuid := '33333333-3333-3333-3333-333333333333';
  v_pat1 uuid := '88888888-8888-8888-8888-888888888888';
  v_orig_hdr uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_orig_zeile1 uuid := '44444444-4444-4444-4444-444444444444';
  v_orig_hdr_nullbiz uuid := 'bbbbbbba-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_orig_zeile_nullbiz uuid := '55555555-5555-5555-5555-555555555555';
BEGIN
  -- Seed prescription linking rx1 to patient1
  INSERT INTO public.prescriptions (id, owner_id, business_id, patient_id, kostentraeger_ik)
  VALUES (v_rx1, v_owner, v_biz1, v_pat1, '108018145');

  -- Original ordinary VKZ01 submission with business_id = biz1
  INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, status)
  VALUES (v_orig_hdr, v_owner, v_biz1, '108018145', '01', 'gesendet');

  INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
  VALUES (v_orig_zeile1, v_orig_hdr, v_owner, v_biz1, v_rx1, '108018145',
          '[{"positionsnummer": "21101", "einzelbetrag": 25.50}, {"positionsnummer": "21102", "einzelbetrag": 30.00}]'::jsonb,
          'einreichung', 'akzeptiert');

  -- Original ordinary VKZ01 submission zeile for testing Grund 5
  INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
  VALUES ('44444444-0005-4444-4444-444444444444', v_orig_hdr, v_owner, v_biz1, v_rx1, '108018145',
          '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb,
          'einreichung', 'akzeptiert');

  -- Original ordinary VKZ01 submission zeile for testing Grund 5 same-day valid
  INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
  VALUES ('44444444-0055-4444-4444-444444444444', v_orig_hdr, v_owner, v_biz1, v_rx1, '108018145',
          '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb,
          'einreichung', 'akzeptiert');

  -- Extra original zeilen for testing Grund 2 variants
  INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
  VALUES ('44444444-0021-4444-4444-444444444444', v_orig_hdr, v_owner, v_biz1, v_rx1, '108018145',
          '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb,
          'einreichung', 'akzeptiert');

  INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
  VALUES ('44444444-0022-4444-4444-444444444444', v_orig_hdr, v_owner, v_biz1, v_rx1, '108018145',
          '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb,
          'einreichung', 'akzeptiert');

  INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
  VALUES ('44444444-0023-4444-4444-444444444444', v_orig_hdr, v_owner, v_biz1, v_rx1, '108018145',
          '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb,
          'einreichung', 'akzeptiert');

  INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
  VALUES ('44444444-0024-4444-4444-444444444444', v_orig_hdr, v_owner, v_biz1, v_rx1, '108018145',
          '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb,
          'einreichung', 'akzeptiert');

  -- Original ordinary VKZ01 submission with business_id = NULL (historical state)
  INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, status)
  VALUES (v_orig_hdr_nullbiz, v_owner, NULL, '108018145', '01', 'gesendet');
  -- trg_set_business_id defaulted business_id on insert; restore historical NULL on header
  UPDATE public.abrechnung SET business_id = NULL WHERE id = v_orig_hdr_nullbiz;

  INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
  VALUES (v_orig_zeile_nullbiz, v_orig_hdr_nullbiz, v_owner, NULL, v_rx1, '108018145',
          '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb,
          'einreichung', 'akzeptiert');

  -- Open Mahnung for rx1 (genuine expired deadline < today, versandDatum <= deadline)
  INSERT INTO public.mahnungen (id, owner_id, prescription_id, patient_id, ausfallrechnung_id, mahnung_nr, level, amount_eur, original_faelligkeit, neue_faelligkeit, sent_at, status)
  VALUES ('66666666-6666-6666-6666-666666666666', v_owner, v_rx1, v_pat1, NULL, 1, 1, 40.00, '2026-09-15', '2026-09-15', '2026-09-01T08:00:00Z', 'offen');

  -- Paid Mahnung for rx1
  INSERT INTO public.mahnungen (id, owner_id, prescription_id, patient_id, ausfallrechnung_id, mahnung_nr, level, amount_eur, original_faelligkeit, neue_faelligkeit, sent_at, status)
  VALUES ('77777777-7777-7777-7777-777777777777', v_owner, v_rx1, v_pat1, NULL, 2, 1, 40.00, '2026-09-15', '2026-09-15', '2026-09-01T08:00:00Z', 'bezahlt');

  -- Written-off Mahnung for rx1
  INSERT INTO public.mahnungen (id, owner_id, prescription_id, patient_id, ausfallrechnung_id, mahnung_nr, level, amount_eur, original_faelligkeit, neue_faelligkeit, sent_at, status)
  VALUES ('77777777-0002-7777-7777-777777777777', v_owner, v_rx1, v_pat1, NULL, 3, 1, 40.00, '2026-09-15', '2026-09-15', '2026-09-01T08:00:00Z', 'abgeschrieben');

  -- Mahnung linked to Ausfallrechnung (prohibited as source)
  INSERT INTO public.mahnungen (id, owner_id, prescription_id, patient_id, ausfallrechnung_id, mahnung_nr, level, amount_eur, original_faelligkeit, neue_faelligkeit, sent_at, status)
  VALUES ('77777777-0003-7777-7777-777777777777', v_owner, v_rx1, v_pat1, '99999999-0001-9999-9999-999999999999', 4, 1, 40.00, '2026-09-15', '2026-09-15', '2026-09-01T08:00:00Z', 'offen');

  -- Mahnung with unexpired deadline in future
  INSERT INTO public.mahnungen (id, owner_id, prescription_id, patient_id, ausfallrechnung_id, mahnung_nr, level, amount_eur, original_faelligkeit, neue_faelligkeit, sent_at, status)
  VALUES ('77777777-0004-7777-7777-777777777777', v_owner, v_rx1, v_pat1, NULL, 5, 1, 40.00, '2099-01-01', '2099-01-01', '2026-09-01T08:00:00Z', 'offen');

  -- Mahnung with unexpired deadline today
  INSERT INTO public.mahnungen (id, owner_id, prescription_id, patient_id, ausfallrechnung_id, mahnung_nr, level, amount_eur, original_faelligkeit, neue_faelligkeit, sent_at, status)
  VALUES ('77777777-0005-7777-7777-777777777777', v_owner, v_rx1, v_pat1, NULL, 6, 1, 40.00, (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Berlin')::date, (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Berlin')::date, '2026-09-01T08:00:00Z', 'offen');

  -- Mahnung with mismatched patient
  INSERT INTO public.mahnungen (id, owner_id, prescription_id, patient_id, ausfallrechnung_id, mahnung_nr, level, amount_eur, original_faelligkeit, neue_faelligkeit, sent_at, status)
  VALUES ('77777777-0006-7777-7777-777777777777', v_owner, v_rx1, '99999999-9999-9999-9999-999999999999', NULL, 7, 1, 40.00, '2026-09-15', '2026-09-15', '2026-09-01T08:00:00Z', 'offen');

  -- Mahnung with deadline before versandDatum (deadline = 2026-08-15, versand = 2026-09-01)
  INSERT INTO public.mahnungen (id, owner_id, prescription_id, patient_id, ausfallrechnung_id, mahnung_nr, level, amount_eur, original_faelligkeit, neue_faelligkeit, sent_at, status)
  VALUES ('77777777-0007-7777-7777-777777777777', v_owner, v_rx1, v_pat1, NULL, 8, 1, 40.00, '2026-08-15', '2026-08-15', '2026-08-01T08:00:00Z', 'offen');

  -- Mahnung with deadline equal to versandDatum (both 2026-09-01, both expired relative to today)
  INSERT INTO public.mahnungen (id, owner_id, prescription_id, patient_id, ausfallrechnung_id, mahnung_nr, level, amount_eur, original_faelligkeit, neue_faelligkeit, sent_at, status)
  VALUES ('77777777-0008-7777-7777-777777777777', v_owner, v_rx1, v_pat1, NULL, 9, 1, 40.00, '2026-09-01', '2026-09-01', '2026-08-20T08:00:00Z', 'offen');

  -- Mahnung with NULL patient (prohibited per contract)
  INSERT INTO public.mahnungen (id, owner_id, prescription_id, patient_id, ausfallrechnung_id, mahnung_nr, level, amount_eur, original_faelligkeit, neue_faelligkeit, sent_at, status)
  VALUES ('77777777-0009-7777-7777-777777777777', v_owner, v_rx1, NULL, NULL, 10, 1, 40.00, '2026-09-15', '2026-09-15', '2026-09-01T08:00:00Z', 'offen');

  -- Original ordinary VKZ01 submission zeile with non-accepted status (eingereicht)
  INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
  VALUES ('44444444-0099-4444-4444-444444444444', v_orig_hdr, v_owner, v_biz1, v_rx1, '108018145',
          '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb,
          'einreichung', 'eingereicht');

  -- Proof document with NULL business_id and NULL patient_id (both nullable)
  INSERT INTO public.prescription_documents (id, owner_id, business_id, prescription_id, patient_id)
  VALUES (1001, v_owner, NULL, v_rx1, NULL);

  -- Proof document with matching biz1 and matching patient1
  INSERT INTO public.prescription_documents (id, owner_id, business_id, prescription_id, patient_id)
  VALUES (1002, v_owner, v_biz1, v_rx1, v_pat1);

  -- Proof document with foreign business_id
  INSERT INTO public.prescription_documents (id, owner_id, business_id, prescription_id, patient_id)
  VALUES (1003, v_owner, '99999999-9999-9999-9999-999999999999', v_rx1, v_pat1);

  -- Proof document with foreign patient_id
  INSERT INTO public.prescription_documents (id, owner_id, business_id, prescription_id, patient_id)
  VALUES (1004, v_owner, v_biz1, v_rx1, '99999999-9999-9999-9999-999999999999');
END $$;

-- ----------------------------------------------------------------------------
-- ASSERTION 1: 03 authenticated INSERT denied 42501
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  '03 authenticated INSERT denied42501',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '42501',
  'authenticated'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 2: service_role valid reservation
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'service_role valid reservation',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  NULL,
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 3: 03 authenticated UPDATE denied 42501
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  '03 authenticated UPDATE denied42501 (update existing VKZ03 header)',
  $$UPDATE public.abrechnung SET status = 'accepted' WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  '42501',
  'authenticated'
);

SELECT public.assert_sqlstate(
  '03 authenticated UPDATE denied42501 (convert ordinary header to VKZ03)',
  $$UPDATE public.abrechnung SET verarbeitungskennzeichen = '03' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  '42501',
  'authenticated'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 4: duplicate origin 23505 including verworfen
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'duplicate origin23505 while erstellt',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23505',
  'service_role'
);

-- Mark claim as verworfen and test duplicate origin constraint again
SET ROLE service_role;
UPDATE public.abrechnung SET status = 'verworfen', verwerfungsgrund = 'Incomplete preflight'
 WHERE id = 'c1111111-1111-1111-1111-111111111111';
RESET ROLE;

SELECT public.assert_sqlstate(
  'duplicate origin23505 including verworfen',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23505',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 5: service_role incomplete verworfen->erstellt CAS works once
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_rows integer;
BEGIN
  -- First CAS: verworfen -> erstellt must succeed and update exactly 1 row
  SET ROLE service_role;
  UPDATE public.abrechnung SET status = 'erstellt', updated_at = now()
   WHERE id = 'c1111111-1111-1111-1111-111111111111' AND status = 'verworfen';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'First CAS failed: expected 1 row updated, got %', v_rows;
  END IF;
  RAISE NOTICE 'ASSERTION PASSED: service_role incomplete verworfen->erstellt CAS works once (1st CAS updated 1 row)';

  -- Second CAS: repeating CAS must match 0 rows (status is now erstellt)
  SET ROLE service_role;
  UPDATE public.abrechnung SET status = 'erstellt', updated_at = now()
   WHERE id = 'c1111111-1111-1111-1111-111111111111' AND status = 'verworfen';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Second CAS failed: expected 0 rows updated, got %', v_rows;
  END IF;
  RAISE NOTICE 'ASSERTION PASSED: service_role incomplete verworfen->erstellt CAS collision protected (2nd CAS updated 0 rows)';
END $$;

-- ----------------------------------------------------------------------------
-- ASSERTION 6: frozen metadata/tenant/origin changes rejected
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'frozen verarbeitungskennzeichen change rejected',
  $$UPDATE public.abrechnung SET verarbeitungskennzeichen = '01' WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'frozen zuzahlungsforderung_ursprung_id change rejected',
  $$UPDATE public.abrechnung SET zuzahlungsforderung_ursprung_id = '55555555-5555-5555-5555-555555555555' WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'frozen zuzahlungsforderung_daten change rejected',
  $$UPDATE public.abrechnung SET zuzahlungsforderung_daten = '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true}'::jsonb WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'frozen owner_id change rejected',
  $$UPDATE public.abrechnung SET owner_id = '99999999-9999-9999-9999-999999999999' WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'frozen business_id change rejected',
  $$UPDATE public.abrechnung SET business_id = '99999999-9999-9999-9999-999999999999' WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'frozen kostentraeger_ik change rejected',
  $$UPDATE public.abrechnung SET kostentraeger_ik = '999999999' WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'frozen id change rejected',
  $$UPDATE public.abrechnung SET id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 7: DELETE03 forbidden
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'DELETE03 forbidden (authenticated denied 42501)',
  $$DELETE FROM public.abrechnung WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  '42501',
  'authenticated'
);

SELECT public.assert_sqlstate(
  'DELETE03 forbidden (service_role forbidden 23514)',
  $$DELETE FROM public.abrechnung WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 8: invalid dates/missing stricttrue/unknownJSONkeys/invalidindices/prooflink and paidmahnung rejected
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'invalid proof date in future rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2099-01-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'invalid proof date format rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"01.09.2026","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', '23514')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'missing strict true (bestaetigt: false) rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":false,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'string true (bestaetigt: "true") rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":"true","mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'unknown JSON keys rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","freeTextNotes":"illegal","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'invalid index out of bounds rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[99],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'duplicate indices rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0, 0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'missing mahnungId for grund=2 rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'paid mahnung rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"77777777-7777-7777-7777-777777777777","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 9: grund1 no doc accepted
-- ----------------------------------------------------------------------------
-- First seed a separate original zeile for testing grund1
SET ROLE postgres;
INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
VALUES ('44444444-0001-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '108018145',
        '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb, 'einreichung', 'akzeptiert');
RESET ROLE;

SELECT public.assert_sqlstate(
  'grund1 no doc accepted',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-0001-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  NULL,
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 9b: grund5 valid reservation accepted
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'grund5 valid reservation accepted',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c5555555-0005-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-0005-4444-4444-444444444444', '{"grund":"5","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"statuswechsel_jahreswechsel","referenz":"KK-JAHRESWECHSEL-2025-2026","gueltigAb":"2025-01-01","gueltigBis":"2025-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"statusWechselDatum":"2026-01-01","zahlungsaufforderungReferenz":"ZA-2026-01-15","zahlungsaufforderungDatum":"2026-01-15","originalAbzugBestaetigt":true}}', 'erstellt')$$,
  NULL,
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 10: oldbusinessNULL restored
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'oldbusinessNULL reservation accepted',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', NULL, '108018145', '03', '55555555-5555-5555-5555-555555555555', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  NULL,
  'service_role'
);

DO $$
DECLARE
  v_res_biz uuid;
BEGIN
  SELECT business_id INTO v_res_biz FROM public.abrechnung WHERE id = 'c4444444-4444-4444-4444-444444444444';
  IF v_res_biz IS NOT NULL THEN
    RAISE EXCEPTION 'oldbusinessNULL failed: business_id expected NULL, but found %', v_res_biz;
  END IF;
  RAISE NOTICE 'ASSERTION PASSED: oldbusinessNULL restored (business_id is NULL despite trigger default)';
END $$;

-- ----------------------------------------------------------------------------
-- ASSERTION 11: docbusinessNULL valid, doc matching patient valid, foreign nonnull rejected, wrong patient rejected
-- ----------------------------------------------------------------------------
-- Seed zeilen for doc testing
SET ROLE postgres;
INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
VALUES ('44444444-0002-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '108018145',
        '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb, 'einreichung', 'akzeptiert');
INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
VALUES ('44444444-0003-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '108018145',
        '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb, 'einreichung', 'akzeptiert');
INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
VALUES ('44444444-0004-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '108018145',
        '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb, 'einreichung', 'akzeptiert');
RESET ROLE;

-- doc with business_id NULL and patient_id NULL is valid
SELECT public.assert_sqlstate(
  'docbusinessNULL valid',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-0002-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisDokumentId":"1001","nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  NULL,
  'service_role'
);

-- doc with matching patient_id is valid
SELECT public.assert_sqlstate(
  'doc matching patient valid',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c7777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-0004-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisDokumentId":"1002","nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  NULL,
  'service_role'
);

-- doc with foreign non-null business_id rejected
SELECT public.assert_sqlstate(
  'foreign nonnull rejected',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c6666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-0003-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisDokumentId":"1003","nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- doc with foreign patient_id rejected
SELECT public.assert_sqlstate(
  'doc wrong patient rejected',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c8888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-0003-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisDokumentId":"1004","nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 12: Ordinary inserts/updates accepted
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'Ordinary authenticated insert accepted',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, status)
    VALUES ('77777777-aaaa-bbbb-cccc-dddddddddddd', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '01', 'erstellt')$$,
  NULL,
  'authenticated'
);

SELECT public.assert_sqlstate(
  'Ordinary authenticated update accepted',
  $$UPDATE public.abrechnung SET total_eur = 199.95, dateiname = 'ordinary_updated.dta'
    WHERE id = '77777777-aaaa-bbbb-cccc-dddddddddddd'$$,
  NULL,
  'authenticated'
);

SELECT public.assert_sqlstate(
  'Ordinary authenticated delete accepted',
  $$DELETE FROM public.abrechnung WHERE id = '77777777-aaaa-bbbb-cccc-dddddddddddd'$$,
  NULL,
  'authenticated'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 13: finalized03 cannot rewind; signing/payment lifecycle allowed
-- ----------------------------------------------------------------------------
-- Finalize claim c1111111-1111-1111-1111-111111111111 by inserting immutable snapshot
SET ROLE service_role;
INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status, patient_name, versichertennummer)
VALUES ('88888888-8888-8888-8888-888888888888', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '108018145',
        '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb, 'einreichung', 'akzeptiert', 'Synthetische Testperson', 'A123456789');
RESET ROLE;

-- Final header update while still in erstellt status must succeed (resumable completion path)
SELECT public.assert_sqlstate(
  'Finalized header completion update in erstellt status succeeds',
  $$UPDATE public.abrechnung SET total_eur = 25.50, storage_path = 'tenant/2026/10/dta.dta', dateiname = 'VKZ03.dta', rechnungsnummer = 'SR-2026-40-1'
    WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  NULL,
  'service_role'
);

-- Attempt to discard finalized claim (verworfen) MUST be rejected
SELECT public.assert_sqlstate(
  'finalized03 cannot rewind to verworfen',
  $$UPDATE public.abrechnung SET status = 'verworfen', verwerfungsgrund = 'late error'
    WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  '23514',
  'service_role'
);

-- Advance claim to gesendet
SELECT public.assert_sqlstate(
  'Advance finalized claim to gesendet succeeds',
  $$UPDATE public.abrechnung SET status = 'gesendet' WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  NULL,
  'service_role'
);

-- Attempt to rewind from gesendet back to erstellt MUST be rejected
SELECT public.assert_sqlstate(
  'finalized03 cannot rewind from gesendet to erstellt',
  $$UPDATE public.abrechnung SET status = 'erstellt' WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  '23514',
  'service_role'
);

-- Signing lifecycle update allowed
SELECT public.assert_sqlstate(
  'Signing lifecycle updates allowed',
  $$UPDATE public.abrechnung SET signed_storage_path = 'tenant/2026/10/signed.dta', signed_at = now(), signed_sha256 = 'abc123signed'
    WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  NULL,
  'service_role'
);

-- Encryption lifecycle update allowed
SELECT public.assert_sqlstate(
  'Encryption lifecycle updates allowed',
  $$UPDATE public.abrechnung SET encrypted_storage_path = 'tenant/2026/10/enc.dta', encrypted_sha256 = 'def456enc', verschluesselt_am = now(), verschluesselt_fuer_fingerprint = 'fp123'
    WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  NULL,
  'service_role'
);

-- Accepted lifecycle update allowed
SELECT public.assert_sqlstate(
  'Accepted lifecycle status allowed',
  $$UPDATE public.abrechnung SET status = 'accepted' WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  NULL,
  'service_role'
);

-- Payment lifecycle update allowed
SELECT public.assert_sqlstate(
  'Payment lifecycle updates allowed',
  $$UPDATE public.abrechnung SET status = 'paid', paid_at = now() WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  NULL,
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 14: missingproof rejected
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'grund1 missing nachweisPruefung rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund5 missing nachweisPruefung rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"5","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 missing nachweisPruefung rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666"}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 with wrong art and invalid keys rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 15: malformedNestedKeys rejected
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'extra key in grund1 nachweisPruefung rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"extraKey":"illegal"}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'missing required key in grund1 nachweisPruefung rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'missing required key in grund5 nachweisPruefung rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"5","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"statuswechsel_jahreswechsel","referenz":"KK-JAHRESWECHSEL-2025-2026","gueltigAb":"2025-01-01","gueltigBis":"2025-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"statusWechselDatum":"2026-01-01","zahlungsaufforderungReferenz":"ZA-2026-01-15","originalAbzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'non-object nachweisPruefung rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":"invalidString"}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'empty referenz in nachweisPruefung rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"   ","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'untrimmed referenz in nachweisPruefung rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"  KK-BEFR-001  ","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'non-boolean bestaetigt in nachweisPruefung rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":"true"}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 16: nonUTCdate rejected
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'geprueftZeitpunkt with offset +02:00 rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00+02:00","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'geprueftZeitpunkt without Z rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 17: Futurechecktime rejected
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'geprueftZeitpunkt in future rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2099-01-01T00:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'geprueftAm in future rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2099-01-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 17b: Audited day consistency (mismatched day rejected, UTC-prior-day/Berlin-midnight accepted)
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'mismatched geprueftZeitpunkt Berlin day rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-08-31T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SET ROLE postgres;
INSERT INTO public.abrechnung_zeile (id, abrechnung_id, owner_id, business_id, prescription_id, kostentraeger_ik, leistungen, herkunft, status)
VALUES ('44444444-0017-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '108018145',
        '[{"positionsnummer": "21101", "einzelbetrag": 25.50}]'::jsonb, 'einreichung', 'akzeptiert');
RESET ROLE;

SELECT public.assert_sqlstate(
  'UTC-prior-day/Berlin-midnight geprueftZeitpunkt accepted',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c1111111-0017-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-0017-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-08-31T22:30:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  NULL,
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 18: invalidFeb31 rejected
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'gueltigAb Feb 31 rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-02-31","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'gueltigBis Feb 31 rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-02-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'geprueftAm Feb 31 rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-02-31","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 19: wrongpatientIKprüfer rejected
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'wrong patientId rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"99999999-9999-9999-9999-999999999999","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'wrong kostentraegerIk in proof rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"999999999","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'wrong prueferId rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"99999999-9999-9999-9999-999999999999","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 20: art rejected
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'wrong art for grund1 rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"statuswechsel_jahreswechsel","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'wrong art for grund5 rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"5","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-JAHRESWECHSEL-2025-2026","gueltigAb":"2025-01-01","gueltigBis":"2025-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"statusWechselDatum":"2026-01-01","zahlungsaufforderungReferenz":"ZA-2026-01-15","zahlungsaufforderungDatum":"2026-01-15","originalAbzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 21: periodordering rejected
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'gueltigBis < gueltigAb rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-12-31","gueltigBis":"2026-01-01","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  '(grund5) statusWechselDatum <= gueltigBis rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"5","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"statuswechsel_jahreswechsel","referenz":"KK-JAHRESWECHSEL-2025-2026","gueltigAb":"2025-01-01","gueltigBis":"2025-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"statusWechselDatum":"2025-12-31","zahlungsaufforderungReferenz":"ZA-2026-01-15","zahlungsaufforderungDatum":"2026-01-15","originalAbzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  '(grund5) zahlungsaufforderungDatum < statusWechselDatum rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"5","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"statuswechsel_jahreswechsel","referenz":"KK-JAHRESWECHSEL-2025-2026","gueltigAb":"2025-01-01","gueltigBis":"2025-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"statusWechselDatum":"2026-01-01","zahlungsaufforderungReferenz":"ZA-2026-01-15","zahlungsaufforderungDatum":"2025-12-31","originalAbzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  '(grund5) zahlungsaufforderungDatum == statusWechselDatum accepted (same-day valid)',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c5555555-0055-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-0055-4444-4444-444444444444', '{"grund":"5","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"statuswechsel_jahreswechsel","referenz":"KK-JAHRESWECHSEL-2025-2026","gueltigAb":"2025-01-01","gueltigBis":"2025-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"statusWechselDatum":"2026-01-01","zahlungsaufforderungReferenz":"ZA-2026-01-01","zahlungsaufforderungDatum":"2026-01-01","originalAbzugBestaetigt":true}}', 'erstellt')$$,
  NULL,
  'service_role'
);

SELECT public.assert_sqlstate(
  '(grund5) zahlungsaufforderungDatum > nachweisDatum rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"5","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"statuswechsel_jahreswechsel","referenz":"KK-JAHRESWECHSEL-2025-2026","gueltigAb":"2025-01-01","gueltigBis":"2025-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"statusWechselDatum":"2026-01-01","zahlungsaufforderungReferenz":"ZA-2026-01-15","zahlungsaufforderungDatum":"2026-09-02","originalAbzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 22: jsonmodificationreject
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'updating nachweisPruefung on existing VKZ03 record rejected',
  $$UPDATE public.abrechnung
       SET zuzahlungsforderung_daten = jsonb_set(zuzahlungsforderung_daten, '{nachweisPruefung,referenz}', '"MODIFIED"')
     WHERE id = 'c3333333-3333-3333-3333-333333333333'$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 23: Source eligibility & notice patient binding negatives
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'source row with non-accepted status (eingereicht) rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-0099-4444-4444-444444444444', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'mahnung with NULL patient rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"77777777-0009-7777-7777-777777777777","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'mahnung with mismatched patient rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"77777777-0006-7777-7777-777777777777","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'doc with non-null business rejected when origin business is NULL',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', NULL, '108018145', '03', '55555555-5555-5555-5555-555555555555', '{"grund":"1","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"nachweisDokumentId":"1002","nachweisPruefung":{"art":"belastungsgrenze62","referenz":"KK-BEFR-2026-001","gueltigAb":"2026-01-01","gueltigBis":"2026-12-31","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 24: Grund 2 date conflict & notice status/deadline negatives
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'grund2 shipping date != top date rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-08-31","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 shipping date > notice deadline rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"77777777-0007-7777-7777-777777777777","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 mahnung with future deadline rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"77777777-0004-7777-7777-777777777777","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 mahnung with today deadline rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"77777777-0005-7777-7777-777777777777","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 written-off mahnung rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"77777777-0002-7777-7777-777777777777","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 ausfallrechnung mahnung rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"77777777-0003-7777-7777-777777777777","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 25: Grund 2 dispatch type and metadata validation negatives
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'grund2 invalid versandArt enum rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"brief","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 missing versandDatum key rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 missing versandArt key rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 missing nachweisBeigefuegtBestaetigt key rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 missing erfolgloserEinzugBestaetigt key rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 nachweisBeigefuegtBestaetigt false rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":false,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 erfolgloserEinzugBestaetigt false rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":false}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 nachweisBeigefuegtBestaetigt string true rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":"true","erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 erfolgloserEinzugBestaetigt string true rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":"true"}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 with extra key gueltigAb rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true,"gueltigAb":"2026-01-01"}}', 'erstellt')$$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 invalid versandDatum format rejected',
  $$INSERT INTO public.abrechnung (owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-4444-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"01.09.2026","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  '23514',
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 26: Grund 2 positive reservations (valid variants)
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'grund2 valid reservation with versandArt elektronisch accepted',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c2222222-0021-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-0021-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"elektronisch","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  NULL,
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 valid reservation with versandArt persoenlich accepted',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c2222222-0022-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-0022-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"persoenlich","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  NULL,
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 same-day deadline (versandDatum == faelligkeit) accepted',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c2222222-0023-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-0023-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"77777777-0008-7777-7777-777777777777","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  NULL,
  'service_role'
);

SELECT public.assert_sqlstate(
  'grund2 valid reservation with nachweisDokumentId accepted',
  $$INSERT INTO public.abrechnung (id, owner_id, business_id, kostentraeger_ik, verarbeitungskennzeichen, zuzahlungsforderung_ursprung_id, zuzahlungsforderung_daten, status)
    VALUES ('c2222222-0024-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '108018145', '03', '44444444-0024-4444-4444-444444444444', '{"grund":"2","nachweisDatum":"2026-09-01","positionIndices":[0],"bestaetigt":true,"mahnungId":"66666666-6666-6666-6666-666666666666","nachweisDokumentId":"1002","nachweisPruefung":{"art":"zahlungsaufforderung43c","referenz":"MAHN-2026-001","geprueftAm":"2026-09-01","geprueftZeitpunkt":"2026-09-01T10:00:00Z","prueferId":"11111111-1111-1111-1111-111111111111","patientId":"88888888-8888-8888-8888-888888888888","kostentraegerIk":"108018145","bestaetigt":true,"versandDatum":"2026-09-01","versandArt":"post","nachweisBeigefuegtBestaetigt":true,"erfolgloserEinzugBestaetigt":true}}', 'erstellt')$$,
  NULL,
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 27: Strict UTC clock and dispatch/audit chronology regressions
-- PostgreSQL normalizes 24:00 and seconds 60; the audit contract forbids both.
-- ----------------------------------------------------------------------------
INSERT INTO public.abrechnung_zeile (id,abrechnung_id,owner_id,business_id,prescription_id,kostentraeger_ik,leistungen,herkunft,status) VALUES ('abcdefab-7777-4444-4444-444444444444','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','108018145','[{"positionsnummer":"21101","einzelbetrag":25.50}]','einreichung','akzeptiert');

SELECT public.assert_sqlstate(
  'hours24 rejected',
  $cold$INSERT INTO public.abrechnung (owner_id,business_id,kostentraeger_ik,verarbeitungskennzeichen,zuzahlungsforderung_ursprung_id,zuzahlungsforderung_daten,status) VALUES ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','108018145','03','abcdefab-7777-4444-4444-444444444444','{"grund": "2", "nachweisDatum": "2026-09-01", "positionIndices": [0], "bestaetigt": true, "mahnungId": "66666666-6666-6666-6666-666666666666", "nachweisPruefung": {"art": "zahlungsaufforderung43c", "referenz": "COLD-ONLY", "geprueftAm": "2026-09-02", "geprueftZeitpunkt": "2026-09-01T24:00:00Z", "prueferId": "11111111-1111-1111-1111-111111111111", "patientId": "88888888-8888-8888-8888-888888888888", "kostentraegerIk": "108018145", "bestaetigt": true, "versandDatum": "2026-09-01", "versandArt": "post", "nachweisBeigefuegtBestaetigt": true, "erfolgloserEinzugBestaetigt": true}}','erstellt')$cold$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'seconds60 rejected',
  $cold$INSERT INTO public.abrechnung (owner_id,business_id,kostentraeger_ik,verarbeitungskennzeichen,zuzahlungsforderung_ursprung_id,zuzahlungsforderung_daten,status) VALUES ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','108018145','03','abcdefab-7777-4444-4444-444444444444','{"grund": "2", "nachweisDatum": "2026-09-01", "positionIndices": [0], "bestaetigt": true, "mahnungId": "66666666-6666-6666-6666-666666666666", "nachweisPruefung": {"art": "zahlungsaufforderung43c", "referenz": "COLD-ONLY", "geprueftAm": "2026-09-02", "geprueftZeitpunkt": "2026-09-02T10:00:60Z", "prueferId": "11111111-1111-1111-1111-111111111111", "patientId": "88888888-8888-8888-8888-888888888888", "kostentraegerIk": "108018145", "bestaetigt": true, "versandDatum": "2026-09-01", "versandArt": "post", "nachweisBeigefuegtBestaetigt": true, "erfolgloserEinzugBestaetigt": true}}','erstellt')$cold$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'shippingafteraudit rejected',
  $cold$INSERT INTO public.abrechnung (owner_id,business_id,kostentraeger_ik,verarbeitungskennzeichen,zuzahlungsforderung_ursprung_id,zuzahlungsforderung_daten,status) VALUES ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','108018145','03','abcdefab-7777-4444-4444-444444444444','{"grund": "2", "nachweisDatum": "2026-09-01", "positionIndices": [0], "bestaetigt": true, "mahnungId": "66666666-6666-6666-6666-666666666666", "nachweisPruefung": {"art": "zahlungsaufforderung43c", "referenz": "COLD-ONLY", "geprueftAm": "2026-08-31", "geprueftZeitpunkt": "2026-08-31T10:00:00Z", "prueferId": "11111111-1111-1111-1111-111111111111", "patientId": "88888888-8888-8888-8888-888888888888", "kostentraegerIk": "108018145", "bestaetigt": true, "versandDatum": "2026-09-01", "versandArt": "post", "nachweisBeigefuegtBestaetigt": true, "erfolgloserEinzugBestaetigt": true}}','erstellt')$cold$,
  '23514',
  'service_role'
);

SELECT public.assert_sqlstate(
  'shippingbeforeaudit accepted',
  $cold$INSERT INTO public.abrechnung (owner_id,business_id,kostentraeger_ik,verarbeitungskennzeichen,zuzahlungsforderung_ursprung_id,zuzahlungsforderung_daten,status) VALUES ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','108018145','03','abcdefab-7777-4444-4444-444444444444','{"grund": "2", "nachweisDatum": "2026-09-01", "positionIndices": [0], "bestaetigt": true, "mahnungId": "66666666-6666-6666-6666-666666666666", "nachweisPruefung": {"art": "zahlungsaufforderung43c", "referenz": "COLD-ONLY", "geprueftAm": "2026-09-02", "geprueftZeitpunkt": "2026-09-02T10:00:00Z", "prueferId": "11111111-1111-1111-1111-111111111111", "patientId": "88888888-8888-8888-8888-888888888888", "kostentraegerIk": "108018145", "bestaetigt": true, "versandDatum": "2026-09-01", "versandArt": "post", "nachweisBeigefuegtBestaetigt": true, "erfolgloserEinzugBestaetigt": true}}','erstellt')$cold$,
  NULL,
  'service_role'
);

-- ----------------------------------------------------------------------------
-- ASSERTION 28: Existing GoBD snapshot freeze, loaded verbatim from baseline
-- ----------------------------------------------------------------------------
SELECT public.assert_sqlstate(
  'Original freeze rejects gross amount changes',
  $$UPDATE public.abrechnung_zeile SET brutto_eur=1 WHERE id='88888888-8888-8888-8888-888888888888'$$,
  'P0001',
  'service_role'
);

SELECT public.assert_sqlstate(
  'Original freeze rejects copayment changes',
  $$UPDATE public.abrechnung_zeile SET zuzahlung_eur=1 WHERE id='88888888-8888-8888-8888-888888888888'$$,
  'P0001',
  'service_role'
);

SELECT public.assert_sqlstate(
  'Original freeze rejects net amount changes',
  $$UPDATE public.abrechnung_zeile SET netto_eur=1 WHERE id='88888888-8888-8888-8888-888888888888'$$,
  'P0001',
  'service_role'
);

SELECT public.assert_sqlstate(
  'Original freeze rejects session changes',
  $$UPDATE public.abrechnung_zeile SET leistungen='[]'::jsonb WHERE id='88888888-8888-8888-8888-888888888888'$$,
  'P0001',
  'service_role'
);

SELECT public.assert_sqlstate(
  'Original freeze rejects KVNR changes',
  $$UPDATE public.abrechnung_zeile SET versichertennummer='B987654321' WHERE id='88888888-8888-8888-8888-888888888888'$$,
  'P0001',
  'service_role'
);

SELECT public.assert_sqlstate(
  'Original freeze rejects patient name changes',
  $$UPDATE public.abrechnung_zeile SET patient_name='Andere Testperson' WHERE id='88888888-8888-8888-8888-888888888888'$$,
  'P0001',
  'service_role'
);

SELECT public.assert_sqlstate(
  'Original freeze rejects snapshot DELETE',
  $$DELETE FROM public.abrechnung_zeile WHERE id='88888888-8888-8888-8888-888888888888'$$,
  'P0001',
  'service_role'
);

SELECT public.assert_sqlstate(
  'Original freeze permits line status changes',
  $$UPDATE public.abrechnung_zeile SET status='nachgereicht' WHERE id='88888888-8888-8888-8888-888888888888'$$,
  NULL,
  'service_role'
);

SELECT public.assert_sqlstate(
  'Original freeze permits anonymization',
  $$UPDATE public.abrechnung_zeile SET patient_name=NULL, versichertennummer=NULL WHERE id='88888888-8888-8888-8888-888888888888'$$,
  NULL,
  'service_role'
);

\echo '=== ALL TEST ASSERTIONS COMPLETED SUCCESSFULLY ==='

\else
-- ============================================================================
-- PHASE 1: PRE-MIGRATION SYNTHETIC SETUP
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;

CREATE TABLE public.abrechnung (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  kostentraeger_ik text NOT NULL,
  dateiname text,
  rechnungsnummer text,
  total_eur numeric(10,2) DEFAULT 0,
  zuzahlung_total numeric(10,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'erstellt'::text,
  dta_file_size integer,
  dta_segment_count integer,
  prescription_count integer DEFAULT 0,
  rejected_count integer DEFAULT 0,
  storage_path text,
  begleitzettel_path text,
  zaa_uploaded_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  signed_storage_path text,
  signed_at timestamptz,
  signed_by_cert_thumbprint text,
  business_id uuid,
  auftragsdatei_path text,
  auftragsdatei_size integer,
  dta_sha256 text,
  auftragsdatei_sha256 text,
  signed_sha256 text,
  betriebsart text,
  datenaustauschreferenz integer,
  transfernummer integer,
  empfaenger_ik text,
  verwerfungsgrund text,
  encrypted_storage_path text,
  encrypted_sha256 text,
  verschluesselt_am timestamptz,
  verschluesselt_fuer_fingerprint text,
  verschluesselung_hinweis text,
  CONSTRAINT abrechnung_pkey PRIMARY KEY (id),
  CONSTRAINT abrechnung_status_check CHECK (status IN ('erstellt', 'heruntergeladen', 'gesendet', 'accepted', 'rejected', 'paid', 'verworfen'))
);

CREATE TABLE public.abrechnung_zeile (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  abrechnung_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  prescription_id uuid,
  kostentraeger_ik text NOT NULL,
  karten_ik text,
  einzel_rechnungsnummer text NOT NULL DEFAULT '0',
  sort_order smallint NOT NULL DEFAULT 0,
  belegnummer text,
  patient_name text,
  versichertennummer text,
  verordnungsdatum date,
  therapie_bereich text,
  heilmittel_position text,
  anzahl_einheiten integer,
  leistungen jsonb NOT NULL DEFAULT '[]'::jsonb,
  brutto_eur numeric(10,2) NOT NULL DEFAULT 0,
  zuzahlung_eur numeric(10,2) NOT NULL DEFAULT 0,
  netto_eur numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'eingereicht'::text,
  absetzung_eur numeric(10,2) NOT NULL DEFAULT 0,
  absetzung_grund text,
  absetzung_am date,
  herkunft text NOT NULL DEFAULT 'einreichung'::text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT abrechnung_zeile_pkey PRIMARY KEY (id),
  CONSTRAINT abrechnung_zeile_abrechnung_id_fkey FOREIGN KEY (abrechnung_id) REFERENCES public.abrechnung(id) ON DELETE RESTRICT
);

CREATE TABLE public.mahnungen (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  prescription_id uuid,
  ausfallrechnung_id uuid,
  patient_id uuid,
  mahnung_nr bigint,
  level smallint,
  amount_eur numeric(10,2),
  original_faelligkeit date,
  neue_faelligkeit date,
  sent_at timestamptz DEFAULT timezone('utc', now()),
  status text NOT NULL DEFAULT 'offen'::text,
  CONSTRAINT mahnungen_pkey PRIMARY KEY (id),
  CONSTRAINT mahnungen_status_check CHECK (status IN ('offen', 'bezahlt', 'abgeschrieben'))
);

CREATE TABLE public.prescription_documents (
  id bigint NOT NULL,
  owner_id uuid NOT NULL,
  business_id uuid,
  prescription_id uuid NOT NULL,
  patient_id uuid,
  CONSTRAINT prescription_documents_pkey PRIMARY KEY (id)
);

CREATE TABLE public.prescriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  patient_id uuid,
  business_id uuid,
  kostentraeger_ik text,
  CONSTRAINT prescriptions_pkey PRIMARY KEY (id)
);

-- Dummy earlier business-default trigger (simulates trg_set_business_id)
-- Alphabetically precedes trg_z_pruefe_abrechnung_zuzahlungsforderung
CREATE OR REPLACE FUNCTION public.dummy_set_business_id_default()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.business_id IS NULL THEN
    NEW.business_id := '99999999-9999-9999-9999-999999999999'::uuid;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_business_id
  BEFORE INSERT ON public.abrechnung
  FOR EACH ROW EXECUTE FUNCTION public.dummy_set_business_id_default();

-- Dummy festschreibung trigger on abrechnung_zeile
CREATE OR REPLACE FUNCTION public.dummy_zeile_festschreibung()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'abrechnung_zeile is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_zeile_festschreibung
  BEFORE DELETE ON public.abrechnung_zeile
  FOR EACH ROW EXECUTE FUNCTION public.dummy_zeile_festschreibung();

GRANT USAGE ON SCHEMA public TO service_role, authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;

\echo '=== PRE-MIGRATION SYNTHETIC SETUP COMPLETED ==='

\endif
