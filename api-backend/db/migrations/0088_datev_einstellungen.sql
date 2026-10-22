-- SaaS: angewandt 22.10.2026 (MCP: 20261022153702)
-- 0088: DATEV-Einstellungen der Praxis (Buchungsstapel-Export für den Steuerberater).
-- Anlass: Kemal 22.10.2026. Schema db-ustasi 22.10.2026 (eine jsonb-Spalte in profiles,
-- gleiches Muster wie buchungskonten/selbstzahler_stufen; Owner-Einstellung → profiles,
-- nicht businesses). onprem O-215: nur Ergänzung, :stable läuft ohne die Spalte weiter.
-- Exportziel DATEV EXTF (compliance/LEGAL_DECISIONS.md 2026-09-17).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS datev_einstellungen jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.datev_einstellungen IS
  'DATEV-EXTF-Kopf + Erlöskonten: {beraternummer, mandantennummer, wj_beginn (MM-TT), sachkontenlaenge, kontenrahmen (SKR03|SKR04), erloeskonten:{gkv,privat,selbstzahler,bg,zuzahlung,ausfall}, gkv_geldkonto}. Leer = Export verweigert mit Hinweis. Form und Standardwerte in module/datev-einstellungen.js.';
