-- Mitarbeiter-Anstellung (Physio-Pilot M5a, 01.11.2026, onprem O-234).
--
-- WAS: Eine Zeile je Mitarbeiter mit Vertragsrahmen: Vollzeit/Teilzeit, Wochenstunden (optional),
--      Urlaubsanspruch in Tagen je Jahr (Vorgabe 30). Liest und schreibt module/anstellung.js
--      (ladeAnstellung, speichereAnstellung: upsert onConflict 'employee_id').
-- WARUM eigene Tabelle statt profiles: Kollegen sehen Vertragsdaten nicht (Physio/PLANUNG-UMSETZUNG.md
--      Entscheidung 7: legal-de, guvenlik, db-ustasi). profiles ist im Team lesbar, diese Tabelle nicht.
-- WARUM employee_id als PK: genau eine Anstellung je Mitarbeiter, Ziel des Upserts.
-- WARUM RLS: Inhaber (owner_id = auth.uid(), also auth_tenant_id() = eigene id) liest und schreibt alle
--      Zeilen seines Mandanten. Mitarbeiter liest nur die eigene Zeile, schreibt nie. Kollegen lesen nichts.
-- WARUM Mandantencheck (WITH CHECK): employee_id muss ein Profil desselben Mandanten sein
--      (COALESCE(owner_id, id) = owner_id, Muster employee_services_mandant/time_offs_mandant), damit
--      niemand eine Anstellung fuer einen fremden Mitarbeiter anlegt.
-- WARUM ON DELETE CASCADE: Die Tabelle ist nicht aufbewahrungspflichtig (DSGVO-Kategorie 'loeschen') und wird
--      von nichts referenziert, CASCADE nimmt also keine gesperrten Daten mit; Auth-Nutzer und Profile werden
--      im Sperrmodell ohnehin nicht geloescht, RESTRICT wuerde nur Bereinigungspfade blockieren.
-- WARUM CHECKs: dieselben Grenzen wie pruefeAnstellung() (Wochenstunden 0-80, eine Nachkommastelle;
--      Urlaub ganze Tage 0-60).
-- SaaS: angewandt 01.11.2026, Supabase Management-API mit MCP-Token (MCP-Prozess hielt alten Token; gleiche Rechte, BEGIN/COMMIT, danach Katalog + Advisors geprueft).
-- ZAEHLER: public_tablo +1, rls_policy +4, fonksiyon +0, trigger +1, index +2.

CREATE TABLE IF NOT EXISTS public.mitarbeiter_anstellung (
  employee_id       uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  beschaeftigung    text NOT NULL DEFAULT 'vollzeit'
                    CHECK (beschaeftigung IN ('vollzeit', 'teilzeit')),
  wochenstunden     numeric(3,1) CHECK (wochenstunden IS NULL OR (wochenstunden >= 0 AND wochenstunden <= 80)),
  urlaub_jahrestage integer NOT NULL DEFAULT 30
                    CHECK (urlaub_jahrestage >= 0 AND urlaub_jahrestage <= 60),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mitarbeiter_anstellung_owner_idx
  ON public.mitarbeiter_anstellung (owner_id);

ALTER TABLE public.mitarbeiter_anstellung ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mitarbeiter_anstellung FROM anon;
REVOKE TRUNCATE ON TABLE public.mitarbeiter_anstellung FROM authenticated;

DROP POLICY IF EXISTS mitarbeiter_anstellung_select ON public.mitarbeiter_anstellung;
CREATE POLICY mitarbeiter_anstellung_select ON public.mitarbeiter_anstellung
  FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR employee_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS mitarbeiter_anstellung_insert ON public.mitarbeiter_anstellung;
CREATE POLICY mitarbeiter_anstellung_insert ON public.mitarbeiter_anstellung
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles e
      WHERE e.id = mitarbeiter_anstellung.employee_id
        AND COALESCE(e.owner_id, e.id) = mitarbeiter_anstellung.owner_id
    )
  );

DROP POLICY IF EXISTS mitarbeiter_anstellung_update ON public.mitarbeiter_anstellung;
CREATE POLICY mitarbeiter_anstellung_update ON public.mitarbeiter_anstellung
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles e
      WHERE e.id = mitarbeiter_anstellung.employee_id
        AND COALESCE(e.owner_id, e.id) = mitarbeiter_anstellung.owner_id
    )
  );

DROP POLICY IF EXISTS mitarbeiter_anstellung_delete ON public.mitarbeiter_anstellung;
CREATE POLICY mitarbeiter_anstellung_delete ON public.mitarbeiter_anstellung
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP TRIGGER IF EXISTS mitarbeiter_anstellung_updated_at ON public.mitarbeiter_anstellung;
CREATE TRIGGER mitarbeiter_anstellung_updated_at
  BEFORE UPDATE ON public.mitarbeiter_anstellung
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
