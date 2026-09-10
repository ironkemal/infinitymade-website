-- custom_days tablosu: dükkan bazli tatil, ozel gunler, kapanis gunleri
CREATE TABLE custom_days (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('closed','holiday','special')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, date)
);

ALTER TABLE custom_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage custom days" ON custom_days FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Everyone can read custom days" ON custom_days FOR SELECT USING (true);
