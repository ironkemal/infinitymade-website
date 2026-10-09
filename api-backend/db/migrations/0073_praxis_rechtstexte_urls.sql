-- Migration 0073_praxis_rechtstexte_urls.sql
-- SaaS: angewandt 09.10.2026 (MCP: 20261009091146; geprüft: anon EXECUTE ja, PUBLIC nein, anon-Spalten profiles weiter 11, Mitarbeiter-ID → 0 Zeilen).
-- K2b.15 · legal-de 09.10.2026 (Box-Patientenseiten: Impressum/Datenschutz) · onprem O-181 · guvenlik S-56 (Vorabbewertung).
--
-- Was: Die Praxis betreibt ihre Online-Terminseite selbst und ist Verantwortliche. Sie kann
-- die Adressen ihres Impressums und ihrer Datenschutzerklärung hinterlegen; ohne Eintrag
-- zeigt die Patientenseite einen aus den Praxisdaten erzeugten Datenschutzhinweis und als
-- Fußzeile nur „Praxisname · Anschrift" (kein Impressum-Link).
--
-- Warum ein RPC und NICHT profiles_public + Spalten-GRANT (db-ustasi + guvenlik + onprem, 09.10.):
--   · profiles_public liefert Zeilen auch für Mitarbeiter (Policy „Public booking lookup profiles").
--     Ein Spaltenrecht gilt für ALLE freigegebenen Zeilen — trägt ein Mitarbeiter je eine
--     Privatanschrift ein, wäre sie sofort öffentlich (S-56-Klasse, guvenlik: Veto für diesen Weg).
--   · Ohne neue Sichtspalte bleibt anon auf profiles bei 11 Spaltenrechten (Selbstcheck
--     anon_profiles_kolon unverändert, S-56-Folgeregel greift nicht).
--   · zip/plz-Doppel und Standortadresse (businesses) werden an EINER Stelle aufgelöst.
--
-- public_praxis_angaben(owner, standort):
--   · nur Inhaber-Zeilen (role = 'owner'), nie Mitarbeiter
--   · nur Praxen mit accepts_bookings (guvenlik Bed. 3) und nicht gelöscht
--   · Standortadresse nur für einen eigenen Standort mit booking_slug, sonst Inhaberanschrift
--   · Rückgabe ist ohnehin Impressum-Pflichtangabe (ladungsfähige Anschrift) — kein Geheimnis
--   · SET search_path = '' (guvenlik Bed. 4), alle Objekte schema-qualifiziert
--
-- Expand-only: zwei nullable Spalten + CHECK + eine Funktion. :stable unberührt.
-- Zähler: fonksiyon +1 (siehe erwartete-zaehler.json _hinweis_0073).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS praxis_impressum_url   text,
  ADD COLUMN IF NOT EXISTS praxis_datenschutz_url text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_praxis_impressum_url_check CHECK (
    praxis_impressum_url IS NULL OR (
      char_length(praxis_impressum_url) <= 500
      AND praxis_impressum_url ~ '^https://[^[:space:][:cntrl:]]+$')),
  ADD CONSTRAINT profiles_praxis_datenschutz_url_check CHECK (
    praxis_datenschutz_url IS NULL OR (
      char_length(praxis_datenschutz_url) <= 500
      AND praxis_datenschutz_url ~ '^https://[^[:space:][:cntrl:]]+$'));

COMMENT ON COLUMN public.profiles.praxis_impressum_url IS
  'Impressum der Praxis (§ 5 DDG), nur https, ≤500. Leer -> Patientenseite zeigt kein Impressum, nur Klartext Praxisname · Anschrift (legal-de 09.10.2026). anon nur über public_praxis_angaben().';
COMMENT ON COLUMN public.profiles.praxis_datenschutz_url IS
  'Datenschutzerklärung der Praxis (Art. 13 DSGVO), nur https, ≤500. Leer -> erzeugte Seite „Datenschutzhinweise zur Terminanfrage" (legal-de 09.10.2026). anon nur über public_praxis_angaben().';

CREATE OR REPLACE FUNCTION public.public_praxis_angaben(p_owner_id uuid, p_business_id uuid DEFAULT NULL)
 RETURNS TABLE (praxis_name text, inhaber_name text, strasse text, hausnummer text,
                plz text, ort text, impressum_url text, datenschutz_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT
    COALESCE(NULLIF(btrim(b.business_name), ''), NULLIF(btrim(p.business_name), '')),
    COALESCE(NULLIF(btrim(p.praxis_inhaber), ''),
             NULLIF(btrim(concat_ws(' ', p.owner_first_name, p.owner_last_name)), '')),
    CASE WHEN b.id IS NOT NULL THEN b.street       ELSE p.street       END,
    CASE WHEN b.id IS NOT NULL THEN b.house_number ELSE p.house_number END,
    CASE WHEN b.id IS NOT NULL THEN b.zip          ELSE COALESCE(NULLIF(p.zip, ''), NULLIF(p.plz, '')) END,
    CASE WHEN b.id IS NOT NULL THEN b.city         ELSE p.city         END,
    p.praxis_impressum_url,
    p.praxis_datenschutz_url
  FROM public.profiles p
  LEFT JOIN public.businesses b
         ON b.id = p_business_id AND b.owner_id = p.id AND b.booking_slug IS NOT NULL
  WHERE p.id = p_owner_id
    AND p.role = 'owner'
    AND p.accepts_bookings IS TRUE
    AND p.plan_status IS DISTINCT FROM 'deleted'
  LIMIT 1;
$function$;

COMMENT ON FUNCTION public.public_praxis_angaben(uuid, uuid) IS
  'Patientenseiten booking/booking-request (anon): Verantwortlicher (Name + Anschrift) und Rechtstext-URLs. Nur Inhaber-Zeile mit accepts_bookings, nie Mitarbeiter; Standortadresse nur für eigenen Standort mit booking_slug. K2b.15, legal-de/guvenlik 09.10.2026.';

-- Drei Grantees schließen (S-04/0035: PUBLIC UND die Default-Privileges von anon/authenticated),
-- danach bewusst öffnen.
REVOKE ALL ON FUNCTION public.public_praxis_angaben(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_praxis_angaben(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.public_praxis_angaben(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.public_praxis_angaben(uuid, uuid) TO anon, authenticated, service_role;
