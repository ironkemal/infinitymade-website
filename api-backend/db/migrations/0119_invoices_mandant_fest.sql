-- 0119_invoices_mandant_fest.sql — Rechnung kann vom Browser nicht in einen anderen Mandanten verschoben werden.
--
-- WAS: neue Triggerfunktion public.invoices_mandant_fest() + Trigger trg_a_invoices_mandant_fest (BEFORE UPDATE).
--      Browser-Rollen (authenticated/anon) duerfen invoices.owner_id nicht aendern → 42501.
-- WARUM: Policy owner_and_employee_invoices (FOR ALL) prueft im WITH CHECK `auth.uid() = owner_id OR Team`. Eine
--      Mitarbeiterin kann daher `PATCH /rest/v1/invoices?id=eq.<id> {owner_id: <eigene id>, business_id: null}`
--      senden — die Zeile erfuellt danach `auth.uid() = owner_id`, verschwindet aus der Praxis (Inhaber sieht sie
--      nicht mehr) und liegt im "Mandanten" der Mitarbeiterin. Nachgewiesen durch
--      api-backend/db/tests/0081_security_boundaries.test.sql ("employee owner transfer plus NULL business",
--      rot seit 04.11.2026, fortschritte/2026-11-04.md). Kein legitimer Browser-Weg aendert owner_id
--      (dashboard.js Rechnung speichern schreibt getOwnerId() unveraendert, module/rechnung-zahlung.js nur Zahlung).
--      Muster 0066 (pruefe_prescriptions_clientrechte: owner_id fuer Browser unveraenderlich). Eigene Funktion statt
--      Eingriff in invoice_festschreibung (GoBD-Logik bleibt unberuehrt; guvenlik S-50 ist ein eigenes Thema).
-- Backend (service_role/postgres) bleibt frei. Expand-only (K4): kein Spalten-/Policy-Wechsel, :stable unberuehrt.
-- ZAEHLER: fonksiyon +1, trigger +1, sonst +0.
-- SaaS: angewandt 10.11.2026, Supabase Management-API (Melih-Auftrag „alle Probleme beheben“ 10.11., BEGIN/COMMIT, Ledger 20261110164855;
--      vorher 0 Rechnungen mit Mitarbeiter-owner_id; live geprueft: Trigger da, kein EXECUTE fuer anon/authenticated, Mitarbeiter-Umschreiben
--      → 42501, normales Mitarbeiter-UPDATE geht durch — beides in zurueckgerollter Transaktion).

CREATE OR REPLACE FUNCTION public.invoices_mandant_fest()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'invoices: Rechnung kann nicht in eine andere Praxis verschoben werden' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.invoices_mandant_fest() IS
  $$0119: Browser-Rollen duerfen invoices.owner_id nicht aendern (Mandantenwechsel). Test: db/tests/0081_security_boundaries.test.sql.$$;
REVOKE ALL ON FUNCTION public.invoices_mandant_fest() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoices_mandant_fest() FROM anon;
REVOKE ALL ON FUNCTION public.invoices_mandant_fest() FROM authenticated;

CREATE TRIGGER trg_a_invoices_mandant_fest BEFORE UPDATE OF owner_id ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_mandant_fest();
