-- ==============================================
-- INFINITY CALENDAR V2 - MULTI-USER & B2B MIGRATION
-- ==============================================

-- 1. PROFILES TABLOSUNU GÜNCELLEME
-- Yeni kolonlar: Rol, Davet Kodu, Kime Bağlı Olduğu (owner_id)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'employee'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);

-- 2. EMPLOYEE SERVICES TABLOSU
-- Hangi çalışan hangi hizmetleri veriyor? (Patron hizmeti oluşturur, personellerine atar)
CREATE TABLE IF NOT EXISTS employee_services (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id UUID REFERENCES auth.users NOT NULL,
  service_id UUID REFERENCES services ON DELETE CASCADE NOT NULL,
  UNIQUE(employee_id, service_id)
);

ALTER TABLE employee_services ENABLE ROW LEVEL SECURITY;
-- Herkes hizmet dağılımını okuyabilir (randevu widget'ı için)
CREATE POLICY "Public read employee services" ON employee_services FOR SELECT USING (true);
-- Patronlar ve çalışanlar kayıt ekleyip silebilir
CREATE POLICY "Authenticated operations employee services" ON employee_services FOR ALL USING (auth.role() = 'authenticated');


-- 3. TIME OFFS (İzin / Tatil Günleri) TABLOSU
-- Patron veya çalışanın kendisi izin günü girebilir (o günler randevu alımına kapatılır)
CREATE TABLE IF NOT EXISTS time_offs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  employee_id UUID REFERENCES auth.users NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  reason TEXT, -- Örn: "Beurlaubt", "Krank"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE time_offs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read time offs" ON time_offs FOR SELECT USING (true);
CREATE POLICY "Authenticated operations time offs" ON time_offs FOR ALL USING (auth.role() = 'authenticated');


-- 4. BOOKINGS (Randevular) TABLOSUNU GÜNCELLEME
-- Randevulara 'owner_id' eklendi ki patron kendi altındaki tüm çalışanların randevularını görebilsin
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users;

-- (Güvenlik) Eğer eski randevular varsa, hepsinin sahibini kendisi yapalım ki kaybolmasınlar
UPDATE bookings SET owner_id = user_id WHERE owner_id IS NULL;


-- NOT: 'services', 'working_hours' ve 'calendar_integrations' tablolarındaki 
-- mevcut "user_id" kolonları artık işlemi yapacak kişi (employee_id) veya solopreneur (owner) olarak kullanılmaya devam edecek. 
-- Kolon isimlerini değiştirmek sistemi kırmamak adına gerekli değildir.
