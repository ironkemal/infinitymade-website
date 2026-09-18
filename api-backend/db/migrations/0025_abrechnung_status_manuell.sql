-- Ops #310 — Beta-1: "soll nur als Info sein — man entscheidet ja am Ende
-- selber". Die automatische "bereit zur Abrechnung"-Markierung darf eine
-- Handentscheidung nicht mehr stillschweigend ueberschreiben.
--
-- Zwei Spalten, gleiches Muster wie prescriptions.zuzahlung_kassiert_am /
-- zuzahlung_kassiert_von (db/SCHEMA.sql) — wer hat wann von Hand eingegriffen.
-- FK auf auth.users (nicht profiles), wie booking_status_korrekturen.geaendert_von:
-- ON DELETE SET NULL, damit ein geloeschter Mitarbeiter-Account keine
-- Verordnung sperrt.
--
-- Bewusst NICHT in prescriptions_festschreibung() aufgenommen (0020): der
-- Abrechnungsstatus bleibt nach der Belegnummer aenderbar (Absetzung,
-- Teilabsetzung, Storno), also muss auch der Handstempel es bleiben.
--
-- ZAEHLER: unveraendert (nur zwei Spalten + FK — kein Tabelle/Policy/Funktion/
--          Trigger/Index; der RI-Trigger des FK ist tgisinternal und wird von
--          schema-zaehler.js nicht gezaehlt, auch nicht in auth.*).

ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS abrechnung_status_manuell_am timestamptz,
  ADD COLUMN IF NOT EXISTS abrechnung_status_manuell_von uuid REFERENCES auth.users(id) ON DELETE SET NULL;
