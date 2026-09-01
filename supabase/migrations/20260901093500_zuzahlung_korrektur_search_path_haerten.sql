-- Nachtrag zu 20260831120000_zuzahlung_korrektur: search_path fehlte.
--
-- prevent_belegliste_mod() — das Vorbild für prevent_zuzahlung_korrekturen_mod()
-- — setzt SET search_path = public; die beiden neuen Funktionen hier hatten das
-- versäumt (Supabase-Advisor: function_search_path_mutable). Ohne festen
-- search_path kann eine Rolle mit CREATE-Recht in einem anderen Schema eine
-- gleichnamige Funktion unterschieben, die zur Laufzeit statt der echten
-- aufgerufen wird.

ALTER FUNCTION public.prevent_zuzahlung_korrekturen_mod() SET search_path = public;
ALTER FUNCTION public.fn_zuzahlung_guthaben_status() SET search_path = public;
