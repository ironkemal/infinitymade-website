-- Standortplan je Mitarbeiter (Physio-Pilot M4a, 01.11.2026, Physio/PLANUNG-UMSETZUNG.md Entscheidung 5, §2a Nr. 8).
--
-- WAS: An welchen Standorten (businesses) ein Mitarbeiter an einem Tag arbeitet. Tag-Granularitaet, keine Halbtage.
--      Zwei Arten Zeilen in einer Tabelle:
--        Wochenmuster: weekday 0-6 (0 = Sonntag, wie working_hours.day_of_week / berlinDayOfWeek()), datum NULL
--        Einzeltag:    datum, weekday NULL
--      Eine Zeile je zugeordnetem Standort; mehrere Standorte am selben Tag sind erlaubt (eine Zeile je Standort).
-- REGEL (liest M4b, api-backend/lib/standort-plan.js + module/standort-plan-regel.js, nicht diese Migration):
--      gibt es fuer (Mitarbeiter, Datum) Einzeltag-Zeilen, gelten nur diese; sonst die Wochenmuster-Zeilen
--      des Wochentags; gibt es keine Zeile, gilt das alte Verhalten (alle Standorte). Leere Tabelle oder
--      Lesefehler = altes Verhalten (M4d).
-- WARUM eigene Tabelle statt working_hours.business_id: working_hours ist anonym lesbar (guvenlik-Veto,
--      Entscheidung 5). Diese Tabelle hat KEINEN anon-Zugriff.
-- WARUM ein UNIQUE NULLS NOT DISTINCT ueber (employee_id, business_id, weekday, datum): genau eines von
--      weekday/datum ist gesetzt (CHECK), das andere ist NULL und zaehlt dank NULLS NOT DISTINCT als gleich.
--      Damit ist eine Wochenmuster-Zeile je (Mitarbeiter, Wochentag, Standort) und eine Einzeltag-Zeile je
--      (Mitarbeiter, Datum, Standort) eindeutig, und PostgREST kann per onConflict upserten (partielle
--      Indizes koennte es nicht). Muster: aufbewahrung_sperre_eindeutig (0057).
-- WARUM RLS: Inhaber (owner_id = auth.uid()) liest und schreibt alle Zeilen seines Mandanten. Mitarbeiter
--      liest nur eigene Zeilen, schreibt nie. Kollegen lesen nichts.
-- WARUM Mandantencheck (WITH CHECK): employee_id muss ein Profil desselben Mandanten sein
--      (COALESCE(owner_id, id) = owner_id, auch der Inhaber selbst), business_id ein Standort des Inhabers
--      (Muster rooms_write_owner, 0092). Ein FK allein laeuft an RLS vorbei.
-- WARUM ON DELETE CASCADE: nicht aufbewahrungspflichtig (DSGVO-Kategorie 'loeschen'), von nichts referenziert;
--      ein geloeschter Standort nimmt seine Planzeilen mit, sonst bliebe ein Mitarbeiter einem toten Ort zugeordnet.
-- :stable/:beta-sicher: nur neue Tabelle, kein bestehender Lese- oder Schreibweg aendert sich.
-- SaaS: angewandt 01.11.2026, Supabase Management-API mit MCP-Token (MCP-Prozess hielt alten Token; gleiche Rechte, BEGIN/COMMIT, danach Katalog + Advisors geprueft).
-- ZAEHLER: public_tablo +1, rls_policy +4, fonksiyon +0, trigger +1, index +4.

CREATE TABLE IF NOT EXISTS public.employee_standort_plan (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  weekday     smallint CHECK (weekday IS NULL OR (weekday >= 0 AND weekday <= 6)),
  datum       date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_standort_plan_art_check CHECK ((weekday IS NULL) <> (datum IS NULL)),
  CONSTRAINT employee_standort_plan_eindeutig
    UNIQUE NULLS NOT DISTINCT (employee_id, business_id, weekday, datum)
);

CREATE INDEX IF NOT EXISTS employee_standort_plan_owner_idx
  ON public.employee_standort_plan (owner_id);
CREATE INDEX IF NOT EXISTS employee_standort_plan_business_idx
  ON public.employee_standort_plan (business_id);

ALTER TABLE public.employee_standort_plan ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.employee_standort_plan FROM anon;
REVOKE TRUNCATE ON TABLE public.employee_standort_plan FROM authenticated;

DROP POLICY IF EXISTS employee_standort_plan_select ON public.employee_standort_plan;
CREATE POLICY employee_standort_plan_select ON public.employee_standort_plan
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR employee_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS employee_standort_plan_insert ON public.employee_standort_plan;
CREATE POLICY employee_standort_plan_insert ON public.employee_standort_plan
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles e
      WHERE e.id = employee_standort_plan.employee_id
        AND COALESCE(e.owner_id, e.id) = employee_standort_plan.owner_id
    )
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = employee_standort_plan.business_id
        AND b.owner_id = employee_standort_plan.owner_id
    )
  );

DROP POLICY IF EXISTS employee_standort_plan_update ON public.employee_standort_plan;
CREATE POLICY employee_standort_plan_update ON public.employee_standort_plan
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles e
      WHERE e.id = employee_standort_plan.employee_id
        AND COALESCE(e.owner_id, e.id) = employee_standort_plan.owner_id
    )
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = employee_standort_plan.business_id
        AND b.owner_id = employee_standort_plan.owner_id
    )
  );

DROP POLICY IF EXISTS employee_standort_plan_delete ON public.employee_standort_plan;
CREATE POLICY employee_standort_plan_delete ON public.employee_standort_plan
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP TRIGGER IF EXISTS employee_standort_plan_updated_at ON public.employee_standort_plan;
CREATE TRIGGER employee_standort_plan_updated_at
  BEFORE UPDATE ON public.employee_standort_plan
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
