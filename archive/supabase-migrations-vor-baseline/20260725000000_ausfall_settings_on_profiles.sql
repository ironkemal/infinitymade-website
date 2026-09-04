-- Ausfallgebühr ist eine Owner-Einstellung (nicht pro Standort). Manche Owner
-- haben gar keine businesses-Zeile (Einzelpraxis), daher gehören die Felder auf
-- profiles. Die businesses.ausfall_* Spalten bleiben bestehen (harmlos), werden
-- aber nicht mehr genutzt.
-- Applied to live DB 2026-07-25 via MCP (migration: ausfall_settings_on_profiles).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ausfall_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ausfall_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS ausfall_amount_eur numeric(10,2),
  ADD COLUMN IF NOT EXISTS ausfall_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS ausfall_cutoff_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS ausfall_hinweis text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_ausfall_mode_check CHECK (ausfall_mode IN ('fixed','percent'));

-- Vorhandene businesses-Einstellungen auf den Owner übernehmen (falls schon gesetzt)
UPDATE public.profiles p
SET ausfall_enabled = b.ausfall_enabled,
    ausfall_mode = COALESCE(b.ausfall_mode, 'fixed'),
    ausfall_amount_eur = b.ausfall_amount_eur,
    ausfall_percent = b.ausfall_percent,
    ausfall_cutoff_hours = COALESCE(b.ausfall_cutoff_hours, 24),
    ausfall_hinweis = b.ausfall_hinweis
FROM public.businesses b
WHERE b.owner_id = p.id AND b.is_default = true AND b.ausfall_enabled = true;
