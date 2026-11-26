-- ENTWURF — NICHT aktiv, nicht in api-backend/db/migrations, nicht live angewandt (GO nötig).
-- Maßgabe onprem O-129 / G7: gemeinsame Triggerfunktion `public.booking_raum_automatisch()`
-- darf erst NACH Live-Ausführung auf SaaS (und ggf. Box) in `api-backend/db/migrations/`
-- übernommen werden; bis dahin kein Eintrag in erwartete-zaehler.json.
--
-- Ursache (Live-QA-Befund BOX-P0-01 vom 25.11.2026):
--   0129_raum_einzelbelegung.sql prüfte `leistung.business_id IS DISTINCT FROM NEW.business_id`.
--   Standard-Leistungen ohne Standortbindung (`services.business_id IS NULL`) sowie
--   standortübergreifend freigegebene Leistungen (`data_sharing_settings.services = true`),
--   die im Frontend per `bizScope` regulär zur Auswahl stehen, wurden beim INSERT in
--   `bookings` abgelehnt, sobald `trg_set_business_id` eine `NEW.business_id` setzt
--   (`NULL IS DISTINCT FROM <uuid>` ist in PostgreSQL TRUE).
--
-- Änderung gegenüber 0129 (signatur- und zählerneutral, gleiche SECURITY DEFINER & ACLs):
--   - Mandantengrenze (`COALESCE(leistung.owner_id, leistung.user_id) IS DISTINCT FROM NEW.owner_id`)
--     bleibt unverändert strikt.
--   - Standortbindung für Leistungen erlaubt:
--       1) `leistung.business_id IS NULL` (praxisweite/globale Leistung),
--       2) `leistung.business_id = NEW.business_id` (selber Standort),
--       3) `NEW.business_id IS NULL` (Einzelpraxis ohne Standortzeile),
--       4) `data_sharing_settings.services IS TRUE` für `NEW.owner_id`.
--
-- Rollout-Schritte nach Live-Anwendung:
--   1. Probelauf mit ROLLBACK, dann Live-Anwendung auf Produkt-SaaS (`njvuclullotbksskpwgk`)
--      und ggf. Kunden-Box.
--   2. Danach nach `api-backend/db/migrations/0134_booking_raum_leistung_standort.sql` verschieben
--      und Kopfzeile auf `-- SaaS: angewandt TT.MM.JJJJ` umstellen.
--   3. `db/SCHEMA.sql`, `db/SCHEMA-RLS.sql` neu exportieren und `api-backend/db/erwartete-zaehler.json`
--      (`bis_version` + `_hinweis_0134`, alle 10 Zähler unverändert) aktualisieren.

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
  -- Explizite Wahl und automatische Zuweisung laufen unter demselben Standort-Lock.
  PERFORM pg_advisory_xact_lock(hashtextextended('raum:' || NEW.owner_id::text || ':' || COALESCE(NEW.business_id::text, '-'), 0));
  -- 0108: Raum gelöscht (FK ON DELETE SET NULL). Der alte Raum ist im selben Statement schon weg; nicht
  -- neu zuteilen, sonst scheitert das Löschen, wenn kein Ersatzraum frei ist (auch bei vergangenen Terminen).
  IF TG_OP = 'UPDATE' AND NEW.room_id IS NULL AND OLD.room_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = OLD.room_id) THEN
    NEW.room_automatisch := false;
    RETURN NEW;
  END IF;
  -- Ein bereits stattgefundener Termin darf seine damalige Raumbelegung behalten.
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' AND NEW.status = 'completed'
     AND (NEW.owner_id, NEW.business_id, NEW.user_id, NEW.room_id, NEW.room_automatisch, NEW.hausbesuch,
          NEW.service_id, NEW.raum_service_ids, NEW.start_time, NEW.end_time, NEW.group_parent_id)
         IS NOT DISTINCT FROM
         (OLD.owner_id, OLD.business_id, OLD.user_id, OLD.room_id, OLD.room_automatisch, OLD.hausbesuch,
          OLD.service_id, OLD.raum_service_ids, OLD.start_time, OLD.end_time, OLD.group_parent_id)
  THEN RETURN NEW; END IF;
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
    IF leistung.id IS NULL
       OR COALESCE(leistung.owner_id, leistung.user_id) IS DISTINCT FROM NEW.owner_id
       OR (
         leistung.business_id IS NOT NULL
         AND NEW.business_id IS NOT NULL
         AND leistung.business_id <> NEW.business_id
         AND NOT EXISTS (
           SELECT 1 FROM public.data_sharing_settings dss
           WHERE dss.owner_id = NEW.owner_id AND dss.services IS TRUE
         )
       ) THEN
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
    IF NEW.status IN ('cancelled','no_show') OR (TG_OP = 'UPDATE' AND OLD.group_parent_id IS NULL
       AND OLD.status NOT IN ('cancelled','no_show') AND OLD.owner_id IS NOT DISTINCT FROM NEW.owner_id
       AND OLD.room_id IS NOT DISTINCT FROM NEW.room_id
       AND OLD.service_id IS NOT DISTINCT FROM NEW.service_id AND OLD.raum_service_ids IS NOT DISTINCT FROM NEW.raum_service_ids
       AND OLD.business_id IS NOT DISTINCT FROM NEW.business_id AND OLD.start_time IS NOT DISTINCT FROM NEW.start_time AND OLD.end_time IS NOT DISTINCT FROM NEW.end_time)
    THEN RETURN NEW; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.rooms r WHERE r.id = NEW.room_id AND r.owner_id = NEW.owner_id
        AND r.business_id IS NOT DISTINCT FROM NEW.business_id
    ) THEN
      RAISE EXCEPTION 'Raum gehört nicht zu diesem Mandanten oder Standort.' USING ERRCODE = '23514';
    END IF;
  ELSE
    NEW.room_id := NULL;
    NEW.room_automatisch := false;
    IF NEW.hausbesuch IS TRUE OR NEW.status IN ('cancelled', 'no_show') THEN RETURN NEW; END IF;
    IF hat_leistung AND online THEN RETURN NEW; END IF;
  END IF;
  SELECT COALESCE(array_agg(DISTINCT e ORDER BY e), '{}') INTO erforderlich FROM unnest(erforderlich) e;
  IF automatisch AND cardinality(erforderlich) = 0 AND NOT EXISTS (
    SELECT 1 FROM public.rooms r WHERE r.owner_id = NEW.owner_id
      AND r.business_id IS NOT DISTINCT FROM NEW.business_id AND r.aktiv
  ) THEN RETURN NEW; END IF;
  IF NEW.start_time IS NULL OR NEW.end_time IS NULL OR NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'Für die Raumzuordnung werden Beginn und Ende des Termins benötigt.' USING ERRCODE = '23514';
  END IF;
  SELECT r.id INTO geeignet FROM public.rooms r
  WHERE r.owner_id = NEW.owner_id AND r.business_id IS NOT DISTINCT FROM NEW.business_id
    AND r.aktiv AND r.ausstattung @> erforderlich
    AND (automatisch OR r.id = NEW.room_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b WHERE b.owner_id = NEW.owner_id AND b.room_id = r.id
        AND b.id IS DISTINCT FROM NEW.id AND b.group_parent_id IS NULL
        AND b.status IS DISTINCT FROM 'cancelled' AND b.status IS DISTINCT FROM 'no_show'
        AND b.start_time < NEW.end_time AND b.end_time > NEW.start_time
    ) ORDER BY r.sort, r.name, r.id LIMIT 1;
  IF geeignet IS NULL THEN
    RAISE EXCEPTION 'Kein freier Raum mit der benötigten Ausstattung am Terminstandort verfügbar. Bitte Zeit oder Raumwahl prüfen.' USING ERRCODE = 'P0001';
  END IF;
  NEW.room_id := geeignet;
  NEW.room_automatisch := automatisch;
  RETURN NEW;
END;
$$;

-- Die Ausführung bleibt dem Trigger und der Backend-Rolle vorbehalten.
REVOKE EXECUTE ON FUNCTION public.booking_raum_automatisch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.booking_raum_automatisch() FROM anon;
REVOKE EXECUTE ON FUNCTION public.booking_raum_automatisch() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.booking_raum_automatisch() TO service_role;
