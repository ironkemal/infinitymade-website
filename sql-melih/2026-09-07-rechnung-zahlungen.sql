-- =====================================================================
-- Migration: rechnung_zahlungen + profiles.buchungskonten + invoices-Storno
-- Vorgesehener Name (für db/REGISTER.md + SCHEMA-Refresh danach):
--   20260907_rechnung_zahlungen_buchungskonten
-- Ziel: njvuclullotbksskpwgk (Produktion)
-- Von db-ustasi ausgearbeitet, geprüft von Claude (Hauptsitzung) — MCP-
-- Zugang fehlte in dieser Session komplett, deshalb hier zur manuellen
-- Ausführung im Supabase SQL-Editor.
-- =====================================================================
-- Nur TEIL A. Additiv, keine Datenverschiebung. Sicher zu laufen, auch
-- während die App läuft.
-- TEIL B (invoice_festschreibung anpassen) und TEIL C (Backfill) folgen
-- in einem zweiten Schritt — dafür wird zuerst Live-Info aus dieser DB
-- gebraucht (zwei Abfragen, im Chat übergeben).
--
-- A.7 ändert mit `belegliste` eine BESTEHENDE GoBD-Tabelle (neue Spalte
--    invoice_id, type-CHECK um 'rechnung' erweitert). Von db-ustasi am
--    07.09.2026 freigegeben: der type-CHECK ist eine Wertebereichsregel,
--    keine GoBD-Garantie — die drei echten Garantien der Tabelle
--    (prevent_belegliste_mod, trg_set_beleg_nr, fehlende UPDATE/DELETE-
--    Policies) bleiben unberührt. Präzedenz für exakt diesen Eingriff:
--    archive/supabase-migrations-vor-baseline/20260713000000_ausfallgebuehr.sql:81
--    (dort wurde 'ausfall' auf demselben Weg ergänzt).
--
-- ⛔ VOR A.7 einmal gegenprüfen, damit die Migration nicht mittendrin
--    abbricht (der DO-Block fängt es zwar ab, bricht dann aber ab):
--      SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--       WHERE conrelid = 'public.belegliste'::regclass AND contype = 'c';
--
-- ⛔ NACH A.7, sonst scheitert der erste echte Insert am Validator:
--    api-backend/billing/belegliste/helper.js -> validateBelegEntry()
--    erlaubt heute nur ['zuzahlung','barverkauf','storno'] — die DB kennt
--    aber schon vier Typen. Muss um 'rechnung' UND 'ausfall' erweitert
--    werden (letzteres ist eine bestehende Drift: ausfall.routes.js:466
--    schreibt deshalb am POST-Weg vorbei direkt in die Tabelle).
--    ⚠️ statistik.routes.js:197 FORDERUNGS_TYPEN dabei NICHT anfassen —
--    'rechnung' dort aufzunehmen füllt die Reihe "bezahlt", während die
--    Gegenreihe "offen" nur Rezepte zählt. Die Zeile landet ohnehin
--    korrekt in umsatzByMonth.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A.1  Owner-Kontenrahmen als jsonb
--   Muster: profiles.selbstzahler_stufen / profiles.fussbefund_legende.
--   Keine eigene Tabelle -> kein Seeding-Trigger, keine neue RLS-Fläche.
--   Leere Liste = Modul-Standard.
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS buchungskonten jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.buchungskonten IS
  'Owner-gepflegter Kontenrahmen: [{code,label,aktiv}] — Form und Normalisierung in module/buchungskonten.js. Leer = Modul-Standard (1000 Kasse, 1100 Postbank, 1200 Bank, 1210 Bank 2, 8700 Erloesschmaelerung, 4900 Teilabsetzung). Gebuchte Zeilen referenzieren NICHT hierher, sie speichern code+label als Snapshot (GoBD Rz. 107).';


