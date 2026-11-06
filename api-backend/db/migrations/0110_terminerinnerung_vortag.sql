-- Terminerinnerung am Vortag (O-206 Phase A, Physio-Pilot P1, 06.11.2026).
--
-- WAS: (1) neuer Anlass 'erinnerung_vortag' im Mitteilungsprotokoll termin_mitteilungen (0101);
--      (2) Tagesdeckel (0102) zaehlt je Anlass getrennt: Sondertag-Absage 500, Erinnerung 1000 je 24 Stunden und Mandant;
--      (3) Praxis-Schalter profiles.terminerinnerung_aktiv, Standard AUS.
-- WARUM getrennt zaehlen: Mit gemeinsamer Zaehlung koennte eine Erinnerungswelle eine dringende Sondertag-Absage sperren
--      (oder umgekehrt Erinnerungen still ausfallen). Die Grenze ist ein Schutz gegen Fehlversand, kein Tagesbedarf.
-- WARUM Schalter in profiles: Owner-Einstellungen gehoeren in profiles, nicht businesses (CLAUDE.md, Multi-tenant).
--      Der Job liest ihn nur aus der Inhaber-Zeile (profiles-Schutztrigger laesst Mitarbeitern ihre eigene Zeile).
-- WARUM freigegeben_von bleibt NULL: Automatik hat keine freigebende Person. NULL heisst damit „Automatik" ODER „Profil
--      geloescht" (ON DELETE SET NULL); unterscheiden laesst es sich nur ueber anlass.
-- Reihenfolge der Pruefungen im Trigger bleibt: erst Dedup (gleicher Schluessel -> UNIQUE-Konflikt 23505 bestimmt
--      Wiederholung), dann Deckel (PT429).
-- Expand-only: :stable schreibt weiter nur 'sondertag_geschlossen'. Rueckfall auf die alte Funktion zaehlt alle Anlaesse
--      gemeinsam mit Grenze 500: dann werden eher Absagen gesperrt, nie eine Mail zu viel versendet.
-- SaaS: nicht angewandt (box-only): Der Zeitjob laeuft nur mit Praxis-SMTP in der Box (versandWeg() = 'smtp', vor jedem DB-Zugriff geprueft);
--      die SaaS hat keinen Versandweg und liest weder Anlass noch Schalter, die Sondertag-Absage bleibt dort unveraendert (Zaehlung
--      je Anlass ist im Code, die alte Funktion zaehlt gemeinsam). Spaeter auf SaaS anwenden ist harmlos (expand-only), aber nicht noetig.
-- ZAEHLER: unveraendert (fonksiyon +0, trigger +0, index +0, tablo +0, rls_policy +0); neue Spalte profiles.terminerinnerung_aktiv.

ALTER TABLE public.termin_mitteilungen
  DROP CONSTRAINT IF EXISTS termin_mitteilungen_anlass_check,
  ADD CONSTRAINT termin_mitteilungen_anlass_check CHECK (anlass IN ('sondertag_geschlossen', 'erinnerung_vortag'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terminerinnerung_aktiv boolean NOT NULL DEFAULT false;

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
      WHERE owner_id = NEW.owner_id AND anlass = NEW.anlass
        AND created_at >= NEW.created_at - interval '24 hours')
     >= (CASE NEW.anlass WHEN 'erinnerung_vortag' THEN 1000 ELSE 500 END) THEN
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
