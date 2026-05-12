-- custom_days tablosu: tatil, ozel gunler, kapanis gunleri
CREATE TABLE custom_days (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('closed','holiday','special')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE custom_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanicilar kendi ozel gunlerini gorebilir" ON custom_days FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Kullanicilar kendi ozel gunlerini ekleyebilir" ON custom_days FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Kullanicilar kendi ozel gunlerini silebilir" ON custom_days FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public read custom days" ON custom_days FOR SELECT USING (true);
