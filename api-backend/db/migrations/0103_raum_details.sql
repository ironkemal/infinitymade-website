-- Raumdetails: lokale Vorbereitung, NICHT SaaS-angewandt.
-- Bestehende Mandanten-/Inhaberrechte und Raumkapazitätsregeln bleiben unverändert.
-- Ausstattung enthält ausschließlich vorhandene, angehakte Punkte.
CREATE OR REPLACE FUNCTION public.raum_ausstattung_gueltig(punkte text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
AS $$
  SELECT punkte IS NOT NULL
    AND COALESCE(array_ndims(punkte), 1) = 1
    AND cardinality(punkte) <= 30
    AND NOT EXISTS (
      SELECT 1 FROM unnest(punkte) punkt
      WHERE punkt IS NULL OR char_length(punkt) NOT BETWEEN 1 AND 80
        OR punkt <> btrim(punkt, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
    )
    AND cardinality(punkte) = (SELECT count(DISTINCT punkt) FROM unnest(punkte) punkt);
$$;
REVOKE ALL ON FUNCTION public.raum_ausstattung_gueltig(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.raum_ausstattung_gueltig(text[]) TO authenticated, service_role;
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS beschreibung text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ausstattung text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_beschreibung_laenge,
  DROP CONSTRAINT IF EXISTS rooms_ausstattung_gueltig;
ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_beschreibung_laenge CHECK (char_length(beschreibung) <= 2000),
  ADD CONSTRAINT rooms_ausstattung_gueltig CHECK (public.raum_ausstattung_gueltig(ausstattung));
