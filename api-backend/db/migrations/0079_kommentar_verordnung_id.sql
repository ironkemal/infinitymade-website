-- Migration 0079_kommentar_verordnung_id.sql
-- SaaS: angewandt 11.10.2026 (MCP: 20261011142626, Freigabe Kemal 11.10.2026 „olur, sen karar ver").
--
-- Nur Spaltenkommentare. Keine Tabelle, keine Spalte, kein Constraint ändert sich.
--
-- Problem: Die Kommentare von bookings.verordnung_id und invoices.verordnung_id
-- (0000_baseline.sql:2922 / :3667) stammen aus der Zeit VOR der Zusammenlegung der
-- Verordnungstöpfe (04.09.2026). Sie sagen „verordnungen.id" bzw. bei bookings sogar
-- „NIEMALS eine prescriptions.id" — beides ist seit dem 04.09.2026 falsch: die Tabelle
-- `verordnungen` existiert nicht mehr, beide FKs zeigen auf prescriptions(id)
-- (bookings_verordnung_id_fkey, invoices_verordnung_id_fkey, ON DELETE SET NULL).
-- Wer den Kommentar liest statt den FK, schreibt in die falsche Richtung.
--
-- Zähler (erwartete-zaehler.json): COMMENT ON COLUMN schreibt nach pg_description, das
-- keiner der zehn Zähler liest -> COUNTER-NEUTRAL (dritte Form von README Kural 6).

COMMENT ON COLUMN public.bookings.verordnung_id IS
  'Podologie: zu welcher podologischen Verordnung (prescriptions.id, therapie_bereich = ''podo'') gehoert dieser Termin. Seit 04.09.2026 zeigt die Spalte auf prescriptions (vorher Tabelle verordnungen, ids unveraendert uebernommen). Physio/Ergo/Logo verknuepfen Termin und Verordnung NICHT hierueber, sondern ueber prescription_sessions.booking_id. Owner-Riegel: trg_booking_verordnung_owner.';

COMMENT ON COLUMN public.invoices.verordnung_id IS
  'Podologische Verordnung (prescriptions.id, therapie_bereich = ''podo''), seit 04.09.2026 auf prescriptions (vorher Tabelle verordnungen). Gegenstueck zu prescription_id fuer Physio/Ergo/Logo. Hoechstens eines von beiden ist gesetzt (CHECK invoices_ein_verordnungsbezug).';
