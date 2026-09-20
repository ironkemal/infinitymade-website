-- §302-Echtbetrieb, Schritt 1.10 — Gesetzlich vorgeschriebene Uebermittlungsdokumentation.
-- Neue Tabelle public.abrechnung_uebermittlung, Festschreibungs-Trigger, RLS.
--
-- FACHLICHER GRUND:
--   Anlage 1 TP5 Kap. 3(2): "Ueber den Datenaustausch ist eine Dokumentation zu
--   fuehren … mindestens 2 Jahre aufzubewahren … alle Schritte von der Initiierung
--   bis ggf. zur Quittierung."
--   Anhang 1 § 4.5(2) zaehlt die gesetzlichen Mindestfelder auf:
--     • physikalischer Dateiname
--     • Erstellungsdatum
--     • laufende Nummer
--     • Kommunikationspartner (partner_ik, partner_name)
--     • Beginn / Ende der Uebertragung (begonnen_am, beendet_am)
--     • Dateigroesse in Bytes (dateigroesse_bytes)
--     • Verarbeitungshinweise (verarbeitungshinweise)
--     • Senden / Empfangen (richtung)
--     • Verarbeitungskennzeichen (verarbeitungskennzeichen)
--     • Fehlerstatus (fehlerstatus, fehlertext)
--
-- ARCHITEKTUR-ENTSCHEIDUNG (db-ustasi, 20.09.2026):
--   Eigene Tabelle `abrechnung_uebermittlung`, keine Spalten an `abrechnung`.
--   Zwei zwingende Gruende:
--     1. Kardinalitaet 1:n: Eine Abrechnung kann mehrfach uebertragen werden (z. B.
--        nach Uebertragungsfehler oder Korrektur), und Rueckmeldungen/Quittungen (CONTRL,
--        APERAK) treffen zeitversetzt als Antwort ein (`antwort_auf`).
--     2. `abrechnung` ist festgeschrieben (GoBD). Spalten dort nachtraeglich bei
--        Transportvorgaengen zu aktualisieren, wuerde den Festschreibungs-Trigger
--        verletzen.
--
-- ENTSTEHUNGSZEITPUNKT:
--   Die Tabelle entsteht JETZT vor dem eigentlichen Versandschritt (der in Faz 2
--   gebaut wird). Grund: Gesetzliche Transportdokumentation laesst sich nicht
--   nachtraeglich rueckwirkend erzeugen. Die Daten muessen vom ersten Versand an
--   lueckenlos und revisionssicher mitprotokolliert werden.
--
-- ⛔ PHI-VERBOT (STRIKT):
--   In diese Tabelle kommen UNTER KEINEN UMSTAENDEN Patientenname, Versichertennummer,
--   Geburtsdatum oder Diagnose. Sie ist ein Transportprotokoll fuer den
--   Datenaustausch nach § 302 SGB V, keine Patientenakte.
--   Die zwei Risikostellen fuer unbeabsichtigte PHI-Eintraege sind die Freitextfelder
--   `verarbeitungshinweise` und `fehlertext`:
--   Werden spaeter ZAA-Fehlermeldungen oder Rueckmeldetexte von Datenannahmestellen
--   hineinkopiert, muessen diese VORHER VOLLSTAENDIG MASKIERT werden (keine
--   Patientendaten!).
--
-- ZAEHLER: +1 Tabelle, +1 Policy, +3 Indizes, +1 Funktion, +1 Trigger.
--
-- DETAIL-RECHNUNG:
--   • Tabellen:  +1 (public.abrechnung_uebermittlung)
--   • Policies:  +1 ("Abrechnung uebermittlung select scoping" FOR SELECT TO authenticated)
--   • Indizes:   +3
--                - 1 impliziter B-Tree-Index durch PRIMARY KEY (id)
--                - 1 expliziter B-Tree-Index abr_uebermittlung_owner_zeit_idx (owner_id, begonnen_am DESC)
--                - 1 expliziter partieller B-Tree-Index abr_uebermittlung_abrechnung_idx (abrechnung_id) WHERE abrechnung_id IS NOT NULL
--                (Fremdschluessel legen in PostgreSQL KEINE Indizes an)
--   • Funktionen:+1 (public.fn_abrechnung_uebermittlung_festschreibung())
--   • Trigger:   +1 (trg_abrechnung_uebermittlung_festschreibung BEFORE DELETE OR UPDATE)
--                (Fremdschluessel-RI-Trigger sind Systemtrigger mit tgisinternal=true und zaehlen nicht)

