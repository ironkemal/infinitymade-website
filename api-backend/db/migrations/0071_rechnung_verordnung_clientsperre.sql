-- Migration 0071_rechnung_verordnung_clientsperre.sql
-- SaaS: angewandt 06.10.2026 (MCP; live per Rollen-Rollback-Test: Rueckgesetzt-auf-draft 23514, DELETE sent 42501, bg_*/rezeptart als authenticated 42501, Zahlung/normale Felder/Backend frei).
-- KHS M2, guvenlik S-50/S-51 (06.10.2026). Zwei Luecken, die die Sperren aus 0066/0070 umgehbar machten:
--  (1) invoices: `invoice_festschreibung()` gab bei OLD.status='draft' alles frei und pruefte `status` selbst nicht — ein Browser-PATCH
--      {status:'draft'} setzte eine AUSGESTELLTE Rechnung zurueck, danach waren alle Pflichtangaben frei aenderbar (GoBD/§ 14c UStG).
--      Und DELETE war fuer das ganze Team frei (Nummernluecke). Jetzt: kein Zurueck auf 'draft' (alle Rollen); DELETE einer nicht-Entwurf-Rechnung
--      fuer die Browser-Rollen verboten (Kaskaden/Backend laufen als Tabellenowner und bleiben moeglich — wie 0066).
--      Der bestehende Trigger wird ersetzt (BEFORE UPDATE OR DELETE), nicht ergaenzt -> Zaehler unveraendert.
--  (2) prescriptions: `rezeptart` und die BG-Angaben `bg_*` (Rechnungsempfaenger!) konnte jedes Teammitglied direkt per PostgREST
--      aendern und damit die 409-Sperre des Backends (PATCH /rezept/:id) umgehen. Die Maske schreibt sie ausschliesslich ueber das
--      Backend -> fuer authenticated/anon unveraenderlich (Muster 0066). CREATE OR REPLACE der bestehenden Funktion.

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
  THEN
    RAISE EXCEPTION 'Festgeschriebene Rechnung % kann inhaltlich nicht geaendert werden. Bitte stornieren und neu ausstellen.', OLD.invoice_number
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_invoice_festschreibung ON public.invoices;
CREATE TRIGGER trg_invoice_festschreibung BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoice_festschreibung();

CREATE OR REPLACE FUNCTION public.pruefe_prescriptions_clientrechte()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_browser boolean := current_user IN ('authenticated', 'anon');
  v_alt_gesperrt boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.abrechnung_id IS NOT NULL OR OLD.belegnummer IS NOT NULL
       OR (OLD.abrechnung_status IS NOT NULL AND OLD.abrechnung_status <> 'bereit') THEN
      RAISE EXCEPTION 'prescriptions: abgerechnete Verordnungen koennen nicht geloescht werden (GoBD)' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF NOT v_browser THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.abrechnung_id IS NOT NULL OR NEW.belegnummer IS NOT NULL OR NEW.absetzung_betrag IS NOT NULL
       OR NEW.absetzung_grund IS NOT NULL OR NEW.absetzung_am IS NOT NULL OR NEW.storno_grund IS NOT NULL
       OR NEW.storno_am IS NOT NULL OR NEW.zuzahlung_kassiert_eur IS NOT NULL
       OR NEW.status = 'billed'
       OR (NEW.abrechnung_status IS NOT NULL AND NEW.abrechnung_status <> 'bereit')
       OR NEW.bg_traeger_name IS NOT NULL OR NEW.bg_traeger_anschrift IS NOT NULL OR NEW.bg_unfalltag IS NOT NULL
       OR NEW.bg_aktenzeichen IS NOT NULL OR NEW.bg_kostenzusage_datum IS NOT NULL OR NEW.bg_kostenzusage_zeichen IS NOT NULL
       OR NEW.bg_einverstaendnis_am IS NOT NULL OR NEW.bg_einverstaendnis_version IS NOT NULL THEN
      RAISE EXCEPTION 'prescriptions: Abrechnungs- und BG-Felder nur ueber das Backend' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE durch den Browser
  IF NEW.abrechnung_id IS DISTINCT FROM OLD.abrechnung_id
     OR NEW.belegnummer IS DISTINCT FROM OLD.belegnummer
     OR NEW.absetzung_betrag IS DISTINCT FROM OLD.absetzung_betrag
     OR NEW.absetzung_grund IS DISTINCT FROM OLD.absetzung_grund
     OR NEW.absetzung_am IS DISTINCT FROM OLD.absetzung_am
     OR NEW.storno_grund IS DISTINCT FROM OLD.storno_grund
     OR NEW.storno_am IS DISTINCT FROM OLD.storno_am
     OR NEW.zuzahlung_kassiert_eur IS DISTINCT FROM OLD.zuzahlung_kassiert_eur
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.business_id IS DISTINCT FROM OLD.business_id THEN
    RAISE EXCEPTION 'prescriptions: Abrechnungs-, Storno- und Mandantenfelder nur ueber das Backend' USING ERRCODE = '42501';
  END IF;
  -- KHS M2: Verordnungsart und BG-Angaben (Rechnungsempfaenger) nur ueber das Backend, das die Sperre bei festgeschriebener Rechnung kennt.
  IF NEW.rezeptart IS DISTINCT FROM OLD.rezeptart
     OR NEW.bg_traeger_name IS DISTINCT FROM OLD.bg_traeger_name
     OR NEW.bg_traeger_anschrift IS DISTINCT FROM OLD.bg_traeger_anschrift
     OR NEW.bg_unfalltag IS DISTINCT FROM OLD.bg_unfalltag
     OR NEW.bg_aktenzeichen IS DISTINCT FROM OLD.bg_aktenzeichen
     OR NEW.bg_kostenzusage_datum IS DISTINCT FROM OLD.bg_kostenzusage_datum
     OR NEW.bg_kostenzusage_zeichen IS DISTINCT FROM OLD.bg_kostenzusage_zeichen
     OR NEW.bg_einverstaendnis_am IS DISTINCT FROM OLD.bg_einverstaendnis_am
     OR NEW.bg_einverstaendnis_version IS DISTINCT FROM OLD.bg_einverstaendnis_version THEN
    RAISE EXCEPTION 'prescriptions: Verordnungsart und BG-Angaben nur ueber das Backend' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND (NEW.status = 'billed' OR OLD.status = 'billed') THEN
    RAISE EXCEPTION 'prescriptions: Status billed nur ueber das Backend' USING ERRCODE = '42501';
  END IF;
  IF NEW.abrechnung_status IS DISTINCT FROM OLD.abrechnung_status THEN
    v_alt_gesperrt := OLD.abrechnung_id IS NOT NULL OR OLD.belegnummer IS NOT NULL
      OR (OLD.abrechnung_status IS NOT NULL AND OLD.abrechnung_status <> 'bereit');
    IF v_alt_gesperrt
       OR (NEW.abrechnung_status IS NOT NULL AND NEW.abrechnung_status <> 'bereit') THEN
      RAISE EXCEPTION 'prescriptions: Abrechnungsstatus % -> % nur ueber das Backend', OLD.abrechnung_status, NEW.abrechnung_status USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
