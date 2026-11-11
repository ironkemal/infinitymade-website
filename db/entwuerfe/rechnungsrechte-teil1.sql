-- ENTWURF rechnungsrechte-teil1.sql — NICHT angewandt (Stand 10.11.2026). Wird zu api-backend/db/migrations/NNNN_rechnungsrechte_teil1.sql,
-- sobald Melih GO gibt; Nummer erst dann mit den parallelen Sitzungen abstimmen (0119 ist die höchste angewandte).
--
-- WAS: (1) Trigger rechnung_zahlung_storno_referenz_pruefen(): ein Storno im Zahlungsjournal hebt genau eine Zahlung DERSELBEN
--          Rechnung und DESSELBEN Mandanten auf (voller Betrag, nie ein Storno eines Storno).
--      (2) Trigger warteliste_referenzen_pruefen(): lead_id/service_id/matched_booking_id der Warteliste müssen zum Mandanten der
--          Zeile gehören (auch für service_role; nicht existierende IDs ebenfalls 23514).
--      (3) Inaktive Mitarbeiter (profiles.is_active nicht true) verlieren den Zugriff auf invoices und rechnung_zahlungen, auch mit
--          noch gültigem JWT.
-- WARUM: api-backend/db/tests/0081_security_boundaries.test.sql (rot seit 04.11.2026; 0119 hat den owner_id-Wechsel geschlossen).
--      (1)/(2): Fremdschlüssel prüfen ohne RLS, eine fremde ID wird also angenommen (Klasse guvenlik M16-2). (3): die Policy
--      owner_and_employee_invoices und die zwei rechnung_zahlungen-Policies kennen is_active nicht.
-- Vorprüfung 10.11.2026: db-ustasi (kein legitimer Browser-Weg betroffen; Backend schreibt in rechnung_zahlungen nur 'zahlung'/'ausbuchung',
--      nie 'storno'; live 0 Mitarbeiter mit is_active NULL, 0 Wartelisten-Zeilen mit fremder Referenz, 0 Rechnungen mit business_id NULL),
--      guvenlik (kein Veto, es wird verschärft), fonksiyon-ustasi (Vorlagen: belegliste_storno_pruefen 0084, patient_dokumente_mandant_pruefen 0093).
-- Bewusst NICHT hier: Modulrecht 'abrechnung' für Rechnungen → rechnungsrechte-teil2-modulrecht.sql (Produktentscheidung nötig).
-- Expand-only (K4): nur Trigger/Policies, kein Spaltenwechsel; :stable liest/ schreibt weiter wie bisher.
-- ZAEHLER: fonksiyon +2, trigger +2, rls_policy +0 (3 Policies ersetzt).

-- ── (1) Storno-Referenz ─────────────────────────────────────────────────────────────────────────────────────────────────────
-- Schon vorhanden und bleibt: CHECK storno_bezug (art='storno' ⇔ storniert_zeile_id), CHECK vorzeichen, UNIQUE
-- idx_rechnung_zahlungen_storno_einmalig (doppeltes Storno → 23505, absichtlich NICHT hier geprüft).
CREATE OR REPLACE FUNCTION public.rechnung_zahlung_storno_referenz_pruefen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE o public.rechnung_zahlungen%ROWTYPE;
BEGIN
  IF NEW.art IS DISTINCT FROM 'storno' OR NEW.storniert_zeile_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO o FROM public.rechnung_zahlungen WHERE id = NEW.storniert_zeile_id;
  IF NOT FOUND
     OR o.owner_id   IS DISTINCT FROM NEW.owner_id
     OR o.invoice_id IS DISTINCT FROM NEW.invoice_id
     OR o.art = 'storno'
     OR NEW.betrag_eur <> -o.betrag_eur THEN
    RAISE EXCEPTION 'rechnung_zahlungen: Ein Storno hebt genau eine Zahlung derselben Rechnung vollständig auf'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.rechnung_zahlung_storno_referenz_pruefen() IS
  $$Teil 1 Rechnungsrechte: Storno-Zeile muss auf Zahlung derselben Rechnung/Praxis zeigen, Betrag = -Original, kein Storno eines Storno.$$;
