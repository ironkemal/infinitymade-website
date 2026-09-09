-- #192. Vom Nutzer ausführen, VOR Bereitstellung des Frontend-Codes.
-- Vorhandene Felder status ('cancelled') und cancellation_reason bleiben maßgeblich.
-- Kein neues Statusmodell und keine Änderung an Rechnungen/Zahlungen.
BEGIN;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_session_links jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.bookings.cancelled_at IS
  'Zeitpunkt der Absage ab #192; bei vorher bereits abgesagten Terminen unbekannt (NULL).';
COMMENT ON COLUMN public.bookings.cancelled_session_links IS
  'Historische Zuordnung geplanter Sitzungen, die bei Absage wieder freigegeben wurden. Kein Sitzungszähler.';

CREATE FUNCTION public.codex_192_booking_before_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  parent_status text;
  parent_owner uuid;
  session_links jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'Abgesagte Termine können nicht reaktiviert werden; bitte einen neuen Termin anlegen.' USING ERRCODE = '23514';
  END IF;

  -- Sperrt auch das Rennen zwischen Gruppenabsage und neuem Teilnehmer.
  IF NEW.group_parent_id IS NOT NULL AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    SELECT status, owner_id INTO parent_status, parent_owner
    FROM public.bookings WHERE id = NEW.group_parent_id FOR SHARE;
    IF NOT FOUND OR parent_status = 'cancelled' OR parent_owner IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Der Gruppentermin ist abgesagt oder nicht zugänglich.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.cancelled_at := CASE WHEN NEW.status = 'cancelled' THEN CURRENT_TIMESTAMP ELSE NULL END;
    NEW.cancelled_session_links := '[]'::jsonb;
    RETURN NEW;
  END IF;

  -- Historische Metadaten werden nur durch diesen Trigger erzeugt.
  NEW.cancelled_at := OLD.cancelled_at;
  NEW.cancelled_session_links := OLD.cancelled_session_links;
  IF NEW.status IS DISTINCT FROM 'cancelled' THEN RETURN NEW; END IF;

  IF OLD.status IS DISTINCT FROM 'cancelled' THEN
    IF OLD.status IS NULL OR OLD.status NOT IN ('confirmed', 'pending') OR OLD.no_show THEN
      RAISE EXCEPTION 'Erledigte oder nicht wahrgenommene Termine können nicht über die Absage geändert werden.' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM public.fahrten WHERE booking_id = NEW.id AND fahrt_ended_at IS NULL) THEN
      RAISE EXCEPTION 'Bitte die laufende Fahrt vor der Terminabsage beenden.' USING ERRCODE = '23514';
    END IF;
    NEW.cancelled_at := CURRENT_TIMESTAMP;
  END IF;

  -- Sperren vor dem Snapshot: paralleles Abhaken darf keine erbrachte Einheit verlieren.
  PERFORM id FROM public.prescription_sessions WHERE booking_id = NEW.id ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.prescription_sessions WHERE booking_id = NEW.id AND status IN ('done', 'no_show')) THEN
    RAISE EXCEPTION 'Der Termin hat bereits erledigte Sitzungen. Bitte zuerst den fachlichen Status prüfen.' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'session_id', id, 'prescription_id', prescription_id,
    'session_number', session_number, 'heilmittel_index', heilmittel_index
  ) ORDER BY session_number), '[]'::jsonb) INTO session_links
  FROM public.prescription_sessions WHERE booking_id = NEW.id AND status = 'planned';
  NEW.cancelled_session_links := OLD.cancelled_session_links || session_links;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.codex_192_booking_after_cancel()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- Genau wie beim bisherigen FK ON DELETE SET NULL wird die geplante Einheit
  -- erneut buchbar. Die vorherige Zuordnung bleibt im Snapshot des Termins.
  UPDATE public.prescription_sessions SET booking_id = NULL
  WHERE booking_id = NEW.id AND status = 'planned';
  IF EXISTS (SELECT 1 FROM public.prescription_sessions WHERE booking_id = NEW.id AND status = 'planned') THEN
    RAISE EXCEPTION 'Die geplanten Sitzungen konnten nicht freigegeben werden.' USING ERRCODE = '42501';
  END IF;

  -- Früher löschte ON DELETE CASCADE die Gruppenteilnehmer mit.
  -- Jetzt bleiben auch deren Termine erhalten; die jeweiligen Trigger lösen
  -- ihre Sitzungen. Ein Fehler rollt die gesamte Gruppenabsage zurück.
  IF EXISTS (SELECT 1 FROM public.bookings WHERE group_parent_id = NEW.id AND owner_id IS DISTINCT FROM NEW.owner_id) THEN
    RAISE EXCEPTION 'Gruppenteilnehmer gehören nicht zur selben Praxis.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.bookings
  SET status = 'cancelled', cancellation_reason = NEW.cancellation_reason
  WHERE group_parent_id = NEW.id AND status IS DISTINCT FROM 'cancelled';
  IF EXISTS (SELECT 1 FROM public.bookings WHERE group_parent_id = NEW.id AND status IS DISTINCT FROM 'cancelled') THEN
    RAISE EXCEPTION 'Nicht alle Gruppenteilnehmer konnten abgesagt werden.' USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.codex_192_session_booking_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  booking_status text;
BEGIN
  IF NEW.booking_id IS NOT NULL AND NEW.status <> 'cancelled' THEN
    SELECT status INTO booking_status FROM public.bookings WHERE id = NEW.booking_id FOR SHARE;
    IF NOT FOUND OR booking_status = 'cancelled' THEN
      RAISE EXCEPTION 'Eine aktive Sitzung benötigt einen nicht abgesagten Termin.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Keine RPCs, keine SECURITY-DEFINER-Ausnahmen, keine erweiterten RLS-Rechte.
REVOKE ALL ON FUNCTION public.codex_192_booking_before_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.codex_192_booking_after_cancel() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.codex_192_session_booking_guard() FROM PUBLIC;

CREATE TRIGGER codex_192_booking_before_write
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.codex_192_booking_before_write();

CREATE TRIGGER codex_192_booking_after_cancel
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW WHEN (NEW.status = 'cancelled')
EXECUTE FUNCTION public.codex_192_booking_after_cancel();

CREATE TRIGGER codex_192_session_booking_guard
BEFORE INSERT OR UPDATE OF booking_id, status ON public.prescription_sessions
FOR EACH ROW EXECUTE FUNCTION public.codex_192_session_booking_guard();

-- Bereits abgesagte Termine dürfen ebenfalls keine geplanten Einheiten oder
-- aktiven Gruppenteilnehmer mehr binden. Kein erfundener historischer Zeitstempel.
CREATE INDEX codex_192_prescription_sessions_booking_idx
ON public.prescription_sessions (booking_id) WHERE booking_id IS NOT NULL;

UPDATE public.bookings b SET status = 'cancelled'
WHERE b.status = 'cancelled' AND (
  EXISTS (SELECT 1 FROM public.prescription_sessions s WHERE s.booking_id = b.id AND s.status = 'planned')
  OR EXISTS (SELECT 1 FROM public.bookings c WHERE c.group_parent_id = b.id AND c.status IS DISTINCT FROM 'cancelled')
);

COMMIT;
