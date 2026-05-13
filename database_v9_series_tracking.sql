-- ==============================================
-- INFINITY CALENDAR V9 - Series Position Tracking
-- 2026-05-13
-- 
-- Adds series_id (UUID) and series_position (INTEGER) columns to bookings
-- to track which position in a series each booking occupies (e.g., 1/8, 2/8)
-- ==============================================

-- Add series_id column to track which series a booking belongs to
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS series_id UUID;

-- Add series_position to track the position in the series (1 = first, 2 = second, etc.)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS series_position INTEGER;

-- Add series_total to track total number of appointments in the series
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS series_total INTEGER;

-- Create index for efficient series queries
CREATE INDEX IF NOT EXISTS idx_bookings_series_id ON bookings(series_id);

-- =============================================
-- SAMPLE UPDATE QUERY (for existing bookings, if needed):
-- UPDATE bookings SET series_id = gen_random_uuid() WHERE series_id IS NULL;
-- =============================================