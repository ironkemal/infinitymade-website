-- Migration 0075_rechnung_aussteller_empfaenger_snapshot.sql
-- SaaS: angewandt 09.10.2026 (MCP: 20261009194407, Freigabe Kemal; geprüft: 2 Spalten da, prosecdef=false,
-- Snapshot-Änderung an festgeschriebener Rechnung → check_violation, in zurückgerollter Transaktion).
-- Rechnungs-Snapshot Aussteller/Empfänger, Entscheidung (a) Kemal 09.10.2026.
-- Rechtsgrundlage: compliance/LEGAL_DECISIONS.md letzter Block (legal-de + gkv-302, 09.10.2026):
-- § 147 Abs. 2 Nr. 1 AO „bildlich übereinstimmend", § 14 Abs. 4 Nr. 1 UStG (Name/Anschrift beider Seiten).
-- Entwurf db-ustasi (KUTU_HAZIRLIK_SPRINT.md §4, „Hat K → Hat M notu 09.10 akşam").
--
-- Problem: Bisher froren nur steuernummer_snapshot/ust_id_snapshot ein. Name, Anschrift, IK, Bank der
-- Praxis und Name/Anschrift des Empfängers (Patient bzw. UV-Träger) wurden zur Druckzeit LIVE gelesen —
-- nach Umzug, Namenskorrektur oder DSGVO-Anonymisierung druckt dieselbe Rechnung anders.
--
-- (1) Zwei jsonb-Spalten. Der Browser schreibt sie bei JEDEM Entwurfsspeichern (saveInvoice), nur die
--     gedruckten Felder (Art. 5 Abs. 1 lit. c DSGVO): kein Patienten-IBAN, keine Diagnose.
-- (2) invoice_festschreibung() sperrt ab status ≠ draft zusätzlich: beide Snapshots, eigenanteil_pct/_eur,
--     kassenzuzahlung (bisher nur über total_patient mittelbar), und die Rechnungsnummer
--     (invoice_number/rechnung_nr) — Letztere nur, wenn OLD schon eine hat: bei einer Altrechnung ohne Nummer
--     darf eine fehlende Nummer einmalig gesetzt werden (set_invoice_nummer übernimmt im UPDATE nur den
--     übergebenen Wert). Trigger-Reihenfolge: trg_invoice_festschreibung läuft vor trg_invoice_nummer — eine
--     Nummernänderung an festgeschriebener Rechnung wird jetzt abgewiesen statt still zurückgesetzt (db-ustasi
--     09.10.: kein Schreibweg sendet heute eine Nummer im UPDATE).
--     Bewusst SECURITY INVOKER (wie bisher). Kein neuer Trigger, keine neue Funktion.
-- (3) Pflicht (Snapshot NULL → Verlassen von draft verweigert) kommt erst mit einem echten „Ausstellen"-
--     Schritt als 0076 — heute sind Altrechnungen ohne Snapshot legitim (Anzeige: „Altbeleg ohne Snapshot").
--
-- Zähler: COUNTER-NEUTRAL (2 Spalten + CREATE OR REPLACE einer bestehenden Funktion + COMMENTs).
-- DSGVO: invoices ist schon in api-backend/dsgvo/klassifikation.js (Aufbewahrung); loeschen.js schreibt
-- invoices nicht — der Snapshot bleibt über die Aufbewahrungsfrist bestehen, wie gesetzlich verlangt.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS aussteller_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS empfaenger_snapshot jsonb;

COMMENT ON COLUMN public.invoices.aussteller_snapshot IS
  'Praxis (Aussteller) wie gedruckt, eingefroren beim Entwurfsspeichern: name, inhaber, strasse, plzOrt, telefon, email, ik, bank{name,iban,bic}. Ab status<>draft gesperrt (invoice_festschreibung, 0075). § 147 Abs. 2 Nr. 1 AO, § 14 Abs. 4 Nr. 1 UStG.';
COMMENT ON COLUMN public.invoices.empfaenger_snapshot IS
  'Rechnungsempfänger wie gedruckt (Patient: name, strasse, plzOrt, geburtsdatum, krankenkasse, versichertennummer; BG: art=bg, empfaenger[], bezug[]). Kein IBAN, keine Diagnose. Ab status<>draft gesperrt (0075).';

CREATE OR REPLACE FUNCTION public.invoice_festschreibung()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' AND current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'Festgeschriebene Rechnung % kann nicht geloescht werden. Bitte stornieren.', OLD.invoice_number
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'draft' THEN
    RAISE EXCEPTION 'Festgeschriebene Rechnung % kann nicht auf Entwurf zurueckgesetzt werden. Bitte stornieren und neu ausstellen.', OLD.invoice_number
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.line_items    IS DISTINCT FROM OLD.line_items
  OR NEW.subtotal      IS DISTINCT FROM OLD.subtotal
  OR NEW.total_patient IS DISTINCT FROM OLD.total_patient
  OR NEW.netto_gesamt  IS DISTINCT FROM OLD.netto_gesamt
  OR NEW.steuer_gesamt IS DISTINCT FROM OLD.steuer_gesamt
  OR NEW.brutto_gesamt IS DISTINCT FROM OLD.brutto_gesamt
  OR NEW.tax_summary   IS DISTINCT FROM OLD.tax_summary
  OR NEW.patient_id    IS DISTINCT FROM OLD.patient_id
  OR NEW.issued_at     IS DISTINCT FROM OLD.issued_at
  OR NEW.steuerhinweis_text IS DISTINCT FROM OLD.steuerhinweis_text
  OR NEW.steuernummer_snapshot IS DISTINCT FROM OLD.steuernummer_snapshot
  OR NEW.ust_id_snapshot       IS DISTINCT FROM OLD.ust_id_snapshot
  OR NEW.steuer_status         IS DISTINCT FROM OLD.steuer_status
  OR NEW.leistung_von          IS DISTINCT FROM OLD.leistung_von
  OR NEW.leistung_bis          IS DISTINCT FROM OLD.leistung_bis
  OR NEW.patient_name          IS DISTINCT FROM OLD.patient_name
  OR NEW.invoice_type          IS DISTINCT FROM OLD.invoice_type
  -- 0075: Aussteller/Empfänger wie gedruckt + Eigenanteil/Kassenzuzahlung direkt
  OR NEW.aussteller_snapshot   IS DISTINCT FROM OLD.aussteller_snapshot
  OR NEW.empfaenger_snapshot   IS DISTINCT FROM OLD.empfaenger_snapshot
  OR NEW.eigenanteil_pct       IS DISTINCT FROM OLD.eigenanteil_pct
  OR NEW.eigenanteil_eur       IS DISTINCT FROM OLD.eigenanteil_eur
  OR NEW.kassenzuzahlung       IS DISTINCT FROM OLD.kassenzuzahlung
  -- 0075: Nummer nur, wenn schon vergeben (eine fehlende Nummer darf einmalig gesetzt werden)
  OR (OLD.invoice_number IS NOT NULL AND NEW.invoice_number IS DISTINCT FROM OLD.invoice_number)
  OR (OLD.rechnung_nr    IS NOT NULL AND NEW.rechnung_nr    IS DISTINCT FROM OLD.rechnung_nr)
  THEN
    RAISE EXCEPTION 'Festgeschriebene Rechnung % kann inhaltlich nicht geaendert werden. Bitte stornieren und neu ausstellen.', OLD.invoice_number
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;
