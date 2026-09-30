-- O-139 Adim 1 -- Gueltigkeitsfenster fuer Datenannahmestellen und Postanschriften
-- (db-ustasi + onprem + gkv-302, Kemal 30.09.2026; onprem/REGISTER.md O-139).
--
-- WARUM
--   `kostentraeger_annahmestellen` (VKG-Segmente) und `kostentraeger_anschriften`
--   (ANS-Segmente) kannten bisher KEINEN Zeitbezug. Ein Quartalswechsel (Q3 -> Q4,
--   01.10.) liess sich deshalb nur so abbilden: am 01.x das Ladewerkzeug per Hand
--   laufen lassen und die alten Zeilen LOESCHEN. Vorher laden ging nicht (zwei
--   Staende nebeneinander = zwei Empfaenger, der Leser nahm zufaellig einen), und
--   auf der Kundenbox gibt es niemanden, der am 01.x etwas anstossen wuerde (O-46).
--   Mit den Fenstern koennen beide Staende nebeneinander stehen; der STICHTAG des
--   Lesers (Rechnungsdatum = Uebermittlungstag, gkv-302) entscheidet.
--
-- WAS
--   * valid_from date NULL, valid_to date NULL an beiden Tabellen.
--     NULL = offen (Bestandszeilen behalten damit ihre Bedeutung -- KEIN Backfill).
--     Beide Grenzen INKLUSIVE. Namen wie `kostentraeger.valid_from/valid_to`.
--   * UNIQUE-Schluessel bleibt UNVERAENDERT. Eine Zeile wird nie "vor" und "nach"
--     dem Wechsel doppelt gefuehrt: bleibt der Schluessel im neuen Stand, bleibt die
--     Zeile (valid_from wird NICHT angefasst); faellt er weg, bekommt sie valid_to
--     (nichts wird geloescht); kommt er zurueck, wird valid_to wieder NULL. Ein
--     anderer Partner/Code ist ohnehin ein anderer Schluessel. Die Zeile eines
--     Schluessels ist also hoechstens ein zusammenhaengendes Fenster -- Luecken im
--     selben Schluessel (weg und spaeter wieder da) werden vom Ladewerkzeug
--     durch valid_to=NULL geschlossen, nicht als zweite Zeile modelliert.
--     (Ein Expand/Contract des Schluessels waere hier nur noetig, wenn derselbe
--     Schluessel zwei getrennte Fenster braeuchte -- dann Adim 3, eigene Migration.)
--   * View `kostentraeger_auswahl`: CREATE OR REPLACE, Spaltenliste unveraendert.
--     Der EXISTS-Teil zaehlt nur Annahmestellen, die AM BERLINER TAG gelten;
--     `kt.valid_to >= current_date` wird auf denselben Berliner Tag gestellt
--     (current_date folgt der Session-Zeitzone -- UTC auf dem Server -- und waere
--     zwischen 00:00 und 01:00/02:00 Berliner Zeit einen Tag zurueck).
--
-- DEPLOY-REIHENFOLGE (onprem, O-139)
--   Adim 1 = diese Datei + Leser (billing/kostentraeger/annahmestelle.js) im
--   SELBEN Image. Bis dieses Image auf :stable liegt, wird KEINE Zeile mit
--   valid_from in der Zukunft geschrieben (Ladewerkzeug und Seed-Generator lehnen
--   das ab): ein aelterer Leser wuerde beide Staende sehen. Erst danach Adim 3.
--
-- ROLLBACK-SICHTBARKEIT: nullable Spalten ohne DEFAULT -- ein aelteres Image, das sie
--   nicht kennt, liest und schreibt weiter wie bisher (Kural 4 der README).
--
-- SaaS: angewandt 01.10.2026, MCP (nach 0045-Lauf; Kemal-Freigabe 30.09.2026).
--
-- ZAEHLER: counter-neutral, nachgerechnet (schema-zaehler.js): vier nullable
--   Spalten ohne DEFAULT/CHECK/FK/UNIQUE -> weder Index noch Trigger; eine Sicht
--   ersetzt (table_type 'VIEW', kein Index, keine Policy); kein storage.*/auth.*.

ALTER TABLE public.kostentraeger_annahmestellen
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_to   date;

ALTER TABLE public.kostentraeger_anschriften
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_to   date;

COMMENT ON COLUMN public.kostentraeger_annahmestellen.valid_from IS
  'Erster Tag, an dem diese VKG-Zeile gilt (inklusive). NULL = von Anfang an. Wird beim Nachladen NIE ueberschrieben (sonst stuende eine heute gueltige Zeile ohne Empfaenger da).';
COMMENT ON COLUMN public.kostentraeger_annahmestellen.valid_to IS
  'Letzter Tag, an dem diese VKG-Zeile gilt (inklusive). NULL = offen. Faellt der Schluessel im neuen Kostentraegerdatei-Stand weg: gueltigAb der neuen Ausgabe minus 1 Tag. Kehrt er zurueck: wieder NULL.';
COMMENT ON COLUMN public.kostentraeger_anschriften.valid_from IS
  'Erster Tag, an dem diese ANS-Zeile gilt (inklusive). NULL = von Anfang an.';
COMMENT ON COLUMN public.kostentraeger_anschriften.valid_to IS
  'Letzter Tag, an dem diese ANS-Zeile gilt (inklusive). NULL = offen.';

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

-- CREATE OR REPLACE VIEW behaelt Rechte und COMMENT der Sicht (0040); Rechte hier
-- nicht erneut gesetzt, damit die Datei nichts an den Grants aendert.
