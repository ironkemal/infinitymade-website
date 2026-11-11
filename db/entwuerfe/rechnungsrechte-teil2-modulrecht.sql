-- ENTWURF rechnungsrechte-teil2-modulrecht.sql — NICHT angewandt, NICHT GO-REIF (Stand 10.11.2026).
-- Voraussetzung: Teil 1 (rechnungsrechte-teil1.sql) ist angewandt; dieser Teil ersetzt dessen drei Policies durch die Modulrecht-Fassung.
--
-- WAS: Mitarbeiter sehen/ändern Rechnungen (invoices) und das Zahlungsjournal (rechnung_zahlungen) nur noch, wenn sie für die Praxis der
--      Rechnung das Modul 'abrechnung' haben (employee_scope_overrides vor group_scopes über employee_business_assignments — dieselbe Logik
--      wie get_my_permissions) UND aktiv sind. Neu: Funktion abrechnungszugriff_erlaubt(p_user, p_business) (INVOKER, STABLE, search_path
--      gepinnt, kein EXECUTE für anon). Rechnungen ohne business_id sind für Mitarbeiter gesperrt; ein Verschieben auf NULL/fremde Praxis
--      scheitert am WITH CHECK.
-- WARUM: api-backend/db/tests/0081_security_boundaries.test.sql (Soll-Verhalten). Heute zeigt die Oberfläche das Rechnungen-Panel jedem
--      Mitarbeiter (nav-registry roles ['owner','employee'], 'rechnungen' fehlt in SIDEBAR_TO_MODULE), die Datenbank schützt nur nach Mandant.
--
-- ⛔ NICHT LIVE, BEVOR DIE PRODUKTFRAGE ENTSCHIEDEN IST (Vorprüfung db-ustasi/guvenlik 10.11.2026):
--    Live hat KEIN Mitarbeiter das Recht 'abrechnung' (Schlüssel steht weder in group_scopes noch in employee_scope_overrides; 11 Mitarbeiter,
--    10 mit Zuordnung ohne Recht, 1 ohne Zuordnung, 4 von 13 Zuordnungen ohne group_id). Mit diesem Teil verlieren ALLE Mitarbeiter sofort den
--    Zugriff, und die Abfragen liefern STILL LEERE Ergebnisse (kein Fehler) in: Rechnungen-Panel (dashboard.js ~12605/12822/12823), Zuzahlung
--    kassieren (dashboard.js ~6037 → module/rechnung-zahlung.js), Patientenakte (~7553), Übersicht (~1481), Rezeptinfo-Geldzeile
--    (module/rezeptinfo-geld.js), Verordnungsmaske (module/verordnung-maske.js ~333: hielte eine abgerechnete Verordnung für offen),
--    module/selbstzahler-stufen.js, module/rechnung-zur-verordnung.js. Entscheidung (Melih/Kemal) VOR dem GO:
--      A) Mitarbeiter sollen Rechnungen weiter sehen/schreiben dürfen → Altbestand freigeben (siehe Block „Option A“ unten) und das Recht
--         in der Teamverwaltung pflegen. 'rechnungen' → 'abrechnung' in SIDEBAR_TO_MODULE aufnehmen (dashboard.js, Zeilenzahl ±0).
--      B) Rechnungen sind Inhaber-Sache → 'rechnungen' in nav-registry auf roles ['owner'] setzen, die oben genannten Mitarbeiter-Stellen
--         auf Inhaber-Sicht prüfen (Verordnungsmaske braucht eine andere Quelle für „schon abgerechnet").
--    Dieser Entwurf ist bis dahin nur lokal bewiesen (Wegwerf-DB, 0081_security_boundaries grün).
-- Expand-only (K4) technisch ja; fachlich ein Verhaltenswechsel für :stable-Frontends → Frontend-Anpassung MUSS vorher ausgerollt sein.
-- ZAEHLER: fonksiyon +1, rls_policy +0 (3 Policies ersetzt), trigger +0.

CREATE OR REPLACE FUNCTION public.abrechnungszugriff_erlaubt(p_user uuid, p_business uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  -- Nur für den Aufrufer selbst: ein fremdes p_user liefert immer false (Klasse S-01: Argument statt Aufrufer auswerten).
  SELECT p_user IS NOT NULL AND p_business IS NOT NULL
     AND p_user = (SELECT auth.uid())
     AND EXISTS (
       SELECT 1
         FROM public.profiles p
         JOIN public.businesses b ON b.id = p_business AND b.owner_id = p.owner_id
        WHERE p.id = p_user
          AND p.is_active IS TRUE
          AND COALESCE(
                -- Einzelfreigabe schlägt Gruppe (wie get_my_permissions); bei Doppelzeilen entscheidet die strengere
                (SELECT bool_and(o.has_access) FROM public.employee_scope_overrides o
                  WHERE o.employee_id = p_user AND o.business_id = p_business AND o.module = 'abrechnung'),
                (SELECT bool_or(gs.has_access)
                   FROM public.employee_business_assignments eba
                   JOIN public.group_scopes gs ON gs.group_id = eba.group_id
                  WHERE eba.employee_id = p_user AND eba.business_id = p_business AND gs.module = 'abrechnung'),
                false)
     );
$$;
COMMENT ON FUNCTION public.abrechnungszugriff_erlaubt(uuid, uuid) IS
  $$Teil 2 Rechnungsrechte: Modul 'abrechnung' für die Praxis, nur für den Aufrufer selbst, nur aktive Mitarbeiter derselben Praxis. Spiegel von get_my_permissions.$$;
REVOKE ALL ON FUNCTION public.abrechnungszugriff_erlaubt(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.abrechnungszugriff_erlaubt(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.abrechnungszugriff_erlaubt(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS owner_and_employee_invoices ON public.invoices;
CREATE POLICY owner_and_employee_invoices ON public.invoices
  FOR ALL
  USING (
    auth.uid() = owner_id
    OR (business_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.owner_id = invoices.owner_id)
        AND public.abrechnungszugriff_erlaubt(auth.uid(), business_id))
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR (business_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.owner_id = invoices.owner_id)
        AND public.abrechnungszugriff_erlaubt(auth.uid(), business_id))
  );

-- rechnung_zahlungen hat keine business_id → Praxis über die Rechnung. Der Browser liest/schreibt das Journal heute nirgends direkt
-- (nur api-backend/billing/api/rechnung-zahlung.routes.js mit get_my_permissions), die Policies bleiben als Netz.
DROP POLICY IF EXISTS "Rechnungszahlungen select scoping" ON public.rechnung_zahlungen;
CREATE POLICY "Rechnungszahlungen select scoping" ON public.rechnung_zahlungen
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.invoices i
                WHERE i.id = rechnung_zahlungen.invoice_id AND i.owner_id = rechnung_zahlungen.owner_id
                  AND i.business_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.owner_id = i.owner_id)
                  AND public.abrechnungszugriff_erlaubt(auth.uid(), i.business_id))
  );