REVOKE ALL ON FUNCTION public.rechnung_zahlung_storno_referenz_pruefen() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rechnung_zahlung_storno_referenz_pruefen() FROM anon;
REVOKE ALL ON FUNCTION public.rechnung_zahlung_storno_referenz_pruefen() FROM authenticated;

DROP TRIGGER IF EXISTS trg_rechnung_zahlung_storno_referenz ON public.rechnung_zahlungen;
CREATE TRIGGER trg_rechnung_zahlung_storno_referenz BEFORE INSERT ON public.rechnung_zahlungen
  FOR EACH ROW EXECUTE FUNCTION public.rechnung_zahlung_storno_referenz_pruefen();

-- ── (2) Warteliste-Referenzen ───────────────────────────────────────────────────────────────────────────────────────────────
-- Nur bei INSERT und bei Änderung der drei Verweisspalten: ein Status-Update einer Altzeile bleibt unberührt, ON DELETE SET NULL
-- (Verweis → NULL) läuft durch. Legacy: services/bookings mit owner_id NULL gehören über user_id dem Inhaber.
CREATE OR REPLACE FUNCTION public.warteliste_referenzen_pruefen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.leads l WHERE l.id = NEW.lead_id AND l.owner_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'warteliste: Patient gehört nicht zu dieser Praxis' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.service_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.services s WHERE s.id = NEW.service_id
          AND (s.owner_id = NEW.owner_id OR (s.owner_id IS NULL AND s.user_id = NEW.owner_id))) THEN
    RAISE EXCEPTION 'warteliste: Leistung gehört nicht zu dieser Praxis' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.matched_booking_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.bookings b WHERE b.id = NEW.matched_booking_id
          AND (b.owner_id = NEW.owner_id OR (b.owner_id IS NULL AND b.user_id = NEW.owner_id))) THEN
    RAISE EXCEPTION 'warteliste: Termin gehört nicht zu dieser Praxis' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.warteliste_referenzen_pruefen() IS
  $$Teil 1 Rechnungsrechte: lead/service/booking der Warteliste müssen zum Mandanten der Zeile gehören (FK ignoriert RLS).$$;
REVOKE ALL ON FUNCTION public.warteliste_referenzen_pruefen() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.warteliste_referenzen_pruefen() FROM anon;
REVOKE ALL ON FUNCTION public.warteliste_referenzen_pruefen() FROM authenticated;

DROP TRIGGER IF EXISTS trg_warteliste_referenzen ON public.warteliste;
CREATE TRIGGER trg_warteliste_referenzen BEFORE INSERT OR UPDATE OF lead_id, service_id, matched_booking_id ON public.warteliste
  FOR EACH ROW EXECUTE FUNCTION public.warteliste_referenzen_pruefen();

-- ── (3) Inaktive Mitarbeiter ────────────────────────────────────────────────────────────────────────────────────────────────
-- Gleiche Policies wie bisher, nur der Team-Zweig verlangt zusätzlich ein aktives Profil. Streng (is_active IS TRUE): der Vorgabewert
-- der Spalte ist true, live 0 NULL-Werte bei Mitarbeitern (10.11.2026).
DROP POLICY IF EXISTS owner_and_employee_invoices ON public.invoices;
CREATE POLICY owner_and_employee_invoices ON public.invoices
  FOR ALL
  USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND p.owner_id = invoices.owner_id AND p.is_active IS TRUE)
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND p.owner_id = invoices.owner_id AND p.is_active IS TRUE)
  );

DROP POLICY IF EXISTS "Rechnungszahlungen select scoping" ON public.rechnung_zahlungen;
CREATE POLICY "Rechnungszahlungen select scoping" ON public.rechnung_zahlungen
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active IS TRUE)
  );

DROP POLICY IF EXISTS "Rechnungszahlungen insert scoping" ON public.rechnung_zahlungen;
CREATE POLICY "Rechnungszahlungen insert scoping" ON public.rechnung_zahlungen
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active IS TRUE)
  );
