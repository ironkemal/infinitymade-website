-- SaaS: angewandt 17.10.2026 (MCP: 20261017202834, Freigabe Melih 17.10.2026; Grants/ACL und Spalte live geprüft, Pflichtberater db-ustasi + onprem: GO)
-- Ausfallzahlung: Status und Journal atomar; Fälligkeit ab Anlage eingefroren.
-- Additiv: Altbelege bleiben NULL (ursprüngliches Zahlungsziel ist unbekannt).
ALTER TABLE public.ausfallrechnungen ADD COLUMN faellig_am date;
COMMENT ON COLUMN public.ausfallrechnungen.faellig_am IS
  'Bei Ausstellung gespeichertes, unveränderliches Zahlungsziel. NULL = Altbeleg, ursprüngliche Fälligkeit nicht nachgewiesen; keine automatische Mahnung.';

CREATE OR REPLACE FUNCTION public.ausfallrechnung_festschreibung()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- c) zurück auf offen: aus keinem anderen Status
  IF NEW.status = 'offen' AND OLD.status IS DISTINCT FROM 'offen' THEN
    RAISE EXCEPTION 'Ausfallrechnung AF-% (Status %) kann nicht wieder auf offen gesetzt werden.', OLD.rechnung_nr, OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- c) bezahlt ist endgültig
  IF OLD.status = 'bezahlt'
     AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.bezahlt_at IS DISTINCT FROM OLD.bezahlt_at) THEN
    RAISE EXCEPTION 'Bezahlte Ausfallrechnung AF-% ist festgeschrieben (Status und Zahlungsdatum).', OLD.rechnung_nr
      USING ERRCODE = 'check_violation';
  END IF;

  -- c) storniert ist endgültig (Hauptsitzung 10.10.2026): POST /ausfall/create erlaubt nach Storno eine neue
  --    AF für denselben Termin — ein Zurück aus storniert ergäbe zwei lebende AF für einen Termin.
  IF OLD.status = 'storniert' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Stornierte Ausfallrechnung AF-% ist endgültig. Für den Termin bitte eine neue Ausfallrechnung anlegen.', OLD.rechnung_nr
      USING ERRCODE = 'check_violation';
  END IF;

  -- c) bezahlt_at nur zusammen mit dem Übergang auf bezahlt
  IF NEW.bezahlt_at IS DISTINCT FROM OLD.bezahlt_at AND NEW.status IS DISTINCT FROM 'bezahlt' THEN
    RAISE EXCEPTION 'Ausfallrechnung AF-%: Zahlungsdatum nur zusammen mit Status bezahlt.', OLD.rechnung_nr
      USING ERRCODE = 'check_violation';
  END IF;

  -- a) + b): Inhalt ab Anlage gesperrt (es gibt keinen Entwurf)
  IF NEW.amount_eur      IS DISTINCT FROM OLD.amount_eur
  OR NEW.service_name    IS DISTINCT FROM OLD.service_name
  OR NEW.leistung_datum  IS DISTINCT FROM OLD.leistung_datum
  OR NEW.rechnung_nr     IS DISTINCT FROM OLD.rechnung_nr
  OR NEW.reason          IS DISTINCT FROM OLD.reason
  OR NEW.created_at      IS DISTINCT FROM OLD.created_at
  OR NEW.owner_id        IS DISTINCT FROM OLD.owner_id
  OR NEW.aussteller_snapshot IS DISTINCT FROM OLD.aussteller_snapshot
  OR NEW.empfaenger_snapshot IS DISTINCT FROM OLD.empfaenger_snapshot
  OR NEW.faellig_am IS DISTINCT FROM OLD.faellig_am
  -- FK ON DELETE SET NULL muss durchgehen; Umhängen auf eine andere Zeile nicht
  OR (NEW.patient_id IS NOT NULL AND NEW.patient_id IS DISTINCT FROM OLD.patient_id)
  OR (NEW.booking_id IS NOT NULL AND NEW.booking_id IS DISTINCT FROM OLD.booking_id)
  THEN
    RAISE EXCEPTION 'Ausfallrechnung AF-% ist ausgestellt und kann inhaltlich nicht geaendert werden. Bitte stornieren.', OLD.rechnung_nr
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- Lehre 0035 (wie 0076). CREATE OR REPLACE behält die ACL, der REVOKE ist idempotent und hält den Stand in der Datei fest.
REVOKE ALL ON FUNCTION public.ausfallrechnung_festschreibung() FROM PUBLIC, anon, authenticated;

-- Nur Backend-service_role; kein SECURITY DEFINER und kein Zugriff für Browserrollen.
CREATE FUNCTION public.ausfall_status_buchen(
  p_owner_id uuid, p_actor_id uuid, p_ausfall_id uuid,
  p_status text, p_zahlart text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  af public.ausfallrechnungen%ROWTYPE;
  patient_name text;
BEGIN
  IF p_actor_id IS DISTINCT FROM p_owner_id OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Nur der Inhaber darf Ausfallrechnungen buchen.' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('bezahlt', 'storniert', 'abgeschrieben') THEN
    RAISE EXCEPTION 'Ungültiger Ausfallstatus.' USING ERRCODE = '23514';
  END IF;
  IF p_status = 'bezahlt' AND (p_zahlart IS NULL OR p_zahlart NOT IN ('bar', 'ec', 'ueberweisung', 'sonstiges', 'paypal')) THEN
    RAISE EXCEPTION 'Zahlart erforderlich.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO af FROM public.ausfallrechnungen WHERE id = p_ausfall_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ausfallrechnung nicht gefunden.' USING ERRCODE = 'P0002';
  END IF;
  IF af.owner_id IS DISTINCT FROM p_owner_id THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Ausfallrechnung.' USING ERRCODE = '42501';
  END IF;
  IF af.status IN ('bezahlt', 'storniert') THEN
    RAISE EXCEPTION 'Ausfallrechnung ist bereits % und nicht mehr änderbar.', af.status USING ERRCODE = '23514';
  END IF;

  IF p_status = 'bezahlt' THEN
    SELECT trim(concat_ws(' ', first_name, last_name)) INTO patient_name
      FROM public.leads WHERE id = af.patient_id;
    IF coalesce(patient_name, '') = '' THEN
      SELECT customer_name INTO patient_name FROM public.bookings WHERE id = af.booking_id;
    END IF;
    INSERT INTO public.belegliste(owner_id, type, amount_eur, patient_id, reference_text, created_by, zahlart)
    VALUES (p_owner_id, 'ausfall', af.amount_eur, af.patient_id,
      'Ausfallhonorar erhalten (AF-' || lpad(af.rechnung_nr::text, greatest(4, length(af.rechnung_nr::text)), '0') || ')'
        || CASE WHEN coalesce(patient_name, '') <> '' THEN ': ' || patient_name ELSE '' END,
      p_actor_id, p_zahlart);
  END IF;

  UPDATE public.ausfallrechnungen
    SET status = p_status,
        bezahlt_at = CASE WHEN p_status = 'bezahlt' THEN now() ELSE bezahlt_at END
    WHERE id = af.id;
END;
$function$;
REVOKE ALL ON FUNCTION public.ausfall_status_buchen(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ausfall_status_buchen(uuid, uuid, uuid, text, text) TO service_role;
