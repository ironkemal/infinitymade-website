-- SaaS: angewandt 23.11.2026 (20261123151007, Backfill 1 Mitarbeiter). Lokal versioniert und geprüft.
-- O-251 (Testbox 22.11.2026): Mitarbeiter ohne Standort-Zuordnung können sich nicht anmelden
-- (dashboard.js loadModulePermissions braucht currentBusiness = employee_business_assignments).
-- Die Box-Einrichtung legt den ersten Standort seit e482d9fa selbst an (setup/standard-standort.js).
-- Diese Migration schließt die umgekehrte Reihenfolge und den Altbestand:
--
-- 1. seed_default_groups_for_business() (AFTER INSERT ON businesses, trg_seed_default_groups) ordnet
--    nach dem Anlegen der Gruppe „Mitarbeiter" alle aktiven Mitarbeiter des Inhabers zu, die noch
--    KEINEN Standort haben. Bewusst in derselben Funktion statt eines zweiten Triggers: Postgres feuert
--    gleichartige Trigger alphabetisch, ein eigener Trigger müsste nach trg_seed_default_groups sortieren,
--    sonst wäre die Gruppe noch nicht da (group_id NULL). Wer schon zugeordnet ist, wird nicht angefasst
--    (zweiter Standort ≠ automatisch alle Mitarbeiter).
--    Invoker-Modell wie bisher (kein SECURITY DEFINER, db-ustasi 22.11.): im Browser legt der Inhaber
--    den Standort an und erfüllt eba_write_owner_only; Server/Einrichtung laufen mit service_role.
--    Kein UPDATE auf profiles (physio_v1_tenant_guard sperrt profiles mit NOWAIT).
-- 2. Backfill: dieselbe Regel für Bestandsdaten — unzugeordnete aktive Mitarbeiter → Standard-Standort
--    ihres Inhabers (uniq_businesses_default_per_owner: höchstens einer), Gruppe „Mitarbeiter".
--    Idempotent über ON CONFLICT. Gezählt 22.11.2026 (read-only, SaaS): 1 Mitarbeiter betroffen.
--
-- Ehemalige: „Entfernen" setzt is_active=false UND mitarbeiter_anstellung.austritt_am; beide schließen aus.
-- Rückweg: neue Migration mit dem alten Funktionskörper (0000_baseline.sql). Die Backfill-Zeilen
-- bleiben stehen — sie entsprechen genau dem bisherigen Handweg „Berechtigungen speichern".
-- ZAEHLER: unveraendert (CREATE OR REPLACE einer bestehenden Funktion + Daten-INSERT, public)

CREATE OR REPLACE FUNCTION public.seed_default_groups_for_business()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mit_id UUID;
  v_sek_id UUID;
  modules_mit TEXT[] := ARRAY['dashboard','calendar','customers','services','hours','notes','anamnese','prescriptions','team'];
  modules_sek TEXT[] := ARRAY['dashboard','calendar','customers','services','hours','b2c','team'];
  m TEXT;
BEGIN
  INSERT INTO public.employee_groups (business_id, name, is_default)
  VALUES (NEW.id, 'Mitarbeiter', TRUE)
  ON CONFLICT (business_id, name) DO NOTHING
  RETURNING id INTO v_mit_id;
  IF v_mit_id IS NULL THEN
    SELECT id INTO v_mit_id FROM public.employee_groups WHERE business_id = NEW.id AND name = 'Mitarbeiter';
  END IF;
  FOREACH m IN ARRAY modules_mit LOOP
    INSERT INTO public.group_scopes (group_id, module, has_access)
    VALUES (v_mit_id, m, TRUE)
    ON CONFLICT (group_id, module) DO NOTHING;
  END LOOP;

  INSERT INTO public.employee_groups (business_id, name, is_default)
  VALUES (NEW.id, 'Sekreter', TRUE)
  ON CONFLICT (business_id, name) DO NOTHING
  RETURNING id INTO v_sek_id;
  IF v_sek_id IS NULL THEN
    SELECT id INTO v_sek_id FROM public.employee_groups WHERE business_id = NEW.id AND name = 'Sekreter';
  END IF;
  FOREACH m IN ARRAY modules_sek LOOP
    INSERT INTO public.group_scopes (group_id, module, has_access)
    VALUES (v_sek_id, m, TRUE)
    ON CONFLICT (group_id, module) DO NOTHING;
  END LOOP;

  -- O-251 (0130): Mitarbeiter, die vor dem ersten Standort angelegt wurden, diesem Standort zuordnen.
  INSERT INTO public.employee_business_assignments (employee_id, business_id, group_id)
  SELECT p.id, NEW.id, v_mit_id
    FROM public.profiles p
   WHERE p.owner_id = NEW.owner_id
     AND p.role = 'employee'
     AND p.is_active IS DISTINCT FROM false
     AND NOT EXISTS (SELECT 1 FROM public.employee_business_assignments e WHERE e.employee_id = p.id)
     AND NOT EXISTS (SELECT 1 FROM public.mitarbeiter_anstellung a
                      WHERE a.employee_id = p.id AND a.austritt_am IS NOT NULL AND a.austritt_am <= current_date)
  ON CONFLICT (employee_id, business_id) DO NOTHING;

  RETURN NEW;
END $function$;

-- Backfill Altbestand (O-251).
INSERT INTO public.employee_business_assignments (employee_id, business_id, group_id)
SELECT p.id, b.id, g.id
  FROM public.profiles p
  JOIN public.businesses b ON b.owner_id = p.owner_id AND b.is_default = true
  LEFT JOIN public.employee_groups g ON g.business_id = b.id AND g.name = 'Mitarbeiter'
 WHERE p.role = 'employee'
   AND p.is_active IS DISTINCT FROM false
   AND NOT EXISTS (SELECT 1 FROM public.employee_business_assignments e WHERE e.employee_id = p.id)
   AND NOT EXISTS (SELECT 1 FROM public.mitarbeiter_anstellung a
                    WHERE a.employee_id = p.id AND a.austritt_am IS NOT NULL AND a.austritt_am <= current_date)
ON CONFLICT (employee_id, business_id) DO NOTHING;
