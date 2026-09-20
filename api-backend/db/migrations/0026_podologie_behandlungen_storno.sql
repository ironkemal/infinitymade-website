-- §302-Echtbetrieb, Schritt 1.5 (ABRECHNUNG_ECHTBETRIEB_PLAN.md) — Entscheidung K3.
--
-- `podologie_behandlungen` ist die Behandlungsdokumentation der Podologie: eine
-- Zeile je erbrachter Behandlung, mit Datum, HPNR-Positionen, Lokalisation und
-- Notizen. Bis heute konnte diese Zeile per DELETE spurlos verschwinden und per
-- UPDATE spurlos anders lauten.
--
-- Warum das nicht bleiben darf (legal-de, 20.09.2026):
--   § 630f Abs. 1 S. 2 BGB — Berichtigungen und Aenderungen der
--   Patientenakte muessen so vorgenommen werden, dass der urspruengliche
--   Inhalt erkennbar bleibt. Die Frist dafuer beginnt im Moment der
--   AUFZEICHNUNG, nicht erst mit der Abrechnung. Ein Schutz, der an
--   `invoice_id IS NOT NULL` haengt, laesst deshalb genau das Fenster offen,
--   das die Norm schliessen will.
--   BGH VI ZR 84/19 — eine elektronische Dokumentation, die nachtraegliche
--   Aenderungen nicht sichtbar macht, hat keinen Beweiswert. "Durchstreichen
--   statt Radieren."
--
-- Folge fuer die Anwendung: eine falsch erfasste Behandlung wird nicht
-- korrigiert, sondern STORNIERT (mit Grund, Zeitpunkt und Person) und
-- daneben neu erfasst. Die stornierte Zeile bleibt lesbar und wird
-- durchgestrichen angezeigt.
--
-- ⛔ KEIN Kulanzfenster. Auch "innerhalb von 5 Minuten loeschbar" waere in
--    § 630f nicht gedeckt und ist genau der Fall, den BGH VI ZR 84/19 ruegt.
--
-- ⚠️ ZWEI FREMDSCHLUESSEL-FALLEN, die den Trigger mitbestimmen:
--    `verordnung_id -> prescriptions(id) ON DELETE SET NULL` und
--    `invoice_id -> invoices(id) ON DELETE SET NULL` fuehrt Postgres als
--    UPDATE aus; der BEFORE-UPDATE-Trigger feuert dabei. Waeren diese Spalten
--    bedingungslos gesperrt, wuerde jedes `DELETE FROM prescriptions` bzw.
--    `DELETE FROM invoices` ab sofort scheitern — und mit ihm die
--    DSGVO-Loeschkette in api/dsgvo.js. Dasselbe gilt fuer
--    `employee_id -> profiles(id) ON DELETE SET NULL`, wenn ein
--    Mitarbeiterkonto geloescht wird.
--    Deshalb: diese drei duerfen auf NULL gesetzt werden, aber nicht auf
--    einen anderen Wert umgehaengt werden.
--
-- ⚠️ AUSSERHALB DIESER DATEI, aber im selben Schritt zwingend:
--    api/dsgvo.js — `podologie_behandlungen` muss aus DELETE_TABLES heraus.
--    Bleibt es drin, wirft der BEFORE-DELETE-Trigger und jede Kontoloeschung
--    endet in einer 500. Siehe Kommentar dort.
--
-- ZAEHLER: +3 Spalten, +1 CHECK, +2 Funktionen, +2 Trigger.
--          Keine neue Tabelle, kein neuer Index, keine Policy-Aenderung.
--          (Der Fremdschluessel auf `profiles` legt in PG KEINEN Index an, und
--           seine RI-Trigger sind tgisinternal=true — schema-zaehler.js zaehlt
--           sie nicht mit. Gegenprobe steht in erwartete-zaehler.json,
--           _hinweis_0025.)

-- --------------------------------------------------------------------------
-- 1) Die drei Storno-Spalten (rein additiv)
-- --------------------------------------------------------------------------

ALTER TABLE public.podologie_behandlungen
  ADD COLUMN IF NOT EXISTS storniert_am  timestamptz,
  ADD COLUMN IF NOT EXISTS storniert_von uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storno_grund  text;

COMMENT ON COLUMN public.podologie_behandlungen.storniert_am IS
  'Zeitpunkt der Stornierung. NULL = wirksame Behandlung. Gesetzt statt geloescht (§ 630f Abs. 1 S. 2 BGB): die Zeile bleibt lesbar, zaehlt aber nicht mehr — weder fuer die Einmaligkeitssperre noch fuer die §302-Datei.';
COMMENT ON COLUMN public.podologie_behandlungen.storniert_von IS
  'Wer storniert hat. ON DELETE SET NULL, damit das Loeschen eines Mitarbeiterkontos nicht an dieser Zeile haengenbleibt.';
COMMENT ON COLUMN public.podologie_behandlungen.storno_grund IS
  'Warum storniert wurde. Pflichtangabe — das "warum/wann erkennbar" ist der eigentliche Inhalt von § 630f Abs. 1 S. 2 BGB, ohne Grund ist die Stornierung dokumentarisch wertlos.';

-- Grund ist Pflicht, sobald storniert wird. Gleiche Bauart wie
-- `abrechnung_zeile`: CHECK absetzung_eur = 0 OR btrim(...) <> ''.
ALTER TABLE public.podologie_behandlungen
  ADD CONSTRAINT podologie_behandlungen_storno_grund_chk
  CHECK (storniert_am IS NULL OR btrim(COALESCE(storno_grund, '')) <> '');

