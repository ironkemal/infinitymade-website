-- §302-Echtbetrieb, Schritt 1.2 (ABRECHNUNG_ECHTBETRIEB_PLAN.md) —
-- ZWEI dauerhafte Zaehler: Datenaustauschreferenz und Transfernummer.
--
-- WAS HEUTE FALSCH IST (gkv-302, 20.09.2026). Alle drei Erzeugungsrouten
-- rechnen `const datennummer = (weekCount || 0) + 1;` aus einem COUNT(*) auf
-- `abrechnung`. Daran stimmt dreierlei nicht:
--
--   1) Falscher Geltungsbereich. Anlage 1 TP5 V21, Kap. 5.4 (UNB 0020) und
--      Kap. 7.2: die Datenaustauschreferenz laeuft JE PAAR
--      (Absender-IK, Empfaenger-IK) fort — also je Datenannahmestelle.
--      Der Code zaehlt je `owner_id`. Sobald eine Praxis an zwei
--      Datenannahmestellen liefert, ist keine der beiden Folgen fortlaufend.
--   2) Jaehrlicher Neustart. `gte(created_at, '<Jahr>-01-01')` setzt jeden
--      1. Januar wieder auf 00001. Die Spezifikation erlaubt einen Neustart
--      nur beim Ueberlauf von 99999.
--   3) COUNT(*). Eine geloeschte Zeile gibt die Nummer zurueck, und zwei
--      gleichzeitige Einreichungen bekommen dieselbe.
--
-- Belegter Schaden: die Reihenfolge im Korrekturverfahren bricht. Wird eine
-- Korrektur vor ihrer Erstrechnung verarbeitet, weist die Kasse sie ab
-- (Kap. 7.2) — und der Fehler ist von aussen schwer zu erkennen.
-- Rechtlich (legal-de): eine doppelte Einreichung ist eine Fehlfunktion,
-- kein Anwenderfehler; ueber AGB § 9(2) (Kardinalpflicht) haften WIR.
--
-- ZWEITER ZAEHLER: die Transfernummer ist etwas anderes und wurde bisher aus
-- `datennummer` abgeleitet (builder.js:427, Modulo) — genau das, wovon die
-- Spezifikation sagt, es habe "keinen Bezug zur lfd. Nr. des Vorlaufsatzes".
-- Sie zaehlt UEBERTRAGUNGEN, laeuft 1..999 im Kreis (Anhang 1 § 4.3,
-- buildPhysikalischerDateiname) und bleibt bei einer FEHLGESCHLAGENEN
-- Uebertragung gleich. Deshalb wird sie einmal je Datei vergeben und AUF DER
-- ZEILE festgehalten: ein zweiter Sendeversuch derselben Datei nimmt dieselbe
-- Nummer, weil er dieselbe Zeile liest.
--   ❓ Offene Frage an `gkv-302`: der Plan schreibt "0..999", der Wortlaut in
--      Anhang 1 § 4.3 (so wie er in filename.js zitiert ist) "1..999". Diese
--      Migration folgt dem Code/Zitat (1..999). Falls 0 zulaessig ist, ist das
--      eine reine Erweiterung des Wertebereichs.
--
-- ⚠️ DREI SZENARIEN, die `onprem` (O-115) nachgetragen hat:
--   1) SaaS -> Box: die `abrechnung`-Tabelle der Box ist leer, der Zaehler
--      begaenne bei 1 und wuerde Referenzen ein ZWEITES Mal vergeben. Aus
--      derselben Nummer entsteht ueber buildSammelRechnungsnummer() auch die
--      Rechnungsnummer — es beisst also zusaetzlich die GoBD-Seite.
--   2) `restore.sh` dreht den Zaehler zurueck.
--   3) Beides ist nur zu heilen, wenn der Zaehler VORWAERTS gesetzt werden
--      kann. Dafuer gibt es unten `datenaustausch_zaehler_vorstellen()` —
--      ausschliesslich vorwaerts, nie zurueck.
-- ⛔ Eine Vergabe aus der Zentrale ist ausgeschlossen (neue Typ-A-Abhaengig-
--    keit; eine Box ohne Netz koennte keine Rechnung mehr schreiben).
--
-- ZAEHLER: +1 Tabelle, +3 Funktionen, +0 Policy (RLS an, bewusst OHNE Policy —
--          wie `nummernkreise`), +1 Index (der Primaerschluessel), +3 Spalten
--          an `abrechnung` (datenaustauschreferenz, transfernummer,
--          empfaenger_ik).

