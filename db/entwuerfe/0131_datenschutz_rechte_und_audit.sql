-- ENTWURF 0131_datenschutz_rechte_und_audit.sql — NOCH NICHT LIVE ANGEWANDT!
--
-- Konsey-Entscheid 24.11.2026 (`konsey/KARARLAR.md`: legal-de + guvenlik + db-ustasi):
-- Zweistufiger Rollout (0131 abwärtskompatibel für :beta/:stable → Frontend-Umstellung → 0132).
--
-- VOR DEM LIVE-APPLY AUF SAAS PRÜFEN (Melih GO erforderlich):
--   SELECT count(*) FROM public.abrechnung WHERE business_id IS NULL;
--   Falls > 0: vor den Policies über businesses.is_default nachfüllen (Block 2a unten).
--   Nach Live-Apply: Datei nach `api-backend/db/migrations/0131_datenschutz_rechte_und_audit.sql`
--   verschieben, `erwartete-zaehler.json` aktualisieren (`fonksiyon +2, trigger +3, rls_policy +0`),
--   `db/SCHEMA.sql` + `db/SCHEMA-RLS.sql` + `db/REGISTER.md` + `compliance/TOM.md` nachziehen.
--
-- WAS DIESE MIGRATION SCHLIESST:
--   (1) Art. 9 DSGVO / § 26 BDSG (`time_offs` Stufe 1):
--       Neue RPC `public.team_abwesenheiten(p_von, p_bis)` liefert Kollegen im Kalender/Überblick
--       AUSSCHLIESSLICH `(id, employee_id, start_date, end_date)` — KEIN `type`, `reason`, `note`.
--       `time_offs_mandant` bleibt in 0131 noch bestehen, bis das Frontend auf :stable umgestellt ist
--       (danach schließt `0132_time_offs_rls_schliessen.sql` die Tabelle endgültig).
--   (2) R6 Modulrecht `abrechnung` auf §302-Tabellen (analog Migration `0121` für `invoices`):
--       `abrechnung`, `abrechnung_zeile`, `abrechnung_uebermittlung`, `abrechnung_zahlung`, `zaa_fehler`
--       auf `TO authenticated` + Inhaber ODER `public.abrechnungszugriff_erlaubt(auth.uid(), business_id)`
--       umstellen (inkl. `WITH CHECK` und `is_active`-Prüfung).
--   (3) Art. 32 DSGVO Rechte-Änderungsprotokoll (`data_access_log`):
--       Eigene Triggerfunktion `public.audit_rechte_log()` (SECURITY DEFINER, `SET search_path = ''`,
--       REVOKE ALL von PUBLIC/anon/authenticated) auf `employee_scope_overrides`, `group_scopes`,
--       `employee_business_assignments`. Löst `owner_id` (und `business_id`) über `businesses` bzw.
--       `employee_groups` auf — die Tabellen selbst haben keine `owner_id`-Spalte (`0021` hätte
--       `owner_id = NULL` geschrieben und die Einträge für den Inhaber unsichtbar gemacht).
--       Protokolliert ausschließlich Minimaldaten (Akteur, Tabelle, Aktion, Ziel-ID, Modul, Flag) —
--       keine Patientendaten, keine Freitexte, keine Client-INSERT-Policy auf `data_access_log`.

BEGIN;

