-- Migration 0070_invoice_festschreibung_pflichtangaben.sql
-- SaaS: angewandt 06.10.2026 (MCP, live per Rollen-Rollback-Test geprueft: sieben Spalten gesperrt; Zahlung/Storno/notes frei).
-- KHS M2 (legal-de 06.10.2026, db-ustasi 05.10.2026): `invoice_festschreibung()` sperrte nach dem Ausstellen nur Betraege, Empfaenger-Id,
-- Datum und Steuerhinweis. Offen waren genau Pflichtangaben einer Rechnung: steuernummer_snapshot, ust_id_snapshot (§ 14 Abs. 4 Nr. 2 UStG),
-- steuer_status (Nr. 7/8; Wechsel steuerfrei -> 19 % nach Ausstellung = § 14c UStG), leistung_von/leistung_bis (Nr. 6), patient_name
-- (Nr. 1, Empfaenger) und invoice_type (Art des Belegs). Ein „Snapshot", den man nachtraeglich aendern kann, ist keiner (§ 146 Abs. 4 AO, GoBD).
-- Die sieben Spalten werden in dieselbe Sperre aufgenommen (ab status <> 'draft'); alle bisherigen Sperren bleiben. Status-Wechsel
-- (Storno/bezahlt), payment_*, storno_grund/-am, notes bleiben aenderbar. CREATE OR REPLACE einer bestehenden Funktion -> Zaehler unveraendert.
-- Ausserdem: prescriptions.bg_einverstaendnis_version — WELCHEM Text zugestimmt wurde (legal-de: Nachweis wie bei patient_consents).

CREATE OR REPLACE FUNCTION public.invoice_festschreibung()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'draft' THEN
    RETURN NEW;
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
  THEN
    RAISE EXCEPTION 'Festgeschriebene Rechnung % kann inhaltlich nicht geaendert werden. Bitte stornieren und neu ausstellen.', OLD.invoice_number
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS bg_einverstaendnis_version text;
ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_bg_einverstaendnis_version_check CHECK (bg_einverstaendnis_version IS NULL OR char_length(bg_einverstaendnis_version) <= 60);
COMMENT ON COLUMN public.prescriptions.bg_einverstaendnis_version IS 'Version des Einverstaendnis-Wortlauts (module/bg-angaben.js EINVERSTAENDNIS_VERSION), dem zugestimmt wurde. Gehoert zu bg_einverstaendnis_am.';
