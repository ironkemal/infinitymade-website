-- 1. SERVICES TABLOSU
-- Müşterilerin (Örn: Kuaför) sunduğu hizmetler ve süreleri
CREATE TABLE services (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  price TEXT,
  description TEXT,
  is_online_meeting BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kullanıcılar kendi hizmetlerini görebilir" ON services FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Kullanıcılar kendi hizmetlerini ekleyebilir" ON services FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Kullanıcılar kendi hizmetlerini silebilir" ON services FOR DELETE USING (auth.uid() = user_id);

-- Herkese açık randevu sayfası için hizmetler okunabilir olmalı (Public Select)
-- user_id filtrelenerek dışarıya açılır.
CREATE POLICY "Public read services" ON services FOR SELECT USING (true);


-- 2. WORKING HOURS TABLOSU
-- Haftanın günlerine göre çalışma saatleri (0=Pazar, 1=Pazartesi ... 6=Cumartesi)
CREATE TABLE working_hours (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day_of_week)
);

ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kullanıcılar kendi saatlerini yönetebilir" ON working_hours FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read working hours" ON working_hours FOR SELECT USING (true);


-- 3. CALENDAR INTEGRATIONS TABLOSU
-- Google ve Apple OAuth / App-Specific Password bilgileri
CREATE TABLE calendar_integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
  access_token TEXT,
  refresh_token TEXT,
  calendar_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Tokenlar ÇOK HASSAS verilerdir. Kesinlikle public erişim olmaz!
ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kullanıcılar sadece kendi tokenlarını görebilir" ON calendar_integrations FOR ALL USING (auth.uid() = user_id);


-- 4. BOOKINGS TABLOSU
-- Alınan randevular
CREATE TABLE bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  service_id UUID REFERENCES services NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  meeting_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kullanıcılar kendi aldıkları randevuları görebilir" ON bookings FOR ALL USING (auth.uid() = user_id);
-- Herkes (Public) randevu OLUŞTURABİLİR.
CREATE POLICY "Public insert bookings" ON bookings FOR INSERT WITH CHECK (true);
-- Müsaitlik kontrolü için randevuların sadece zamanları public okunabilmeli (kişisel veriler hariç - bu yüzden backend üzerinden kontrol edeceğiz)
-- RLS ayarı şimdilik admin panel için yapıldı. Randevu saatlerini API üzerinden gizlilikle hesaplayacağız.
