-- 0121_rechnungen_modulrecht.sql — Rechnungsrechte Teil 2: Modulrecht 'abrechnung' für Rechnungen und Zahlungsjournal
-- (aus db/entwuerfe/rechnungsrechte-teil2-modulrecht.sql; Melih-Entscheid Option A am 11.11.2026: Mitarbeiter behalten den Zugriff).
--
-- WAS: (1) Altbestand freigeben: jede bestehende Gruppe ohne 'abrechnung'-Zeile bekommt has_access = true; jede Zuordnung OHNE Gruppe
--          bekommt eine Einzelfreigabe (employee_scope_overrides). Bestehende Zeilen (auch ausdrückliche Verweigerungen) bleiben unberührt.
--          Ergebnis: heute berechtigte Mitarbeiter verlieren nichts; der Inhaber kann das Recht danach je Gruppe/Mitarbeiter entziehen
--          (Teamverwaltung, RBAC_MODULES enthält 'abrechnung').
--      (2) Funktion abrechnungszugriff_erlaubt(p_user, p_business) (INVOKER, STABLE, search_path gepinnt, kein EXECUTE für anon): Modul
--          'abrechnung' wie get_my_permissions (Einzelfreigabe vor Gruppe), nur für den Aufrufer selbst, nur aktive Mitarbeiter derselben Praxis.
--      (3) Policies ersetzen die Fassung aus 0120: invoices und rechnung_zahlungen nur noch für den Inhaber ODER für Mitarbeiter mit dem Recht
--          für die Praxis der Rechnung. Rechnungen ohne business_id sind für Mitarbeiter gesperrt (live 0 von 48), ein Verschieben auf NULL oder
--          eine fremde Praxis scheitert am WITH CHECK.
-- WARUM: api-backend/db/tests/0081_security_boundaries.test.sql (Soll-Verhalten, jetzt vollständig grün). Bis hier prüfte die Datenbank nur den
--      Mandanten; die Oberfläche versteckte das Panel nicht einmal (nav-registry roles ['owner','employee'], 'rechnungen' fehlte in
--      SIDEBAR_TO_MODULE — wird im selben Rollout ergänzt, dashboard.js ±0 Zeilen).
-- Reihenfolge ist bindend: Freigabe (1) und Policies (3) stehen in EINER Transaktion, damit heute berechtigte Mitarbeiter nie einen Moment ohne
--      Recht dastehen. Neue Gruppen (seed_default_groups_for_business) bekommen 'abrechnung' NICHT automatisch: für neue Praxen gilt Standard
--      „kein Zugriff auf Rechnungen“, der Inhaber vergibt das Recht (bewusst, Least Privilege bei Geld).
-- Vorprüfung: db-ustasi, guvenlik, fonksiyon-ustasi 10.11.2026 (Entwurf), onprem 11.11.2026 (Datenschritt). Live-Stand vorher: 11 Mitarbeiter,
--      13 Zuordnungen (4 ohne Gruppe), 36 Gruppen, 0 'abrechnung'-Zeilen.
-- Box: Datenschritt ist auf einer frischen Box ein No-op (keine Gruppen); bei einer laufenden Box mit Gruppen gilt dieselbe Freigabe wie im SaaS.
-- ZAEHLER: fonksiyon +1, trigger +0, rls_policy +0 (3 Policies ersetzt).
-- SaaS: angewandt 11.11.2026, Supabase Management-API (Melih GO über Option A, BEGIN/COMMIT, Ledger-Zeile). Katalog und zurückgerollte Proben danach geprüft.

-- ── (1) Altbestand freigeben ────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO public.group_scopes (group_id, module, has_access)
SELECT g.id, 'abrechnung', true
  FROM public.employee_groups g
 WHERE NOT EXISTS (SELECT 1 FROM public.group_scopes s WHERE s.group_id = g.id AND s.module = 'abrechnung');

INSERT INTO public.employee_scope_overrides (employee_id, business_id, module, has_access)
SELECT eba.employee_id, eba.business_id, 'abrechnung', true
  FROM public.employee_business_assignments eba
 WHERE eba.group_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.employee_scope_overrides o
                    WHERE o.employee_id = eba.employee_id AND o.business_id = eba.business_id AND o.module = 'abrechnung');

-- ── (2) Hilfsfunktion ───────────────────────────────────────────────────────────────────────────────────────────────────────
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
  $$0121: Modul 'abrechnung' für die Praxis, nur für den Aufrufer selbst, nur aktive Mitarbeiter derselben Praxis. Spiegel von get_my_permissions.$$;
REVOKE ALL ON FUNCTION public.abrechnungszugriff_erlaubt(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.abrechnungszugriff_erlaubt(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.abrechnungszugriff_erlaubt(uuid, uuid) TO authenticated;

-- ── (3) Policies ────────────────────────────────────────────────────────────────────────────────────────────────────────────
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
