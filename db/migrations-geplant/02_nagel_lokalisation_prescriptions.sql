-- ===========================================================================
-- VORBEREITET, NICHT ANGEWENDET.  Ops-Aufgabe 245.
-- Erzeugt: 04.09.2026 · db-ustasi · Anwendung erst nach Freigabe.
-- ===========================================================================
--
-- Zweck: die Nagel-Lokalisation einer Nagelspangen-Verordnung maschinenlesbar
-- machen, damit die Sperre aus § 3b lit. a (Änderungsvereinbarung 16.06.2025)
-- ueberhaupt formulierbar wird:
--
--   „Die Leistung nach Anlage 1c Teil 2 Ziffer I.1 (Erstbefundung) kann
--    einmalig zu Beginn einer Nagelspangenbehandlungsserie erfolgen. Eine
--    Behandlungsserie bezieht sich stets auf einen zu behandelnden Nagel und
--    kann mehrere Verordnungen umfassen."
--
-- Die Serie laeuft also ueber Verordnungsgrenzen hinweg und wird allein durch
-- den NAGEL zusammengehalten. Ohne einen vergleichbaren Nagelwert ist die
-- Regel nicht pruefbar — genau deshalb steht sie in
-- module/eingangsbefundung-regel.js:298-304 bis heute als bewusste Luecke.
--
-- ── Warum an `prescriptions` und nicht an `podologie_behandlungen` ─────────
--
-- Derselbe Vertrag, § 3b Satz 3-4:
--   „Die Nagelspangenbehandlung eines Zehennagels (Lokalisation) stellt einen
--    eigenen Verordnungsfall dar. Eine Verordnung bezieht sich jeweils auf die
--    Behandlung eines Zehennagels."
-- und Satz 5: die Lokalisation ist „auf der Rueckseite jeder Verordnung
-- EINMALIG" zu dokumentieren.
--
-- Der Nagel ist damit eine Eigenschaft der VERORDNUNG, nicht der einzelnen
-- Behandlung. An `podologie_behandlungen` waere derselbe Wert auf jeder Zeile
-- derselben VO wiederholt — und koennte auseinanderlaufen (Zeile 1 „U1 links",
-- Zeile 2 „U2 rechts"). Ein Zustand, den der Vertrag ausschliesst, den das
-- Schema aber erlauben wuerde. Wo eine Regel „einmalig je VO" sagt, gehoert
-- der Wert an die VO.
--
-- ── Warum die Werte nicht erfunden sind ────────────────────────────────────
--
-- Die Schreibweise steht im Vertrag selbst, § 3b Satz 5: „unter Verwendung des
-- Kuerzels ‚U' fuer Unguis, der Ziffern 1 bis 5 und der Seite ... (z. B. U1
-- links, U2 rechts)". Anlage 3 o2 zeigt dieselben zehn Werte mit Leerzeichen
-- („U 1 links"). Gespeichert wird die Form aus § 3b (ohne Leerzeichen); die
-- Darstellung ist Sache der Oberflaeche, nicht der Spalte.
-- Es gibt exakt zehn moegliche Werte — deshalb CHECK und nicht Freitext.
--
-- ── Rueckwaerts-Risiko: keines ─────────────────────────────────────────────
--
-- Gemessen am 04.09.2026 gegen die Live-DB:
--   podologie_behandlungen : 3 Zeilen, `lokalisation` in 3 von 3 LEER,
--                            0 Zeilen mit 78610/78620, 0 mit 78110/78100
--   prescriptions          : 55 Zeilen, davon 0 mit diagnosegruppe UI1/UI2
-- Es existiert kein Altbestand, der geparst oder migriert werden muesste.
-- Die Spalte startet leer und bleibt fuer alle Nicht-Nagel-Verordnungen leer.
--
-- Ruecknahme: ALTER TABLE prescriptions DROP COLUMN nagel;
-- ===========================================================================

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS nagel text;

COMMENT ON COLUMN public.prescriptions.nagel IS
  'Nagelspange: behandelter Zehennagel dieser Verordnung, Schreibweise nach '
  '§ 3b Satz 5 Aenderungsvereinbarung 16.06.2025 ("U1 links" .. "U5 rechts"). '
  'Nur bei diagnosegruppe UI1/UI2 gefuellt. Haelt die Behandlungsserie ueber '
  'mehrere Verordnungen zusammen (§ 3b lit. a).';

-- Zehn zulaessige Werte, sonst NULL. NOT VALID ist hier nicht noetig:
-- die Spalte ist neu und ueberall NULL.
ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_nagel_check
  CHECK (
    nagel IS NULL OR nagel IN (
      'U1 links', 'U2 links', 'U3 links', 'U4 links', 'U5 links',
      'U1 rechts','U2 rechts','U3 rechts','U4 rechts','U5 rechts'
    )
  );

-- Der Nagel ist bei UI1/UI2 Pflichtangabe (Anlage 3 o2: „Pflichtangabe").
-- BEWUSST NICHT als CHECK erzwungen: eine Verordnung entsteht in Praxura
-- zuerst aus dem OCR-Lauf und wird danach ergaenzt — ein harter CHECK wuerde
-- den Scan-Weg (api-backend, /rezept/save) beim INSERT abweisen, bevor
-- irgendjemand den Nagel eintragen konnte. Die Pflicht gehoert deshalb an die
-- Freigabe zur Abrechnung, nicht an den INSERT. Sperre dort:
--   api-backend/billing/api/verordnung-status.routes.js  (einreichbar-Pruefung)
-- Ein CHECK hier waere die dritte Stelle, an der eine halbfertige Verordnung
-- nicht mehr gespeichert werden kann — dieselbe Falle wie beim
-- Unterschriftsfeld.

-- KEIN Index. 55 Zeilen; die Serienabfrage laeuft ueber patient_id und liest
-- pro Patient eine Handvoll Zeilen. Wieder anschauen, wenn die Tabelle
-- fuenfstellig wird.
