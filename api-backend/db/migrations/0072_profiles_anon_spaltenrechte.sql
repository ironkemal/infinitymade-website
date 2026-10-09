-- Migration 0072_profiles_anon_spaltenrechte.sql
-- SaaS: angewandt 09.10.2026 (MCP: 20261009083226; Katalogexport 09.10.: anon hat keine Tabellenrechte auf profiles mehr, 11 Spaltenrechte SELECT).
-- guvenlik S-56 (09.10.2026, hoch). Gefunden von db-ustasi beim Vorab-Check zu K2b.15.
--
-- Problem: Die Policy "Public booking lookup profiles" (anon darf Zeilen mit booking_slug +
-- accepts_bookings lesen) steht auf der TABELLE profiles, und anon hatte Tabellenrechte auf
-- ALLE 87 Spalten. Die Sicht profiles_public (security_invoker, 10 Spalten) war damit nur eine
-- Konvention: ohne Login ging `GET /rest/v1/profiles?select=iban,email,phone,steuernummer,...`
-- direkt an der Sicht vorbei. Seit 22.06.2026 (Migration add_public_booking_read_policies),
-- in der Box über 0000_baseline genauso (Caddy reicht /rest/* an Kong durch).
--
-- Fix (guvenlik Variante a): Tabellenrechte von anon zurücknehmen, nur die Spalten wieder
-- freigeben, die die Sicht und die RLS-Unterabfragen anderer Tabellen brauchen.
--   · Sichtspalten: id, business_name, owner_first_name, owner_last_name, accepts_bookings,
--     role, owner_id, booking_slug, avatar_url, anrede
--   · is_active: WHERE-Klausel der Sicht (security_invoker → Rechte des Aufrufers)
--   · 65 Policies anderer Tabellen (services, breaks, businesses, employee_business_assignments …)
--     fragen profiles über id/owner_id/role ab — alle drei sind oben enthalten. Ohne diese
--     Spaltenrechte stirbt booking.html lautlos („Unternehmen nicht gefunden").
-- Reihenfolge ist Pflicht: REVOKE auf Tabellenebene entfernt auch Spaltenrechte, GRANT danach.
--
-- Zusätzlich: die Policy blendet ausgeschiedene Mitarbeiter (is_active = false) aus, wie die Sicht
-- es schon tut — sonst sähe die direkte Tabellenabfrage deren Namen weiterhin.
--
-- ⚠️ Folgeregel: neue Spalte in profiles_public ⇒ in DERSELBEN Migration
--    GRANT SELECT (<spalte>) ON public.profiles TO anon; sonst bricht die Buchungsseite.
--    Und nie wieder `GRANT ALL ON ALL TABLES … TO anon` (würde diesen Fix zurückdrehen, S-04-Klasse).
-- Rein additiv für authenticated/service_role: deren Rechte bleiben unverändert.

REVOKE ALL ON TABLE public.profiles FROM anon;

GRANT SELECT (
  id, business_name, owner_first_name, owner_last_name, accepts_bookings,
  role, owner_id, booking_slug, avatar_url, anrede, is_active
) ON public.profiles TO anon;

DROP POLICY IF EXISTS "Public booking lookup profiles" ON public.profiles;
CREATE POLICY "Public booking lookup profiles" ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO PUBLIC
  USING (
    auth.uid() IS NULL
    AND booking_slug IS NOT NULL
    AND accepts_bookings = true
    AND NOT (role = 'employee' AND is_active IS FALSE)
  );
