-- Nach der Migration und erneut nach den manuellen Tests ausführen.
-- Nur SELECTs, keine Änderungen. Von Codex nicht ausgeführt.

-- Erwartet: drei Trigger, jeweils tgenabled = O.
SELECT c.relname AS tabelle, t.tgname AS trigger_name, t.tgenabled
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND t.tgname LIKE 'codex_192_%'
ORDER BY t.tgname;

-- Erwartet: beide Spalten mit den genannten Typen.
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'bookings'
  AND column_name IN ('cancelled_at', 'cancelled_session_links')
ORDER BY column_name;

-- Erwartet: ein Index für die Sitzungsfreigabe nach booking_id.
SELECT indexname, indexdef FROM pg_catalog.pg_indexes
WHERE schemaname = 'public' AND indexname = 'codex_192_prescription_sessions_booking_idx';

-- Erwartet: 0. Abgesagte Termine dürfen keine geplanten Einheiten binden.
SELECT count(*) AS abgesagte_termine_mit_geplanten_sitzungen
FROM public.prescription_sessions s
JOIN public.bookings b ON b.id = s.booking_id
WHERE b.status = 'cancelled' AND s.status = 'planned';

-- Erwartet: 0. Keine aktiven Teilnehmer einer abgesagten Gruppe.
SELECT count(*) AS aktive_teilnehmer_abgesagter_gruppen
FROM public.bookings c JOIN public.bookings p ON p.id = c.group_parent_id
WHERE p.status = 'cancelled' AND c.status IS DISTINCT FROM 'cancelled';

-- Erwartet: 0; bei Altbestands-Treffern erst fachlich prüfen, nicht umschreiben.
SELECT count(*) AS abgesagte_termine_mit_erledigten_sitzungen
FROM public.prescription_sessions s JOIN public.bookings b ON b.id = s.booking_id
WHERE b.status = 'cancelled' AND s.status IN ('done', 'no_show');
