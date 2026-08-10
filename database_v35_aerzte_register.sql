-- ============================================================================
-- v32 — Ärzte-Register: stabile Identität (LANR) + Kontaktdaten-Bereinigung
--
-- Hintergrund
-- -----------
-- `aerzte.arzt_nummer` war doppelt belegt:
--   * die Ärzte-Verwaltungsmaske bot sie als "Telefon / Fax" an
--   * die §302-DTA-Erzeugung las sie als LANR-Fallback
--     (billing/api/abrechnung.routes.js: `arzt?.lanr || arzt?.arzt_nummer`)
-- Dadurch konnte eine Telefonnummer als LANR in die Kassendatei geraten.
-- Die Spalte wird entwertet, die Altdaten wandern in die richtigen Felder.
--
-- Ausserdem: das Register bekommt eine erzwungene Identität, damit derselbe
-- Arzt nicht bei jeder Verordnung erneut angelegt wird.
--
-- Idempotent — kann gefahrlos erneut ausgeführt werden.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Fehlende Stamm-/Kontaktfelder
-- ---------------------------------------------------------------------------
ALTER TABLE public.aerzte
  ADD COLUMN IF NOT EXISTS praxis_name text,
  ADD COLUMN IF NOT EXISTS fax         text,
  ADD COLUMN IF NOT EXISTS email       text,
  ADD COLUMN IF NOT EXISTS notizen     text,
  ADD COLUMN IF NOT EXISTS quelle      text,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

-- ---------------------------------------------------------------------------
-- 2) Altbestand aus arzt_nummer in die richtigen Spalten überführen
-- ---------------------------------------------------------------------------

-- a) Sieht aus wie eine Telefonnummer -> telefon
UPDATE public.aerzte
   SET telefon = btrim(arzt_nummer)
 WHERE arzt_nummer IS NOT NULL
   AND telefon IS NULL
   AND btrim(arzt_nummer) ~ '^[0-9][0-9 +/().-]{4,}$';

-- b) Enthält Buchstaben, ist aber keine LANR-Schreibweise -> praxis_name
--    (z. B. "Orthopädische Praxis Hoffmann & Partner")
UPDATE public.aerzte
   SET praxis_name = btrim(arzt_nummer)
 WHERE arzt_nummer IS NOT NULL
   AND praxis_name IS NULL
   AND btrim(arzt_nummer) ~ '[A-Za-zÄÖÜäöüß]'
   AND btrim(arzt_nummer) !~ '^[A-Za-z]?[0-9]+$';

-- c) LANR-Schreibweise ("L987654321") und lanr noch leer -> lanr
UPDATE public.aerzte
   SET lanr = regexp_replace(btrim(arzt_nummer), '^[A-Za-z]', '')
 WHERE arzt_nummer IS NOT NULL
   AND lanr IS NULL
   AND regexp_replace(btrim(arzt_nummer), '^[A-Za-z]', '') ~ '^[0-9]{9}$';

-- d) Spalte entwerten. Nicht droppen — Rückbau bleibt möglich.
UPDATE public.aerzte SET arzt_nummer = NULL WHERE arzt_nummer IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) Dokumentation der Semantik
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.aerzte IS
  'Ärzte-Register je Inhaber (owner_id). Wird beim Erfassen einer Verordnung '
  'automatisch befüllt: LANR-Treffer -> vorhandenen Datensatz anreichern, sonst '
  'neu anlegen. Grundlage der Arzt-Auswertung (welcher Arzt überweist wie viel).';

COMMENT ON COLUMN public.aerzte.arzt_nummer IS
  'VERALTET (2026-08-10). War doppelt belegt (Telefon in der Maske, LANR-Fallback '
  'in der DTA-Erzeugung). Daten nach telefon/praxis_name/lanr migriert. Nicht mehr '
  'lesen oder schreiben — Ersatz: lanr, bsnr, telefon, praxis_name.';

COMMENT ON COLUMN public.aerzte.lanr IS
  'Lebenslange Arztnummer, 9-stellig. Stabiler Identitätsschlüssel: bleibt bei '
  'Namensänderung (Heirat) und Praxiswechsel gleich. Primäres Matching-Kriterium.';

