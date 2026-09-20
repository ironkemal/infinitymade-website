-- §302-Abrechnung — Festhalten verworfener Abrechnungsversuche (GoBD-Erklärbarkeit).
--
-- VORHERIGER ZUSTAND:
--   In allen drei Erzeugungswegen (abrechnung.routes.js: /abrechnung/create,
--   /abrechnung/create-podologie, /abrechnung/korrektur) zieht vergebeNummern()
--   zuerst die naechste Datenaustauschreferenz und Transfernummer atomar aus
--   der Datenbank (datenaustausch_zaehler, Migration 0029). Schlaegt danach
--   buildDtaFile() fehl — z. B. weil der Preflight anschlaegt —, sind die
--   Nummern verbraucht und es entsteht eine Luecke in der Nummernfolge. Dieser
--   Zustand wurde bisher nirgends in der Datenbank festgehalten.
--
-- FACHLICHER GRUND (gkv-302, 20.09.2026):
--   1) Die Luecke selbst ist KEIN Verstoss gegen die GKV-Spezifikation.
--      Die Spezifikation verlangt "fortlaufend", nicht "lueckenlos", und keine
--      der drei Pruefstufen der Datenannahmestellen sucht nach Luecken.
--   2) Die Reihenfolge "erst Nummer ziehen, dann Preflight/Datei bauen" bleibt
--      ABSICHTLICH genau so: wuerde die Reihenfolge umgedreht, wuerden die
--      Regeln F:03001–F:03004 geblendet, denn diese Regeln pruefen die
--      Datennummer selbst.
--   3) GoBD verlangt jedoch Erklaerbarkeit: nicht die Abwesenheit von Luecken,
--      sondern dass jede Luecke nachvollziehbar begruendet werden kann (dieselbe
--      Begruendung steht in db/REGISTER.md bereits bei nummernkreise). Wenn in
--      sechs Monaten die Frage aufkommt "wo ist die 94 geblieben?", muss dies
--      anhand der abrechnung-Tabelle belegbar sein.
--
-- AENDERUNGEN:
--   1) abrechnung.status erhaelt den zusaetzlichen Wert 'verworfen'
--      (DROP CONSTRAINT IF EXISTS abrechnung_status_check und Wiederanlage
--      mit der vollstaendigen bisherigen Liste plus 'verworfen').
--   2) Neue Spalte abrechnung.verwerfungsgrund text (nullable), die den
--      Fehlercode bzw. eine gekuerzte Zusammenfassung ohne PHI aufnimmt.
--
-- ZAEHLER: counter-neutral (geänderte CHECK-Constraint und neue nullable Spalte
--          legen kein neues zählbares Objekt an — +0 Tabelle, +0 Policy,
--          +0 Index, +0 Funktion, +0 Trigger).

ALTER TABLE public.abrechnung
  DROP CONSTRAINT IF EXISTS abrechnung_status_check;

ALTER TABLE public.abrechnung
  ADD CONSTRAINT abrechnung_status_check
  CHECK (status = ANY (ARRAY['erstellt'::text, 'heruntergeladen'::text, 'gesendet'::text, 'accepted'::text, 'rejected'::text, 'paid'::text, 'verworfen'::text]));

ALTER TABLE public.abrechnung
  ADD COLUMN IF NOT EXISTS verwerfungsgrund text;

COMMENT ON COLUMN public.abrechnung.verwerfungsgrund IS
  'Fehlercode bzw. gekürzte, PHI-freie Begründung, weshalb dieser Abrechnungsversuch nach Vergabe von Datenaustauschreferenz und Transfernummer verworfen wurde. Erklärt Lücken im Nummernkreis (GoBD).';
