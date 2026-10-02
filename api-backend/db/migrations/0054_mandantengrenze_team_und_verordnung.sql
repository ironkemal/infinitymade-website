-- Mandantengrenze: employee_services, time_offs (guvenlik S-07) und
-- prescriptions ↔ Patient/Arzt (guvenlik S-18).
--
-- VORAUSSETZUNG: 0053 (S-39). Die neuen Policies lesen den Mandanten über
--   auth_tenant_id() = COALESCE(profiles.owner_id, id); solange jeder seine
--   eigene owner_id umschreiben konnte, wären sie umgehbar gewesen (guvenlik
--   02.10.2026: „nach S-39 oder in derselben Migration").
--
-- S-07 — WARUM: beide Tabellen hatten „Authenticated operations" [ALL] mit
--   auth.role() = 'authenticated': jede angemeldete Person jeder Praxis durfte
--   fremde Zeilen lesen, ändern, löschen.
--   * employee_services hat KEINE owner_id (employee_id, service_id,
--     business_id). Schreiben/Lesen nur, wenn der Mitarbeiter UND die Leistung
--     zum eigenen Mandanten gehören. services.user_id ist in 69 Zeilen NULL →
--     COALESCE(owner_id, user_id) (db-ustasi 02.10.). „Public read" bleibt:
--     booking.js:170 liest anonym für die Online-Buchung.
--   * time_offs: owner_id ist nullable (2 SaaS-Seed-Zeilen NULL vom 08.06.2026 —
--     im SaaS per MCP gelöscht, K-14; NICHT in dieser Datei, damit die Kette in
--     einer Box keine Daten löscht. Alle Schreiber setzen owner_id).
--     Prüfung über employee_id, zusätzlich darf eine gesetzte owner_id nicht
--     fremd sein. „Public read time offs" ENTFÄLLT: niemand liest anonym
--     (server.js:931/1756 mit service_role; Dashboard/Kalender angemeldet), und
--     reason/note können Gesundheitsangaben einer Mitarbeiterin enthalten.
--   Schreibrecht bleibt wie bisher beim ganzen Team des Mandanten (keine
--   Verhaltensänderung innerhalb der Praxis).
--   Live 02.10.: employee_services 126 Zeilen, 0 verletzen die neue Regel;
--   time_offs 1 gesetzte Zeile, korrekt.
--
-- S-18 — WARUM: der prescriptions-Schreibweg prüfte nirgends, ob patient_id
--   (→ leads) und arzt_id (→ aerzte) demselben Mandanten gehören wie owner_id.
--   Trigger statt Policy, damit auch service_role-Wege (Backend: Rezept-Scan,
--   Speichern) erfasst sind; SECURITY DEFINER, damit die Prüfung nicht an der
--   RLS des Aufrufers hängt. NULL bleibt erlaubt (2 Live-Zeilen ohne Patient).
--   Live 02.10.: 75 Zeilen, 0 Verstöße. Kollidiert nicht mit
--   prescriptions_festschreibung (sperrt owner_id/kostentraeger_ik nach
--   Belegnummer — andere Frage).
--
-- SaaS: angewandt 02.10.2026, MCP.
-- ZAEHLER: rls_policy −1 (employee_services: 1 weg, 1 neu; time_offs: 2 weg,
--   1 neu), fonksiyon +1, trigger +1.

-- ── S-07 · employee_services ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated operations employee services" ON public.employee_services;
DROP POLICY IF EXISTS employee_services_mandant ON public.employee_services;
CREATE POLICY employee_services_mandant ON public.employee_services
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles e
             WHERE e.id = employee_services.employee_id
               AND COALESCE(e.owner_id, e.id) = public.auth_tenant_id())
    AND EXISTS (SELECT 1 FROM public.services s
                 WHERE s.id = employee_services.service_id
                   AND COALESCE(s.owner_id, s.user_id) = public.auth_tenant_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles e
             WHERE e.id = employee_services.employee_id
               AND COALESCE(e.owner_id, e.id) = public.auth_tenant_id())
    AND EXISTS (SELECT 1 FROM public.services s
                 WHERE s.id = employee_services.service_id
                   AND COALESCE(s.owner_id, s.user_id) = public.auth_tenant_id())
  );

-- ── S-07 · time_offs ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated operations time offs" ON public.time_offs;
DROP POLICY IF EXISTS "Public read time offs" ON public.time_offs;
DROP POLICY IF EXISTS time_offs_mandant ON public.time_offs;
CREATE POLICY time_offs_mandant ON public.time_offs
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles e
             WHERE e.id = time_offs.employee_id
               AND COALESCE(e.owner_id, e.id) = public.auth_tenant_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles e
             WHERE e.id = time_offs.employee_id
               AND COALESCE(e.owner_id, e.id) = public.auth_tenant_id())
    AND (owner_id IS NULL OR owner_id = public.auth_tenant_id())
  );

-- ── S-18 · prescriptions ↔ Patient/Arzt desselben Mandanten ──────────────
CREATE OR REPLACE FUNCTION public.prescriptions_mandant_pruefen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.patient_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.leads l
        WHERE l.id = NEW.patient_id AND l.owner_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'Patient gehört nicht zu dieser Praxis.' USING ERRCODE = '42501';
  END IF;
  IF NEW.arzt_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.aerzte a
        WHERE a.id = NEW.arzt_id AND a.owner_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'Arzt gehört nicht zu dieser Praxis.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prescriptions_mandant_pruefen() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prescriptions_mandant_pruefen() FROM anon;
REVOKE ALL ON FUNCTION public.prescriptions_mandant_pruefen() FROM authenticated;

DROP TRIGGER IF EXISTS prescriptions_mandant_pruefen ON public.prescriptions;
CREATE TRIGGER prescriptions_mandant_pruefen
  BEFORE INSERT OR UPDATE OF owner_id, patient_id, arzt_id ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.prescriptions_mandant_pruefen();
