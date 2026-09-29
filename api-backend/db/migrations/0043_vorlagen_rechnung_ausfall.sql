-- Vorlagen — Typ 'rechnung_ausfall' in der CHECK-Constraint zulassen (Reform S3.2).
--
-- SaaS: angewendet 29.09.2026, MCP.
--
-- VORHERIGER ZUSTAND:
--   document_vorlagen_vorlage_type_check liess nur acht Typen zu
--   (quittung_zuzahlung, rechnung_bg, rechnung_privat, rechnung_eigenanteil,
--   rechnung_selbstzahler, rechnung_sonder, rezeptvorderseite, rzg_quittung).
--   dashboard.js seedet seit 12.08.2026 zusaetzlich 'rechnung_ausfall'.
--
-- FACHLICHER GRUND (db-ustasi, 29.09.2026, live gemessen):
--   seedMissingVorlagen fuegte alle fehlenden Typen in EINEM insert ein und
--   pruefte den Fehler nicht. Die CHECK-Verletzung durch 'rechnung_ausfall'
--   verwarf den gesamten insert: seit dem 12.08. angelegte Konten erhielten
--   GAR KEINE Vorlage, und ausfall.routes.js fand 'rechnung_ausfall' immer als null.
--
-- AENDERUNGEN:
--   Constraint entfernen und mit den bisherigen acht Werten plus
--   'rechnung_ausfall' neu anlegen.
--
-- ZAEHLER: counter-neutral (CHECK-Constraint neu angelegt; kein neues zaehlbares
--          Objekt — +0 Tabelle, +0 Policy, +0 Index, +0 Funktion, +0 Trigger).
--          Dritte Form von Kural 6, wie 0033.

ALTER TABLE public.document_vorlagen
  DROP CONSTRAINT document_vorlagen_vorlage_type_check;

ALTER TABLE public.document_vorlagen
  ADD CONSTRAINT document_vorlagen_vorlage_type_check
  CHECK (vorlage_type = ANY (ARRAY['quittung_zuzahlung','rechnung_bg','rechnung_privat',
    'rechnung_eigenanteil','rechnung_selbstzahler','rechnung_sonder','rezeptvorderseite',
    'rzg_quittung','rechnung_ausfall']::text[]));