COMMENT ON COLUMN public.aerzte.bsnr IS
  'Betriebsstättennummer, 9-stellig. Ortsgebunden — ändert sich beim Praxiswechsel '
  'des Arztes. NICHT als Identitätsschlüssel verwenden.';

COMMENT ON COLUMN public.aerzte.business_id IS
  'Standort, an dem der Arzt zuerst erfasst wurde. Rein informativ — das Register '
  'ist owner-weit und wird NICHT nach business_id gefiltert.';

COMMENT ON COLUMN public.aerzte.quelle IS
  'Herkunft: ocr (KI-Rezeptscan), rezept (manuelle Rezepterfassung), '
  'verordnung (Podologie), manuell (Ärzte-Verwaltung), import.';

-- ---------------------------------------------------------------------------
-- 4) Identität erzwingen
--    LANR ist der stabile Schlüssel. Ohne LANR fällt das Register auf den
--    normalisierten Namen zurück.
--    Vor dem Index Duplikate zusammenführen, sonst schlägt CREATE UNIQUE fehl.
-- ---------------------------------------------------------------------------

-- a) LANR-Duplikate je Inhaber zusammenführen: ältester Datensatz gewinnt,
--    Referenzen umhängen, Rest löschen.
WITH ranked AS (
  SELECT id, owner_id, lanr,
         first_value(id) OVER (PARTITION BY owner_id, lanr
                               ORDER BY created_at NULLS LAST, id) AS keep_id
    FROM public.aerzte
   WHERE lanr IS NOT NULL
), dupes AS (
  SELECT id AS dup_id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE public.prescriptions p
   SET arzt_id = d.keep_id
  FROM dupes d
 WHERE p.arzt_id = d.dup_id;

WITH ranked AS (
  SELECT id, owner_id, lanr,
         first_value(id) OVER (PARTITION BY owner_id, lanr
                               ORDER BY created_at NULLS LAST, id) AS keep_id
    FROM public.aerzte
   WHERE lanr IS NOT NULL
), dupes AS (
  SELECT id AS dup_id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE public.verordnungen v
   SET arzt_id = d.keep_id
  FROM dupes d
 WHERE v.arzt_id = d.dup_id;

WITH ranked AS (
  SELECT id, owner_id, lanr,
         first_value(id) OVER (PARTITION BY owner_id, lanr
                               ORDER BY created_at NULLS LAST, id) AS keep_id
    FROM public.aerzte
   WHERE lanr IS NOT NULL
), dupes AS (
  SELECT id AS dup_id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE public.leads l
   SET arzt_id = d.keep_id
  FROM dupes d
 WHERE l.arzt_id = d.dup_id;

WITH ranked AS (
  SELECT id, owner_id, lanr,
         first_value(id) OVER (PARTITION BY owner_id, lanr
                               ORDER BY created_at NULLS LAST, id) AS keep_id
    FROM public.aerzte
   WHERE lanr IS NOT NULL
)
DELETE FROM public.aerzte a
 USING ranked r
 WHERE a.id = r.id AND r.id <> r.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_aerzte_owner_lanr
  ON public.aerzte (owner_id, lanr)
  WHERE lanr IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_aerzte_owner_name_no_lanr
  ON public.aerzte (owner_id, lower(btrim(arzt_name)))
  WHERE lanr IS NULL;

-- ---------------------------------------------------------------------------
-- 5) Indizes für die Arzt-Auswertung
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_prescriptions_arzt
  ON public.prescriptions (owner_id, arzt_id) WHERE arzt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verordnungen_arzt
  ON public.verordnungen (owner_id, arzt_id) WHERE arzt_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6) updated_at automatisch pflegen
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aerzte_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aerzte_updated_at ON public.aerzte;
CREATE TRIGGER trg_aerzte_updated_at
  BEFORE UPDATE ON public.aerzte
  FOR EACH ROW EXECUTE FUNCTION public.aerzte_touch_updated_at();

COMMIT;
