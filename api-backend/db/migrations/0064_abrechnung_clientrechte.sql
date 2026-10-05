-- Migration 0064_abrechnung_clientrechte.sql
-- SaaS: angewandt 05.10.2026 (MCP: 20261005154202).
-- M1.16 Haertung: Die Policy abrechnung_owner_all erlaubt Owner UND Team-Mitgliedern (FOR ALL) direkte
-- Schreibzugriffe auf `abrechnung` — also auch auf Dateipfade, Hashes, Signatur-/Verschluesselungsfelder und
-- den Status. Alle diese Felder schreibt ausschliesslich das Backend (service_role/postgres). Der Browser
-- darf genau EINEN Wechsel auf dem Header ausloesen: erstellt -> heruntergeladen (Download-Knopf).
-- Umsetzung als Trigger nach Hausmuster (0053 profiles, 0062 VKZ03): blockiert werden die Browser-Rollen
-- authenticated/anon, unabhaengig vom Funktionsowner (SaaS postgres, Box supabase_admin).
-- INSERT und DELETE durch den Browser gibt es nicht (alle Erzeugungswege laufen im Backend).

CREATE OR REPLACE FUNCTION public.pruefe_abrechnung_clientrechte()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN COALESCE(NEW, OLD);   -- Backend (service_role/postgres/supabase_admin): unveraendert
  END IF;
  IF TG_OP IN ('INSERT', 'DELETE') THEN
    RAISE EXCEPTION 'abrechnung: % nur ueber das Backend' , TG_OP USING ERRCODE = '42501';
  END IF;
  -- UPDATE: alles ausser status/updated_at muss unveraendert bleiben ...
  IF (to_jsonb(NEW) - 'status' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'updated_at') THEN
    RAISE EXCEPTION 'abrechnung: Datei-, Hash- und Kopffelder nur ueber das Backend' USING ERRCODE = '42501';
  END IF;
  -- ... und der Status darf nur von erstellt auf heruntergeladen springen.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'erstellt' AND NEW.status = 'heruntergeladen') THEN
    RAISE EXCEPTION 'abrechnung: Statuswechsel % -> % nur ueber das Backend', OLD.status, NEW.status USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_a_abrechnung_clientrechte
  BEFORE INSERT OR UPDATE OR DELETE ON public.abrechnung
  FOR EACH ROW EXECUTE FUNCTION public.pruefe_abrechnung_clientrechte();

REVOKE ALL ON FUNCTION public.pruefe_abrechnung_clientrechte() FROM PUBLIC, anon, authenticated;
