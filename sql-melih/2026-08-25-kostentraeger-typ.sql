-- =============================================================================
-- Im Supabase SQL-Editor ausführen
-- Projekt: njvuclullotbksskpwgk (Produkt, NICHT das Ops-Projekt farkaejociddtgqkusvm)
-- Stand: 25.08.2026
-- =============================================================================
--
-- ANLASS: Beta-Rückmeldung — „Klare Trennung nach Abrechnungsart: GKV
-- bundeseinheitlich, Privat, Selbstzahler, BG."
--
-- Bisher wurde nur implizit unterschieden: `gkv_position_nr` gesetzt hieß GKV,
-- leer hieß Privat. **Selbstzahler und BG waren gar nicht abbildbar.**
--
-- DRINGLICHKEIT: gering. Der Code läuft auch ohne dieses Skript.
-- `module/leistungen-liste.js` fällt auf die alte implizite Regel zurück, und
-- das Auswahlfeld „Abrechnungsart" in der Leistungsmaske bleibt so lange
-- ausgeblendet (Erkennung: `spalteKostentraegerDa()` in dashboard.js).
-- Nach diesem Skript erscheint es und die Gruppen stimmen.
--
-- Es ist also KEIN Notfall wie das Skript vom 11.08. — nichts ist kaputt,
-- solange es nicht läuft. Es fehlt nur die Funktion.

-- ── 1. Spalte ────────────────────────────────────────────────────────────────
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS kostentraeger_typ text;

-- ── 2. Erlaubte Werte ────────────────────────────────────────────────────────
-- NULL bleibt zulässig und bedeutet „automatisch bestimmen". Ohne diese
-- Erlaubnis würde jeder gleichzeitig laufende Speichervorgang aus einer
-- offenen Browsersitzung auf den Constraint laufen.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_kostentraeger_typ_check'
  ) THEN
    ALTER TABLE services
      ADD CONSTRAINT services_kostentraeger_typ_check
      CHECK (kostentraeger_typ IS NULL
             OR kostentraeger_typ IN ('gkv', 'privat', 'selbstzahler', 'bg'));
  END IF;
END $$;

-- ── 3. Bestand nachtragen ────────────────────────────────────────────────────
-- Pflicht, nicht Kür: ohne diesen Schritt stünden alle vorhandenen Leistungen
-- auf NULL. Sichtbar wären sie trotzdem (der Rückfall greift), aber die
-- Praxis müsste jede einzeln nachpflegen, um sie umzugruppieren.
--
-- Interne Leistungen (Blocker, Blanko-Zuschläge) bleiben bewusst NULL —
-- sie sind keine abrechenbare Leistung und werden in der Übersicht ohnehin
-- unter „Intern" geführt.
UPDATE services
SET kostentraeger_typ = CASE
      WHEN gkv_position_nr IS NOT NULL AND btrim(gkv_position_nr) <> '' THEN 'gkv'
      ELSE 'privat'
    END
WHERE kostentraeger_typ IS NULL
  AND COALESCE(is_internal, false) = false;

-- ── 4. Kontrolle ─────────────────────────────────────────────────────────────
-- Sollte je Typ eine Zeile liefern. `intern` und ggf. NULL sind in Ordnung.
SELECT COALESCE(kostentraeger_typ, CASE WHEN is_internal THEN 'intern (NULL)' ELSE 'OFFEN — NULL' END) AS typ,
       count(*)
FROM services
GROUP BY 1
ORDER BY 1;

-- =============================================================================
-- DANACH NICHT VERGESSEN
-- =============================================================================
-- Regel aus db/README.md: nach jeder Schemaänderung werden db/SCHEMA.sql und
-- db/SCHEMA-RLS.sql neu aus der Datenbank erzeugt, im selben Commit, samt Datum
-- und letzter Migration im Kopf beider Dateien.
--
-- In der Sitzung vom 25.08.2026 war der Supabase-Zugang (MCP) nicht verfügbar,
-- deshalb konnte das nicht direkt geschehen. Sag „Schema aktualisieren",
-- sobald der Zugang wieder steht — sonst zeigt der Dump eine Tabelle ohne
-- diese Spalte, und wer ihn liest, glaubt es.
