-- v29: Group Appointments (Gruppentermine)
--
-- Supports scheduling and managing group appointments in German physiotherapy.
-- Group appointments have is_group = TRUE and a group_capacity.
-- Multiple patients/leads can be booked into the same slot as child bookings
-- referencing the parent slot via group_parent_id.
--
-- The exclusion constraint is updated so child bookings do not trigger a collision.

-- 1. Add group columns to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS group_capacity INTEGER DEFAULT 5;

-- 2. Add group-specific columns to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS group_capacity INTEGER DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS group_parent_id UUID REFERENCES bookings(id) ON DELETE CASCADE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

-- 3. Create indexes for quick lookups and performance
CREATE INDEX IF NOT EXISTS idx_bookings_group_parent_id ON bookings(group_parent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_lead_id ON bookings(lead_id);

-- 4. Modify exclusion constraint to allow overlapping child bookings.
-- The parent booking preserves the slot (group_parent_id IS NULL).
-- Child bookings are linked (group_parent_id IS NOT NULL), bypass the overlap check.

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_overlapping_bookings;

ALTER TABLE bookings
  ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING GIST (
    user_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status = 'confirmed' AND group_parent_id IS NULL);
