-- SaaS: angewandt 18.10.2026 (MCP: 20261017224757, Freigabe Melih 18.10.2026; Pflichtberater db-ustasi + onprem: GO)
-- Supabase-Advisor function_search_path_mutable: feste search_path fuer vier Triggerfunktionen.
-- Rein additiv: nur Funktionskonfiguration (proconfig), kein Funktionskoerper aendert sich.
-- notify_feedback_telegram existiert in der Kundenbox nicht (0000_baseline droppt sie, O-21/G1),
-- daher geschuetzt (G7); die uebrigen drei legt die Baseline an.
ALTER FUNCTION public.update_attendance_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.aerzte_touch_updated_at()      SET search_path = public, pg_temp;
ALTER FUNCTION public.pat_fussbefund_versionieren()  SET search_path = public, pg_temp;

DO $$
BEGIN
  IF to_regprocedure('public.notify_feedback_telegram()') IS NOT NULL THEN
    ALTER FUNCTION public.notify_feedback_telegram() SET search_path = public, pg_temp;
  END IF;
END $$;