-- ---------------------------------------------------------------------
-- A.2  Storno-Felder an invoices
--   ⚠️ Bleiben nach dieser Migration vorerst UNBESCHREIBBAR sobald
--   status <> 'draft' (bestehender Trigger invoice_festschreibung()).
--   Das ist Absicht bis TEIL B — kein toter Zustand, nur noch nicht
--   nutzbar. Erst NACH TEIL B im Frontend/Backend verwenden.
-- ---------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS storno_grund text,
  ADD COLUMN IF NOT EXISTS storno_am    date;


-- ---------------------------------------------------------------------
-- A.3  Zahlungs-Ledger, append-only
-- ---------------------------------------------------------------------
CREATE TABLE public.rechnung_zahlungen (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  invoice_id         uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,

  art                text NOT NULL CHECK (art IN ('zahlung','ausbuchung','storno')),
  betrag_eur         numeric(10,2) NOT NULL,
  zahlungsdatum      date NOT NULL DEFAULT CURRENT_DATE,

  -- SNAPSHOT, kein Fremdschlüssel: benennt der Owner später "1200 Bank"
  -- um, muss die gebuchte Zeile weiter zeigen, was gebucht wurde.
  gegenkonto_code    text NOT NULL,
  gegenkonto_label   text NOT NULL,

  -- Gegenbuchung zeigt auf die Zeile, die sie aufhebt.
  storniert_zeile_id uuid REFERENCES public.rechnung_zahlungen(id),
  bemerkung          text,

  created_at         timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  CONSTRAINT rechnung_zahlungen_vorzeichen CHECK (
    (art =  'storno' AND betrag_eur < 0) OR
    (art <> 'storno' AND betrag_eur > 0)
  ),
  CONSTRAINT rechnung_zahlungen_storno_bezug CHECK (
    (art = 'storno') = (storniert_zeile_id IS NOT NULL)
  )
);

CREATE INDEX idx_rechnung_zahlungen_invoice ON public.rechnung_zahlungen (invoice_id);
CREATE INDEX idx_rechnung_zahlungen_owner_datum ON public.rechnung_zahlungen (owner_id, zahlungsdatum);

-- Eine Zeile kann nur EINMAL storniert werden. Ohne diesen Index liessen sich
-- zwei Gegenbuchungen auf dieselbe Zahlung schreiben und der Saldo waere um
-- den Betrag zu niedrig — in einer append-only Tabelle nicht mehr korrigierbar
-- ausser durch eine dritte Zeile, die das Journal weiter verrauscht.
CREATE UNIQUE INDEX idx_rechnung_zahlungen_storno_einmalig
  ON public.rechnung_zahlungen (storniert_zeile_id)
  WHERE storniert_zeile_id IS NOT NULL;

COMMENT ON TABLE public.rechnung_zahlungen IS
  'Append-only Zahlungshistorie zu invoices (Privatrechnung). Der beglichene Betrag ist sum(betrag_eur), nicht invoices.payment_status - der ist nur Cache. UPDATE/DELETE per Trigger gesperrt (GoBD).';


-- ---------------------------------------------------------------------
-- A.4  GoBD-Sperre (eigene Funktion, eigene Fehlermeldung)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_rechnung_zahlungen_mod()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  RAISE EXCEPTION
    'Zahlungszeilen sind unveraenderlich (GoBD, § 146 Abs. 4 AO). Eine falsche Buchung wird durch eine NEUE Zeile mit art = ''storno'' aufgehoben - nicht geaendert und nicht geloescht.'
    USING ERRCODE = 'check_violation';
END;
$fn$;

CREATE TRIGGER trg_prevent_rechnung_zahlungen_mod
  BEFORE UPDATE OR DELETE ON public.rechnung_zahlungen
  FOR EACH ROW EXECUTE FUNCTION public.prevent_rechnung_zahlungen_mod();


