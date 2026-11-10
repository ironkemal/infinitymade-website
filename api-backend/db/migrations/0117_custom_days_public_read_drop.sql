-- SaaS: angewandt 10.11.2026 (Supabase Management-API, MCP nicht authentifiziert)
-- 0117: S-64 Abschluss. Die offene SELECT-Policy auf custom_days (roles {public}, also anon) fällt weg.
-- Öffentliche Buchungsseite liest seit booking.js?v=20261110sondertag nur noch public_sondertage() (0116, ohne note).
-- Team-Lesen läuft über custom_days_team_read (0116), Inhaber über custom_days_owner_all, Backend über service_role.
-- ZAEHLER: rls_policy -1 (zusammen mit 0116: netto 0 gegenüber vorher).
DROP POLICY IF EXISTS custom_days_public_read ON public.custom_days;
