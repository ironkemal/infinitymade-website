-- Mitarbeiter-Zugang härten (guvenlik S-38 Restpunkte, KHS K1.3).
--
-- WARUM:
--   (a) Ein neuer Einrichtungscode setzte nur ein zufälliges Passwort — bereits
--       angemeldete Sitzungen der Mitarbeiterin liefen weiter.
--       auth.admin.signOut() nimmt ein JWT, keine userId (guvenlik 02.10.), daher
--       eine eigene Funktion, die die Sitzungen in auth.sessions löscht
--       (auth.refresh_tokens hängt per ON DELETE CASCADE daran). Bereits
--       ausgestellte Access-Tokens bleiben bis zu ihrem Ablauf gültig.
--   (b) Das Plan-Limit wurde im Backend gezählt und erst danach das Konto
--       angelegt — zwei parallele Anlagen konnten das Limit überschreiten.
--       Jetzt: Zählen + Zuordnen (owner_id, role) in EINER Transaktion unter
--       pg_advisory_xact_lock je Inhaber (Muster: vergebe_patientennummer).
--       Das Limit selbst kommt als Parameter vom Backend
--       (PLAN_EMPLOYEE_LIMITS bleibt die Quelle, keine dritte Kopie).
--       Gezählt werden nur aktive Mitarbeiter (is_active IS NOT FALSE): ein
--       entfernter Mitarbeiter gibt seinen Platz frei (Kemal-Linie, 02.10.).
--   (c) profiles_public (öffentliche Buchungsseite, booking.js) zeigte auch
--       entfernte Mitarbeiter. Die Sicht lässt jetzt Mitarbeiter mit
--       is_active = false weg; Inhaber-Zeilen bleiben unverändert.
--   Audit: KEINE neue Tabelle — die Routen schreiben über logAccess() in
--   data_access_log (fonksiyon-ustasi 02.10.).
--
-- SCHUTZ: beide Funktionen SECURITY DEFINER, search_path fest, EXECUTE nur
--   service_role (drei REVOKEs, Lehre aus 0035).
--
-- SaaS: angewandt 02.10.2026, MCP.
-- ZAEHLER: fonksiyon +2. Sicht: counter-neutral.

CREATE OR REPLACE FUNCTION public.auth_sitzungen_beenden(p_user uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM auth.sessions WHERE user_id = p_user;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_sitzungen_beenden(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_sitzungen_beenden(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.auth_sitzungen_beenden(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auth_sitzungen_beenden(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.mitarbeiter_zuordnen(
  p_owner uuid,
  p_mitarbeiter uuid,
  p_limit integer   -- NULL = unbegrenzt
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('mitarbeiter_' || p_owner::text));

  SELECT count(*) INTO n
    FROM public.profiles
   WHERE owner_id = p_owner
     AND role = 'employee'
     AND is_active IS NOT FALSE
     AND id <> p_mitarbeiter;

  IF p_limit IS NOT NULL AND n >= p_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
     SET owner_id = p_owner, role = 'employee'
   WHERE id = p_mitarbeiter
     AND owner_id IS NULL;   -- nur frisch angelegte Konten, nie fremde

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MITARBEITER_NICHT_ZUORDENBAR' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mitarbeiter_zuordnen(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mitarbeiter_zuordnen(uuid, uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.mitarbeiter_zuordnen(uuid, uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mitarbeiter_zuordnen(uuid, uuid, integer) TO service_role;

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = true) AS
 SELECT id,
    business_name,
    owner_first_name,
    owner_last_name,
    accepts_bookings,
    role,
    owner_id,
    booking_slug,
    avatar_url,
    anrede
   FROM public.profiles
  WHERE NOT (role = 'employee' AND is_active IS FALSE);
