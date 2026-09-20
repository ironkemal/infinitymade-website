-- §302-Echtbetrieb, Schritt 1.4 (ABRECHNUNG_ECHTBETRIEB_PLAN.md) —
-- Postanschriften der Papierannahmestellen (und Kostentraeger) in eigener Kindtabelle.
--
-- FACHLICHER GRUND (Richtlinien-Text § 2(1)/§ 4, db-ustasi 20.09.2026):
--   Eine §302-Abrechnung besteht aus sechs Teilen, darunter die Urbelege im
--   Original — und die gehen per Post an die Papierannahmestelle
--   (Verknuepfungsart 09), nicht an die Datenannahmestelle (02/03).
--   Der Begleitzettel trug bisher keine Empfaengeradresse, weil sie nirgends
--   in der Datenbank gespeichert war. Im Echtbetrieb muss der Heilmittelerbringer
--   wissen, wohin der Briefumschlag mit den Verordnungen geht.
--
-- FUNDSTELLEN:
--   • Richtlinien der Spitzenverbaende der Krankenkassen nach § 302 Abs. 2 SGB V:
--     § 2 Abs. 1 und § 4 (Begleitzettel und urkundliche Belege im Original).
--   • Anhang 03 zu Anlage 1 TP5 V10 § 7 (ANS-Segment: Art-Schluessel '1' = Haus,
--     '2' = Postfach, '3' = Grosskunde).
--   • Anhang 03 Abschnitt 5: Verknuepfungsart 09 = Papierannahmestelle.
--
-- ENTSCHEIDUNG db-ustasi (20.09.2026): EIGENE KINDTABELLE.
--   Keine flachen Spalten an `kostentraeger`, keine statische Codedatei.
--   Begruendung: Das ANS-Segment ist wie VKG wiederholbar (Hausanschrift,
--   Postfach und Grosskunde koennen nebeneinander existieren). Eine flache Spalte
--   an `kostentraeger` wuerde exakt den Fehler von `kostentraeger.das_ik`
--   wiederholen — eine Einzelspalte fuer eine 1:n-Beziehung (diese Spalte gilt
--   heute als veraltet, siehe db/SCHEMA.sql bei `kostentraeger`).
--
-- AUSWAHL BEIM LESEN:
--   Alle ANS-Zeilen werden unveraendert gespeichert. Die Auswahl der besten
--   Postanschrift nach der Vorzugsreihenfolge 1 (Haus) > 2 (Postfach) > 3 (Grosskunde)
--   erfolgt beim Lesen ueber `waehlePostanschrift()` (billing/kostentraeger/parser.js).
--   Die Priorisierung wird bewusst nicht in die Daten eingebrannt, um Informationsverlust
--   zu vermeiden.
--
-- ZAEHLER: +1 Tabelle, +1 Policy, +2 Index (Primaerschluessel + UNIQUE-Constraint), +0 Funktion, +0 Trigger.

CREATE TABLE public.kostentraeger_anschriften (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kostentraeger_ik text NOT NULL REFERENCES public.kostentraeger(ik) ON DELETE CASCADE,
  art             text NOT NULL,          -- '1' Haus · '2' Postfach · '3' Grosskunde
  plz             text NOT NULL DEFAULT '',
  ort             text NOT NULL DEFAULT '',
  strasse         text NOT NULL DEFAULT '',
  quelle          text,
  quelle_stand    date,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kostentraeger_anschriften_art_chk CHECK (art IN ('1','2','3')),
  CONSTRAINT kostentraeger_anschriften_uniq
    UNIQUE (kostentraeger_ik, art, plz, ort, strasse)
);

COMMENT ON TABLE public.kostentraeger_anschriften IS
  'Postanschriften der Kostentraeger und Papierannahmestellen aus dem ANS-Segment der Kostentraegerdatei (Anhang 03 V10 § 7, Richtlinien § 2(1)/§ 4). Kindtabelle, da wie VKG wiederholbar (Haus, Postfach, Grosskunde). Auswahl erfolgt leseseitig via waehlePostanschrift().';
COMMENT ON COLUMN public.kostentraeger_anschriften.kostentraeger_ik IS
  'Institutionskennzeichen des Kostentraegers bzw. der Papierannahmestelle (Fremdschluessel auf kostentraeger.ik).';
COMMENT ON COLUMN public.kostentraeger_anschriften.art IS
  'Art der Anschrift gemaess Anhang 03 V10 § 7: ''1'' = Hausanschrift, ''2'' = Postfach, ''3'' = Grosskunde.';
COMMENT ON COLUMN public.kostentraeger_anschriften.quelle IS
  'Dateiname der Kostentraegerdatei, aus der dieser Datensatz stammt (z. B. AO05Q326_KE3.txt).';
COMMENT ON COLUMN public.kostentraeger_anschriften.quelle_stand IS
  'Gueltigkeitsstichtag der Quelldatei gemaess Herausgeber / VDT-Segment.';

ALTER TABLE public.kostentraeger_anschriften ENABLE ROW LEVEL SECURITY;

CREATE POLICY kostentraeger_anschriften_read_all ON public.kostentraeger_anschriften
  FOR SELECT USING (auth.role() = 'authenticated');
