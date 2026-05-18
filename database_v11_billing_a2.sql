-- ==============================================
-- INFINITY V11 — § 302 SGB V Direct Billing (Faz A2)
-- 2026-05-18
--
-- 5 yeni tablo (kostentraeger, heilmittel_tarif, terapeut_zertifikat,
-- abrechnung, zaa_fehler, zuzahlung_befreiung) + prescriptions extend.
--
-- NOT: Plan'daki "verordnung" tablosu yerine mevcut "prescriptions"
-- tablosu genişletildi (alanların büyük çoğunluğu zaten örtüşüyordu).
-- Plan'daki patient_id → leads(id) referansı kullanılır.
-- ==============================================

-- ----------------------------------------------
-- 1. Krankenkasse + Datenannahmestelle haritası
-- ----------------------------------------------
CREATE TABLE IF NOT EXISTS kostentraeger (
  ik          TEXT PRIMARY KEY,                    -- 9 haneli Institutionskennzeichen
  name        TEXT NOT NULL,
  das_ik      TEXT,                                -- bağlı olduğu Datenannahmestelle IK
  payer_type  TEXT CHECK (payer_type IN ('gkv','sonst','privat')),
  region      TEXT,
  active      BOOLEAN DEFAULT TRUE,
  valid_from  DATE,
  valid_to    DATE,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kostentraeger_active
  ON kostentraeger (active, payer_type) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_kostentraeger_das
  ON kostentraeger (das_ik) WHERE das_ik IS NOT NULL;

-- ----------------------------------------------
-- 2. Heilmittel Tarif (Bundesland × KK × Position)
-- ----------------------------------------------
CREATE TABLE IF NOT EXISTS heilmittel_tarif (
  id                BIGSERIAL PRIMARY KEY,
  bundesland        TEXT NOT NULL,                 -- 'NW', 'BY', vs.
  kostentraeger_ik  TEXT REFERENCES kostentraeger(ik) ON DELETE CASCADE,
  position_nr       TEXT NOT NULL,                 -- '1021', '1010', vs.
  heilmittel_code   TEXT,                          -- 'KG', 'MT', 'MLD'
  preis_eur         NUMERIC(10,2) NOT NULL,
  zuzahlung_pflicht BOOLEAN DEFAULT TRUE,
  gueltig_ab        DATE NOT NULL,
  gueltig_bis       DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tarif_lookup
  ON heilmittel_tarif (bundesland, kostentraeger_ik, position_nr, gueltig_ab DESC);
CREATE INDEX IF NOT EXISTS idx_tarif_active
  ON heilmittel_tarif (bundesland, position_nr)
  WHERE gueltig_bis IS NULL;

-- ----------------------------------------------
-- 3. Terapeut Dakota Sertifika (public bilgi)
--    Private key ASLA server'a gelmez — sadece public meta.
-- ----------------------------------------------
CREATE TABLE IF NOT EXISTS terapeut_zertifikat (
  owner_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ik_nummer       TEXT NOT NULL,                   -- terapistin kendi IK'sı
  cert_subject    TEXT,
  cert_valid_from DATE,
  cert_valid_to   DATE,
  cert_thumbprint TEXT,                            -- SHA-1/256 fingerprint
  cert_serial     TEXT,
  uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zertifikat_expiring
  ON terapeut_zertifikat (cert_valid_to) WHERE cert_valid_to IS NOT NULL;

-- ----------------------------------------------
-- 4. Abrechnung (bir batch = bir DTA dosyası)
-- ----------------------------------------------
CREATE TABLE IF NOT EXISTS abrechnung (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kostentraeger_ik   TEXT NOT NULL REFERENCES kostentraeger(ik),
  dateiname          TEXT,                         -- 'EHK1234500000023'
  rechnungsnummer    TEXT,                         -- 'R2026-W20-001'
  total_eur          NUMERIC(10,2) DEFAULT 0,
  zuzahlung_total    NUMERIC(10,2) DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'erstellt'
    CHECK (status IN ('erstellt','heruntergeladen','gesendet','accepted','rejected','paid')),
  dta_file_size      INT,
  dta_segment_count  INT,
  prescription_count INT DEFAULT 0,
  rejected_count     INT DEFAULT 0,
  storage_path       TEXT,                         -- .dta.p7m Supabase Storage yolu
  begleitzettel_path TEXT,
  zaa_uploaded_at    TIMESTAMPTZ,
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abrechnung_owner_status
  ON abrechnung (owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abrechnung_kostentraeger
  ON abrechnung (kostentraeger_ik, created_at DESC);

-- ----------------------------------------------
-- 5. ZAA hata kayıtları
-- ----------------------------------------------
CREATE TABLE IF NOT EXISTS zaa_fehler (
  id              BIGSERIAL PRIMARY KEY,
  abrechnung_id   UUID NOT NULL REFERENCES abrechnung(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  fehler_code     TEXT NOT NULL,                   -- '04', '101', vs.
  fehler_text     TEXT,                            -- standart ITSG hata mesajı
  uebersetzung    TEXT,                            -- anlaşılır Almanca çevirimiz
  loesung_hint    TEXT,                            -- "ICD-10 kodu eksik, ..."
  status          TEXT NOT NULL DEFAULT 'offen'
    CHECK (status IN ('offen','in_bearbeitung','behoben','ignoriert')),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zaa_fehler_abrechnung
  ON zaa_fehler (abrechnung_id, status);
CREATE INDEX IF NOT EXISTS idx_zaa_fehler_prescription
  ON zaa_fehler (prescription_id) WHERE prescription_id IS NOT NULL;

-- ----------------------------------------------
-- 6. Zuzahlung Befreiung (hasta yıllık muafiyet)
-- ----------------------------------------------
CREATE TABLE IF NOT EXISTS zuzahlung_befreiung (
  id           BIGSERIAL PRIMARY KEY,
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id   UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  jahr         INT NOT NULL,
  befreit_ab   DATE NOT NULL,
  befreit_bis  DATE,
  beleg_url    TEXT,                               -- Supabase Storage yolu
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (patient_id, jahr)
);

CREATE INDEX IF NOT EXISTS idx_befreiung_patient_jahr
  ON zuzahlung_befreiung (patient_id, jahr);

-- ----------------------------------------------
-- 7. prescriptions tablosunu genişlet (verordnung yerine)
-- ----------------------------------------------
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS heilmittel_position TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS zuzahlung_eur NUMERIC(10,2);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS zuzahlung_befreit BOOLEAN DEFAULT FALSE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS is_blanko BOOLEAN DEFAULT FALSE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS is_lhb_bvb BOOLEAN DEFAULT FALSE;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS doctor_lanr TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS doctor_bsnr TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS kostentraeger_ik TEXT REFERENCES kostentraeger(ik);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS abrechnung_id UUID REFERENCES abrechnung(id) ON DELETE SET NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS abrechnung_status TEXT
  CHECK (abrechnung_status IN (NULL,'bereit','in_abrechnung','gesendet','accepted','rejected','paid'));

CREATE INDEX IF NOT EXISTS idx_prescriptions_abrechnung
  ON prescriptions (abrechnung_id) WHERE abrechnung_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prescriptions_billing_ready
  ON prescriptions (owner_id, abrechnung_status)
  WHERE abrechnung_status = 'bereit';

-- ----------------------------------------------
-- 8. Row Level Security
-- ----------------------------------------------
ALTER TABLE kostentraeger       ENABLE ROW LEVEL SECURITY;
ALTER TABLE heilmittel_tarif    ENABLE ROW LEVEL SECURITY;
ALTER TABLE terapeut_zertifikat ENABLE ROW LEVEL SECURITY;
ALTER TABLE abrechnung          ENABLE ROW LEVEL SECURITY;
ALTER TABLE zaa_fehler          ENABLE ROW LEVEL SECURITY;
ALTER TABLE zuzahlung_befreiung ENABLE ROW LEVEL SECURITY;

-- Kostenträger & Tarif: tüm authenticated kullanıcılar OKUR, sadece service_role yazar
DROP POLICY IF EXISTS "kostentraeger_read_all" ON kostentraeger;
CREATE POLICY "kostentraeger_read_all" ON kostentraeger
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "heilmittel_tarif_read_all" ON heilmittel_tarif;
CREATE POLICY "heilmittel_tarif_read_all" ON heilmittel_tarif
  FOR SELECT USING (auth.role() = 'authenticated');

-- Terapeut zertifikat: sadece sahibi (ve çalışanları okur)
DROP POLICY IF EXISTS "zertifikat_owner_all" ON terapeut_zertifikat;
CREATE POLICY "zertifikat_owner_all" ON terapeut_zertifikat
  FOR ALL USING (
    auth.uid() = owner_id
    OR auth.uid() IN (SELECT id FROM profiles WHERE owner_id = terapeut_zertifikat.owner_id)
  );

-- Abrechnung: owner ve çalışanlar
DROP POLICY IF EXISTS "abrechnung_owner_all" ON abrechnung;
CREATE POLICY "abrechnung_owner_all" ON abrechnung
  FOR ALL USING (
    auth.uid() = owner_id
    OR auth.uid() IN (SELECT id FROM profiles WHERE owner_id = abrechnung.owner_id)
  );

-- ZAA Fehler: abrechnung üzerinden
DROP POLICY IF EXISTS "zaa_fehler_via_abrechnung" ON zaa_fehler;
CREATE POLICY "zaa_fehler_via_abrechnung" ON zaa_fehler
  FOR ALL USING (
    abrechnung_id IN (
      SELECT id FROM abrechnung
      WHERE owner_id = auth.uid()
         OR auth.uid() IN (SELECT id FROM profiles WHERE owner_id = abrechnung.owner_id)
    )
  );

-- Zuzahlung Befreiung: owner ve çalışanlar
DROP POLICY IF EXISTS "befreiung_owner_all" ON zuzahlung_befreiung;
CREATE POLICY "befreiung_owner_all" ON zuzahlung_befreiung
  FOR ALL USING (
    auth.uid() = owner_id
    OR auth.uid() IN (SELECT id FROM profiles WHERE owner_id = zuzahlung_befreiung.owner_id)
  );

-- ----------------------------------------------
-- 9. updated_at triggers
-- ----------------------------------------------
CREATE OR REPLACE FUNCTION trg_billing_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kostentraeger_updated_at ON kostentraeger;
CREATE TRIGGER kostentraeger_updated_at
  BEFORE UPDATE ON kostentraeger
  FOR EACH ROW EXECUTE FUNCTION trg_billing_updated_at();

DROP TRIGGER IF EXISTS zertifikat_updated_at ON terapeut_zertifikat;
CREATE TRIGGER zertifikat_updated_at
  BEFORE UPDATE ON terapeut_zertifikat
  FOR EACH ROW EXECUTE FUNCTION trg_billing_updated_at();

DROP TRIGGER IF EXISTS abrechnung_updated_at ON abrechnung;
CREATE TRIGGER abrechnung_updated_at
  BEFORE UPDATE ON abrechnung
  FOR EACH ROW EXECUTE FUNCTION trg_billing_updated_at();