-- ── (1) Datensparsame Kalender-RPC für Team-Abwesenheiten (Art. 9 DSGVO) ─────────────────────
CREATE OR REPLACE FUNCTION public.team_abwesenheiten(
  p_von timestamptz,
  p_bis timestamptz
)
RETURNS TABLE (
  id uuid,
  employee_id uuid,
  start_date timestamptz,
  end_date timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.id, t.employee_id, t.start_date, t.end_date
    FROM public.time_offs t
    JOIN public.profiles e ON e.id = t.employee_id
   WHERE (SELECT auth.uid()) IS NOT NULL
     AND COALESCE(e.owner_id, e.id) = public.auth_tenant_id()
     AND t.start_date <= p_bis
     AND t.end_date >= p_von
   ORDER BY t.start_date ASC;
$$;

COMMENT ON FUNCTION public.team_abwesenheiten(timestamptz, timestamptz) IS
  $$0131 (Art. 9 DSGVO): Liefert Team-Abwesenheiten im eigenen Mandanten ohne type/reason/note.$$;

REVOKE ALL ON FUNCTION public.team_abwesenheiten(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_abwesenheiten(timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.team_abwesenheiten(timestamptz, timestamptz) TO authenticated;

-- ── (2a) Optionaler Backfill falls Altzeilen mit business_id IS NULL existieren ──────────────
UPDATE public.abrechnung a
   SET business_id = b.id
  FROM public.businesses b
 WHERE a.business_id IS NULL
   AND b.owner_id = a.owner_id
   AND b.is_default IS TRUE;

-- ── (2b) Modulrecht 'abrechnung' auf §302-Tabellen (R6, analog 0121) ─────────────────────────
DROP POLICY IF EXISTS abrechnung_owner_all ON public.abrechnung;
CREATE POLICY abrechnung_owner_all ON public.abrechnung
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR (business_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.owner_id = abrechnung.owner_id)
        AND public.abrechnungszugriff_erlaubt(auth.uid(), business_id))
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR (business_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.owner_id = abrechnung.owner_id)
        AND public.abrechnungszugriff_erlaubt(auth.uid(), business_id))
  );

DROP POLICY IF EXISTS "Abrechnungszeile select scoping" ON public.abrechnung_zeile;
CREATE POLICY "Abrechnungszeile select scoping" ON public.abrechnung_zeile
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.abrechnung a
       WHERE a.id = abrechnung_zeile.abrechnung_id
         AND a.owner_id = abrechnung_zeile.owner_id
         AND a.business_id IS NOT NULL
         AND public.abrechnungszugriff_erlaubt(auth.uid(), a.business_id)
    )
  );

DROP POLICY IF EXISTS "Abrechnungszeile insert scoping" ON public.abrechnung_zeile;
CREATE POLICY "Abrechnungszeile insert scoping" ON public.abrechnung_zeile
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.abrechnung a
       WHERE a.id = abrechnung_zeile.abrechnung_id
         AND a.owner_id = abrechnung_zeile.owner_id
         AND a.business_id IS NOT NULL
         AND public.abrechnungszugriff_erlaubt(auth.uid(), a.business_id)
    )
  );

DROP POLICY IF EXISTS "Abrechnung uebermittlung select scoping" ON public.abrechnung_uebermittlung;
CREATE POLICY "Abrechnung uebermittlung select scoping" ON public.abrechnung_uebermittlung
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR (business_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.owner_id = abrechnung_uebermittlung.owner_id)
        AND public.abrechnungszugriff_erlaubt(auth.uid(), business_id))
    OR EXISTS (
      SELECT 1 FROM public.abrechnung a
       WHERE a.id = abrechnung_uebermittlung.abrechnung_id
         AND a.owner_id = abrechnung_uebermittlung.owner_id
         AND a.business_id IS NOT NULL
         AND public.abrechnungszugriff_erlaubt(auth.uid(), a.business_id)
    )
  );

DROP POLICY IF EXISTS "Abrechnungszahlung select scoping" ON public.abrechnung_zahlung;
CREATE POLICY "Abrechnungszahlung select scoping" ON public.abrechnung_zahlung
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.abrechnung a
       WHERE a.id = abrechnung_zahlung.abrechnung_id
         AND a.owner_id = abrechnung_zahlung.owner_id
         AND a.business_id IS NOT NULL
         AND public.abrechnungszugriff_erlaubt(auth.uid(), a.business_id)
    )
  );

DROP POLICY IF EXISTS "Abrechnungszahlung insert scoping" ON public.abrechnung_zahlung;
CREATE POLICY "Abrechnungszahlung insert scoping" ON public.abrechnung_zahlung
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.abrechnung a
       WHERE a.id = abrechnung_zahlung.abrechnung_id
         AND a.owner_id = abrechnung_zahlung.owner_id
         AND a.business_id IS NOT NULL
         AND public.abrechnungszugriff_erlaubt(auth.uid(), a.business_id)
    )
  );

