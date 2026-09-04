-- Faz 1 der Zusammenlegung der beiden Verordnungstöpfe.
--
-- Entscheidung Kemal, 03.09.2026: es gibt künftig EINEN Topf. Zieltabelle ist
-- `prescriptions` (Struktur und Name), weil der Weg dorthin 9 statt 47 Spalten,
-- 7 statt 242 Zeilen und 72 statt 168 Codestellen kostet. Die Umbenennung nach
-- `verordnungen` ist bewusst VERTAGT — sie ist rein kosmetisch und wird später
-- als eigene Migration gemacht, wenn sonst nichts in Bewegung ist.
--
-- Diese Datei ist REIN ADDITIV: sie legt nur die Spalten an, in die Faz 2 die
-- vier Zeilen aus `verordnungen` kopiert. Kein Datensatz wird angefasst, keine
-- bestehende Regel verschärft. Rücknahme = DROP COLUMN.
--
-- ── Warum manche Paare NICHT gefaltet werden ────────────────────────────────
--
--   rezeptart  ≠ rezept_typ    `rezept_typ` mischt zwei Achsen: Formtyp
--                              (standard|blanko|lhb_bvb) UND Zahlerart
--                              (kassen|privat). Live sind nur die drei
--                              Formtyp-Werte belegt (27 blanko, 24 standard,
--                              0 kassen/privat) — die Zahlerart-Werte sind tote
--                              Buchstaben. `rezeptart` ist die saubere
--                              Zahlerachse; `rezeptinfo-geld.js` liest daraus
--                              „privat/selbstzahler". Zusammenlegen hiesse, die
--                              Unterscheidung zu verlieren, die das Geld regelt.
--
--   notizen    ≠ hinweise      `hinweise` kommt vom ARZT (server.js: aus
--                              `rezept.therapieziele` des gescannten Musters 13).
--                              `notizen` ist die interne Notiz der Praxis.
--                              Dieselbe Spalte hiesse: die Quelle vergessen.
--
--   abrechnung_status ≡ verordnungen.status   Das ist das eigentliche Paar.
--                              `prescriptions.status` ist die BEARBEITUNGS-
--                              achse (parsed→confirmed→…), `verordnungen.status`
--                              war die ABRECHNUNGS-achse. Deshalb wird hier
--                              `abrechnung_status` erweitert und `status`
--                              unangetastet gelassen. Werteschlüssel:
--                                  aktiv        → NULL
--                                  abrechenbar  → bereit
--                                  abgerechnet  → gesendet
--                                  abgesetzt    → rejected
--                                  teilabsetzung → teilabsetzung  (neu)
--                                  storniert    → storniert       (neu)
--                                  archiviert   → archiviert      (neu)
--
-- ── Was hier bewusst NICHT mitkommt ─────────────────────────────────────────
--   `verordnungen_kassen_braucht_diagnosegruppe` (CHECK: rezeptart='kassen'
--   verlangt eine Diagnosegruppe) wird NICHT übernommen. Live verletzen ihn
--   5 Zeilen in `prescriptions` (Diagnosegruppe nicht im Katalog: 4× "WS3a",
--   1× "MT" — alle aus dem Demo-Mandanten) plus eine Zeile ohne
--   Ausstellungsdatum (OCR-Fehllesung einer Medikamentenpackung, 03.06.2026).
--   Diese Zeilen sind echte Datenfehler und gehören aufgeräumt — aber in einem
--   eigenen Schritt, nicht als Nebenwirkung dieser Migration.
--
--   Der Fremdschlüssel `diagnosegruppe -> diagnosegruppen(code)` kommt aus
--   demselben Grund nicht mit.

BEGIN;

-- ── 1. Die neun Spalten aus `verordnungen` ohne Gegenstück ─────────────────