-- ---------------------------------------------------------------------
-- A.5  Owner-Riegel: ein FREMDSCHLÜSSEL PRÜFT KEINE RLS.
--   Ohne diesen Trigger ließe sich die id einer fremden Rechnung in eine
--   eigene Zahlungszeile schreiben. Gleiches Muster wie
--   pruefe_booking_leistung_owner() / pruefe_booking_verordnung_owner().
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pruefe_rechnung_zahlung_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_owner uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM public.invoices WHERE id = NEW.invoice_id;
  IF v_owner IS NOT NULL AND v_owner <> NEW.owner_id THEN
    RAISE EXCEPTION 'Die Rechnung gehoert einem anderen Inhaber.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;

-- ⚠️ CREATE FUNCTION vergibt EXECUTE per Default an PUBLIC. Ohne diesen
--    REVOKE meldet der Advisor die Funktion als über /rest/v1/rpc/
--    aufrufbaren SECURITY DEFINER.
REVOKE EXECUTE ON FUNCTION public.pruefe_rechnung_zahlung_owner() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pruefe_rechnung_zahlung_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.pruefe_rechnung_zahlung_owner() FROM authenticated;

CREATE TRIGGER trg_pruefe_rechnung_zahlung_owner
  BEFORE INSERT ON public.rechnung_zahlungen
  FOR EACH ROW EXECUTE FUNCTION public.pruefe_rechnung_zahlung_owner();


-- ---------------------------------------------------------------------
-- A.6  RLS: SELECT + INSERT owner+Team, KEINE UPDATE/DELETE-Policy.
--   Muster wie belegliste und booking_status_korrekturen.
-- ---------------------------------------------------------------------
ALTER TABLE public.rechnung_zahlungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rechnungszahlungen select scoping"
  ON public.rechnung_zahlungen FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Rechnungszahlungen insert scoping"
  ON public.rechnung_zahlungen FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR owner_id = (SELECT p.owner_id FROM public.profiles p WHERE p.id = auth.uid())
  );
-- KEINE UPDATE-Policy, KEINE DELETE-Policy. Absicht (GoBD).


-- ---------------------------------------------------------------------
-- A.7  belegliste für die Bar-Brücke öffnen
--   ⚠️ ÄNDERT EINE BESTEHENDE GoBD-TABELLE. Von db-ustasi noch nicht
--      freigegeben (nachträglich gefunden) — vor dem Ausführen bestätigen
--      lassen. Ohne diesen Block ist die geplante Bar-Brücke NICHT
--      ausführbar: belegliste hat kein invoice_id, und der type-CHECK
--      kennt nur zuzahlung|barverkauf|storno|ausfall — der erste Insert
--      einer bar bezahlten Privatrechnung würde scheitern.
--
--   Reine DDL, keine Zeile wird verändert: prevent_belegliste_mod() ist
--   ein Zeilen-Trigger auf UPDATE/DELETE und greift hier nicht.
-- ---------------------------------------------------------------------
ALTER TABLE public.belegliste
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_belegliste_invoice
  ON public.belegliste (invoice_id) WHERE invoice_id IS NOT NULL;

COMMENT ON COLUMN public.belegliste.invoice_id IS
  'Bei type IN (''rechnung'',''storno''): die bar bezahlte Privatrechnung bzw. deren Gegenbuchung. Die Storno-Zeile braucht die Referenz ebenso, sonst ist der Kassenbuch-Saldo je Rechnung nicht rechenbar (Muster: prescription_id in saldoJeRezept). Bewusst KEIN CHECK darauf. Bank/EC erzeugen keine Beleglisten-Zeile, Ausbuchungen nie (kein Geldfluss).';

-- Den bestehenden type-CHECK um 'rechnung' erweitern. Der Constraint-Name
-- steht nicht im Dump, deshalb wird er nachgeschlagen statt geraten.
DO $$
DECLARE
  c_name  text;
  c_count integer;
