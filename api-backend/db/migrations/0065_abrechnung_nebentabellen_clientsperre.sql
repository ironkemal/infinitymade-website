-- Migration 0065_abrechnung_nebentabellen_clientsperre.sql
-- SaaS: angewandt 05.10.2026 (MCP: 20261005154848).
-- guvenlik-Befund M16-2/M16-3 (05.10.2026): abrechnung_zeile, abrechnung_zahlung und zaa_fehler hatten Policies,
-- die dem Browser (Owner/Team) Schreibzugriffe erlaubten bzw. nur die owner_id pruefen (kein Abgleich der
-- abrechnung_id mit dem Mandanten): eingeschleuste Teilzahlungen koennten den Header vorzeitig auf `paid`
-- setzen, Fremd-Inserts den Snapshot-Insert des Opfers (UNIQUE abrechnung_id,prescription_id) blockieren,
-- Team-Mitglieder ZAA-Rueckmeldungen aendern oder loeschen. Der Browser LIEST diese Tabellen nur (dashboard.js,
-- module/abrechnung-detail.js); alle Schreibwege laufen im Backend (service_role/postgres).
-- Umsetzung wie 0064: rollenunabhaengiger Trigger, blockiert werden die Browser-Rollen authenticated/anon.

CREATE OR REPLACE FUNCTION public.sperre_clientschreibzugriff()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION '%: % nur ueber das Backend', TG_TABLE_NAME, TG_OP USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_a_abrechnung_zeile_clientsperre
  BEFORE INSERT OR UPDATE OR DELETE ON public.abrechnung_zeile
  FOR EACH ROW EXECUTE FUNCTION public.sperre_clientschreibzugriff();
CREATE TRIGGER trg_a_abrechnung_zahlung_clientsperre
  BEFORE INSERT OR UPDATE OR DELETE ON public.abrechnung_zahlung
  FOR EACH ROW EXECUTE FUNCTION public.sperre_clientschreibzugriff();
CREATE TRIGGER trg_a_zaa_fehler_clientsperre
  BEFORE INSERT OR UPDATE OR DELETE ON public.zaa_fehler
  FOR EACH ROW EXECUTE FUNCTION public.sperre_clientschreibzugriff();

REVOKE ALL ON FUNCTION public.sperre_clientschreibzugriff() FROM PUBLIC, anon, authenticated;