ALTER TABLE prescriptions
  -- Freitextname vom Anlagezeitpunkt. Zwei der vier zu kopierenden Zeilen
  -- haben KEIN lead_id — dort existiert der Name nur hier. Für die Abrechnung
  -- bleibt er unbenutzt: mapVerordnungToDtaShape() nimmt den Namen immer aus
  -- `leads` und bricht lieber ab, als einen veralteten Namen an die Kasse zu
  -- schicken (abrechnung.routes.js:1994).
  ADD COLUMN IF NOT EXISTS patient_name        text,

  -- Wagner-Armstrong-Grad des diabetischen Fusses. Podologie-Pflichtfeld.
  ADD COLUMN IF NOT EXISTS wagner_grad         smallint,

  -- Versichertennummer wie auf DIESEM Rezept gedruckt. `leads` führt die
  -- aktuelle; für § 302 zählt die des Belegs.
  ADD COLUMN IF NOT EXISTS versichertennummer  text,

  -- Nur ausserhalb der GKV gefüllt: warum behandelt wird, wenn keine
  -- Verordnung dahintersteht (podologie-abrechnung.js, POD_ANLASS_DEFAULT).
  ADD COLUMN IF NOT EXISTS behandlungsanlass   text,

  -- Absetzung durch die Kasse (ZAA-Rückmeldung).
  ADD COLUMN IF NOT EXISTS absetzung_betrag    numeric(10,2),
  ADD COLUMN IF NOT EXISTS absetzung_grund     text,
  ADD COLUMN IF NOT EXISTS absetzung_am        date,

  -- Storno durch die Praxis.
  ADD COLUMN IF NOT EXISTS storno_grund        text,
  ADD COLUMN IF NOT EXISTS storno_am           date,

  -- ── 2. Die zwei Spalten, die NICHT gefaltet werden (Begründung oben) ──
  ADD COLUMN IF NOT EXISTS rezeptart           text,
  ADD COLUMN IF NOT EXISTS notizen             text;

-- ── 3. Die Regeln, die an diesen Spalten hingen ───────────────────────────

ALTER TABLE prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_wagner_grad_check;
ALTER TABLE prescriptions
  ADD CONSTRAINT prescriptions_wagner_grad_check
  CHECK (wagner_grad IS NULL OR (wagner_grad >= 0 AND wagner_grad <= 5));

ALTER TABLE prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_rezeptart_check;
ALTER TABLE prescriptions
  ADD CONSTRAINT prescriptions_rezeptart_check
  CHECK (rezeptart IS NULL OR rezeptart = ANY (ARRAY['kassen','privat','selbstzahler']));

-- ── 4. Die Abrechnungsachse um die drei podologischen Werte erweitern ─────
--
-- Nur ERWEITERN, nie einschränken: jeder bisher erlaubte Wert bleibt erlaubt,
-- deshalb kann keine bestehende Zeile durchfallen.

ALTER TABLE prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_abrechnung_status_check;
ALTER TABLE prescriptions
  ADD CONSTRAINT prescriptions_abrechnung_status_check
  CHECK (abrechnung_status IS NULL OR abrechnung_status = ANY (ARRAY[
    'bereit','in_abrechnung','gesendet','accepted','rejected','paid',
    'teilabsetzung','storniert','archiviert'
  ]));

-- ── 5. Absetzungsregeln — Spiegel von verordnungen, auf die neue Achse ────

ALTER TABLE prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_absetzung_betrag_check;
ALTER TABLE prescriptions
  ADD CONSTRAINT prescriptions_absetzung_betrag_check
  CHECK (absetzung_betrag IS NULL
         OR (absetzung_betrag > 0
             AND abrechnung_status = ANY (ARRAY['teilabsetzung','rejected'])));

ALTER TABLE prescriptions
  DROP CONSTRAINT IF EXISTS prescriptions_teilabsetzung_braucht_betrag;
ALTER TABLE prescriptions
  ADD CONSTRAINT prescriptions_teilabsetzung_braucht_betrag
  CHECK (abrechnung_status IS DISTINCT FROM 'teilabsetzung'
         OR absetzung_betrag IS NOT NULL);

-- ── 6. Spaltenkommentare — der nächste Leser soll nicht raten müssen ──────

COMMENT ON COLUMN prescriptions.patient_name IS
  'Freitextname vom Anlagezeitpunkt (aus verordnungen uebernommen 09.2026). NICHT fuer die Abrechnung verwenden — der Name kommt immer aus leads.';
COMMENT ON COLUMN prescriptions.rezeptart IS
  'Zahlerachse: kassen|privat|selbstzahler. NICHT mit rezept_typ verwechseln — das ist die Formachse (standard|blanko|lhb_bvb).';
COMMENT ON COLUMN prescriptions.notizen IS
  'Interne Notiz der Praxis. Gegenstueck: hinweise = Therapieziel vom Arzt (aus dem gescannten Muster 13).';
COMMENT ON COLUMN prescriptions.abrechnung_status IS
  'Abrechnungsachse. Schluessel zur alten verordnungen.status: aktiv=NULL, abrechenbar=bereit, abgerechnet=gesendet, abgesetzt=rejected; teilabsetzung/storniert/archiviert unveraendert.';

COMMIT;