BEGIN
  SELECT count(*), min(conname) INTO c_count, c_name
    FROM pg_constraint
   WHERE conrelid = 'public.belegliste'::regclass
     AND contype  = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%type%'
     AND pg_get_constraintdef(oid) ILIKE '%zuzahlung%';

  -- Lieber abbrechen als raten: an einer GoBD-Tabelle darf hier nicht
  -- versehentlich der falsche CHECK fallen.
  IF c_count = 0 THEN
    RAISE EXCEPTION 'type-CHECK auf belegliste nicht gefunden — Migration abgebrochen, bitte manuell nachsehen.';
  END IF;
  IF c_count > 1 THEN
    RAISE EXCEPTION 'Mehrdeutig: % CHECK-Constraints auf belegliste passen auf das Suchmuster. Migration abgebrochen, bitte den richtigen Namen manuell einsetzen.', c_count;
  END IF;

  EXECUTE format('ALTER TABLE public.belegliste DROP CONSTRAINT %I', c_name);
END $$;

ALTER TABLE public.belegliste
  ADD CONSTRAINT belegliste_type_check
  CHECK (type IN ('zuzahlung','barverkauf','storno','ausfall','rechnung'));

-- ⚠️ WANN 'rechnung' UND WANN 'zuzahlung' — das ist keine Stilfrage, daran
--    haengt das Mahnwesen. Der `type` beschreibt den GESCHAEFTSVORFALL, nicht
--    den Erfassungsweg:
--
--      Rechnung MIT Rezeptbezug  -> type='zuzahlung', BEIDE Referenzen setzen
--                                   (prescription_id UND invoice_id)
--      Rechnung OHNE Rezeptbezug -> type='rechnung'
--
--    Grund: mahnwesen.routes.js (~Z. 96) und statistik.routes.js (~Z. 226)
--    filtern auf .in('type', ['zuzahlung','storno']) und finden eine
--    'rechnung'-Zeile NICHT. Wer eine rezeptgebundene Zuzahlung als
--    type='rechnung' bucht, erzeugt genau den Bug, den module/rechnung-
--    zahlung.js am 12.08.2026 behoben hat: bezahlt, trotzdem gemahnt.
--    Mit der Regel oben bleiben ALLE bestehenden Abfragen unveraendert
--    korrekt — deshalb ist sie so gewaehlt.
--
--    Ebenfalls bindend: bei rezeptgebundener Zahlung setzt die RPC zusaetzlich
--    prescriptions.zuzahlung_kassiert_am (sonst zeigt die Oberflaeche das
--    Rezept weiter als nicht kassiert und jemand kassiert doppelt), und eine
--    AUSBUCHUNG auf eine rezeptgebundene Zuzahlung laeuft ueber
--    zuzahlung_korrekturen statt ueber dieses Ledger — sonst bleibt der
--    Kassenbuch-Saldo unter dem Soll und es wird weiter gemahnt.


-- ---------------------------------------------------------------------
-- A.8  Zwei Dinge, die beim Bauen der Auswertungen zu Fehlern führen,
--      wenn sie nicht dastehen
-- ---------------------------------------------------------------------
-- 1) PERIODENZUORDNUNG. rechnung_zahlungen.zahlungsdatum ist das BELEGDATUM
--    (frei wählbar, darf rückdatiert werden). belegliste.created_at ist das
--    BUCHUNGSDATUM (Zeitpunkt der Erfassung, unveränderlich). Eine am
--    07.09. erfasste Zahlung mit zahlungsdatum 30.08. steht im Journal
--    unter dem 07.09. und in der Zahlungshistorie unter dem 30.08. Das ist
--    GoBD-konform (§ 146 AO trennt beides bewusst) — aber ein Bericht muss
--    sagen, WELCHES der beiden Daten er summiert. Der Belegjournal-Bericht
--    summiert belegliste, also nach Buchungsdatum.
--
-- 2) DOPPELZÄHL-FALLE. Eine bar bezahlte Privatrechnung steht in BEIDEN
--    Tabellen (rechnung_zahlungen + belegliste). Für den Belegjournal-
--    Bericht ist das richtig, weil er nur belegliste liest. Wer später eine
--    Umsatzauswertung baut, darf NICHT beide Tabellen addieren.