-- --------------------------------------------------------------------------
-- 2) Festschreibung — Vorbild: prescriptions_festschreibung() (0020)
--
--    Unterschied zu 0020, mit Absicht:
--      • KEIN Tor. 0020 laesst alles durch, solange `belegnummer IS NULL`
--        (Entwurf vor der Einreichung). Hier gibt es kein solches Tor: die
--        Frist des § 630f beginnt mit der Aufzeichnung, nicht mit der
--        Abrechnung.
--      • DELETE wird geworfen. 0020 tut das bewusst nicht; dort haengt der
--        DSGVO-Loeschweg dran. Hier ist die Sperre der Auftrag (K3), und die
--        Folge fuer api/dsgvo.js wird dort ausdruecklich ausgetragen.
--      • Kein `new.updated_at := ...` — diese Tabelle hat keine solche Spalte.
-- --------------------------------------------------------------------------

CREATE FUNCTION public.podologie_behandlungen_festschreibung() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  -- Inhaltsfelder: bedingungslos gesperrt. Was hier steht, ist die
  -- Behandlungsdokumentation selbst.
  if new.behandlungsdatum  is distinct from old.behandlungsdatum
  or new.hpnr_codes        is distinct from old.hpnr_codes
  or new.diagnosegruppe    is distinct from old.diagnosegruppe
  or new.lokalisation      is distinct from old.lokalisation
  or new.notizen           is distinct from old.notizen
  or new.betrag_gkv        is distinct from old.betrag_gkv
  or new.owner_id          is distinct from old.owner_id
  or new.created_at        is distinct from old.created_at
  then
    raise exception 'Dokumentierte Behandlung ist unveraenderlich (§ 630f Abs. 1 S. 2 BGB). Eine Korrektur erfolgt durch Stornierung mit Grund und eine neue Behandlungszeile.';
  end if;

  -- Storno: nur der Weg NULL -> Wert. Eine Stornierung wird nicht
  -- zurueckgenommen; sonst waere sie kein Beleg, sondern eine Notiz.
  if old.storniert_am is not null
     and (new.storniert_am  is distinct from old.storniert_am
       or new.storno_grund  is distinct from old.storno_grund
       or new.storniert_von is distinct from old.storniert_von)
  then
    raise exception 'Eine Stornierung laesst sich nicht zuruecknehmen oder aendern (§ 630f Abs. 1 S. 2 BGB).';
  end if;

  -- verordnung_id: nur auf NULL. Das Umhaengen einer dokumentierten
  -- Behandlung an eine ANDERE Verordnung waere eine inhaltliche Aenderung.
  -- NULL zu erlauben ist kein Zugestaendnis, sondern Pflicht: der
  -- Fremdschluessel steht auf ON DELETE SET NULL (siehe Kopf).
  if new.verordnung_id is not null
     and new.verordnung_id is distinct from old.verordnung_id
  then
    raise exception 'Die Zuordnung zur Verordnung ist festgeschrieben und kann nur aufgehoben (NULL), nicht umgehaengt werden.';
  end if;

  -- employee_id: NULL -> Wert erlaubt (Altbestand wird nachgetragen),
  -- Wert -> NULL erlaubt (ON DELETE SET NULL beim Loeschen eines
  -- Mitarbeiterkontos), Wert -> anderer Wert nicht.
  if old.employee_id is not null
     and new.employee_id is not null
     and new.employee_id is distinct from old.employee_id
  then
    raise exception 'Die durchfuehrende Person ist festgeschrieben und kann nicht ausgetauscht werden.';
  end if;

  -- invoice_id bleibt bewusst offen: die Rechnungsbruecke setzt sie, und
  -- ON DELETE SET NULL nimmt sie beim Loeschen der Rechnung wieder zurueck.
  return new;
end $$;

CREATE FUNCTION public.podologie_behandlungen_kein_delete() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  -- Bedingungslos. Nicht an `invoice_id` haengen: die Aufbewahrungspflicht
  -- entsteht mit der Aufzeichnung, nicht mit der Abrechnung (K3).
  raise exception 'Eine dokumentierte Behandlung kann nicht geloescht werden (§ 630f Abs. 1 S. 2 BGB). Bitte stornieren — die Zeile bleibt sichtbar, zaehlt aber nicht mehr.';
end $$;

CREATE TRIGGER trg_podologie_behandlungen_festschreibung
  BEFORE UPDATE ON public.podologie_behandlungen
  FOR EACH ROW EXECUTE FUNCTION public.podologie_behandlungen_festschreibung();

CREATE TRIGGER trg_podologie_behandlungen_kein_delete
  BEFORE DELETE ON public.podologie_behandlungen
  FOR EACH ROW EXECUTE FUNCTION public.podologie_behandlungen_kein_delete();

GRANT ALL ON FUNCTION public.podologie_behandlungen_festschreibung() TO anon;
GRANT ALL ON FUNCTION public.podologie_behandlungen_festschreibung() TO authenticated;
GRANT ALL ON FUNCTION public.podologie_behandlungen_festschreibung() TO service_role;
GRANT ALL ON FUNCTION public.podologie_behandlungen_kein_delete() TO anon;
GRANT ALL ON FUNCTION public.podologie_behandlungen_kein_delete() TO authenticated;
GRANT ALL ON FUNCTION public.podologie_behandlungen_kein_delete() TO service_role;
