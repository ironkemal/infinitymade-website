-- v3: prevent double-booking via PostgreSQL exclusion constraint
--
-- Without this, two clients POSTing /api/booking/create at the same instant
-- both pass the slot-availability check and both INSERT, leaving the same
-- employee with two simultaneous bookings.
--
-- An exclusion constraint enforces atomicity at the DB level: any INSERT/UPDATE
-- that would create a time-range overlap for the same user gets rejected
-- with SQLSTATE 23P01 (exclusion_violation). Pair this with the server-side
-- handler in server.js that catches the error and returns a 409 to the client.

-- btree_gist is required to mix uuid (=) with tstzrange (&&) in the same exclusion
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop any prior version of the constraint (idempotent re-run)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_overlapping_bookings;

-- Block overlapping confirmed bookings for the same employee.
-- '[)' = inclusive start, exclusive end — back-to-back appointments are allowed.
ALTER TABLE bookings
  ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING GIST (
    user_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status = 'confirmed');
