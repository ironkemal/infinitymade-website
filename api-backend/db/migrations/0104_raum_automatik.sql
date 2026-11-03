-- Ausstattung je Leistung und automatische Raumwahl, lokal vorbereitet; NICHT SaaS-angewandt.
-- Voraussetzung: 0103. Keine Bestandszuordnung, manuelle Überbelegung bleibt möglich.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS raum_ausstattung text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_raum_ausstattung_gueltig;
ALTER TABLE public.services ADD CONSTRAINT services_raum_ausstattung_gueltig
  CHECK (public.raum_ausstattung_gueltig(raum_ausstattung));
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS room_automatisch boolean NOT NULL DEFAULT false;
-- Vorprüfung sämtlicher geplanter Leistungen, bevor getrennte REST-Aufrufe die
-- kanonischen booking_leistungen-Zeilen schreiben. Bei jedem Edit mitsenden.
-- NULL = Altaufruf nutzt gespeicherte Relationen; explizites [] ist ein geplanter
-- Satz ohne Zusatzleistungen. Die Hauptleistung wird nicht doppelt gespeichert.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS raum_service_ids uuid[];
ALTER TABLE public.bookings ALTER COLUMN raum_service_ids DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN raum_service_ids DROP DEFAULT;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_raum_service_ids_gueltig;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_raum_service_ids_gueltig CHECK (
  raum_service_ids IS NULL OR (cardinality(raum_service_ids) <= 30 AND COALESCE(array_ndims(raum_service_ids), 1) = 1
  AND array_position(raum_service_ids, NULL) IS NULL)
);

CREATE OR REPLACE FUNCTION public.booking_raum_automatisch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  erforderlich text[] := '{}';
  geeignet uuid;
  eltern public.bookings%ROWTYPE;
  leistung record;
  automatisch boolean;
  online boolean := true;
  hat_leistung boolean := false;
BEGIN
  -- Alle Schreibwege serialisieren ihre Raumentscheidung am selben Standort. Eine
  -- explizite manuelle Wahl prüft trotzdem keine Kapazität (bestehende Warnregel).
  PERFORM pg_advisory_xact_lock(hashtextextended('raum:' || NEW.owner_id::text || ':' || COALESCE(NEW.business_id::text, '-'), 0));
  automatisch := NEW.room_id IS NULL;
  IF TG_OP = 'UPDATE' THEN
    automatisch := automatisch OR (OLD.room_automatisch AND NEW.room_automatisch AND NEW.room_id IS NOT DISTINCT FROM OLD.room_id);
  END IF;
  IF NEW.raum_service_ids IS NOT NULL THEN
    IF COALESCE(array_ndims(NEW.raum_service_ids), 1) <> 1
       OR cardinality(NEW.raum_service_ids) > 30
       OR array_position(NEW.raum_service_ids, NULL) IS NOT NULL THEN
      RAISE EXCEPTION 'Für die Raumzuordnung sind höchstens 30 gültige Leistungen erlaubt.' USING ERRCODE = '23514';
    END IF;
    NEW.raum_service_ids := array_remove(NEW.raum_service_ids, NEW.service_id);
  END IF;
  FOR leistung IN
    SELECT s.*, ids.id AS requested_id FROM (
      SELECT NEW.service_id AS id WHERE NEW.service_id IS NOT NULL
      UNION SELECT unnest(NEW.raum_service_ids)
      UNION SELECT bl.service_id FROM public.booking_leistungen bl WHERE bl.booking_id = NEW.id AND NEW.raum_service_ids IS NULL
    ) ids LEFT JOIN public.services s ON s.id = ids.id
  LOOP
    IF leistung.id IS NULL OR COALESCE(leistung.owner_id, leistung.user_id) IS DISTINCT FROM NEW.owner_id
       OR leistung.business_id IS DISTINCT FROM NEW.business_id THEN
      RAISE EXCEPTION 'Leistung gehört nicht zu diesem Mandanten oder Standort.' USING ERRCODE = '23514';
    END IF;
    erforderlich := erforderlich || leistung.raum_ausstattung;
    hat_leistung := true;
    online := online AND COALESCE(leistung.is_online_meeting, false);
  END LOOP;
  IF NEW.group_parent_id IS NOT NULL THEN
    SELECT * INTO eltern FROM public.bookings WHERE id = NEW.group_parent_id;
    IF NOT FOUND OR eltern.owner_id IS DISTINCT FROM NEW.owner_id OR eltern.business_id IS DISTINCT FROM NEW.business_id THEN
      RAISE EXCEPTION 'Gruppentermin gehört nicht zu diesem Mandanten oder Standort.' USING ERRCODE = '23514';
    END IF;
    NEW.room_id := eltern.room_id;
    NEW.room_automatisch := eltern.room_automatisch;
    RETURN NEW;
  END IF;
  IF NOT automatisch THEN
    NEW.room_automatisch := false;
    RETURN NEW;
  END IF;
  NEW.room_id := NULL;
  NEW.room_automatisch := false;
  IF NEW.hausbesuch IS TRUE OR NEW.status IN ('cancelled', 'no_show') THEN RETURN NEW; END IF;
  IF hat_leistung AND online THEN RETURN NEW; END IF;
  SELECT COALESCE(array_agg(DISTINCT e ORDER BY e), '{}') INTO erforderlich FROM unnest(erforderlich) e;
  IF cardinality(erforderlich) = 0 AND NOT EXISTS (
    SELECT 1 FROM public.rooms r WHERE r.owner_id = NEW.owner_id
      AND r.business_id IS NOT DISTINCT FROM NEW.business_id AND r.aktiv
  ) THEN RETURN NEW; END IF;
  IF NEW.start_time IS NULL OR NEW.end_time IS NULL OR NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'Für die Raumzuordnung werden Beginn und Ende des Termins benötigt.' USING ERRCODE = '23514';
  END IF;
  SELECT r.id INTO geeignet FROM public.rooms r
  WHERE r.owner_id = NEW.owner_id AND r.business_id IS NOT DISTINCT FROM NEW.business_id
    AND r.aktiv AND r.ausstattung @> erforderlich
    AND r.plaetze > (
      SELECT count(*) FROM public.bookings b WHERE b.owner_id = NEW.owner_id AND b.room_id = r.id
        AND b.id IS DISTINCT FROM NEW.id AND b.group_parent_id IS NULL
        AND b.status IS DISTINCT FROM 'cancelled' AND b.status IS DISTINCT FROM 'no_show'
        AND b.start_time < NEW.end_time AND b.end_time > NEW.start_time
    ) ORDER BY r.sort, r.name, r.id LIMIT 1;
  IF geeignet IS NULL THEN
    RAISE EXCEPTION 'Kein freier Raum mit der benötigten Ausstattung am Terminstandort verfügbar. Bitte Zeit oder Raumwahl prüfen.' USING ERRCODE = 'P0001';
  END IF;
  NEW.room_id := geeignet;
  NEW.room_automatisch := true;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_raum_automatisch() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_zy_booking_room_auto ON public.bookings;