DROP POLICY IF EXISTS "Rechnungszahlungen insert scoping" ON public.rechnung_zahlungen;
CREATE POLICY "Rechnungszahlungen insert scoping" ON public.rechnung_zahlungen
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.invoices i
                WHERE i.id = rechnung_zahlungen.invoice_id AND i.owner_id = rechnung_zahlungen.owner_id
                  AND i.business_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.owner_id = i.owner_id)
                  AND public.abrechnungszugriff_erlaubt(auth.uid(), i.business_id))
  );

-- ── Option A: Altbestand freigeben (nur wenn Entscheidung A) ────────────────────────────────────────────────────────────────
-- Erhält das heutige Verhalten: jede bestehende Gruppe mit Zuordnung bekommt 'abrechnung' = true, sofern noch keine Zeile existiert.
-- Danach pflegt der Inhaber das Recht in der Teamverwaltung. NICHT automatisch ausführen; auszuführen als eigener, bewusster Schritt.
-- INSERT INTO public.group_scopes (group_id, module, has_access)
-- SELECT g.id, 'abrechnung', true FROM public.employee_groups g
--  WHERE NOT EXISTS (SELECT 1 FROM public.group_scopes s WHERE s.group_id = g.id AND s.module = 'abrechnung');
-- Zuordnungen ohne group_id (live 4) bekämen dadurch KEIN Recht: vorher eine Gruppe zuweisen oder je Mitarbeiter eine Einzelfreigabe
-- (employee_scope_overrides) setzen.
