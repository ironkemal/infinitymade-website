-- Standortplan mit Zeitfenster (Physio-Pilot M4, Melih 04.11.2026: „Zeitfenster pro Tag“, z. B. Mo 8–12 Standort A,
-- 14–18 Standort B).
--
-- WAS: employee_standort_plan.von/bis (time, Berliner Ortszeit). Beide NULL = ganzer Tag — so bleiben alle
--      bestehenden Zeilen und alle Einzeltage. Das Fenster schraenkt nur ein: ob gearbeitet wird, regeln
--      weiter working_hours (Schnittmenge, db-ustasi 04.11.).
-- WARUM time: wie working_hours.start_time/end_time und custom_days. von < bis, kein Fenster ueber Mitternacht.
-- WARUM UNIQUE unveraendert: hoechstens ein Fenster je (Mitarbeiter, Standort, Tag, Version). Reicht fuer A-vormittags/
--      B-nachmittags. Zwei Fenster am selben Standort brauchen spaeter von im Schluessel (neue Migration).
-- Regel: api-backend/lib/standort-plan.js = module/standort-plan-regel.js imZeitfenster().
-- :stable/:beta-sicher: zwei nullable Spalten + CHECK, der NULL/NULL erlaubt. Alter Code liest/schreibt weiter
--      ohne von/bis; nach Rueckfall auf eine aeltere Version gelten Fenster als ganzer Tag — Hinweis genuegt, s. onprem O-242.
-- SaaS: angewandt 04.11.2026, Supabase Management-API (Melih GO 04.11., BEGIN/COMMIT, Ledger-Zeile, Katalog geprüft).
-- ZAEHLER: kolon +2, check +1; rls_policy/fonksiyon/trigger/index unveraendert.

ALTER TABLE public.employee_standort_plan ADD COLUMN IF NOT EXISTS von time;
ALTER TABLE public.employee_standort_plan ADD COLUMN IF NOT EXISTS bis time;
ALTER TABLE public.employee_standort_plan DROP CONSTRAINT IF EXISTS employee_standort_plan_zeitfenster_check;
ALTER TABLE public.employee_standort_plan ADD CONSTRAINT employee_standort_plan_zeitfenster_check
  CHECK ((von IS NULL) = (bis IS NULL) AND (von IS NULL OR von < bis));

COMMENT ON COLUMN public.employee_standort_plan.von IS 'Beginn des Zeitfensters (Berlin), NULL = ganzer Tag (0109)';
COMMENT ON COLUMN public.employee_standort_plan.bis IS 'Ende des Zeitfensters (Berlin), NULL = ganzer Tag (0109)';
