-- F12: Tagesdeckel atomar ueber alle Backend-Prozesse sichern (02.11.2026).
-- SaaS: angewandt 02.11.2026, Supabase Management-API mit MCP-Token (Melih GO 02.11., BEGIN/COMMIT, Katalog geprueft).
-- Keine neue Tabelle: neue Protokollzeilen zaehlen, Retry-UPDATE bleibt unveraendert.
-- VOLATILE + getrennte Abfrage nach dem Mandanten-Lock: frischer Snapshot bei READ COMMITTED.
-- Andere Isolation wird abgewiesen, statt mit einem alten Transaktionssnapshot zu zaehlen.
-- ZAEHLER: fonksiyon +1, trigger +1; uebrige Zaehler unveraendert.

CREATE OR REPLACE FUNCTION public.termin_mitteilungen_tagesdeckel()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Mitteilungsprotokoll braucht READ COMMITTED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('termin_mitteilungen:' || NEW.owner_id::text, 0));
  -- Zeit erst NACH dem Lock erfassen; vom Aufrufer backdatierte Claims zaehlen ebenfalls.
  NEW.created_at := clock_timestamp();
  IF EXISTS (
    SELECT 1 FROM public.termin_mitteilungen
    WHERE booking_id = NEW.booking_id AND anlass = NEW.anlass AND termin_beginn = NEW.termin_beginn
  ) THEN
    RETURN NEW; -- Originaler UNIQUE-Konflikt steuert Dedup/Retry im Backend.
  END IF;
  IF (SELECT count(*) FROM public.termin_mitteilungen
      WHERE owner_id = NEW.owner_id AND created_at >= NEW.created_at - interval '24 hours') >= 500 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT429', MESSAGE = 'TERMIN_MITTEILUNGEN_TAGESDECKEL';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.termin_mitteilungen_tagesdeckel() FROM PUBLIC;
-- Supabase-Default-Privilegien vergeben EXECUTE zusaetzlich an anon/authenticated (live 02.11. gemessen).
REVOKE ALL ON FUNCTION public.termin_mitteilungen_tagesdeckel() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.termin_mitteilungen_tagesdeckel() TO service_role;
DROP TRIGGER IF EXISTS termin_mitteilungen_tagesdeckel ON public.termin_mitteilungen;
CREATE TRIGGER termin_mitteilungen_tagesdeckel
  BEFORE INSERT ON public.termin_mitteilungen
  FOR EACH ROW EXECUTE FUNCTION public.termin_mitteilungen_tagesdeckel();
