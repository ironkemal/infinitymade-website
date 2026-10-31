-- Startseite: Aufgaben (K10, 31.10.2026).
--
-- WAS: Einfache, manuell gepflegte Aufgabenliste fuer die Praxis (Freitext, optional faellig, optional mit Patient verknuepft).
-- WARUM: Praxen brauchen auf der Startseite schnelle interne Erinnerungen ohne Rezept-/Abrechnungsbindung.
-- WARUM RLS: Teammitglieder duerfen Aufgaben ihres Mandanten lesen, erstellen und bearbeiten (z. B. als erledigt markieren).
--      Loeschen darf der Praxisinhaber oder der Ersteller der jeweiligen Aufgabe.
-- WARUM lead_id-Check: Verhindert, dass Aufgaben mit fremden Patienten verknuepft werden (Mandantentrennung).
-- SaaS: angewandt 31.10.2026, MCP.
-- ZAEHLER: public_tablo +1, rls_policy +4, fonksiyon +0, trigger +2, index +3.

CREATE TABLE IF NOT EXISTS public.praxis_aufgaben (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id  uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  lead_id      uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  text         text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 500),
  faellig_am   date,
  erledigt_at  timestamptz,
  erledigt_von uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  erstellt_von uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS praxis_aufgaben_owner_faellig_idx
  ON public.praxis_aufgaben (owner_id, faellig_am)
  WHERE erledigt_at IS NULL;

CREATE INDEX IF NOT EXISTS praxis_aufgaben_lead_idx
  ON public.praxis_aufgaben (lead_id)
  WHERE lead_id IS NOT NULL;

ALTER TABLE public.praxis_aufgaben ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.praxis_aufgaben FROM anon;

DROP POLICY IF EXISTS praxis_aufgaben_select ON public.praxis_aufgaben;
CREATE POLICY praxis_aufgaben_select ON public.praxis_aufgaben
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT public.auth_tenant_id()));

DROP POLICY IF EXISTS praxis_aufgaben_insert ON public.praxis_aufgaben;
CREATE POLICY praxis_aufgaben_insert ON public.praxis_aufgaben
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT public.auth_tenant_id())
    AND (lead_id IS NULL OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.owner_id = praxis_aufgaben.owner_id
    ))
  );

DROP POLICY IF EXISTS praxis_aufgaben_update ON public.praxis_aufgaben;
CREATE POLICY praxis_aufgaben_update ON public.praxis_aufgaben
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT public.auth_tenant_id()))
  WITH CHECK (
    owner_id = (SELECT public.auth_tenant_id())
    AND (lead_id IS NULL OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.owner_id = praxis_aufgaben.owner_id
    ))
  );

DROP POLICY IF EXISTS praxis_aufgaben_delete ON public.praxis_aufgaben;
CREATE POLICY praxis_aufgaben_delete ON public.praxis_aufgaben
  FOR DELETE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR (owner_id = (SELECT public.auth_tenant_id()) AND erstellt_von = (SELECT auth.uid()))
  );

DROP TRIGGER IF EXISTS praxis_aufgaben_updated_at ON public.praxis_aufgaben;
CREATE TRIGGER praxis_aufgaben_updated_at
  BEFORE UPDATE ON public.praxis_aufgaben
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_set_business_id ON public.praxis_aufgaben;
CREATE TRIGGER trg_set_business_id
  BEFORE INSERT ON public.praxis_aufgaben
  FOR EACH ROW EXECUTE FUNCTION public.set_business_id_default();
