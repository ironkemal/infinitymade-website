-- Modulrechte je Standort schreibt nur der Inhaber (Physio/PLANUNG-UMSETZUNG.md M3b, Entwurf 31.10., Melih GO 04.11.2026).
--
-- WAS: employee_scope_overrides trennt Lesen (Betroffener und Inhaber) und Schreiben (Inhaber).
-- WARUM: eso_owner_or_self galt FOR ALL. Der Zweig employee_id = auth.uid() ließ also auch das
--      Schreiben zu, obwohl das Dashboard diese Tabelle nur im Inhaber-Panel schreibt
--      (dashboard.js, Mitarbeiter-Standorte). Vor dem Einblenden der Standort-Bildschirme (M3)
--      muss das zu sein (guvenlik, Vorprüfung 31.10.2026).
-- :stable/:beta-sicher: nur Policies; alter Code liest weiter, Mitarbeiter schrieben hier nie.
-- Live bestätigt 04.11.2026: nur eso_owner_or_self (FOR ALL, public) vorhanden; 0081_security_boundaries.test.sql
--      („override self grant must reject") war deshalb rot.
-- Dasselbe für employee_groups und group_scopes: employee_groups_owner_all und group_scopes_via_group galten
--      FOR ALL auch für jeden Mitarbeiter des Inhabers — ein Mitarbeiter konnte seiner Gruppe z. B. „abrechnung"
--      freischalten (0081: „group self grant"). Das Dashboard liest beide Tabellen nur (dashboard.js
--      Mitarbeiter-Standorte); Standardgruppen legt der Inhaber an. Neu: Team liest, Inhaber schreibt.
-- SaaS: angewandt 04.11.2026, Supabase Management-API (Melih GO 04.11., BEGIN/COMMIT, Ledger-Zeile, Katalog geprüft).
-- ZAEHLER: rls_policy +3.

DROP POLICY IF EXISTS eso_owner_or_self ON public.employee_scope_overrides;
DROP POLICY IF EXISTS eso_lesen ON public.employee_scope_overrides;
DROP POLICY IF EXISTS eso_inhaber ON public.employee_scope_overrides;

CREATE POLICY eso_lesen ON public.employee_scope_overrides
  FOR SELECT TO authenticated
  USING (
    employee_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.businesses b
                WHERE b.id = employee_scope_overrides.business_id AND b.owner_id = (SELECT auth.uid()))
  );

CREATE POLICY eso_inhaber ON public.employee_scope_overrides
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses b
             WHERE b.id = employee_scope_overrides.business_id AND b.owner_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.businesses b
             WHERE b.id = employee_scope_overrides.business_id AND b.owner_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = employee_scope_overrides.employee_id
                   AND COALESCE(p.owner_id, p.id) = (SELECT auth.uid()))
  );

-- ── employee_groups ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS employee_groups_owner_all ON public.employee_groups;
DROP POLICY IF EXISTS employee_groups_lesen ON public.employee_groups;
DROP POLICY IF EXISTS employee_groups_inhaber ON public.employee_groups;

CREATE POLICY employee_groups_lesen ON public.employee_groups
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses b
             WHERE b.id = employee_groups.business_id
               AND (b.owner_id = (SELECT auth.uid())
                    OR EXISTS (SELECT 1 FROM public.profiles p
                                WHERE p.id = (SELECT auth.uid()) AND p.owner_id = b.owner_id)))
  );

CREATE POLICY employee_groups_inhaber ON public.employee_groups
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b
                  WHERE b.id = employee_groups.business_id AND b.owner_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b
                       WHERE b.id = employee_groups.business_id AND b.owner_id = (SELECT auth.uid())));

-- ── group_scopes ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS group_scopes_via_group ON public.group_scopes;
DROP POLICY IF EXISTS group_scopes_lesen ON public.group_scopes;
DROP POLICY IF EXISTS group_scopes_inhaber ON public.group_scopes;

CREATE POLICY group_scopes_lesen ON public.group_scopes
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employee_groups eg JOIN public.businesses b ON b.id = eg.business_id
             WHERE eg.id = group_scopes.group_id
               AND (b.owner_id = (SELECT auth.uid())
                    OR EXISTS (SELECT 1 FROM public.profiles p
                                WHERE p.id = (SELECT auth.uid()) AND p.owner_id = b.owner_id)))
  );

CREATE POLICY group_scopes_inhaber ON public.group_scopes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employee_groups eg JOIN public.businesses b ON b.id = eg.business_id
                  WHERE eg.id = group_scopes.group_id AND b.owner_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employee_groups eg JOIN public.businesses b ON b.id = eg.business_id
                       WHERE eg.id = group_scopes.group_id AND b.owner_id = (SELECT auth.uid())));
