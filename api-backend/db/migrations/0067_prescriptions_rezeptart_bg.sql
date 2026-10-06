-- Migration 0067_prescriptions_rezeptart_bg.sql
-- SaaS: angewandt 06.10.2026 (MCP: 20261006083750).
-- KHS M2.1 / PE-006 (05.10.2026): die Verordnungsart BG (Berufsgenossenschaft/Unfallkasse) wird zulaessig. Der CHECK kannte nur
-- kassen|privat|selbstzahler (der alte Kommentar „... | bg | ..." gilt der Vorgaengertabelle `verordnungen`).
-- Die neue Menge ist eine Obermenge der alten — keine bestehende Zeile kann den CHECK verletzen (live 05.10.2026: 79 Zeilen,
-- rezeptart nur NULL oder 'kassen'), deshalb ohne NOT VALID. NULL bleibt erlaubt (Altzeilen; gelten als Kasse).
-- BG laeuft NICHT ueber §302/DTA (SPEC-RULES „BG / Arbeitsunfall"); der Guard `rezeptart !== 'kassen'` in
-- abrechnung.routes.js haelt sie aus der Kassenabrechnung. Keine neue Funktion/Policy/Index/Trigger -> Schema-Zaehler unveraendert.

ALTER TABLE public.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_rezeptart_check;
ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_rezeptart_check
  CHECK (rezeptart IS NULL OR rezeptart = ANY (ARRAY['kassen'::text, 'privat'::text, 'selbstzahler'::text, 'bg'::text]));