-- =====================================================================
-- TEIL B1  Die Buchungsfunktion
-- =====================================================================
-- Warum eine Funktion und nicht drei Aufrufe aus dem Backend:
-- supabase-js/PostgREST kennt keine Mehrfach-Statement-Transaktion. Eine
-- Zahlung schreibt aber drei Dinge, von denen ZWEI append-only sind
-- (rechnung_zahlungen, belegliste) — die lassen sich bei einem Fehler nicht
-- durch Loeschen zuruecknehmen, sondern nur durch eine Gegenbuchung. Eine
-- Netzwerkpanne stuende dann als Geschaeftsvorfall im Journal.
--
-- Dazu kommt ein konkreter, dokumentierter Fehlerfall: set_next_beleg_nr()
-- zaehlt per MAX+1 (db/SCHEMA-RLS.sql:581-584). Bei zwei gleichzeitigen
-- Inserts faellt dieselbe Nummer und der UNIQUE-Index wirft — bei einem
-- app-seitigen Ablauf genau NACH dem bereits committeten Ledger-Insert.
--
-- ⚠️ TEIL B1 ist unabhaengig von TEIL B2 (Storno-Trigger). Diese Funktion
--    schreibt an invoices nur payment_status/status/paid_at, und dass diese
--    Felder von invoice_festschreibung() offen gelassen werden, ist
--    dokumentiert (db/SCHEMA-RLS.sql:594-596). B1 kann also sofort laufen.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.rechnung_zahlung_buchen(
  p_invoice_id             uuid,
  p_owner_id               uuid,
  p_created_by             uuid,
  p_betrag_eur             numeric,
  p_zahlungsdatum          date,
  p_gegenkonto_code        text,
  p_gegenkonto_label       text,
  p_restbetrag_modus       text,                 -- 'offen_lassen' | 'ausbuchen'
  p_ausbuchungskonto_code  text DEFAULT NULL,
  p_ausbuchungskonto_label text DEFAULT NULL,
  p_bemerkung              text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
-- SECURITY INVOKER (Default): der Aufrufer ist das Backend mit service_role,
-- das RLS ohnehin umgeht. So kann die Funktion nie zur Rechteausweitung
-- werden, falls sie jemand spaeter versehentlich grantet.
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_inv           record;
  v_rx_id         uuid;
  v_gebucht       numeric(10,2);
  v_offen         numeric(10,2);
  v_rest          numeric(10,2);
  v_ausbuchen     boolean;
  v_zahlung_id    uuid;
  v_ausbuchung_id uuid;
  v_beleg_nr      bigint := NULL;
  v_status        text;
  v_zahlart       text;
  v_rx            record;
BEGIN
  -- 1. Rechnung sperren. Ohne diese Sperre lesen zwei gleichzeitige Buchungen
  --    denselben offenen Betrag und buchen beide.
  SELECT id, owner_id, status, payment_status, total_patient,
         patient_id, invoice_number,
         COALESCE(prescription_id, verordnung_id) AS rezept_id
    INTO v_inv
    FROM public.invoices
   WHERE id = p_invoice_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rechnung nicht gefunden.' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_inv.owner_id <> p_owner_id THEN
    RAISE EXCEPTION 'Die Rechnung gehoert einem anderen Inhaber.' USING ERRCODE = '42501';
  END IF;

  IF v_inv.status = 'cancelled' THEN
    RAISE EXCEPTION 'Auf eine stornierte Rechnung kann nicht gebucht werden.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(v_inv.total_patient, 0) <= 0 THEN
    RAISE EXCEPTION 'Die Rechnung hat keinen Betrag (total_patient).'
      USING ERRCODE = 'check_violation';
  END IF;

  v_rx_id := v_inv.rezept_id;

  -- 2. Was liegt schon im Ledger? sum() ist die Wahrheit, nicht payment_status.
  SELECT COALESCE(sum(betrag_eur), 0)::numeric(10,2)
    INTO v_gebucht
    FROM public.rechnung_zahlungen
   WHERE invoice_id = p_invoice_id;

  -- 2b. Altbestand-Riegel: als bezahlt markiert, aber ohne Beleg. Das entsteht
  --     durch markiereRechnungBezahlt() (module/rechnung-zahlung.js), das
  --     payment_status setzt ohne Ledger-Zeile. Wuerde man hier weiterbuchen,
  --     saehe die Funktion den vollen Betrag als offen und dieselbe Zahlung
  --     liesse sich ein zweites Mal erfassen.
  IF v_gebucht = 0 AND v_inv.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Diese Rechnung gilt bereits als bezahlt, hat aber keinen Zahlungsbeleg. Bitte zuerst klaeren (Backfill), sonst wird dieselbe Zahlung doppelt erfasst.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_offen := (v_inv.total_patient - v_gebucht)::numeric(10,2);

  IF v_offen <= 0 THEN
    RAISE EXCEPTION 'Auf diese Rechnung ist bereits alles gebucht.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_betrag_eur IS NULL OR p_betrag_eur <= 0 THEN
    RAISE EXCEPTION 'Der eingegangene Betrag muss ueber 0 EUR liegen.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 3. Ueberzahlung: harter Riegel, kein Guthaben. "Mehr als die Rechnung" im
  --    Moment der Erfassung ist ein Tippfehler. numeric(10,2) -> exakter
  --    Vergleich, keine Toleranz noetig.
  IF p_betrag_eur > v_offen THEN
    RAISE EXCEPTION 'Mehr als offen: es stehen noch % EUR aus.', to_char(v_offen, 'FM999999990.00')
      USING ERRCODE = 'check_violation';
  END IF;

  v_rest      := (v_offen - p_betrag_eur)::numeric(10,2);
  v_ausbuchen := (p_restbetrag_modus = 'ausbuchen' AND v_rest > 0);

  -- 3b. Eine rezeptgebundene Forderung wird NICHT hier kleingerechnet.
  --     Dafuer gibt es zuzahlung_korrekturen samt Guthaben-Verrechnung und
  --     Protokoll (api-backend/billing/zuzahlung/korrektur.js). Zwei Wege,
  --     dieselbe Forderung zu reduzieren, waeren genau der Zustand, den dieses
  --     Feature vermeiden soll.
  IF v_ausbuchen AND v_rx_id IS NOT NULL THEN
    RAISE EXCEPTION 'Diese Rechnung haengt an einem Rezept — den Restbetrag ueber die Zuzahlungskorrektur reduzieren, nicht hier.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 4. Die Zahlung selbst.
  INSERT INTO public.rechnung_zahlungen
    (owner_id, invoice_id, art, betrag_eur, zahlungsdatum,
     gegenkonto_code, gegenkonto_label, bemerkung, created_by)
  VALUES
    (p_owner_id, p_invoice_id, 'zahlung', p_betrag_eur,
     COALESCE(p_zahlungsdatum, CURRENT_DATE),
     p_gegenkonto_code, p_gegenkonto_label, p_bemerkung, p_created_by)
  RETURNING id INTO v_zahlung_id;

  -- 5. Restbetrag ausbuchen (nur ohne Rezeptbezug, siehe 3b).
  IF v_ausbuchen THEN
    INSERT INTO public.rechnung_zahlungen
      (owner_id, invoice_id, art, betrag_eur, zahlungsdatum,
       gegenkonto_code, gegenkonto_label, bemerkung, created_by)
    VALUES
      (p_owner_id, p_invoice_id, 'ausbuchung', v_rest,
       COALESCE(p_zahlungsdatum, CURRENT_DATE),
       COALESCE(p_ausbuchungskonto_code, '8700'),
       COALESCE(p_ausbuchungskonto_label, 'Erloesschmaelerung'),
       'Restbetrag ausgebucht', p_created_by)
    RETURNING id INTO v_ausbuchung_id;
  END IF;

  -- 6. Bar-Bruecke. Nur Bargeld gehoert ins Kassenbuch (§ 146 AO
  --    Kassensturzfaehigkeit); Bank/EC nicht, eine Ausbuchung nie (kein Geld
  --    geflossen).
  --
  --    ⚠️ Der `type` beschreibt den GESCHAEFTSVORFALL, nicht den Erfassungsweg:
  --    haengt die Rechnung an einem Rezept, wird als 'zuzahlung' gebucht.
  --    mahnwesen.routes.js und statistik.routes.js filtern auf
  --    type IN ('zuzahlung','storno') und wuerden eine 'rechnung'-Zeile
  --    uebersehen — der Patient bekaeme eine Mahnung fuer bezahltes Geld.
  IF p_gegenkonto_code = '1000' THEN
    v_zahlart := 'bar';
    INSERT INTO public.belegliste
      (owner_id, type, amount_eur, patient_id, prescription_id, invoice_id,
       reference_text, zahlart, created_by)
    VALUES
      (p_owner_id,
       CASE WHEN v_rx_id IS NOT NULL THEN 'zuzahlung' ELSE 'rechnung' END,
       p_betrag_eur, v_inv.patient_id, v_rx_id, p_invoice_id,
       'Zahlungseingang Rechnung ' || COALESCE(v_inv.invoice_number, ''),
       v_zahlart, p_created_by)
    RETURNING beleg_nr INTO v_beleg_nr;
  END IF;

  -- 7. Rezeptvermerk. Ohne ihn zeigt die Oberflaeche das Rezept weiter als
  --    "nicht kassiert" und jemand kassiert ein zweites Mal. Entspricht dem
  --    optimistischen .is('zuzahlung_kassiert_am', null)-Claim aus
  --    kassiereZuzahlung (dashboard.js).
  IF v_rx_id IS NOT NULL AND v_rest = 0 THEN
    SELECT id, zuzahlung_eur, zuzahlung_befreit, zuzahlung_kassiert_am
      INTO v_rx
      FROM public.prescriptions
     WHERE id = v_rx_id
       FOR UPDATE;

    IF FOUND
       AND v_rx.zuzahlung_kassiert_am IS NULL
       AND COALESCE(v_rx.zuzahlung_befreit, false) = false
       AND COALESCE(v_rx.zuzahlung_eur, 0) > 0 THEN
      UPDATE public.prescriptions
         SET zuzahlung_kassiert_am  = now(),
             zuzahlung_kassiert_von = p_created_by,
             zuzahlung_kassiert_eur = v_rx.zuzahlung_eur,
             zuzahlung_zahlart      = COALESCE(v_zahlart, 'ueberweisung')
       WHERE id = v_rx_id;
    END IF;
  END IF;

  -- 8. Cache auf der Rechnung. NUR hier geschrieben — sonst entstehen wieder
  --    zwei Wahrheiten fuer "bezahlt".
  v_status := CASE WHEN v_rest = 0 OR v_ausbuchen THEN 'paid' ELSE 'partial' END;

  UPDATE public.invoices
     SET payment_status = v_status,
         status         = CASE WHEN v_status = 'paid' THEN 'paid' ELSE status END,
         paid_at        = CASE WHEN v_status = 'paid' THEN now() ELSE paid_at END
   WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'zahlung_id',     v_zahlung_id,
    'ausbuchung_id',  v_ausbuchung_id,
    'beleg_nr',       v_beleg_nr,
    'payment_status', v_status,
    'offen_eur',      CASE WHEN v_ausbuchen THEN 0 ELSE v_rest END
  );
