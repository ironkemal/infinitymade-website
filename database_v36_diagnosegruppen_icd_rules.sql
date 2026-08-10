-- database_v33_diagnosegruppen_icd_rules.sql
--
-- Warum icd_prefixes entfernt wird
-- ---------------------------------
-- Die bisherige Spalte `icd_prefixes text[]` konnte nur Praefixe speichern,
-- also z. B. ['G60', 'G61', 'G62']. Damit liessen sich zwei Anforderungen
-- nicht ausdruecken:
--
--   1. Ausschluesse: G63.2 gehoert zur Diagnosegruppe DF (diabetische Neuropathie),
--      NICHT zur Gruppe NF. Ein Ausschluss ist mit Praefix-Listen nicht darstellbar.
--
--   2. Endstaendigkeit: G82.6-! ist ein Ausrufezeichenkode und niemals Hauptdiagnose
--      (ICD-10-GM-Feld 13 = 'Z'). G82.[0-6]- ist eine vierstellige Gruppenuberschrift
--      (Feld 14 = 'V'). Beides muss erkennbar zurueckgewiesen werden.
--
-- Wurde icd_prefixes bestehen bleiben, entstunden zwei Wahrheiten: die JSON-Regeln
-- in api-backend/ai/validators/diagnosegruppen.json (JSON-Regulaerausdruecke mit
-- Ausschluessen) und die vereinfachte Praefixliste in der Datenbank. Jede Abweichung
-- ware ein stiller Fehler in der Oberflaeche.
--
-- Wer die Daten fuellt
-- ---------------------
-- `node api-backend/check_diagnosegruppen_icd.js`
-- Standardlauf schreibt die Regeln in die Tabelle.
-- Mit --check meldet das Skript Drift (Exit-Code 1) -- CI-tauglich.
--
-- Regeldaten (Quelle der Wahrheit)
-- ----------------------------------
-- api-backend/ai/validators/diagnosegruppen.json  -->  Abschnitt "podologie"
-- Schluessel DF, NF, QF, UI1, UI2 (Schluessel mit fuehrendem _ werden uebersprungen).
--
-- Idempotenz: alle Befehle nutzen IF NOT EXISTS / IF EXISTS.
-- -----------------------------------------------------------------

ALTER TABLE diagnosegruppen
  ADD COLUMN IF NOT EXISTS icd_accept          jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS icd_exclude         jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS icd_auto_select     jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS icd_accept_unsicher jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS icd_enforcement     text  NOT NULL DEFAULT 'warn';

ALTER TABLE diagnosegruppen DROP COLUMN IF EXISTS icd_prefixes;