-- --------------------------------------------------------------------------
-- 1) Die Zaehlerzeile
-- --------------------------------------------------------------------------

CREATE TABLE public.datenaustausch_zaehler (
  absender_ik    text NOT NULL,
  empfaenger_ik  text NOT NULL,
  owner_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  letzte_referenz      bigint NOT NULL DEFAULT 0,
  letzte_transfernummer integer NOT NULL DEFAULT 0,
  aktualisiert_am      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (absender_ik, empfaenger_ik)
);

COMMENT ON TABLE public.datenaustausch_zaehler IS
  'Dauerhafte §302-Zaehler je Paar (Absender-IK, Empfaenger-IK). Wird ausschliesslich ueber die drei SECURITY-DEFINER-Funktionen unten angefasst — kein Client, kein PostgREST.';
COMMENT ON COLUMN public.datenaustausch_zaehler.letzte_referenz IS
  'Monoton, ohne Jahresruecksetzung, ohne Obergrenze. Der 5-stellige UNB-Wert entsteht daraus erst bei der Ausgabe (((n-1) %% 99999) + 1) — so ueberlaeuft das SPEZIFIKATIONSFELD bei 99999, die HISTORIE aber nicht.';
COMMENT ON COLUMN public.datenaustausch_zaehler.letzte_transfernummer IS
  'Eigener Zaehler, 1..999 im Kreis. Ausdruecklich ohne Bezug zur Datenaustauschreferenz (Anhang 1 § 4.3).';
COMMENT ON COLUMN public.datenaustausch_zaehler.owner_id IS
  'Mandant, zu dem die Absender-IK gehoert. Nicht Teil des Schluessels: fortlaufend ist die Folge je IK-Paar, nicht je Konto.';

ALTER TABLE public.datenaustausch_zaehler ENABLE ROW LEVEL SECURITY;
-- Bewusst KEINE Policy — wie `nummernkreise`. Kein Client fasst den Zaehler
-- direkt an; die Funktionen laufen als SECURITY DEFINER.

-- --------------------------------------------------------------------------
-- 2) Vergabe — atomar, wie `naechste_nummer()` (Konsey 2026-08-12, Kova 2)
-- --------------------------------------------------------------------------

CREATE FUNCTION public.naechste_datenaustauschreferenz(
  p_owner uuid, p_absender_ik text, p_empfaenger_ik text
) RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_n bigint;
begin
  if p_owner is null or btrim(coalesce(p_absender_ik,'')) = '' or btrim(coalesce(p_empfaenger_ik,'')) = '' then
    raise exception 'naechste_datenaustauschreferenz: owner, Absender-IK und Empfaenger-IK sind Pflicht';
  end if;

  -- INSERT .. ON CONFLICT DO UPDATE .. RETURNING sperrt die Zeile; zwei
  -- gleichzeitige Einreichungen bekommen verschiedene Nummern.
  insert into datenaustausch_zaehler (absender_ik, empfaenger_ik, owner_id, letzte_referenz)
  values (p_absender_ik, p_empfaenger_ik, p_owner, 1)
  on conflict (absender_ik, empfaenger_ik) do update
    set letzte_referenz = datenaustausch_zaehler.letzte_referenz + 1,
        aktualisiert_am = now()
  returning letzte_referenz into v_n;

  -- Der Zaehler laeuft weiter, das SPEZIFIKATIONSFELD ist 5-stellig.
  -- Anlage 1 TP5 V21 erlaubt den Neustart nur beim Ueberlauf von 99999.
  return ((v_n - 1) % 99999)::integer + 1;
end $$;

CREATE FUNCTION public.naechste_transfernummer(
  p_owner uuid, p_absender_ik text, p_empfaenger_ik text
) RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_n integer;
begin
  if p_owner is null or btrim(coalesce(p_absender_ik,'')) = '' or btrim(coalesce(p_empfaenger_ik,'')) = '' then
    raise exception 'naechste_transfernummer: owner, Absender-IK und Empfaenger-IK sind Pflicht';
  end if;

  insert into datenaustausch_zaehler (absender_ik, empfaenger_ik, owner_id, letzte_transfernummer)
  values (p_absender_ik, p_empfaenger_ik, p_owner, 1)
  on conflict (absender_ik, empfaenger_ik) do update
    -- 1..999 im Kreis: nach 999 kommt wieder 1, nicht 0.
    set letzte_transfernummer = (datenaustausch_zaehler.letzte_transfernummer % 999) + 1,
        aktualisiert_am = now()
  returning letzte_transfernummer into v_n;

  return v_n;