-- --------------------------------------------------------------------------
-- 1) DDL — Tabelle abrechnung_uebermittlung
-- --------------------------------------------------------------------------

CREATE TABLE public.abrechnung_uebermittlung (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES public.profiles(id)   ON DELETE RESTRICT,
  business_id   uuid          REFERENCES public.businesses(id) ON DELETE SET NULL,
  abrechnung_id uuid          REFERENCES public.abrechnung(id) ON DELETE RESTRICT,
  antwort_auf   uuid          REFERENCES public.abrechnung_uebermittlung(id) ON DELETE SET NULL,
  richtung                 text        NOT NULL,
  physikalischer_dateiname text        NOT NULL,
  erstellt_am              timestamptz NOT NULL,
  laufende_nummer          integer,
  transfernummer           integer,
  partner_ik               text        NOT NULL,
  partner_name             text,
  begonnen_am              timestamptz NOT NULL DEFAULT now(),
  beendet_am               timestamptz,
  dateigroesse_bytes       bigint,
  verarbeitungshinweise    text,
  verarbeitungskennzeichen text,
  fehlerstatus             text        NOT NULL DEFAULT 'offen',
  fehlertext               text,
  uebertragungsweg text,
  sha256           text,
  betriebsart      text,
  absender_ik      text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT abr_uebermittlung_richtung_chk CHECK (richtung IN ('senden','empfangen')),
  CONSTRAINT abr_uebermittlung_fehlerstatus_chk CHECK (fehlerstatus IN ('offen','ok','fehler','abgebrochen')),
  CONSTRAINT abr_uebermittlung_betriebsart_chk CHECK (betriebsart IS NULL OR betriebsart IN ('test','erprobung','echt')),
  CONSTRAINT abr_uebermittlung_weg_chk CHECK (uebertragungsweg IS NULL OR uebertragungsweg IN ('portal','dfue','mail','datentraeger','papier'))
);

CREATE INDEX abr_uebermittlung_owner_zeit_idx ON public.abrechnung_uebermittlung (owner_id, begonnen_am DESC);
CREATE INDEX abr_uebermittlung_abrechnung_idx ON public.abrechnung_uebermittlung (abrechnung_id) WHERE abrechnung_id IS NOT NULL;

COMMENT ON TABLE public.abrechnung_uebermittlung IS
  'Gesetzliche Uebermittlungsdokumentation des Datenaustauschs gemaess § 302 SGB V, Anlage 1 TP5 Kap. 3(2) und Anhang 1 § 4.5(2). Mindestens 2 Jahre Aufbewahrungspflicht. Striktes PHI-Verbot.';

