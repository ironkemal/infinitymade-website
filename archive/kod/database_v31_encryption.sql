-- =============================================================
-- PRAXURA v31 — Column-Level Encryption for PHI / PII
-- 2026-06-15
--
-- DSGVO Art. 32 compliance: protects health data (Art. 9) and
-- patient identifiers at rest in Supabase PostgreSQL.
--
-- DEPLOYMENT INSTRUCTIONS — READ BEFORE APPLYING:
--   This migration MUST be deployed simultaneously with the
--   matching server.js changes (encrypt/decrypt helpers).
--   Apply during a maintenance window; the app will return
--   errors if only the DB or only the code is updated.
--
-- ENCRYPTION SCHEME:
--   pgp_sym_encrypt / pgp_sym_decrypt (pgcrypto, AES-256)
--   Key source: process.env.DATA_ENCRYPTION_KEY (32-byte hex)
--   Key is NOT stored in DB — server-side only.
--
-- AFFECTED TABLES:
--   leads           → first_name, last_name, phone, geburtsdatum,
--                     versichertennummer, krankenkasse
--   prescriptions   → icd10, ocr_raw_response (JSONB→TEXT→encrypt)
-- =============================================================

-- Step 0: Enable pgcrypto (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------
-- Step 1: leads — add encrypted shadow columns
-- (Existing plaintext columns are preserved during transition;
--  drop them after backfill is verified in production.)
-- ---------------------------------------------------------------
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS first_name_enc  BYTEA,
  ADD COLUMN IF NOT EXISTS last_name_enc   BYTEA,
  ADD COLUMN IF NOT EXISTS phone_enc       BYTEA,
  ADD COLUMN IF NOT EXISTS geburtsdatum_enc BYTEA,
  ADD COLUMN IF NOT EXISTS versichertennummer_enc BYTEA,
  ADD COLUMN IF NOT EXISTS krankenkasse_enc BYTEA,
  ADD COLUMN IF NOT EXISTS pii_encrypted   BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN leads.pii_encrypted IS
  'TRUE once all _enc columns are filled and plaintext columns can be nulled.';

-- ---------------------------------------------------------------
-- Step 2: prescriptions — add encrypted shadow columns
-- ---------------------------------------------------------------
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS icd10_enc           BYTEA,
  ADD COLUMN IF NOT EXISTS ocr_raw_enc         BYTEA,   -- JSON serialised then encrypted
  ADD COLUMN IF NOT EXISTS phi_encrypted       BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN prescriptions.phi_encrypted IS
  'TRUE once icd10_enc/ocr_raw_enc are filled and plaintext columns can be nulled.';

-- ---------------------------------------------------------------
-- Step 3: Indexes on encrypted columns (on pii_encrypted flag
--         so backfill queries can efficiently find unprocessed rows)
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leads_pii_not_encrypted
  ON leads (owner_id) WHERE pii_encrypted = FALSE;

CREATE INDEX IF NOT EXISTS idx_prescriptions_phi_not_encrypted
  ON prescriptions (owner_id) WHERE phi_encrypted = FALSE;

-- ---------------------------------------------------------------
-- Step 4: After full backfill, run this block to drop plaintext
--         columns (do NOT run until pii_encrypted = TRUE for ALL rows):
--
-- ALTER TABLE leads
--   DROP COLUMN IF EXISTS first_name,
--   DROP COLUMN IF EXISTS last_name,
--   DROP COLUMN IF EXISTS phone,
--   DROP COLUMN IF EXISTS geburtsdatum,
--   DROP COLUMN IF EXISTS versichertennummer,
--   DROP COLUMN IF EXISTS krankenkasse;
--
-- ALTER TABLE prescriptions
--   DROP COLUMN IF EXISTS icd10,
--   DROP COLUMN IF EXISTS ocr_raw_response;
-- ---------------------------------------------------------------