end $$;

-- --------------------------------------------------------------------------
-- 3) Vorstellen — der Weg aus O-115 (Migration, restore.sh)
--    NUR VORWAERTS. Ein Ruecksetzen wuerde genau den Schaden anrichten,
--    gegen den der Zaehler gebaut ist.
-- --------------------------------------------------------------------------

CREATE FUNCTION public.datenaustausch_zaehler_vorstellen(
  p_owner uuid, p_absender_ik text, p_empfaenger_ik text,
  p_referenz bigint, p_transfernummer integer
) RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into datenaustausch_zaehler (absender_ik, empfaenger_ik, owner_id, letzte_referenz, letzte_transfernummer)
  values (p_absender_ik, p_empfaenger_ik, p_owner,
          greatest(coalesce(p_referenz, 0), 0),
          least(greatest(coalesce(p_transfernummer, 0), 0), 999))
  on conflict (absender_ik, empfaenger_ik) do update
    set letzte_referenz = greatest(datenaustausch_zaehler.letzte_referenz, coalesce(p_referenz, 0)),
        letzte_transfernummer = greatest(datenaustausch_zaehler.letzte_transfernummer,
                                         least(coalesce(p_transfernummer, 0), 999)),
        aktualisiert_am = now();
end $$;

-- Die drei Funktionen sind SECURITY DEFINER und fassen einen Zaehler an, aus
-- dem Rechnungsnummern entstehen. PUBLIC hat hier nichts zu suchen (S-04).
REVOKE EXECUTE ON FUNCTION public.naechste_datenaustauschreferenz(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.naechste_transfernummer(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.datenaustausch_zaehler_vorstellen(uuid, text, text, bigint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.naechste_datenaustauschreferenz(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.naechste_transfernummer(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.datenaustausch_zaehler_vorstellen(uuid, text, text, bigint, integer) TO service_role;

-- --------------------------------------------------------------------------
-- 4) Die vergebenen Nummern gehoeren auf die Zeile
--    Ohne sie laesst sich eine Datei nicht identisch neu erzeugen, und die
--    Transfernummer waere bei einem zweiten Sendeversuch eine andere.
-- --------------------------------------------------------------------------

ALTER TABLE public.abrechnung
  ADD COLUMN IF NOT EXISTS datenaustauschreferenz integer,
  ADD COLUMN IF NOT EXISTS transfernummer         integer,
  ADD COLUMN IF NOT EXISTS empfaenger_ik          text;

COMMENT ON COLUMN public.abrechnung.datenaustauschreferenz IS
  'Der 5-stellige UNB-0020-Wert DIESER Datei, wie vergeben. Nicht neu berechnen — er ist bei der Kasse hinterlegt.';
COMMENT ON COLUMN public.abrechnung.transfernummer IS
  'Die 1..999-Transfernummer DIESER Datei (Stellen 6-8 des physikalischen Dateinamens). Ein wiederholter Sendeversuch nimmt dieselbe Nummer (Anhang 1 § 4.3).';
COMMENT ON COLUMN public.abrechnung.empfaenger_ik IS
  'IK der Datenannahmestelle, an die diese Datei geht. Bisher nur fluechtig in der Route bekannt; der Zaehler laeuft je (Absender-IK, Empfaenger-IK) und ohne diese Spalte ist im Nachhinein nicht mehr feststellbar, welche Folge die Datei fortgeschrieben hat.';

-- Seed aus dem Bestand: die bisher vergebenen Nummern duerfen kein zweites
-- Mal rausgehen. Es gibt heute keinen `empfaenger_ik` auf den Altzeilen —
-- deshalb wird der Zaehler NICHT rueckwirkend je Paar aufgebaut, sondern nur
-- der bisher hoechste Wert je Absender-IK vorgemerkt, sobald die erste Datei
-- unter dem neuen Verfahren erzeugt wird. Das leistet
-- `datenaustausch_zaehler_vorstellen()`; ein automatischer Backfill waere
-- geraten, nicht gewusst.
