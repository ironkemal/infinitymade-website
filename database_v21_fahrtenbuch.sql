-- ==============================================
-- INFINITY V21 — Fahrtenbuch / Hausbesuch
-- 2026-05-22
--
-- Hausbesuch + Fahrtenbuch (sürüş seyir defteri) modülü.
-- PostGIS ile koordinat depolama (zincirleme Hausbesuch için).
--
-- Değişiklikler:
--   profiles  : clinic_location, clinic_geocoded_at
--   leads     : location, distance_km, duration_min, route_calculated_at
--   bookings  : fahrt_status, vehicle_id, start_km, end_km, fahrt_*_at
--   vehicles  : yeni tablo (gewerblich paylaşımlı, privat sahibe özel)
--   fahrten   : yeni tablo (sürüş log, immutable kayıt)
-- ==============================================

-- 1. PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. profiles: klinik koordinatı (mevcut street/zip/city/house_number'a ek olarak)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS clinic_location geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS clinic_geocoded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_clinic_location ON profiles USING GIST (clinic_location);

-- 3. leads: hasta koordinatı + ORS sonuç cache (mevcut street/plz/city'ye ek)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS location geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS distance_km numeric(6,2),
  ADD COLUMN IF NOT EXISTS duration_min integer,
  ADD COLUMN IF NOT EXISTS route_calculated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_location ON leads USING GIST (location);

-- 4. bookings: fahrt state machine + vehicle linkage
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS fahrt_status text
    CHECK (fahrt_status IN ('fahrt_started','fahrt_arrived','fahrt_return_pending','fahrt_completed')),
  ADD COLUMN IF NOT EXISTS vehicle_id uuid,
  ADD COLUMN IF NOT EXISTS start_km integer,
  ADD COLUMN IF NOT EXISTS end_km integer,
  ADD COLUMN IF NOT EXISTS fahrt_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS fahrt_arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS fahrt_ended_at timestamptz;

-- 5. vehicles (klinik filosu + bireysel özel araçlar)
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('privat','gewerblich')),
  kennzeichen text NOT NULL,
  label text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_owner_kind ON vehicles (owner_id, kind);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON vehicles (created_by);

-- bookings.vehicle_id FK (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_vehicle_id_fkey') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_vehicle_id_fkey
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. fahrten (immutable sürüş kaydı — Fahrtenbuch yasal log)
CREATE TABLE IF NOT EXISTS fahrten (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  -- Snapshot: araç silinse bile log korunur (yasal saklama)
  kennzeichen_snapshot text,
  kind_snapshot text,
  start_km integer NOT NULL,
  end_km integer,
  distance_km integer GENERATED ALWAYS AS (
    CASE WHEN end_km IS NOT NULL AND end_km >= start_km THEN end_km - start_km ELSE NULL END
  ) STORED,
  estimated_duration_min integer,
  fahrt_started_at timestamptz NOT NULL DEFAULT now(),
  fahrt_arrived_at timestamptz,
  fahrt_ended_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fahrten_booking_uniq ON fahrten (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fahrten_owner_user ON fahrten (owner_id, user_id, fahrt_started_at DESC);

-- 7. RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fahrten ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------
-- VEHICLES RLS
-- ----------------------------------------------
-- SELECT:
--   owner (auth.uid() = owner_id) → tüm araçları (privat + gewerblich) görür
--   employee (profile.owner_id = vehicles.owner_id) → gewerblich + kendi privat'larını görür
DROP POLICY IF EXISTS "vehicles select policy" ON vehicles;
CREATE POLICY "vehicles select policy" ON vehicles FOR SELECT USING (
  owner_id = auth.uid()
  OR (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.owner_id = vehicles.owner_id)
    AND (kind = 'gewerblich' OR created_by = auth.uid())
  )
);

-- INSERT:
--   owner → her kind ekleyebilir
--   employee → sadece privat (kendi created_by ile)
DROP POLICY IF EXISTS "vehicles insert policy" ON vehicles;
CREATE POLICY "vehicles insert policy" ON vehicles FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND (
    owner_id = auth.uid()
    OR (
      kind = 'privat'
      AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.owner_id = vehicles.owner_id)
    )
  )
);

-- UPDATE:
--   owner → her şeyi
--   employee → sadece kendi privat aracı
DROP POLICY IF EXISTS "vehicles update policy" ON vehicles;
CREATE POLICY "vehicles update policy" ON vehicles FOR UPDATE
USING (
  owner_id = auth.uid()
  OR (kind = 'privat' AND created_by = auth.uid())
)
WITH CHECK (
  owner_id = auth.uid()
  OR (kind = 'privat' AND created_by = auth.uid())
);

-- DELETE: aynı (employee kendi privat'ını silebilir; gewerblich sadece owner)
DROP POLICY IF EXISTS "vehicles delete policy" ON vehicles;
CREATE POLICY "vehicles delete policy" ON vehicles FOR DELETE USING (
  owner_id = auth.uid()
  OR (kind = 'privat' AND created_by = auth.uid())
);

-- ----------------------------------------------
-- FAHRTEN RLS
-- ----------------------------------------------
-- SELECT: owner her şey, employee sadece kendi
DROP POLICY IF EXISTS "fahrten select policy" ON fahrten;
CREATE POLICY "fahrten select policy" ON fahrten FOR SELECT USING (
  owner_id = auth.uid()
  OR user_id = auth.uid()
);

-- INSERT: kullanıcı kendi user_id'siyle, owner_id ya kendisi ya da takımının owner'ı
DROP POLICY IF EXISTS "fahrten insert policy" ON fahrten;
CREATE POLICY "fahrten insert policy" ON fahrten FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.owner_id = fahrten.owner_id)
  )
);

