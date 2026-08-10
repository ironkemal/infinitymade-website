-- =============================================================================
-- v32 — Zahlart beim Kassieren
-- =============================================================================
-- Kontext: Der neue Kassieren-Ablauf (Zahlart wählen → drucken → kassiert)
-- braucht ein Feld für die Zahlungsart. Ohne diese Migration schlägt das
-- Kassieren im Dashboard fehl.
--
-- Ausführen: Supabase SQL-Editor, Projekt njvuclullotbksskpwgk.
-- Gefahrlos wiederholbar (IF NOT EXISTS / DROP … IF EXISTS).
--
-- Bestandsdaten: alle vorhandenen Zeilen bekommen NULL. Das ist gewollt —
-- für Altbelege ist die Zahlart nicht bekannt und darf nicht erfunden werden.
-- =============================================================================

-- 1) Kassenbuch: Zahlart am Beleg -------------------------------------------
--    Die belegliste ist per Trigger unveränderlich (v27). Das betrifft nur
--    Zeilen (UPDATE/DELETE), nicht die Tabellenstruktur — ADD COLUMN geht.
ALTER TABLE public.belegliste
  ADD COLUMN IF NOT EXISTS zahlart TEXT;

ALTER TABLE public.belegliste
  DROP CONSTRAINT IF EXISTS belegliste_zahlart_check;

ALTER TABLE public.belegliste
  ADD CONSTRAINT belegliste_zahlart_check
  CHECK (zahlart IS NULL OR zahlart IN ('bar', 'ec', 'ueberweisung', 'sonstiges'));

COMMENT ON COLUMN public.belegliste.zahlart IS
  'Zahlungsart des Belegs: bar | ec | ueberweisung | sonstiges. NULL = Altbeleg vor v32.';

-- 2) Rezept: Zahlart der kassierten Zuzahlung -------------------------------
--    Redundant zum Beleg, aber das Termin-Panel zeigt die Zuzahlung direkt aus
--    prescriptions an (dashboard.js, openBookingActionModal). Ohne diese Spalte
--    bräuchte jede Terminansicht einen zusätzlichen Join auf belegliste.
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS zuzahlung_zahlart TEXT;

ALTER TABLE public.prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_zuzahlung_zahlart_check;

ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_zuzahlung_zahlart_check
  CHECK (zuzahlung_zahlart IS NULL OR zuzahlung_zahlart IN ('bar', 'ec', 'ueberweisung', 'sonstiges'));

COMMENT ON COLUMN public.prescriptions.zuzahlung_zahlart IS
  'Zahlungsart, mit der die Zuzahlung kassiert wurde. Gehört zu zuzahlung_kassiert_am/_von.';

-- 3) Index für die Monatsübersicht (Aufgabe 6) ------------------------------
--    statistik.routes.js sucht Rezepte mit offener Zuzahlung. Ohne Index ist
--    das ein Full Scan über alle Rezepte des Mandanten.
CREATE INDEX IF NOT EXISTS idx_prescriptions_zuzahlung_offen
  ON public.prescriptions (owner_id, ausstellungsdatum)
  WHERE zuzahlung_eur > 0 AND zuzahlung_befreit = false;

-- 4) Kontrolle ---------------------------------------------------------------
-- Nach dem Ausführen sollte das hier 2 Zeilen liefern:
--
--   SELECT table_name, column_name
--   FROM information_schema.columns
--   WHERE (table_name = 'belegliste'     AND column_name = 'zahlart')
--      OR (table_name = 'prescriptions'  AND column_name = 'zuzahlung_zahlart');
