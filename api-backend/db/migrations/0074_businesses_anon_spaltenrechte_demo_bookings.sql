-- Migration 0074_businesses_anon_spaltenrechte_demo_bookings.sql
-- SaaS: angewandt 09.10.2026 (MCP: 20261009101324; geprüft: anon businesses nur 6 Spalten, phone → 42501
-- per REST, Policy-Unterabfragen employee_groups/eba/group_scopes/eso ohne Fehler, demo_bookings → 42501,
-- booking.html?u=<Standort-Slug> + booking-request.html im Browser ok).
-- guvenlik S-57 (businesses, niedrig) + S-58 (demo_bookings, mittel), 09.10.2026.
-- Gefunden beim Vorab-Check zu K2b.15 / S-56 (db-ustasi, guvenlik).
--
-- (1) businesses — gleiche Bauart wie S-56/0072 bei profiles:
--   anon hatte Tabellenrechte (INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER)
--   auf alle 26 Spalten; die Policy "Public booking lookup businesses" filtert nur Zeilen
--   (booking_slug IS NOT NULL). Ohne Login lesbar: email, phone, ik_number, Anschrift,
--   clinic_lat/lng, ausfall_*. In der Box über 0000_baseline genauso.
--   Spaltenbedarf anon (db-ustasi + guvenlik, 09.10.):
--     · module/public-owner.js:57  select id, owner_id, business_name; Filter booking_slug
--     · booking.js:339-340         closed_days; Filter id / owner_id + is_default
--     · get_default_business(), get_my_permissions(), fn_check_booking_closed_day (INVOKER)
--     · RLS-Unterabfragen anderer Tabellen (employee_groups, group_scopes,
--       employee_scope_overrides, employee_business_assignments): b.id, b.owner_id
--   Anschrift/URLs der Praxis für Patientenseiten kommen über public_praxis_angaben() (0073).
--   Reihenfolge Pflicht: REVOKE auf Tabellenebene nimmt Spaltenrechte mit, GRANT danach.
--   Kein Schreibrecht für anon zurück. authenticated/service_role unverändert.
--
-- (2) demo_bookings — Policy "authenticated can select demo_bookings" USING true: jedes
--   angemeldete Konto (mandantenübergreifend) las Name, E-Mail, Firma, Nachricht und
--   reschedule_token aller Demo-Anfragen. "anon can insert" WITH CHECK true umging
--   api/demo-booking.js (Prüfung, Rate-Limit). Einziger Nutzer ist api/demo-booking.js
--   über adminFetch (service_role) — beide Policies und die Client-Rechte entfallen.
--
-- ⚠️ Folgeregel (wie 0072): neue anon-Lesung auf businesses ⇒ GRANT SELECT (<spalte>) in
--    derselben Migration. Nie wieder GRANT … ON businesses/profiles TO anon ohne Spaltenliste
--    (tools/check-anon-grants.mjs prüft beide Tabellen).

REVOKE ALL ON TABLE public.businesses FROM anon;

GRANT SELECT (id, owner_id, business_name, booking_slug, is_default, closed_days)
  ON public.businesses TO anon;

-- demo_bookings gibt es nur im SaaS (0000_baseline lässt die Tabelle bewusst weg: Marketing-
-- Demo, nicht Praxis). In der Box ist dieser Block ein No-op — Zähler dort unverändert.
DO $$
BEGIN
  IF to_regclass('public.demo_bookings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "authenticated can select demo_bookings" ON public.demo_bookings';
    EXECUTE 'DROP POLICY IF EXISTS "anon can insert demo_bookings" ON public.demo_bookings';
    EXECUTE 'REVOKE ALL ON TABLE public.demo_bookings FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public.demo_bookings FROM authenticated';
  END IF;
END $$;
