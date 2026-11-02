-- Standortplan-Versionen „gültig ab" + Austrittsdatum (Physio-Pilot M4c/M5, 01.11.2026, db-ustasi).
--
-- WAS 1: employee_standort_plan.gueltig_ab — ein Wochenmuster kann ab einem Datum gelten (physio: Pilot-Minimum,
--      eine geplante Umstellung soll nicht sofort wirken). NULL = seit immer. Version gilt je Mitarbeiter:
--      fuer Datum d zaehlt die Version mit dem groessten gueltig_ab <= d (NULL = -unendlich), nur deren Zeilen;
--      Einzeltage gehen weiter vor. Regel im Code (module/standort-plan-regel.js = api-backend/lib/standort-plan.js).
-- WARUM CHECK: Einzeltage haben nie gueltig_ab (sie sind selbst ein Datum).
-- WARUM UNIQUE ersetzen: zwei Versionen duerfen dieselbe (Mitarbeiter, Standort, Wochentag)-Zeile tragen;
--      Tabelle war beim Anwenden leer bzw. klein, Austausch in einer Transaktion. Kein onConflict im Code.
-- WAS 2: mitarbeiter_anstellung.austritt_am — gesetzt von POST /team/mitarbeiter/:id/entfernen. Basis der
--      Loeschfrist fuer Anstellung + time_offs: 31.12. des dritten Kalenderjahres nach dem Austrittsjahr
--      (§§ 195, 199 BGB, Urlaubsabgeltung § 7 Abs. 4 BUrlG; legal-de 01.11.2026). Loeschen manuell durch den
--      Inhaber (Ansicht „Ehemalige Mitarbeiter"), kein Cron (onprem).
-- RLS/klassifikation/loeschen: unveraendert (Policies lesen weder weekday/datum noch die neuen Spalten).
-- SaaS: angewandt 02.11.2026, Supabase Management-API mit MCP-Token (BEGIN/COMMIT, danach Katalog geprueft).
-- ZAEHLER: public_tablo +0, rls_policy +0, fonksiyon +0, trigger +0, index +0.

ALTER TABLE public.employee_standort_plan ADD COLUMN IF NOT EXISTS gueltig_ab date;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_standort_plan_gueltig_check') THEN
    ALTER TABLE public.employee_standort_plan ADD CONSTRAINT employee_standort_plan_gueltig_check
      CHECK (datum IS NULL OR gueltig_ab IS NULL);
  END IF;
END $$;

ALTER TABLE public.employee_standort_plan DROP CONSTRAINT IF EXISTS employee_standort_plan_eindeutig;
ALTER TABLE public.employee_standort_plan ADD CONSTRAINT employee_standort_plan_eindeutig
  UNIQUE NULLS NOT DISTINCT (employee_id, business_id, weekday, datum, gueltig_ab);

ALTER TABLE public.mitarbeiter_anstellung ADD COLUMN IF NOT EXISTS austritt_am date;