CREATE TRIGGER trg_zy_booking_room_auto BEFORE INSERT OR UPDATE OF room_id, service_id, raum_service_ids, start_time, end_time, business_id, owner_id, group_parent_id, hausbesuch, status
  ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.booking_raum_automatisch();

CREATE OR REPLACE FUNCTION public.booking_leistung_raum_nachpruefen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE b_id uuid;
BEGIN
  b_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.booking_id ELSE NEW.booking_id END;
  -- Eine manuelle Raumwahl bleibt bewusst manuell. Bei automatischer Wahl
  -- berücksichtigen wir die Vereinigungsmenge aller inzwischen gespeicherten Leistungen.
  UPDATE public.bookings SET
    room_id = CASE WHEN room_automatisch THEN NULL ELSE room_id END,
    raum_service_ids = CASE
      WHEN raum_service_ids IS NULL OR TG_OP = 'DELETE' THEN raum_service_ids
      WHEN NEW.service_id = service_id OR NEW.service_id = ANY(raum_service_ids) THEN raum_service_ids
      ELSE array_append(raum_service_ids, NEW.service_id) END
    WHERE id = b_id;
  IF TG_OP = 'UPDATE' AND OLD.booking_id IS DISTINCT FROM NEW.booking_id THEN
    UPDATE public.bookings SET room_id = NULL WHERE id = OLD.booking_id AND room_automatisch;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_leistung_raum_nachpruefen() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_booking_raum_leistungen ON public.booking_leistungen;
CREATE TRIGGER trg_booking_raum_leistungen AFTER INSERT OR UPDATE OR DELETE ON public.booking_leistungen
  FOR EACH ROW EXECUTE FUNCTION public.booking_leistung_raum_nachpruefen();

CREATE OR REPLACE FUNCTION public.booking_gruppe_raum_nachziehen()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.group_parent_id IS NULL AND NEW.room_id IS DISTINCT FROM OLD.room_id THEN
    UPDATE public.bookings SET room_id = NEW.room_id
      WHERE group_parent_id = NEW.id AND owner_id = NEW.owner_id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_gruppe_raum_nachziehen() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_booking_gruppe_raum ON public.bookings;
CREATE TRIGGER trg_booking_gruppe_raum AFTER UPDATE OF room_id ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.booking_gruppe_raum_nachziehen();
