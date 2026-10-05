-- Migration 0066_prescriptions_clientrechte.sql
-- SaaS: angewandt 05.10.2026 (MCP: 20261005194119).
-- guvenlik M16-5 / db-ustasi-Beurteilung (05.10.2026): prescriptions_owner_all (FOR ALL, Owner+Team) liess den Browser nach dem
-- Abrechnen weiter an den Abrechnungs-/Storno-/Absetzungsfeldern schreiben (-> Doppelabrechnung moeglich, z. B. ein
-- veralteter Tab setzt in_abrechnung -> NULL zurueck) und Zeilen loeschen (auch per Kaskade aus businesses/auth.users).
-- Konservativ umgesetzt — nur was kein legitimer Browser-Weg braucht (Grep ueber dashboard.js/module):
--   a) DELETE einer GESPERRTEN Zeile (abrechnung_id oder belegnummer gesetzt, oder abrechnung_status nicht NULL/bereit)
--      wird fuer ALLE Rollen abgelehnt — das faengt auch RI-Kaskaden ab (Kaskaden laufen als Tabellenowner, ein reiner
--      Rollenvergleich saehe sie nicht).
--   b) Browser-Rollen (authenticated/anon): Spalten, die nur das Backend schreibt, bleiben unveraendert
--      (abrechnung_id, belegnummer, absetzung_*, storno_*, zuzahlung_kassiert_eur, owner_id, business_id); `status` darf nicht
--      nach/von 'billed'; `abrechnung_status` darf nur zwischen NULL und 'bereit' wechseln und nur wenn die alte Zeile nicht
--      gesperrt ist.
--   c) Browser-INSERT darf keine bereits abgerechnete/festgeschriebene Zeile anlegen.
-- Backend (service_role/postgres/supabase_admin) und SECURITY-DEFINER-RPCs bleiben unberuehrt.

CREATE OR REPLACE FUNCTION public.pruefe_prescriptions_clientrechte()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
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
       OR (NEW.abrechnung_status IS NOT NULL AND NEW.abrechnung_status <> 'bereit') THEN
      RAISE EXCEPTION 'prescriptions: Abrechnungsfelder nur ueber das Backend' USING ERRCODE = '42501';
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
END $$;

CREATE TRIGGER trg_a_prescriptions_clientrechte
  BEFORE INSERT OR UPDATE OR DELETE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.pruefe_prescriptions_clientrechte();

REVOKE ALL ON FUNCTION public.pruefe_prescriptions_clientrechte() FROM PUBLIC, anon, authenticated;
