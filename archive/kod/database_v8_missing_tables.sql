-- ==============================================
-- INFINITY CALENDAR V8 - Eksik Tablolar Migration
-- 2026-05-13
-- 
-- Bu migration, JavaScript'te kullanılan ancak mevcut migration dosyalarında
-- CREATE TABLE ifadesi bulunmayan tabloları tanımlar.
-- Bu tablolar muhtemelen Supabase dashboard üzerinden manuel oluşturulmuştur.
-- Bu dosya sadece şema dokümantasyonu amacıyla oluşturulmuştur.
-- ==============================================

-- NOT: Aşağıdaki tablolar zaten mevcut olabilir. Her tablo için IF NOT EXISTS kullanılmıştır.

-- ==============================================
-- 1. ANAMNESE (Tıbbi Özgeçmiş Formu)
-- ==============================================
CREATE TABLE IF NOT EXISTS anamnese (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Genel Bilgiler
  geschlecht TEXT,
  geburtsdatum DATE,
  beruf TEXT,
  
  -- Şikayetler
  beschwerden TEXT,
  schmerzart TEXT,
  schmerzdaempfung INTEGER DEFAULT 5,
  schmerzverlauf TEXT,
  
  -- Tıbbi Geçmiş
  vorerkrankungen TEXT,
  operationen TEXT,
  medikamente TEXT,
  allergien TEXT,
  
  -- Yaşam Tarzı
  sport TEXT,
  
  -- Tanı
  diagnose TEXT,
  diagnose_seite TEXT,
  diagnose_lokalisation TEXT,
  
  -- Ek notlar
  anamnese_text TEXT,
  bemerkungen TEXT
);

-- RLS Policies
ALTER TABLE anamnese ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own anamnese" ON anamnese
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own anamnese" ON anamnese
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own anamnese" ON anamnese
  FOR UPDATE USING (owner_id = auth.uid());

-- ==============================================
-- 2. B2B_CONTACTS (B2B Müşteri Kişileri)
-- ==============================================
CREATE TABLE IF NOT EXISTS b2b_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'lead')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE b2b_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own b2b contacts" ON b2b_contacts
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own b2b contacts" ON b2b_contacts
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own b2b contacts" ON b2b_contacts
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own b2b contacts" ON b2b_contacts
  FOR DELETE USING (owner_id = auth.uid());

-- ==============================================
-- 3. WA_CONTACTS (WhatsApp Kişileri)
-- ==============================================
CREATE TABLE IF NOT EXISTS wa_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES auth.users(id),
  wa_id TEXT,
  phone TEXT NOT NULL,
  customer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE wa_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wa contacts" ON wa_contacts
  FOR SELECT USING (business_id = auth.uid());

CREATE POLICY "Users can insert own wa contacts" ON wa_contacts
  FOR INSERT WITH CHECK (business_id = auth.uid());

CREATE POLICY "Users can update own wa contacts" ON wa_contacts
  FOR UPDATE USING (business_id = auth.uid());

CREATE POLICY "Users can delete own wa contacts" ON wa_contacts
  FOR DELETE USING (business_id = auth.uid());

-- ==============================================
-- 4. EMAIL_LOGS (E-posta Gönderim Kayıtları)
-- ==============================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  lead_id UUID REFERENCES leads(id),
  b2b_contact_id UUID REFERENCES b2b_contacts(id),
  email_type TEXT, -- 'b2c', 'b2b', 'ai-report'
  to_email TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email logs" ON email_logs
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own email logs" ON email_logs
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- ==============================================
-- 5. SCRAPER_DATA (Doktor/Apify Arama Sonuçları)
-- ==============================================
CREATE TABLE IF NOT EXISTS scraper_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  company_name TEXT,
  name TEXT,
  category TEXT,
  placeName TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  rating TEXT,
  reviews TEXT,
  source TEXT DEFAULT 'apify',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE scraper_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scraper data" ON scraper_data
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own scraper data" ON scraper_data
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can delete own scraper data" ON scraper_data
  FOR DELETE USING (owner_id = auth.uid());

-- ==============================================
-- 6. AERZTE (Doktorlar)
-- ==============================================
CREATE TABLE IF NOT EXISTS aerzte (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  arzt_name TEXT NOT NULL,
  arzt_nummer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE aerzte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own aerzte" ON aerzte
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own aerzte" ON aerzte
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own aerzte" ON aerzte
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own aerzte" ON aerzte
  FOR DELETE USING (owner_id = auth.uid());

-- ==============================================
-- 7. FEEDBACKS (Geri Bildirimler)
-- ==============================================
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'feature', 'general')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  admin_note TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedbacks" ON feedbacks
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own feedbacks" ON feedbacks
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own feedbacks" ON feedbacks
  FOR UPDATE USING (user_id = auth.uid());

