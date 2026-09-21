-- Ops #300 -- Auswahlsicht fuer die IK-Suche im Kassenfeld
-- (Konsey 21.09.2026, konsey/tutanak/2026-09-21-ik-suche-kassenfeld.md).
--
-- WARUM
--   Der Podologe tippt die IK von Muster 13 -- das ist die KARTEN-IK. Sie steht nur in
--   `kostentraeger` (eigene Zeile; `abrechnender_kt_ik` verweist auf die IK, bei der
--   abgerechnet wird. DAK: Karte 100167999 -> abgerechnet bei 105830016), nicht in
--   `krankenkassen.ik_number` (dort steht die abrechnende IK).
--   `kostentraeger` ist aber keine reine Kassenliste: sie enthaelt auch Rechenzentren
--   und Abrechnungsstellen (gkv informatik, BITMARCK, Rezeptpruefstelle Duderstadt ...).
--   Ohne Filter bekaeme der Anwender "gkv informatik" als Krankenkasse angeboten; waehlt
--   er es, geht die Abrechnung still an die falsche Stelle (podoloji, gkv-302).
--
-- FILTER (gkv-302, Konsey 21.09.2026)
--   * datensatz_status = 'echt'   -- die 9 Mock-Zeilen fallen weg
--   * active
--   * payer_type = 'gkv'          -- TRAEGT NICHTS: im Seed sind alle 1043 Zeilen 'gkv',
--                                    auch die Rechenzentren. Bleibt als Absicherung, falls
--                                    spaeter andere Zahlerarten dazukommen.
--   * heute gueltig (valid_to)    -- nur fuer die NEUE Auswahl. Eine bereits gespeicherte
--                                    IK wird davon nicht beruehrt.
--   * "hat mindestens ein VKG":   abrechnender_kt_ik IS NOT NULL (Verweis, VKG 01) ODER
--                                    mindestens eine Zeile in kostentraeger_annahmestellen
--                                    (Selbstverweis / Datenannahmestelle). Das ist das
--                                    einzige gespeicherte Merkmal, das Rechenzentren trennt;
--                                    `ist_abrechnender_kt` taugt dafuer nicht (steht bei
--                                    gkv informatik auf 't').
--
-- NACHGERECHNET (offline, am Box-Seed 0006 + 0037; NICHT gegen die Live-DB)
--   1043 Zeilen -> 893 in der Sicht: 82 ohne VKG-Segment ausgeschlossen, 68 abgelaufen
--   (valid_to). Bekannte Rechenzentren (gkv informatik, IQVIA, Medent, Rezeptpruefstelle,
--   AZE Emmendingen) in der Sicht: 0. Groesster Dreier-Praefix "108": 155 Zeilen.
--   ⚠️ Von den 82 tragen rund ein Dutzend einen schlichten Kassennamen ohne Zusatz
--      (AOK NORDWEST, DAK-Gesundheit x2, Techniker Krankenkasse, IKK Thueringen x2,
--      KNAPPSCHAFT Kranken- und Pflegeversicherung ...). Wer eine solche IK abtippt,
--      findet nichts; Freitext bleibt moeglich, falsche Daten entstehen dadurch nicht.
--      Ob das Karten-IKs sein koennen, ist eine offene Frage an gkv-302.
--   ⚠️ Der Seed fuehrt fuer die Ersatzkassen noch EK05Q426 (Q4); live ist die heute
--      gueltige Q2 geladen (db/REGISTER.md, ZEITFEHLER). Die Live-Zahlen weichen daher ab.
--
-- RECHTE
--   `security_invoker = true` wie bei den beiden bestehenden Sichten (0000_baseline):
--   die Sicht liest mit den Rechten des Aufrufers, erbt also die RLS von `kostentraeger`
--   (kostentraeger_read_all, nur authenticated) und `kostentraeger_annahmestellen`
--   (kostentraeger_annahmestellen_read_all). Ausdrueckliches REVOKE/GRANT statt sich auf die Supabase-Standardrechte
--   zu verlassen (Lehre aus 0035): nur SELECT, nur fuer authenticated.
--   KEIN anon-Zugriff -- die Sicht darf nicht in der oeffentlichen Buchungsanfrage landen.
--   Auch service_role wird ausdruecklich entzogen (db-ustasi, 21.09.2026): Supabase vergibt
--   per ALTER DEFAULT PRIVILEGES ALL an anon, authenticated UND service_role -- so stehen
--   die beiden Baseline-Sichten (GRANT ALL ... TO service_role, fahrten_monthly_summary
--   sogar Schreibrechte fuer anon). Diese Sicht ist einfach genug, um aktualisierbar zu
--   sein (ein FROM, kein Aggregat), und service_role umgeht die RLS: sie koennte durch
--   die Sicht in `kostentraeger` schreiben. Liest das Backend die Sicht spaeter selbst,
--   dann ausdruecklich `GRANT SELECT ... TO service_role` in einer neuen Datei.
--   Der EXISTS-Teil wird ebenfalls durch RLS geprueft: wuerde
--   kostentraeger_annahmestellen_read_all je verschaerft, verlaere die Sicht STILL Zeilen.
--
-- KEIN INDEX: ~900 Zeilen, ein Seq Scan liegt im Mikrosekundenbereich; ein Index auf ik
--   braeuchte fuer LIKE 'praefix%' zudem text_pattern_ops und hebt den `index`-Zaehler.
--
-- KEIN STAND HARTKODIERT: die Sicht folgt active/valid_to/datensatz_status. Ein
--   Quartalsseed (neue Migration, angewandte Dateien sind unveraenderlich) aendert die
--   Daten, nicht diese Sicht.
--
-- VORAB (nur lesen, vor dem Anwenden; Erwartung am Seed-Stand ~893, live kann abweichen):
--   SELECT count(*) FROM kostentraeger WHERE active IS NOT TRUE;   -- 0 erwartet (NULL zaehlt
--     wie FALSE und fiele still heraus; im Seed 0006 sind alle 1043 Zeilen active = 't')
--   SELECT count(*) FROM kostentraeger kt
--    WHERE kt.datensatz_status = 'echt' AND kt.active IS TRUE AND kt.payer_type = 'gkv'
--      AND (kt.valid_to IS NULL OR kt.valid_to >= current_date)
--      AND (kt.abrechnender_kt_ik IS NOT NULL
--           OR EXISTS (SELECT 1 FROM kostentraeger_annahmestellen ka
--                       WHERE ka.kostentraeger_ik = kt.ik));
-- NACHHER (0 Zeilen erwartet):
--   SELECT ik, name FROM kostentraeger_auswahl
--    WHERE name ~* 'gkv informatik|IQVIA|Medent|Rezeptpr|AZE Emmendingen|BITMARCK';
--   Stichprobe (1 Zeile, abrechnender_kt_ik = 105830016):
--   SELECT * FROM kostentraeger_auswahl WHERE ik = '100167999';
--
-- SaaS: NICHT angewandt (Stand beim Schreiben, 21.09.2026). Bei Anwendung hier mit Datum
--   vermerken (Kural aus migrations/README.md, "SaaS'a hangi migration'lar uygulandi"),
--   solange noch keine Box diese Datei ausgefuehrt hat.
--   REIHENFOLGE: View live, DANN das Frontend deployen (das Frontend faengt eine
--   fehlende Sicht ab, ist aber ohne sie ohne IK-Suche).
--
-- ZAEHLER: counter-neutral. Keiner der zehn Zaehler (schema-zaehler.js) zaehlt Sichten:
--   public_tablo zaehlt nur table_type = 'BASE TABLE'; Policy/Funktion/Trigger/Index
--   unveraendert (die Sicht bringt keinen eigenen Index mit).

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
  AND (kt.valid_to IS NULL OR kt.valid_to >= current_date)
  AND (
    kt.abrechnender_kt_ik IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.kostentraeger_annahmestellen ka
      WHERE ka.kostentraeger_ik = kt.ik
    )
  );

COMMENT ON VIEW public.kostentraeger_auswahl IS
  'Auswahlsicht fuer die IK-Suche im Kassenfeld (Ops #300): nur echte, aktive, heute gueltige GKV-Kostentraeger mit mindestens einem VKG -- ohne Rechenzentren und Abrechnungsstellen. ik = Karten-IK (was auf Muster 13 steht), abrechnender_kt_ik = IK, bei der abgerechnet wird (NULL = die Zeile rechnet selbst ab). security_invoker: erbt die RLS von kostentraeger, nur authenticated.';

REVOKE ALL ON public.kostentraeger_auswahl FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.kostentraeger_auswahl TO authenticated;
