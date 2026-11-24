-- ENTWURF 0132_time_offs_rls_schliessen.sql — STUFE 2 (ERST NACH FRONTEND-UMSTELLUNG AUF :stable!)
--
-- Konsey-Entscheid 24.11.2026 (`konsey/KARARLAR.md`: legal-de + guvenlik + db-ustasi):
-- Darf ERST live angewandt werden, nachdem alle Kalender-/Überblick-Lesewege
-- (`module/abwesenheit.js`, `module/ueberblick-ansicht.js`, `dashboard.js`) auf
-- `supabase.rpc('team_abwesenheiten', ...)` aus 0131 umgestellt und auf :stable
-- ausgerollt sind!
--
-- WAS DIESE MIGRATION SCHLIESST:
--   Ersetzt `time_offs_mandant` (`FOR ALL TO authenticated` für den ganzen Mandanten —
--   Mitarbeiter konnten bisher sowohl `type='krank'/reason/note` von Kollegen lesen als
--   auch fremde Abwesenheiten ändern/löschen!) durch strenge Policies:
--     - Inhaber: voller Zugriff auf alle Abwesenheiten seiner Praxis
--     - Mitarbeiter: SELECT ausschließlich auf eigene Zeilen (`employee_id = auth.uid()`)
--     - Kollegen-Kalender: ausschließlich über `public.team_abwesenheiten()` (ohne `type/reason/note`)

BEGIN;

DROP POLICY IF EXISTS time_offs_mandant ON public.time_offs;

CREATE POLICY time_offs_owner_all ON public.time_offs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.profiles e
       WHERE e.id = time_offs.employee_id
         AND COALESCE(e.owner_id, e.id) = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.profiles e
       WHERE e.id = time_offs.employee_id
         AND COALESCE(e.owner_id, e.id) = auth.uid()
    )
  );

CREATE POLICY time_offs_self_select ON public.time_offs
  FOR SELECT
  TO authenticated
  USING (
    employee_id = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM public.profiles e
       WHERE e.id = auth.uid()
         AND e.is_active IS TRUE
    )
  );

COMMIT;
