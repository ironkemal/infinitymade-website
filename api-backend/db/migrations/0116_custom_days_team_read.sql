-- SaaS: angewandt 10.11.2026 (Supabase Management-API, MCP nicht authentifiziert)
-- Sondertage: Lesen nur noch fuer das eigene Team; Buchungsseite ueber Funktion ohne Notiz (S-64, 09.11.2026).
--
-- WAS: (1) neue Policy custom_days_team_read (SELECT, nur angemeldet, owner_id = auth_tenant_id()) — Mitarbeiter
--      sehen die Sondertage ihres Inhabers weiter, ohne dass die offene Policy dafuer noetig ist;
--      (2) neue Funktion public_sondertage(p_owner, p_von, p_bis): liefert NUR date,type,start_time,end_time
--      (kein note), nur fuer Praxen mit gesetztem booking_slug, hoechstens 92 Tage.
-- WARUM: custom_days_public_read (TO PUBLIC USING (true)) erlaubt jedem mit dem anon-Key
--      GET /rest/v1/custom_days?select=owner_id,date,note fuer ALLE Praxen. note ist Freitext
--      (z. B. "Krankheit Frau X") = Gesundheitsdatum ueber Beschaeftigte. guvenlik S-64, Schweregrad mittel.
-- Expand-only: die offene Policy bleibt in DIESER Migration bestehen, damit :stable und die alte booking.js
--      weiterlaufen. 0117 loescht sie erst, nachdem booking.js auf public_sondertage umgestellt und live ist.
-- Grants: alle drei REVOKEs (PUBLIC, anon, authenticated), dann gezielt GRANT (Lehre aus 0035).
-- ZAEHLER: fonksiyon +1, rls_policy +1, trigger +0, index +0, tablo +0.

CREATE POLICY custom_days_team_read ON public.custom_days
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT public.auth_tenant_id()));

CREATE OR REPLACE FUNCTION public.public_sondertage(p_owner uuid, p_von date, p_bis date)
 RETURNS TABLE(date date, type text, start_time time without time zone, end_time time without time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT cd.date, cd.type, cd.start_time, cd.end_time
  FROM public.custom_days cd
  WHERE cd.owner_id = p_owner
    AND p_von IS NOT NULL AND p_bis IS NOT NULL
    AND p_bis >= p_von AND p_bis - p_von <= 92
    AND cd.date BETWEEN p_von AND p_bis
    AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.owner_id = p_owner AND b.booking_slug IS NOT NULL)
  ORDER BY cd.date;
$function$;

REVOKE ALL ON FUNCTION public.public_sondertage(uuid,date,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_sondertage(uuid,date,date) FROM anon;
REVOKE ALL ON FUNCTION public.public_sondertage(uuid,date,date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.public_sondertage(uuid,date,date) TO anon, authenticated;

COMMENT ON FUNCTION public.public_sondertage(uuid,date,date) IS
  'Oeffentliche Sicht auf Sondertage fuer die Buchungsseite: ohne Notiz, nur Praxen mit booking_slug, max. 92 Tage (S-64).';
