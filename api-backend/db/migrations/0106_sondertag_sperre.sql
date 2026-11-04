-- Sondertag sperrt neue Termine (Physio-Pilot M6, Kemal 31.10.2026, Melih GO 04.11.2026: „hart, auch serverseitig").
--
-- WAS: fn_check_booking_closed_day() prüft zusätzlich custom_days. Ein ganztägig geschlossener Sondertag
--      (type closed/holiday, ohne start_time/end_time) des Inhabers sperrt jeden NEUEN Termin an diesem
--      Berlin-Tag — egal über welchen Weg (Dashboard direkt, Serie, Online-Buchung, Warteliste, service_role).
-- WARUM DB statt Browser: Termine entstehen an über zehn Stellen, sechs davon schreiben direkt aus dem
--      Browser. Nur der Trigger deckt alle ab. Ausnahme zu Ops #307 „warnen statt blockieren", bewusst.
-- Regel identisch zu server.js getAvailableSlots (1.5) und module/sondertag.js sondertagArt():
--      Inhaber-weit (custom_days ist UNIQUE owner_id,date), Sonderöffnungszeiten sperren nicht.
-- Bestehende Termine bleiben änderbar: UPDATE ohne Änderung von start_time/business_id und Termine mit
--      status cancelled laufen durch. Sonst könnte man einen Termin am neuen Schließtag nicht einmal absagen
--      (UPDATE OF start_time feuert auch, wenn der Wert unverändert im SET steht). Das gilt nun auch für
--      die bestehende Wochentagsprüfung (closed_days) — vorher ein stiller Fehler beim Bearbeiten.
-- INVOKER genügt: custom_days_public_read (USING true) gibt allen Rollen Lesezugriff.
-- Fehlertext beginnt mit „Praxis geschlossen (Sondertag)"; api-backend/lib/raum-automatik.js
--      raumBuchungsFehler() und das Dashboard erkennen ihn am Anfang.
-- :stable/:beta-sicher: nur Funktionskörper, kein neues Objekt; alter Code bekommt nur eine Fehlermeldung mehr.
-- SaaS: angewandt 04.11.2026, Supabase Management-API (Melih GO 04.11., BEGIN/COMMIT, Ledger-Zeile, Katalog geprüft).
-- ZAEHLER: unveraendert (CREATE OR REPLACE einer bestehenden Funktion).

CREATE OR REPLACE FUNCTION public.fn_check_booking_closed_day()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_closed_days INTEGER[];
  v_dow INTEGER;
  v_tag date;
BEGIN
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.start_time IS NOT DISTINCT FROM OLD.start_time
     AND NEW.business_id IS NOT DISTINCT FROM OLD.business_id THEN
    RETURN NEW;
  END IF;

  v_tag := (NEW.start_time AT TIME ZONE 'Europe/Berlin')::date;

  IF EXISTS (
    SELECT 1 FROM public.custom_days cd
     WHERE cd.owner_id = COALESCE(NEW.owner_id, NEW.user_id)
       AND cd.date = v_tag
       AND cd.type IN ('closed', 'holiday')
       AND cd.start_time IS NULL AND cd.end_time IS NULL
  ) THEN
    RAISE EXCEPTION 'Praxis geschlossen (Sondertag) am %', to_char(v_tag, 'DD.MM.YYYY') USING ERRCODE = 'P0001';
  END IF;

  IF NEW.business_id IS NULL THEN RETURN NEW; END IF;
  SELECT closed_days INTO v_closed_days FROM public.businesses WHERE id = NEW.business_id;
  IF v_closed_days IS NULL OR array_length(v_closed_days, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  v_dow := EXTRACT(DOW FROM (NEW.start_time AT TIME ZONE 'Europe/Berlin'))::INTEGER;
  IF v_dow = ANY (v_closed_days) THEN
    RAISE EXCEPTION 'Geschäft ist an diesem Tag geschlossen (closed_days check)' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $function$;
