-- v33 — Diagnosegruppe in der Terminanfrage
--
-- Warum: Das Anfrage-Formular fragte ICD-10 und Heilmittel ab, aber nicht die
-- Diagnosegruppe. Genau die braucht die Verordnung-Maske im Dashboard, damit die
-- Angaben des Patienten übernommen werden können, statt sie erneut zu erfassen.
--
-- Sicherheit: nur eine zusätzliche, optionale Textspalte. Bestehende Zeilen
-- bekommen NULL, kein Backfill nötig, keine Constraint-Änderung.
--
-- ⚠️ Vor dem Deploy im Supabase SQL-Editor ausführen (Projekt njvuclullotbksskpwgk).
--    Ohne die Spalte lehnt PostgREST das Speichern einer GKV-Anfrage ab.

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS diagnosegruppe text;

COMMENT ON COLUMN public.booking_requests.diagnosegruppe IS
  'Diagnosegruppe aus dem Heilmittelkatalog (z. B. WS2, EX3, SP6), vom Patienten aus dem Rezept übernommen. Optional.';
