-- ==============================================
-- INFINITY V22 — Fahrtenbuch lat/lng sync
-- 2026-05-22
--
-- PostgREST'ten PostGIS geography(Point) okumak zor; lat/lng numeric
-- kolonları eklenir, location trigger ile auto-sync olur.
-- ==============================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS lng numeric(9,6);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS clinic_lat numeric(9,6),
  ADD COLUMN IF NOT EXISTS clinic_lng numeric(9,6);

CREATE OR REPLACE FUNCTION sync_leads_location()
RETURNS trigger AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng::float, NEW.lat::float), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_leads_location ON leads;
CREATE TRIGGER trg_sync_leads_location
  BEFORE INSERT OR UPDATE OF lat, lng ON leads
  FOR EACH ROW EXECUTE FUNCTION sync_leads_location();

CREATE OR REPLACE FUNCTION sync_profiles_clinic_location()
RETURNS trigger AS $$
BEGIN
  IF NEW.clinic_lat IS NOT NULL AND NEW.clinic_lng IS NOT NULL THEN
    NEW.clinic_location := ST_SetSRID(ST_MakePoint(NEW.clinic_lng::float, NEW.clinic_lat::float), 4326)::geography;
  ELSE
    NEW.clinic_location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_profiles_clinic_location ON profiles;
CREATE TRIGGER trg_sync_profiles_clinic_location
  BEFORE INSERT OR UPDATE OF clinic_lat, clinic_lng ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_profiles_clinic_location();