-- ==============================================
-- 8. INVOICES (Faturalar)
-- ==============================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  lead_id UUID REFERENCES leads(id),
  invoice_number TEXT UNIQUE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'cancelled')),
  issued_at DATE,
  due_date DATE,
  subtotal DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  total_patient DECIMAL(10,2) DEFAULT 0,
  eigenanteil_eur DECIMAL(10,2) DEFAULT 0,
  kassenzuzahlung DECIMAL(10,2) DEFAULT 0,
  lines JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices" ON invoices
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own invoices" ON invoices
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own invoices" ON invoices
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own invoices" ON invoices
  FOR DELETE USING (owner_id = auth.uid());

-- ==============================================
-- 9. PATIENT_NOTES (Hasta Notları)
-- ==============================================
-- NOT: Bu tablo database_v4_sector.sql'de zaten tanımlıdır.
-- Sadece şema kontrolü için burada tekrar edilmiştir.

-- Tablo zaten mevcutsa atla
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patient_notes') THEN
    CREATE TABLE patient_notes (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      owner_id UUID NOT NULL REFERENCES auth.users(id),
      doctor_notes TEXT,
      therapist_notes TEXT,
      ai_summary TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    ALTER TABLE patient_notes ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view own patient notes" ON patient_notes
      FOR SELECT USING (owner_id = auth.uid());
    
    CREATE POLICY "Users can insert own patient notes" ON patient_notes
      FOR INSERT WITH CHECK (owner_id = auth.uid());
    
    CREATE POLICY "Users can update own patient notes" ON patient_notes
      FOR UPDATE USING (owner_id = auth.uid());
  END IF;
END $$;

-- ==============================================
-- 10. UEBERWEISUNGEN (Sevk Yazıları)
-- ==============================================
CREATE TABLE IF NOT EXISTS ueberweisungen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  arzt_id UUID REFERENCES aerzte(id),
  diagnose TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE ueberweisungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ueberweisungen" ON ueberweisungen
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own ueberweisungen" ON ueberweisungen
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own ueberweisungen" ON ueberweisungen
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own ueberweisungen" ON ueberweisungen
  FOR DELETE USING (owner_id = auth.uid());

-- ==============================================
-- 11. KRANKENKASSEN (Sağlık Sigortaları)
-- ==============================================
CREATE TABLE IF NOT EXISTS krankenkassen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  ik_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
-- Bu tablo genel bir referans tablosu olduğu için herkes okuyabilir
ALTER TABLE krankenkassen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view krankenkassen" ON krankenkassen
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert krankenkassen" ON krankenkassen
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'owner'));

-- ==============================================
-- 12. BREAKS (Mola Saatleri)
-- ==============================================
-- NOT: Bu tablo database_setup.sql'de zaten tanımlıdır.
-- Sadece şema kontrolü için burada tekrar edilmiştir.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'breaks') THEN
    CREATE TABLE breaks (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id),
      day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    ALTER TABLE breaks ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view own breaks" ON breaks
      FOR SELECT USING (user_id = auth.uid());
    
    CREATE POLICY "Users can insert own breaks" ON breaks
      FOR INSERT WITH CHECK (user_id = auth.uid());
    
    CREATE POLICY "Users can update own breaks" ON breaks
      FOR UPDATE USING (user_id = auth.uid());
    
    CREATE POLICY "Users can delete own breaks" ON breaks
      FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ==============================================
-- INDEXES (Ortak Indexler)
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_leads_owner_id ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_owner_id ON bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_services_owner_id ON services(owner_id);
CREATE INDEX IF NOT EXISTS idx_anamnese_lead_id ON anamnese(lead_id);
CREATE INDEX IF NOT EXISTS idx_invoices_lead_id ON invoices(lead_id);
CREATE INDEX IF NOT EXISTS idx_invoices_owner_id ON invoices(owner_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_b2b_contacts_owner_id ON b2b_contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_business_id ON wa_contacts(business_id);
CREATE INDEX IF NOT EXISTS idx_scraper_data_owner_id ON scraper_data(owner_id);
CREATE INDEX IF NOT EXISTS idx_aerzte_owner_id ON aerzte(owner_id);
CREATE INDEX IF NOT EXISTS idx_patient_notes_lead_id ON patient_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_ueberweisungen_lead_id ON ueberweisungen(lead_id);