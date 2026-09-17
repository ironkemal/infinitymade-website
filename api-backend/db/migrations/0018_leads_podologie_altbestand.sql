-- Ops-Karte #244 — HPNR 78040 Altbestand-Sperre wird nie dauerhaft beantwortet.
--
-- Problem
-- ───────
-- Das Regelwerk (module/eingangsbefundung-regel.js:183-283) stellt die Frage
-- schon: Patienten, die VOR dem 01.11.2023 erstmals podologisch behandelt
-- wurden, haben keinen Anspruch auf HPNR 78040 (Aenderungsvereinbarung
-- 20.10.2023). Die Antwort landet bisher nur in einer modulscope JS-Variable
-- (`module/verordnung-podo.js:611,677-736`, `_altbestand`) — sie verfaellt bei
-- Patientenwechsel oder Sitzungsende. Die Sperre laesst sich damit nie
-- dauerhaft durchsetzen, obwohl das Regelwerk sie kennt.
--
-- Warum an `leads`, nicht an `prescriptions`
-- ───────────────────────────────────────────
-- Die Frage ist patientenbezogen ("wann hat dieser Patient erstmals
-- podologische Behandlung begonnen"), nicht verordnungsbezogen — bestaetigt
-- durch wissensbank/SPEC-RULES.md:139-168 und module/verordnung-podo.js:
-- 600-609. `leads` ist Tenant-scoped, die Spalte bedeutet also automatisch
-- "dieser Patient bei dieser Praxis" — die offene Rechtsfrage (Praxis- oder
-- patientenbezogener Anspruch, SPEC-RULES.md:169) aendert daran nichts.
--
-- db-ustasi-Konsultation: 2026-09-17.
--
-- ZAEHLER: unveraendert (nur zwei Spalten — kein Tabelle/Policy/Funktion/
--          Trigger/Index, keine storage.*/auth.*-Aenderung).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS podologie_altbestand_vor_2023 boolean,
  ADD COLUMN IF NOT EXISTS podologie_altbestand_beantwortet_am timestamptz;

COMMENT ON COLUMN public.leads.podologie_altbestand_vor_2023 IS
  'NULL = noch nicht gefragt/unbekannt. true/false = Patient hat vor dem 01.11.2023 erstmals podologische Behandlung begonnen (HPNR 78040 Aenderungsvereinbarung 20.10.2023). Ops #244.';
COMMENT ON COLUMN public.leads.podologie_altbestand_beantwortet_am IS
  'Wann die Altbestand-Frage beantwortet wurde — dient als Beleg gegenueber der Kasse, ein fluechtiger Dialog reicht laut SPEC-RULES.md nicht. Ops #244.';
