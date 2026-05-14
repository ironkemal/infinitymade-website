-- ==============================================
-- INFINITY CALENDAR V10 - Überweisung Otomasyonu
-- 2026-05-13
-- 
-- Almanya pazarındaki fizyoterapi/sağlık merkezleri için
-- Hasta sevk belgelerini (Überweisung) parse eden,
-- Supabase'e kaydeden ve sekreter onayına sunan sistem.
-- ==============================================

-- ==============================================
-- 1. REFERRAL_DRAFTS (AI Parse Edilmiş Sevk Belgeleri)
-- ==============================================
-- Bu tablo, AI tarafından okunan sevk belgelerini tutar.
-- Sekreter onayına sunulacak taslaklar burada saklanır.
CREATE TABLE IF NOT EXISTS referral_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  lead_id UUID REFERENCES leads(id), -- Eşleşen hasta (bulunamazsa NULL)
  
  -- AI tarafından parse edilen ham veriler
  raw_ai_data JSONB NOT NULL DEFAULT '{}',
  
  -- Parsed alanlar (kolay erişim için)
  patient_vorname TEXT,           -- Hasta adı
  patient_nachname TEXT,          -- Hasta soyadı
  patient_geburtsdatum DATE,      -- Doğum tarihi
  seans_sayisi INTEGER,           -- Seans sayısı
  tedavi_turu TEXT,               -- Tedavi türü
  hausbesuch BOOLEAN DEFAULT false,-- Ev ziyareti mi?
  diagnose TEXT,                   -- Tanı
  arzt_name TEXT,                 -- Sevk eden doktor
  
  -- Görsel
  image_url TEXT,                 -- Supabase Storage'daki görsel URL'i
  
  -- Durum
  is_confirmed BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Onay sonrası
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  booking_series_id UUID,         -- Oluşturulan randevu serisi
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE referral_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral drafts" ON referral_drafts
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own referral drafts" ON referral_drafts
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own referral drafts" ON referral_drafts
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own referral drafts" ON referral_drafts
  FOR DELETE USING (owner_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_drafts_owner_id ON referral_drafts(owner_id);
CREATE INDEX IF NOT EXISTS idx_referral_drafts_status ON referral_drafts(status);
CREATE INDEX IF NOT EXISTS idx_referral_drafts_lead_id ON referral_drafts(lead_id);
CREATE INDEX IF NOT EXISTS idx_referral_drafts_created_at ON referral_drafts(created_at DESC);

-- ==============================================
-- 2. SUPABASE STORAGE - referrals bucket
-- ==============================================
-- NOT: Storage bucket'ı Supabase Dashboard'dan veya
-- Storage API'sinden oluşturulmalı. Aşağıdaki SQL sadece
-- dokümantasyon amaçlıdır.
--
-- Bucket oluşturmak için Supabase Dashboard > Storage > New Bucket
-- Bucket name: 'referrals'
-- Public: false (güvenlik için)
-- File size limit: 10MB
-- Allowed MIME types: image/jpeg, image/png, image/webp, application/pdf

-- Storage RLS Policy (opsiyonel - bucket public değilse gerekli)
-- INSERT için service role yetkisi gerekir (n8n için)

-- ==============================================
-- 3. PATIENT SEARCH FUNCTION
-- ==============================================
-- leads tablosunda ad, soyad ve doğum tarihi üzerinden arama
CREATE OR REPLACE FUNCTION find_patient_by_name_and_birth(
  p_vorname TEXT,
  p_nachname TEXT,
  p_geburtsdatum DATE,
  p_owner_id UUID
)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  geburtsdatum DATE,
  phone TEXT,
  email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.first_name,
    l.last_name,
    (l.metadata->>'geburtsdatum')::DATE as geburtsdatum,
    l.phone,
    l.email
  FROM leads l
  WHERE 
    l.owner_id = p_owner_id
    AND (
      -- Tam eşleşme
      (LOWER(l.first_name) = LOWER(p_vorname) AND LOWER(l.last_name) = LOWER(p_nachname))
      OR
      -- Kısmi eşleşme (benzer isim)
      (LOWER(l.first_name) LIKE LOWER('%' || p_vorname || '%') 
       AND LOWER(l.last_name) LIKE LOWER('%' || p_nachname || '%'))
    )
    AND (
      p_geburtsdatum IS NULL 
      OR (l.metadata->>'geburtsdatum')::DATE = p_geburtsdatum
    )
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 4. CONFIRM REFERRAL FUNCTION
-- ==============================================
-- Sekreter onayladığında çağrılacak fonksiyon
CREATE OR REPLACE FUNCTION confirm_referral_and_create_series(
  p_draft_id UUID,
  p_lead_id UUID,
  p_confirmed_by UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  booking_series_id UUID
) AS $$
DECLARE
  v_draft RECORD;
  v_lead RECORD;
  v_service_id UUID;
  v_series_id UUID;
BEGIN
  -- Draft'ı al
  SELECT * INTO v_draft FROM referral_drafts WHERE id = p_draft_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Draft not found', NULL::UUID;
    RETURN;
  END IF;
  
  IF v_draft.is_confirmed THEN
    RETURN QUERY SELECT false, 'Already confirmed', v_draft.booking_series_id;
    RETURN;
  END IF;
  
  -- Lead'i al
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Patient not found', NULL::UUID;
    RETURN;
  END IF;
  
  -- TODO: Uygun servisi bul (fizyoterapi seansı)
  -- Şimdilik ilk fizyoterapi servisini alalım
  SELECT id INTO v_service_id FROM services 
  WHERE user_id = v_draft.owner_id 
  AND (title ILIKE '%physio%' OR title ILIKE '%therapie%' OR title ILIKE '%fyzio%')
  LIMIT 1;
  
  -- Servis bulunamazsa ilk servisi al
  IF v_service_id IS NULL THEN
    SELECT id INTO v_service_id FROM services 
    WHERE user_id = v_draft.owner_id
    LIMIT 1;
  END IF;
  
  IF v_service_id IS NULL THEN
    RETURN QUERY SELECT false, 'No service found', NULL::UUID;
    RETURN;
  END IF;
  
  -- Booking series oluştur
  INSERT INTO booking_series (
    owner_id,
    lead_id,
    service_id,
    total_sessions,
    completed_sessions,
    status,
    source_type,
    source_id,
    created_by
  ) VALUES (
    v_draft.owner_id,
    p_lead_id,
    v_service_id,
    v_draft.seans_sayisi,
    0,
    'active',
    'referral_draft',
    p_draft_id,
    p_confirmed_by
  ) RETURNING id INTO v_series_id;
  
  -- Draft'ı güncelle
  UPDATE referral_drafts SET
    is_confirmed = true,
    status = 'approved',
    lead_id = p_lead_id,
    confirmed_at = NOW(),
    confirmed_by = p_confirmed_by,
    booking_series_id = v_series_id,
    updated_at = NOW()
  WHERE id = p_draft_id;
  
  RETURN QUERY SELECT true, 'Referral confirmed and series created', v_series_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- 5. TRIGGER - updated_at auto-update
-- ==============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_referral_drafts_updated_at
  BEFORE UPDATE ON referral_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- 6. NOTIFICATION FUNCTION (Webhook için)
-- ==============================================
-- Yeni referral draft geldiğinde bildirim
CREATE OR REPLACE FUNCTION notify_new_referral_draft()
RETURNS TRIGGER AS $$
BEGIN
  -- Supabase Realtime kullanarak bildirim gönder
  -- Bu fonksiyon Supabase Edge Function veya n8n tarafından tetiklenebilir
  PERFORM pg_notify(
    'new_referral_draft',
    json_build_object(
      'id', NEW.id,
      'owner_id', NEW.owner_id,
      'patient_name', NEW.patient_vorname || ' ' || NEW.patient_nachname,
      'seans_sayisi', NEW.seans_sayisi,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_referral_draft
  AFTER INSERT ON referral_drafts
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_referral_draft();

-- ==============================================
-- 7. SEED DATA - Örnek Sağlık Sigortaları
-- ==============================================
INSERT INTO krankenkassen (name, ik_number) VALUES
  ('AOK Baden-Württemberg', '710101000'),
  ('AOK Bayern', '710102000'),
  ('AOK Hessen', '710103000'),
  ('AOK Nordost', '710104000'),
  ('AOK Plus', '710105000'),
  ('AOK Rheinland/Hamburg', '710106000'),
  ('AOK Sachsen-Anhalt', '710107000'),
  ('Barmer', '111111111'),
  ('BKK Mobil Oil', '210101000'),
  ('BKK Technoform', '210102000'),
  ('DAK-Gesundheit', '333333333'),
  ('Deutsche安康', '444444444'),
  ('HEK', '555555555'),
  ('HKK', '666666666'),
  ('IKK classic', '777777777'),
  ('KKH', '888888888'),
  ('Pronova BKK', '999999999'),
  ('SBK', '101010101'),
  ('SKD BKK', '202020202'),
  ('Techniker Krankenkasse', '303030303')
ON CONFLICT (name) DO NOTHING;