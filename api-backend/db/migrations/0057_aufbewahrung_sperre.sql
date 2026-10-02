-- DSGVO Löschung ↔ Aufbewahrung (KHS K1.4, guvenlik S-10/S-32/S-40/S-41, onprem O-16/O-145).
-- Recht: compliance/LEGAL_DECISIONS.md Abschnitt „2026-10-02" §4 — aufbewahrungspflichtige
-- Unterlagen werden gesperrt statt gelöscht. db-ustasi 02.10.2026: eigene Tabelle statt Spalten
-- (je Kategorie eigene Frist, Fall A braucht später Patienten-Granularität).
--
-- WAS:
--   1. Neue Tabelle aufbewahrung_sperre — der Sperrvermerk. patient_id NULL = ganzes Konto
--      (Fall B, Kontolöschung SaaS); gesetzt = einzelner Patient (Fall A, später).
--      Nur service_role (RLS an, keine Policy). Schreiber: api-backend/dsgvo/loeschen.js.
--   2. profiles.plan_status darf 'deleted' (gesperrtes, gelöschtes Konto). Ohne diesen Wert
--      warf schon das alte delete_expired_accounts() beim ersten Konto.
--   3. DROP delete_expired_accounts(): lief seit Juli 2026 nie durch (CHECK aus 2. und
--      prescription_sessions.owner_id existiert nicht → jeder Lauf zurückgerollt; 2 fällige
--      Testkonten, K-14) und hätte im reparierten Zustand Behandlungsdoku (prescriptions,
--      leads) gelöscht. Der Cron in server.js ruft sie im selben Commit nicht mehr auf.
--      zweistufig: Aufrufer im selben Commit entfernt; :stable wurde nie veröffentlicht
--      (onprem O-143), in der Box ist die Funktion seit 0000_baseline ohnehin gedroppt.
--   GoBD-Trigger und patient_consents RESTRICT bleiben unberührt.
--
-- SaaS: angewandt 02.10.2026, MCP.
-- ZAEHLER: public_tablo +1, index +2 (PK, Unique), rls_policy ±0 (RLS an ohne Policy, wie
--   nummernkreise), fonksiyon ±0 in der Box (delete_expired_accounts dort nie vorhanden),
--   trigger ±0. FKs legen keinen Index an (_hinweis_0025).

CREATE TABLE IF NOT EXISTS public.aufbewahrung_sperre (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  patient_id   uuid REFERENCES public.leads(id) ON DELETE RESTRICT,
  kategorie    text NOT NULL CHECK (kategorie IN ('behandlung', 'einwilligung', 'beleg', 'grundaufzeichnung', 'geschaeftsbrief')),
  gesperrt_am  timestamptz NOT NULL DEFAULT now(),
  gesperrt_bis date NOT NULL,
  grundlage    text NOT NULL,
  vorgang_id   uuid,
  CONSTRAINT aufbewahrung_sperre_eindeutig UNIQUE NULLS NOT DISTINCT (owner_id, patient_id, kategorie)
);

COMMENT ON TABLE public.aufbewahrung_sperre IS
  'Sperrvermerk Art. 17 Abs. 3 lit. b / Art. 18 DSGVO: aufbewahrungspflichtige Unterlagen bleiben gesperrt bis gesperrt_bis (frühestens). patient_id NULL = ganzes Konto (Fall B). Nur service_role. KHS K1.4, 02.10.2026.';

ALTER TABLE public.aufbewahrung_sperre ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.aufbewahrung_sperre FROM anon, authenticated;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_status_check
  CHECK (plan_status = ANY (ARRAY['pending', 'trial', 'active', 'past_due', 'canceled', 'expired', 'deleted']));

DROP FUNCTION IF EXISTS public.delete_expired_accounts();
