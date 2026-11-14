-- ENTWURF — NICHT aktiv, nicht in api-backend/db/migrations, nicht live angewandt (GO nötig).
-- Maßgabe onprem O-129 / G7 (2026-11-14): gemeinsame Tabelle `public.diagnosegruppen`
-- darf erst NACH Ausführung auf der Live-SaaS-Datenbank in `api-backend/db/migrations/`
-- übernommen werden; bis dahin kein Migrationseintrag und keine `ausstehend`/`box-only`-Deklaration.
--
-- Ziel (HeilM-RL 15.05.2025, iK 05.08.2025 — Abgleich mit api-backend/ai/catalogs/rezept-optionen.js):
--   1. Veraltete Alt-DGs vor 2021 (`AT1..3`, `EX1..4`, `LY1..3`, `SM`, `WS1..2`, `ZN1..2`, 15 Codes)
--      historisch erhalten (`aktiv = false`, KEIN DELETE wegen bestehender Verordnungen).
--   2. Fehlende Regelhöchstmengen der 10 Ergo- und 14 Logo-Diagnosegruppen nachtragen
--      (HeilM-RL Zweiter Teil III/IV; Quelle wissensbank/.../HeilM-RL_2025-05-15_iK-2025-08-05.txt).
--   3. Ernährungstherapie (`SAS`, `CF`, HeilM-RL Zweiter Teil V Z. 5127–5231) ergänzen;
--      `hoechstmenge` bleibt NULL („je nach Bedarf für maximal 12 Wochen“, keine orientierende Menge).
--   4. Selbstprüfung im DO-Block: exakt 44 aktive Diagnosegruppen und >= 59 Zeilen gesamt.
--
-- Manuelle Rollout-Schritte nach Live-SaaS-Ausführung:
--   1. Dieses SQL auf der Live-SaaS-DB ausführen (z. B. via Supabase Dashboard / SQL Editor).
--   2. Danach `node tools/seed-generieren.mjs diagnosegruppen` (falls Box-Seed-Auffrischung gewünscht)
--      bzw. als nächste freie Migration nach `api-backend/db/migrations/0122_diagnosegruppen_heilm_rl_bereinigen.sql`
--      überführen (reine Datenänderung, counter-neutral nach `migrations/README.md` Kural 6).
--   3. `api-backend/db/erwartete-zaehler.json` (`bis_version` + `_hinweis_0122`, Zähler unverändert) aktualisieren.
--   4. `db/REGISTER.md` + `PRUEFSTAND.md` (Entwurf-Verweis entfernen) aktualisieren und `sh tools/check-onprem.sh` prüfen.

BEGIN;

-- 1. Veraltete Physio-Alt-DGs (14 Alt-Codes + 'SM') deaktivieren (kein DELETE)
UPDATE public.diagnosegruppen
   SET aktiv = false
 WHERE code IN (
   'AT1', 'AT2', 'AT3',
   'EX1', 'EX2', 'EX3', 'EX4',
   'LY1', 'LY2', 'LY3',
   'SM',
   'WS1', 'WS2',
   'ZN1', 'ZN2'
 );

-- 2. Regelhöchstmengen je VO für Ergotherapie (Teil IV, 10 Diagnosegruppen)
UPDATE public.diagnosegruppen AS d
   SET hoechstmenge = v.hoechstmenge,
       aktiv = true
  FROM (VALUES
    ('SB1', 10),
    ('SB2', 10),
    ('SB3', 10),
    ('EN1', 10),
    ('EN2', 10),
    ('EN3', 10),
    ('PS1', 10),
    ('PS2', 20),
    ('PS3', 20),
    ('PS4', 10)
  ) AS v(code, hoechstmenge)
 WHERE d.code = v.code;

-- 3. Regelhöchstmengen je VO für Logopädie (Teil III, 14 Diagnosegruppen)
UPDATE public.diagnosegruppen AS d
   SET hoechstmenge = v.hoechstmenge,
       aktiv = true
  FROM (VALUES
    ('ST1', 10),
    ('ST2', 10),
    ('ST3', 10),
    ('ST4', 10),
    ('SP1', 10),
    ('SP2', 10),
    ('SP3', 10),
    ('SP4', 20),
    ('SP5', 20),
    ('SP6', 20),
    ('RE1', 10),
    ('RE2', 10),
    ('SF',  10),
    ('SC',  10)
  ) AS v(code, hoechstmenge)
 WHERE d.code = v.code;

-- 4. Ernährungstherapie (Teil V, 2 Diagnosegruppen) ergänzen / aktivieren
INSERT INTO public.diagnosegruppen (
  code, label, untergruppen, icd10_codes, icd10_pflicht,
  befundung_erlaubt, nagelspange_erlaubt, lokalisation_pflicht,
  bereich, indikation, leitsymptomatik, hoechstmenge,
  icd_ranges, sort, aktiv,
  icd_accept, icd_exclude, icd_auto_select, icd_accept_unsicher
) VALUES
  (
    'SAS',
    'Seltene angeborene Stoffwechselerkrankungen',
    ARRAY['a', 'b', 'c'],
    NULL, NULL,
    true, false, false,
    'ernaehrung', NULL, NULL, NULL,
    ARRAY[]::text[], 10, true,
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
  ),
  (
    'CF',
    'Mukoviszidose (Cystische Fibrose)',
    ARRAY['a', 'b', 'c'],
    NULL, NULL,
    true, false, false,
    'ernaehrung', NULL, NULL, NULL,
    ARRAY[]::text[], 20, true,
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  label        = EXCLUDED.label,
  untergruppen = EXCLUDED.untergruppen,
  bereich      = EXCLUDED.bereich,
  hoechstmenge = EXCLUDED.hoechstmenge,
  sort         = EXCLUDED.sort,
  aktiv        = true;

-- 5. Konsistenzprüfung: exakt 44 aktive HeilM-RL-DGs, >= 59 Zeilen gesamt
DO $$
DECLARE
  aktiv_n  integer;
  gesamt_n integer;
  alt_aktiv integer;
BEGIN
  SELECT count(*) FILTER (WHERE aktiv IS TRUE),
         count(*),
         count(*) FILTER (WHERE aktiv IS TRUE AND code IN (
           'AT1','AT2','AT3','EX1','EX2','EX3','EX4','LY1','LY2','LY3','SM','WS1','WS2','ZN1','ZN2'
         ))
    INTO aktiv_n, gesamt_n, alt_aktiv
    FROM public.diagnosegruppen;

  IF alt_aktiv <> 0 THEN
    RAISE EXCEPTION '0122_diagnosegruppen_heilm_rl_bereinigen: noch % aktive Alt-DGs', alt_aktiv;
  END IF;
  IF aktiv_n <> 44 THEN
    RAISE EXCEPTION '0122_diagnosegruppen_heilm_rl_bereinigen: % aktive DGs, erwartet 44', aktiv_n;
  END IF;
  IF gesamt_n < 59 THEN
    RAISE EXCEPTION '0122_diagnosegruppen_heilm_rl_bereinigen: % Zeilen gesamt, erwartet >= 59', gesamt_n;
  END IF;
END $$;

COMMIT;