END;
$fn$;

-- Nur das Backend (service_role) ruft diese Funktion auf. Alle client-
-- aufrufbaren RPCs im Projekt sind lesende Lookups; schreibende laufen
-- serverseitig. Ohne diesen REVOKE waere sie ueber /rest/v1/rpc/ erreichbar.
REVOKE EXECUTE ON FUNCTION public.rechnung_zahlung_buchen(
  uuid, uuid, uuid, numeric, date, text, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rechnung_zahlung_buchen(
  uuid, uuid, uuid, numeric, date, text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rechnung_zahlung_buchen(
  uuid, uuid, uuid, numeric, date, text, text, text, text, text, text) FROM authenticated;


-- =====================================================================
-- ROLLBACK  (auf ausdrueckliche Anweisung, 08.09.2026)
-- =====================================================================
-- ⚠️ Das Projekt fuehrt sonst KEINE Down-Migrations. Die Begruendung steht in
--    api-backend/db/migrations/README.md (Kural 3): ein down-Schritt wird nie
--    getestet und funktioniert an dem Tag nicht, an dem man ihn braucht; der
--    echte Rueckweg ist das Backup. Dieser Block ist deshalb bewusst
--    AUSKOMMENTIERT und kein Teil des Migrationslaufs.
--
-- ⛔ NICHT blind ausfuehren. Er wirft Daten weg. Reihenfolge beachten:
--    zuerst die Objekte, die auf andere zeigen.
--
-- ⛔ Sobald die erste echte Zahlung gebucht wurde, ist dieses Skript KEIN
--    Rueckweg mehr, sondern eine Loeschung von Buchhaltungsdaten
--    (§ 147 AO Aufbewahrungspflicht). Ab dann gilt: vorwaerts korrigieren,
--    nicht zurueckrollen.
--
--   -- 1. Buchungsfunktion
--   DROP FUNCTION IF EXISTS public.rechnung_zahlung_buchen(
--     uuid, uuid, uuid, numeric, date, text, text, text, text, text, text);
--
--   -- 2. Ledger samt Triggern und Indizes (fallen mit der Tabelle)
--   DROP TABLE IF EXISTS public.rechnung_zahlungen;
--   DROP FUNCTION IF EXISTS public.prevent_rechnung_zahlungen_mod();
--   DROP FUNCTION IF EXISTS public.pruefe_rechnung_zahlung_owner();
--
--   -- 3. belegliste zurueckbauen. NUR moeglich, solange keine Zeile den
--   --    neuen Typ traegt — sonst verletzt der alte CHECK bestehende Daten.
--   --    Vorher pruefen:
--   --      SELECT count(*) FROM public.belegliste WHERE type = 'rechnung';
--   ALTER TABLE public.belegliste DROP CONSTRAINT IF EXISTS belegliste_type_check;
--   ALTER TABLE public.belegliste ADD CONSTRAINT belegliste_type_check
--     CHECK (type IN ('zuzahlung','barverkauf','storno','ausfall'));
--   DROP INDEX IF EXISTS public.idx_belegliste_invoice;
--   ALTER TABLE public.belegliste DROP COLUMN IF EXISTS invoice_id;
--
--   -- 4. Spalten. Wegwerfen, was der Owner evtl. schon gepflegt hat —
--   --    vorher sichern:
--   --      SELECT id, buchungskonten FROM public.profiles
--   --       WHERE buchungskonten <> '[]'::jsonb;
--   ALTER TABLE public.invoices DROP COLUMN IF EXISTS storno_grund;
--   ALTER TABLE public.invoices DROP COLUMN IF EXISTS storno_am;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS buchungskonten;
--
--   -- 5. NICHT vergessen: invoice_festschreibung() wurde von TEIL B2
--   --    veraendert. Der Rueckbau DIESER Funktion steht nicht hier, weil ihr
--   --    Original erst zur Laufzeit bekannt ist — vor TEIL B2 den Rumpf per
--   --    pg_get_functiondef() sichern und beim Rueckbau genau den
--   --    zurueckspielen.