-- UPDATE: kullanıcı kendi yarım fahrt'ını günceller (end_km), owner her şeyi düzeltir
DROP POLICY IF EXISTS "fahrten update policy" ON fahrten;
CREATE POLICY "fahrten update policy" ON fahrten FOR UPDATE
USING (user_id = auth.uid() OR owner_id = auth.uid())
WITH CHECK (user_id = auth.uid() OR owner_id = auth.uid());

-- DELETE: sadece owner (Fahrtenbuch yasal kayıt — employee silmemeli)
DROP POLICY IF EXISTS "fahrten delete policy" ON fahrten;
CREATE POLICY "fahrten delete policy" ON fahrten FOR DELETE USING (
  owner_id = auth.uid()
);

-- 8. updated_at trigger for vehicles (mevcut yardımcı yoksa oluştur)
CREATE OR REPLACE FUNCTION set_updated_at_now()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_vehicles ON vehicles;
CREATE TRIGGER set_timestamp_vehicles BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_now();

-- 9. Aylık özet raporu için yardımcı view (Fahrtenbuch sayfasında "Berichte" sekmesi kullanır)
CREATE OR REPLACE VIEW fahrten_monthly_summary AS
SELECT
  f.owner_id,
  f.user_id,
  f.vehicle_id,
  f.kennzeichen_snapshot,
  f.kind_snapshot,
  date_trunc('month', f.fahrt_started_at) AS month,
  COUNT(*) AS trips,
  SUM(COALESCE(f.distance_km, 0)) AS total_km,
  SUM(
    CASE
      WHEN f.fahrt_ended_at IS NOT NULL AND f.fahrt_started_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (f.fahrt_ended_at - f.fahrt_started_at)) / 60
      ELSE 0
    END
  )::integer AS total_minutes
FROM fahrten f
WHERE f.end_km IS NOT NULL  -- sadece tamamlanmış sürüşler
GROUP BY f.owner_id, f.user_id, f.vehicle_id, f.kennzeichen_snapshot, f.kind_snapshot, date_trunc('month', f.fahrt_started_at);