-- --------------------------------------------------------------------------
-- 2) Unveraenderlichkeits-Trigger (GoBD, Anlage 1 TP5 Kap. 3(2))
--    Vorlage: public.fn_abrechnung_zeile_festschreibung() (0000_baseline.sql)
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_abrechnung_uebermittlung_festschreibung()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
begin
  -- Loeschen ist gesetzlich untersagt: mindestens 2 Jahre Aufbewahrungsfrist
  if tg_op = 'DELETE' then
    raise exception 'Ein Eintrag der Uebermittlungsdokumentation kann nicht geloescht werden (Anlage 1 TP5 Kap. 3(2): mindestens 2 Jahre Aufbewahrungspflicht).';
  end if;

  -- Gesperrt (jede Aenderung wirft):
  -- richtung, physikalischer_dateiname, erstellt_am, laufende_nummer, transfernummer,
  -- partner_ik, absender_ik, begonnen_am, dateigroesse_bytes, sha256, betriebsart,
  -- owner_id, abrechnung_id, created_at.
  if new.id                       is distinct from old.id
  or new.richtung                 is distinct from old.richtung
  or new.physikalischer_dateiname is distinct from old.physikalischer_dateiname
  or new.erstellt_am              is distinct from old.erstellt_am
  or new.laufende_nummer          is distinct from old.laufende_nummer
  or new.transfernummer           is distinct from old.transfernummer
  or new.partner_ik               is distinct from old.partner_ik
  or new.absender_ik              is distinct from old.absender_ik
  or new.begonnen_am              is distinct from old.begonnen_am
  or new.dateigroesse_bytes       is distinct from old.dateigroesse_bytes
  or new.sha256                   is distinct from old.sha256
  or new.betriebsart              is distinct from old.betriebsart
  or new.owner_id                 is distinct from old.owner_id
  or new.abrechnung_id            is distinct from old.abrechnung_id
  or new.created_at               is distinct from old.created_at
  then
    raise exception 'Uebermittlungsdokumentation ist festgeschrieben (Anlage 1 TP5 Kap. 3(2)). Gesperrte Stammdaten duerfen nicht geaendert werden.';
  end if;

  -- Nur Vervollstaendigung erlaubt (NULL -> Wert, aber kein Wert -> anderer Wert):
  -- beendet_am, antwort_auf, uebertragungsweg.
  if old.beendet_am is not null and new.beendet_am is distinct from old.beendet_am then
    raise exception 'beendet_am darf nur einmalig ergaenzt werden (NULL -> Wert) und danach nicht mehr veraendert werden.';
  end if;

  if old.antwort_auf is not null and new.antwort_auf is distinct from old.antwort_auf then
    raise exception 'antwort_auf darf nur einmalig ergaenzt werden (NULL -> Wert) und danach nicht mehr veraendert werden.';
  end if;

  if old.uebertragungsweg is not null and new.uebertragungsweg is distinct from old.uebertragungsweg then
    raise exception 'uebertragungsweg darf nur einmalig ergaenzt werden (NULL -> Wert) und danach nicht mehr veraendert werden.';
  end if;

  -- ⚠️ business_id und created_by stehen ABSICHTLICH in keiner der drei Listen.
  --    Beide haengen an ON DELETE SET NULL, und PostgreSQL fuehrt SET NULL als
  --    UPDATE aus — dieser Trigger feuert dabei mit. Waeren sie gesperrt,
  --    liesse sich anschliessend weder ein Standort noch ein Benutzerkonto
  --    loeschen: das DELETE liefe in eine Exception aus dieser Funktion.
  --    Genau diese Falle ist im Plan bei `podologie_behandlungen` beschrieben
  --    (zwei FKs, ON DELETE SET NULL, BEFORE-UPDATE-Trigger). Sie sind damit
  --    frei aenderbar — bewusst, nicht vergessen.
  --
  -- Frei aenderbar:
  --   • verarbeitungskennzeichen, fehlerstatus, fehlertext, partner_name
  --   • business_id, created_by (siehe Hinweis oben)
  --   • verarbeitungshinweise ist VOLLSTAENDIG frei:
  --     Begruendung: In einer Kundenbox gibt es keinen SQL-Zugang (O-114).
  --     Laeuft etwas schief, muss die Korrektur eine zusaetzliche Notiz sein koennen
  --     und nicht eine Zeilenaenderung — sonst gibt es gar keinen Weg.

  return new;
end $$;

CREATE TRIGGER trg_abrechnung_uebermittlung_festschreibung
  BEFORE DELETE OR UPDATE ON public.abrechnung_uebermittlung
  FOR EACH ROW EXECUTE FUNCTION public.fn_abrechnung_uebermittlung_festschreibung();

-- --------------------------------------------------------------------------
-- 3) Row Level Security (RLS)
-- --------------------------------------------------------------------------

ALTER TABLE public.abrechnung_uebermittlung ENABLE ROW LEVEL SECURITY;

-- ⚠️ RLS-Architektur:
-- Genau EINE Policy fuer SELECT, wortgleich zur Bauart von "Abrechnungszeile select scoping" (0000_baseline.sql):
-- auth.uid() = owner_id OR auth.uid() IN (SELECT profiles.id FROM profiles WHERE profiles.owner_id = abrechnung_uebermittlung.owner_id)
--
-- ⚠️ KEINE INSERT-/UPDATE-Policy:
-- Geschrieben wird ausschliesslich mit service_role ueber backend-Services.
--
-- ⚠️ Nicht komplett verschlossen (Bedingung von onprem):
-- Die Tabelle wird NICHT wie `nummernkreise` komplett verschlossen. In der Kundenbox
-- muss der Praxisinhaber die Frage "wann ist diese Datei rausgegangen" an seinem
-- EIGENEN Bildschirm beantworten koennen — wir Betreiber kommen dort nicht hinein.
-- Die SELECT-Policy erfuellt genau diesen Zweck.
CREATE POLICY "Abrechnung uebermittlung select scoping" ON public.abrechnung_uebermittlung
  FOR SELECT TO authenticated
  USING (((auth.uid() = owner_id) OR (auth.uid() IN (
    SELECT profiles.id
    FROM public.profiles
    WHERE (profiles.owner_id = abrechnung_uebermittlung.owner_id)
  ))));
