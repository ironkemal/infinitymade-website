-- ==============================================
-- INFINITY V19 — Auto-flag prescriptions.zuzahlung_befreit
-- 2026-05-19
-- ==============================================
-- Closes the gap noticed during Sprint 11 review: until now, a Befreiung
-- record in zuzahlung_befreiung did NOT automatically flip the
-- prescriptions.zuzahlung_befreit boolean. The flag had to be set manually
-- during OCR confirm or rezept entry — easy to miss when the Befreiung
-- arrives after the prescription was already created.
--
-- This migration:
--   1. Adds a helper fn_is_patient_befreit(patient_id, date) returning bool
--   2. BEFORE INSERT/UPDATE trigger on prescriptions to compute the flag
--      from zuzahlung_befreiung at write time
--   3. AFTER INSERT/UPDATE/DELETE trigger on zuzahlung_befreiung to back-fill
--      all matching (still-billable) prescriptions when the exemption record
--      changes
--   4. One-time backfill of existing data
--
-- Manual exemptions: to mark a single prescription exempt without a real
-- Befreiungsausweis, create a zuzahlung_befreiung row directly (the PDF is
-- optional in the schema).

-- ---------- 1. Helper function ----------
CREATE OR REPLACE FUNCTION fn_is_patient_befreit(p_patient_id UUID, p_datum DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM zuzahlung_befreiung
    WHERE patient_id = p_patient_id
      AND befreit_ab <= p_datum
      AND (befreit_bis IS NULL OR befreit_bis >= p_datum)
  );
$$;

-- ---------- 2. Prescriptions trigger (BEFORE INSERT/UPDATE) ----------
CREATE OR REPLACE FUNCTION fn_prescriptions_set_befreit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Skip if patient unknown (defensive — shouldn't happen for billable rx)
  IF NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.zuzahlung_befreit := fn_is_patient_befreit(
    NEW.patient_id,
    COALESCE(NEW.ausstellungsdatum, CURRENT_DATE)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prescriptions_set_befreit ON prescriptions;
CREATE TRIGGER trg_prescriptions_set_befreit
  BEFORE INSERT OR UPDATE OF patient_id, ausstellungsdatum
  ON prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION fn_prescriptions_set_befreit();

-- ---------- 3. Befreiung trigger (AFTER INSERT/UPDATE/DELETE) ----------
-- When a Befreiung record changes, recompute the flag on all of that
-- patient's still-billable prescriptions (NOT already in an Abrechnung).
CREATE OR REPLACE FUNCTION fn_befreiung_backfill_prescriptions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_patient_id UUID;
BEGIN
  v_patient_id := COALESCE(NEW.patient_id, OLD.patient_id);
  IF v_patient_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE prescriptions
  SET zuzahlung_befreit = fn_is_patient_befreit(
    patient_id,
    COALESCE(ausstellungsdatum, CURRENT_DATE)
  )
  WHERE patient_id = v_patient_id
    AND abrechnung_id IS NULL;  -- never touch already-billed prescriptions

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_befreiung_backfill_prescriptions ON zuzahlung_befreiung;
CREATE TRIGGER trg_befreiung_backfill_prescriptions
  AFTER INSERT OR UPDATE OR DELETE
  ON zuzahlung_befreiung
  FOR EACH ROW
  EXECUTE FUNCTION fn_befreiung_backfill_prescriptions();

-- ---------- 4. One-time backfill of existing prescriptions ----------
-- Bring the existing data into sync. Only touches not-yet-billed rows.
UPDATE prescriptions p
SET zuzahlung_befreit = fn_is_patient_befreit(
  p.patient_id,
  COALESCE(p.ausstellungsdatum, CURRENT_DATE)
)
WHERE p.patient_id IS NOT NULL
  AND p.abrechnung_id IS NULL;
