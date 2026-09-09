-- Nur bei Rücknahme des Fixes ausführen, NICHT nach dem regulären Vorwärtsskript.
-- Die Absagen und historischen Metadaten bleiben absichtlich erhalten.
-- Sitzungen nicht zurückhängen: sie können inzwischen neu vergeben worden sein.
BEGIN;
DROP TRIGGER IF EXISTS codex_192_session_booking_guard ON public.prescription_sessions;
DROP TRIGGER IF EXISTS codex_192_booking_after_cancel ON public.bookings;
DROP TRIGGER IF EXISTS codex_192_booking_before_write ON public.bookings;
DROP FUNCTION IF EXISTS public.codex_192_session_booking_guard();
DROP FUNCTION IF EXISTS public.codex_192_booking_after_cancel();
DROP FUNCTION IF EXISTS public.codex_192_booking_before_write();
DROP INDEX IF EXISTS public.codex_192_prescription_sessions_booking_idx;
-- cancelled_at und cancelled_session_links sind additive historische Daten.
-- Ein DROP würde die bei der Absage gesicherte Zuordnung erneut vernichten.
COMMIT;