DROP POLICY IF EXISTS zaa_fehler_via_abrechnung ON public.zaa_fehler;
CREATE POLICY zaa_fehler_via_abrechnung ON public.zaa_fehler
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.abrechnung a
       WHERE a.id = zaa_fehler.abrechnung_id
         AND (
           a.owner_id = auth.uid()
           OR (a.business_id IS NOT NULL AND public.abrechnungszugriff_erlaubt(auth.uid(), a.business_id))
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.abrechnung a
       WHERE a.id = zaa_fehler.abrechnung_id
         AND (
           a.owner_id = auth.uid()
           OR (a.business_id IS NOT NULL AND public.abrechnungszugriff_erlaubt(auth.uid(), a.business_id))
         )
    )
  );

-- ── (3) Rechte-Änderungsprotokoll in data_access_log (Art. 32 DSGVO) ─────────────────────────
CREATE OR REPLACE FUNCTION public.audit_rechte_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_zeile       jsonb;
  v_owner_id    uuid;
  v_business_id uuid;
  v_meta        jsonb;
BEGIN
  v_zeile := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  IF TG_TABLE_NAME = 'group_scopes' THEN
    SELECT b.owner_id, g.business_id
      INTO v_owner_id, v_business_id
      FROM public.employee_groups g
      JOIN public.businesses b ON b.id = g.business_id
     WHERE g.id = NULLIF(v_zeile ->> 'group_id', '')::uuid;
    v_meta := jsonb_build_object(
      'group_id', v_zeile ->> 'group_id',
      'module', v_zeile ->> 'module',
      'has_access', (v_zeile -> 'has_access')
    );
  ELSE
    v_business_id := NULLIF(v_zeile ->> 'business_id', '')::uuid;
    SELECT b.owner_id INTO v_owner_id
      FROM public.businesses b
     WHERE b.id = v_business_id;
    IF TG_TABLE_NAME = 'employee_scope_overrides' THEN
      v_meta := jsonb_build_object(
        'employee_id', v_zeile ->> 'employee_id',
        'module', v_zeile ->> 'module',
        'has_access', (v_zeile -> 'has_access')
      );
    ELSE
      v_meta := jsonb_build_object(
        'employee_id', v_zeile ->> 'employee_id',
        'group_id', v_zeile ->> 'group_id'
      );
    END IF;
  END IF;

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.data_access_log
      (user_id, owner_id, business_id, method, path, resource, resource_id, action, metadata)
    VALUES
      (auth.uid(), v_owner_id, v_business_id, 'DB', 'db://' || TG_TABLE_NAME,
       TG_TABLE_NAME, v_zeile ->> 'id', TG_OP, v_meta);
  END IF;

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Protokollierung darf eine Rechteänderung niemals blockieren (Muster 0021).
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.audit_rechte_log() IS
  $$0131 (Art. 32 DSGVO): Protokolliert Änderungen an Gruppenrechten, Einzelfreigaben und Standortzuordnungen in data_access_log.$$;

REVOKE ALL ON FUNCTION public.audit_rechte_log() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_rechte_log() FROM anon;
REVOKE ALL ON FUNCTION public.audit_rechte_log() FROM authenticated;

DROP TRIGGER IF EXISTS trg_audit_employee_scope_overrides ON public.employee_scope_overrides;
CREATE TRIGGER trg_audit_employee_scope_overrides
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_scope_overrides
  FOR EACH ROW EXECUTE FUNCTION public.audit_rechte_log();

DROP TRIGGER IF EXISTS trg_audit_group_scopes ON public.group_scopes;
CREATE TRIGGER trg_audit_group_scopes
  AFTER INSERT OR UPDATE OR DELETE ON public.group_scopes
  FOR EACH ROW EXECUTE FUNCTION public.audit_rechte_log();

DROP TRIGGER IF EXISTS trg_audit_employee_business_assignments ON public.employee_business_assignments;
CREATE TRIGGER trg_audit_employee_business_assignments
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_business_assignments
  FOR EACH ROW EXECUTE FUNCTION public.audit_rechte_log();

COMMIT;
