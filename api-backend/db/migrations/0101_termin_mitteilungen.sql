-- Mitteilungsprotokoll fuer Terminabsagen per E-Mail (Physio-Pilot M6b/S8, 02.11.2026).
--
-- WAS: Eine Zeile je versandter Mitteilung „Termin entfaellt" (Anlass: Sondertag geschlossen). Schreibt NUR das
--      Backend (service_role) in api-backend/routes/sondertag-mitteilung.js — nie automatisch: Vorschau ->
--      Praxis-Mitarbeiter:in gibt frei -> Versand. Nur an Patienten mit gueltiger Datenschutz-Einwilligung ab v6
--      mit Option „Terminerinnerungen und Terminaenderungen" (legal-de 01.11.2026); alle anderen: Anrufliste.
-- WARUM Dedup (booking_id, anlass, termin_beginn) statt custom_day_id: ein geloeschter und neu angelegter
--      Sondertag bekommt eine neue id; die Mail darf trotzdem nicht ein zweites Mal rausgehen (db-ustasi).
--      Die Zeile wird VOR dem Versand angelegt, zwei gleichzeitige Laeufe senden also nie doppelt (guvenlik).
-- WARUM keine E-Mail-Adresse, keine lead_id: Datenminimierung; die Adresse kommt beim Versand frisch aus leads.
-- WARUM RLS ohne Schreib-Policy: authenticated darf nur lesen (eigener Mandant: Inhaber + Team, die ohnehin alle
--      Termine sehen); INSERT/UPDATE/DELETE nur service_role. anon: nichts.
-- WARUM Index owner_id + created_at: Tagesdeckel je Mandant (guvenlik: Prozesszaehler allein reicht nicht, S-55).
-- SaaS: angewandt 02.11.2026, Supabase Management-API mit MCP-Token (Melih GO 02.11., BEGIN/COMMIT, Katalog + Advisors geprueft).
-- ZAEHLER: public_tablo +1, rls_policy +1, fonksiyon +0, trigger +0, index +3.

CREATE TABLE IF NOT EXISTS public.termin_mitteilungen (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id      uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  custom_day_id   uuid REFERENCES public.custom_days(id) ON DELETE SET NULL,
  anlass          text NOT NULL CHECK (anlass IN ('sondertag_geschlossen')),
  termin_beginn   timestamptz NOT NULL,
  status          text NOT NULL CHECK (status IN ('gesendet', 'fehler')),
  fehler_code     text CHECK (fehler_code IS NULL OR length(fehler_code) <= 64),
  freigegeben_von uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gesendet_am     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT termin_mitteilungen_eindeutig UNIQUE (booking_id, anlass, termin_beginn)
);

CREATE INDEX IF NOT EXISTS termin_mitteilungen_owner_zeit_idx
  ON public.termin_mitteilungen (owner_id, created_at);

ALTER TABLE public.termin_mitteilungen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.termin_mitteilungen FROM anon;
REVOKE ALL ON TABLE public.termin_mitteilungen FROM authenticated;
GRANT SELECT ON TABLE public.termin_mitteilungen TO authenticated;

DROP POLICY IF EXISTS termin_mitteilungen_select ON public.termin_mitteilungen;
CREATE POLICY termin_mitteilungen_select ON public.termin_mitteilungen
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT public.auth_tenant_id()));
