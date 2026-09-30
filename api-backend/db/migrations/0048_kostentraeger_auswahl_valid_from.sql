-- O-139 Nachtrag -- Sicht kostentraeger_auswahl beachtet auch kt.valid_from.
--
-- WARUM
--   0046 hat die Sicht auf den Berliner Tag gestellt, prueft am Kostentraeger
--   aber nur das ENDE (valid_to). Ein Kostentraeger, dessen Gueltigkeit erst in
--   der Zukunft beginnt, stuende damit schon heute in der IK-Suche des
--   Kassenfelds. Das Backend (`kostentraegerAbfrage`, api-backend/lib/rezept-
--   felder.js) prueft beide Grenzen; die Sicht zog nicht mit. Heute ohne
--   Wirkung (kein echter Kostentraeger mit valid_from in der Zukunft), aber
--   genau das aendert sich, sobald Adim 3 (Vorausladen) kommt.
--
-- WAS
--   CREATE OR REPLACE VIEW, Spaltenliste unveraendert, einzige Aenderung:
--   `AND (kt.valid_from IS NULL OR kt.valid_from <= <Berliner Tag>)`.
--   Grants und COMMENT bleiben bei CREATE OR REPLACE erhalten (0040/0046).
--
-- SaaS: angewandt 01.10.2026, MCP (Freigabe Kemal). Live danach 876 Zeilen (unveraendert,
--   0 Kostentraeger mit valid_from in der Zukunft); Grants/COMMENT geprueft erhalten.
--
-- ZAEHLER: counter-neutral (Sicht ersetzt; kein Index/Policy/Funktion/Trigger),
--   gleiche Herleitung wie _hinweis_0040/_hinweis_0046.

CREATE OR REPLACE VIEW public.kostentraeger_auswahl
  WITH (security_invoker = true) AS
SELECT
  kt.ik,
  kt.name,
  kt.kurzname,
  kt.abrechnender_kt_ik
FROM public.kostentraeger kt
WHERE kt.datensatz_status = 'echt'
  AND kt.active IS TRUE
  AND kt.payer_type = 'gkv'
  AND (kt.valid_from IS NULL
       OR kt.valid_from <= (now() AT TIME ZONE 'Europe/Berlin')::date)
  AND (kt.valid_to IS NULL
       OR kt.valid_to >= (now() AT TIME ZONE 'Europe/Berlin')::date)
  AND (
    kt.abrechnender_kt_ik IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.kostentraeger_annahmestellen ka
      WHERE ka.kostentraeger_ik = kt.ik
        AND (ka.valid_from IS NULL OR ka.valid_from <= (now() AT TIME ZONE 'Europe/Berlin')::date)
        AND (ka.valid_to   IS NULL OR ka.valid_to   >= (now() AT TIME ZONE 'Europe/Berlin')::date)
    )
  );
