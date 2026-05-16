-- ==============================================
-- INFINITY V10 — Prescriptions (Phase 2)
-- 2026-05-16
--
-- AI Pre-filling + Human-in-the-Loop für Muster 13 Rezepte.
-- Drei neue Tabellen + Erweiterungen an leads & aerzte.
-- ==============================================

-- 1. leads bekommt Patienten-Stammdaten, die ein Muster 13 enthält
ALTER TABLE leads ADD COLUMN IF NOT EXISTS geburtsdatum DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS versichertennummer TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS krankenkasse TEXT;

-- Schneller Match auf "gleicher Name + DOB" für Auto-Patient-Linkage
CREATE INDEX IF NOT EXISTS idx_leads_name_dob
  ON leads (owner_id, lower(coalesce(first_name,'')), lower(coalesce(last_name,'')), geburtsdatum);

-- 2. aerzte braucht LANR + BSNR für Identifikation und Krankenkassen-Abrechnung
ALTER TABLE aerzte ADD COLUMN IF NOT EXISTS lanr TEXT;
ALTER TABLE aerzte ADD COLUMN IF NOT EXISTS bsnr TEXT;

CREATE INDEX IF NOT EXISTS idx_aerzte_lanr ON aerzte (owner_id, lanr) WHERE lanr IS NOT NULL;

-- 3. prescriptions — der zentrale Datensatz pro Muster 13 / Blanko
CREATE TABLE IF NOT EXISTS prescriptions (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id               UUID REFERENCES leads(id) ON DELETE SET NULL,
  arzt_id                  UUID REFERENCES aerzte(id) ON DELETE SET NULL,

  -- Original-Bild im Supabase Storage Bucket "prescriptions"
  image_storage_path       TEXT,
  image_uploaded_at        TIMESTAMPTZ,

  -- Status-Lebenszyklus
  status TEXT NOT NULL DEFAULT 'parsed'
    CHECK (status IN ('parsed','confirmed','in_therapy','completed','billed','cancelled')),

  -- Typ der Verordnung
  rezept_typ TEXT NOT NULL DEFAULT 'standard'
    CHECK (rezept_typ IN ('standard','blanko','lhb_bvb')),

  -- Aus OCR extrahierte und vom Therapeuten bestätigte Pflichtfelder
  icd10                    TEXT,
  diagnosegruppe           TEXT,
  heilmittel               TEXT,
  heilmittel_feld_text     TEXT,
  anzahl_einheiten         INTEGER,
  frequenz                 TEXT,
  ausstellungsdatum        DATE,
  behandlungsbeginn        DATE,
  is_dringend              BOOLEAN DEFAULT FALSE,
  hausbesuch               BOOLEAN DEFAULT FALSE,

  -- Berechnete Daten (aus validators)
  gueltig_bis              DATE,
  computed                 JSONB,        -- full validator result.computed snapshot
  warnings                 JSONB,        -- snapshot of warnings at confirm time
  blockers_overridden      JSONB,        -- if user proceeded despite blockers

  -- Roh-OCR und Bestätigungs-Metadaten (Audit)
  ocr_raw_response         JSONB,
  ocr_confidence           NUMERIC(3,2),  -- 0.00 - 1.00
  confirmed_by             UUID REFERENCES auth.users(id),
  confirmed_at             TIMESTAMPTZ,
  proceed_anyway           BOOLEAN DEFAULT FALSE,

  -- Abrechnung
  dmrz_exported_at         TIMESTAMPTZ,
  total_bonuses_eur        NUMERIC(8,2),

  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_owner_status
  ON prescriptions (owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient
  ON prescriptions (patient_id, created_at DESC);

-- 4. prescription_sessions — verknüpft eine Verordnung mit ihrer Termin-Serie
CREATE TABLE IF NOT EXISTS prescription_sessions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  booking_id      UUID REFERENCES bookings(id) ON DELETE SET NULL,
  session_number  INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','done','cancelled','no_show')),
  done_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (prescription_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_prescription_sessions_prescription
  ON prescription_sessions (prescription_id, session_number);

-- 5. prescription_validations — frozen audit trail of compliance checks
CREATE TABLE IF NOT EXISTS prescription_validations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  engine          TEXT NOT NULL,         -- 'standard' | 'lhb_bvb' | 'blanko'
  input_snapshot  JSONB NOT NULL,        -- rezept payload at validation time
  result          JSONB NOT NULL,        -- full validator output
  ok              BOOLEAN NOT NULL,
  warnings_count  INTEGER DEFAULT 0,
  blockers_count  INTEGER DEFAULT 0,
  proceeded_anyway BOOLEAN DEFAULT FALSE,
  validated_by    UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescription_validations_prescription
  ON prescription_validations (prescription_id, created_at DESC);

-- 6. RLS — owner-scoped access
ALTER TABLE prescriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prescriptions_owner_all" ON prescriptions;
CREATE POLICY "prescriptions_owner_all" ON prescriptions
  FOR ALL USING (
    auth.uid() = owner_id
    OR auth.uid() IN (
      SELECT id FROM profiles WHERE owner_id = prescriptions.owner_id
    )
  );

DROP POLICY IF EXISTS "prescription_sessions_via_prescription" ON prescription_sessions;
CREATE POLICY "prescription_sessions_via_prescription" ON prescription_sessions
  FOR ALL USING (
    prescription_id IN (
      SELECT id FROM prescriptions
      WHERE owner_id = auth.uid()
         OR auth.uid() IN (SELECT id FROM profiles WHERE owner_id = prescriptions.owner_id)
    )
  );

DROP POLICY IF EXISTS "prescription_validations_via_prescription" ON prescription_validations;
CREATE POLICY "prescription_validations_via_prescription" ON prescription_validations
  FOR ALL USING (
    prescription_id IN (
      SELECT id FROM prescriptions
      WHERE owner_id = auth.uid()
         OR auth.uid() IN (SELECT id FROM profiles WHERE owner_id = prescriptions.owner_id)
    )
  );

-- 7. updated_at trigger
CREATE OR REPLACE FUNCTION trg_prescriptions_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prescriptions_updated_at ON prescriptions;
CREATE TRIGGER prescriptions_updated_at
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION trg_prescriptions_updated_at();
