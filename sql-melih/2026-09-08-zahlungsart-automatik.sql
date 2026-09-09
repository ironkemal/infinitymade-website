-- =====================================================================
-- Migration: Zahlungsart-Automatik nach Rechnungserstellung (Ops #271)
-- Vorgesehener Name (für db/REGISTER.md + SCHEMA-Refresh danach):
--   20260908_zahlungsart_automatik
-- Ziel: njvuclullotbksskpwgk (Produktion)
-- Von Claude (Hauptsitzung) ausgearbeitet, VOR Ausführung von db-ustasi
-- gegengeprüft. Baut auf sql-melih/2026-09-07-rechnung-zahlungen.sql auf
-- (rechnung_zahlungen, profiles.buchungskonten, rechnung_zahlung_buchen()) —
-- diese Migration bringt keinen der dortigen Objekte neu, sie erweitert nur.
--
-- ⚠️ VOR AUSFÜHRUNG: db-ustasi muss diese Datei freigegeben haben (Pflicht
--    laut CLAUDE.md § Schema-Änderungen). Ohne Freigabe nicht ausführen.
--
-- Hintergrund (Ops #271, Bestandsaufnahme 08.09.2026): der Kartentext will
-- "Bar/Karte/Überweisung/PayPal" abfragen und bei Karte den Beleg automatisch
-- erzeugen statt manuell nachzutragen. Zwei Dinge fehlten dafür:
--   1. `belegliste` kannte als Zahlart nur (bar, ec, ueberweisung, sonstiges) —
--      kein `paypal`. Dasselbe Vokabular hat `prescriptions.zuzahlung_zahlart`.
--   2. `rechnung_zahlung_buchen()` erzeugte einen Beleg NUR bei Bar
--      (Konto '1000'). `belegliste` ist aber schon heute faktisch ein
--      Belegjournal (kassiereZuzahlung schreibt dort auch ec/ueberweisung),
--      keine reine Bar-Kassenbuch-Tabelle — der neue RPC hätte als einziger
--      Schreibweg eine abweichende Bar-only-Regel gehabt. Entscheidung des
--      Nutzers 08.09.2026: Variante B — jede Zahlart erzeugt einen Beleg,
--      das Bar-Kassenbuch (§ 146 AO Kassensturzfähigkeit) wird daraus über
--      den `zahlart`-Filter hergestellt (Frontend: dashboard.html
--      #blFilterZahlart).
-- =====================================================================


-- ---------------------------------------------------------------------
-- TEIL A — 'paypal' als Zahlart zulassen
--   ⚠️ Ändert ZWEI bestehende GoBD-/Fach-Tabellen. Muster: Teil A.7 aus
--   sql-melih/2026-09-07-rechnung-zahlungen.sql — Constraint-Name per
--   pg_get_constraintdef() nachschlagen, nicht raten. Bricht bei
--   Mehrdeutigkeit ab statt zu raten.
-- ---------------------------------------------------------------------

-- A.1  belegliste.belegliste_zahlart_check
DO $$
DECLARE
  c_name  text;
  c_count integer;
BEGIN
  SELECT count(*), min(conname) INTO c_count, c_name
    FROM pg_constraint
   WHERE conrelid = 'public.belegliste'::regclass
     AND contype  = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%zahlart%'
     AND pg_get_constraintdef(oid) ILIKE '%ueberweisung%';

  IF c_count = 0 THEN
    RAISE EXCEPTION 'zahlart-CHECK auf belegliste nicht gefunden — Migration abgebrochen, bitte manuell nachsehen.';
  END IF;
  IF c_count > 1 THEN
    RAISE EXCEPTION 'Mehrdeutig: % CHECK-Constraints auf belegliste passen auf das Suchmuster. Migration abgebrochen, bitte den richtigen Namen manuell einsetzen.', c_count;
  END IF;

  EXECUTE format('ALTER TABLE public.belegliste DROP CONSTRAINT %I', c_name);
END $$;

ALTER TABLE public.belegliste
  ADD CONSTRAINT belegliste_zahlart_check
  CHECK (zahlart IS NULL OR zahlart IN ('bar','ec','ueberweisung','sonstiges','paypal'));

-- A.2  prescriptions — CHECK auf zuzahlung_zahlart (Name im Dump nicht
--      genannt, db/SCHEMA.sql:1799 nennt nur die Werte). Gleiche Erweiterung,
--      sonst kann eine PayPal-Zahlung auf eine rezeptgebundene Rechnung
--      zuzahlung_zahlart nicht setzen (rechnung_zahlung_buchen() Schritt 7).
DO $$
DECLARE
  c_name  text;
  c_count integer;
BEGIN
  SELECT count(*), min(conname) INTO c_count, c_name
    FROM pg_constraint
   WHERE conrelid = 'public.prescriptions'::regclass
     AND contype  = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%zuzahlung_zahlart%'
     AND pg_get_constraintdef(oid) ILIKE '%ueberweisung%';

  IF c_count = 0 THEN
    RAISE EXCEPTION 'zuzahlung_zahlart-CHECK auf prescriptions nicht gefunden — Migration abgebrochen, bitte manuell nachsehen.';
  END IF;
  IF c_count > 1 THEN
    RAISE EXCEPTION 'Mehrdeutig: % CHECK-Constraints auf prescriptions passen auf das Suchmuster. Migration abgebrochen, bitte den richtigen Namen manuell einsetzen.', c_count;
  END IF;

  EXECUTE format('ALTER TABLE public.prescriptions DROP CONSTRAINT %I', c_name);
END $$;

ALTER TABLE public.prescriptions
  ADD CONSTRAINT prescriptions_zuzahlung_zahlart_check
  CHECK (zuzahlung_zahlart IS NULL OR zuzahlung_zahlart IN ('bar','ec','ueberweisung','sonstiges','paypal'));


-- ---------------------------------------------------------------------
-- TEIL B — rechnung_zahlung_buchen() ersetzen
--   Gleiche Signatur wie sql-melih/2026-09-07-…:310-513, EIN neuer
--   Parameter am Ende (p_zahlart) — bestehende Aufrufer, die ihn nicht
--   mitgeben, würden brechen; das Backend gibt ihn ab diesem Deploy immer
--   mit (api-backend/billing/api/rechnung-zahlung.routes.js), daher ohne
--   DEFAULT — ein fehlender Wert soll aussagekräftig fehlschlagen, nicht
--   still auf einen falschen Default fallen.
--
--   ⚠️ CREATE OR REPLACE ersetzt NUR bei identischer Signatur. Ein
--   zusätzlicher Parameter macht daraus eine zweite Überladung, nicht einen
--   Ersatz — die alte 11-Parameter-Funktion bliebe sonst live liegen und
--   würde bei jedem Aufruf OHNE p_zahlart (z. B. ein vergessener alter
--   Client) still die alte Bar-only-Logik fahren, statt laut zu fehlschlagen.
--   Deshalb zuerst die exakte alte Signatur droppen.
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.rechnung_zahlung_buchen(
  uuid, uuid, uuid, numeric, date, text, text, text, text, text, text);

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
  p_bemerkung              text DEFAULT NULL,
  p_zahlart                text DEFAULT NULL     -- 'bar'|'ec'|'ueberweisung'|'paypal'|'sonstiges'
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

  -- 1b. Zahlart ist seit Ops #271 Pflicht — sie entscheidet, ob/als was der
  --     Beleg entsteht. Ein fehlender Wert soll die Buchung ablehnen, nicht
  --     still als 'sonstiges' durchrutschen (das Backend löst ihn immer aus
  --     der Konto-Kategorie auf, siehe rechnung-zahlung.routes.js).
  IF p_zahlart IS NULL OR p_zahlart NOT IN ('bar','ec','ueberweisung','paypal','sonstiges') THEN
    RAISE EXCEPTION 'Unbekannte oder fehlende Zahlart.' USING ERRCODE = 'check_violation';
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

  -- 6. Beleg im Journal. Seit Ops #271 (08.09.2026) bei JEDER Zahlart, nicht
  --    mehr nur Bar — belegliste ist ein Belegjournal (kassiereZuzahlung
  --    schreibt dort schon heute ec/ueberweisung, ausfall.routes.js Bank),
  --    das Bar-Kassenbuch (§ 146 AO) ist der zahlart='bar'-Filter im Frontend.
  --    Eine Ausbuchung bleibt OHNE Beleg (kein Geldfluss, unveraendert).
  --
  --    ⚠️ Der `type` beschreibt den GESCHAEFTSVORFALL, nicht den Erfassungsweg:
  --    haengt die Rechnung an einem Rezept, wird als 'zuzahlung' gebucht.
  --    mahnwesen.routes.js und statistik.routes.js filtern auf
  --    type IN ('zuzahlung','storno') und wuerden eine 'rechnung'-Zeile
  --    uebersehen — der Patient bekaeme eine Mahnung fuer bezahltes Geld.
  INSERT INTO public.belegliste
    (owner_id, type, amount_eur, patient_id, prescription_id, invoice_id,
     reference_text, zahlart, created_by)
  VALUES
    (p_owner_id,
     CASE WHEN v_rx_id IS NOT NULL THEN 'zuzahlung' ELSE 'rechnung' END,
     p_betrag_eur, v_inv.patient_id, v_rx_id, p_invoice_id,
     'Zahlungseingang Rechnung ' || COALESCE(v_inv.invoice_number, ''),
     p_zahlart, p_created_by)
  RETURNING beleg_nr INTO v_beleg_nr;

  -- 7. Rezeptvermerk. Ohne ihn zeigt die Oberflaeche das Rezept weiter als
  --    "nicht kassiert" und jemand kassiert ein zweites Mal. Entspricht dem
  --    optimistischen .is('zuzahlung_kassiert_am', null)-Claim aus
  --    kassiereZuzahlung (dashboard.js). p_zahlart direkt uebernommen statt
  --    des alten COALESCE(v_zahlart,'ueberweisung')-Fallbacks — der schrieb
  --    bei Kartenzahlung faelschlich 'ueberweisung' (Ops #271, gefunden bei
  --    der Bestandsaufnahme).
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
             zuzahlung_zahlart      = p_zahlart
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
  uuid, uuid, uuid, numeric, date, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rechnung_zahlung_buchen(
  uuid, uuid, uuid, numeric, date, text, text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rechnung_zahlung_buchen(
  uuid, uuid, uuid, numeric, date, text, text, text, text, text, text, text) FROM authenticated;


-- =====================================================================
-- ROLLBACK  (auf ausdrueckliche Anweisung, Muster aus
-- sql-melih/2026-09-07-rechnung-zahlungen.sql:527-542 uebernommen)
-- =====================================================================
-- ⚠️ Das Projekt fuehrt sonst KEINE Down-Migrations (Begruendung dort).
--    Dieser Block ist deshalb bewusst AUSKOMMENTIERT und kein Teil des
--    Migrationslaufs.
--
-- ⛔ NICHT blind ausfuehren. Reihenfolge: zuerst die Funktion auf den
--    Stand VOR dieser Migration zuruecksetzen (Rumpf steht in
--    sql-melih/2026-09-07-rechnung-zahlungen.sql:310-513 — dort OHNE
--    p_zahlart, mit dem alten "nur Bar"-Beleg und dem alten
--    COALESCE(v_zahlart,'ueberweisung')-Fallback), DANACH die CHECKs.
--
-- ⛔ Sobald die erste Zahlung mit p_zahlart <> 'bar' gebucht wurde (also
--    sobald belegliste eine Zeile mit zahlart IN ('ec','paypal') hat, die es
--    vor dieser Migration nicht geben konnte), ist der CHECK-Rueckbau KEIN
--    Rueckweg mehr — er wuerde bestehende Buchhaltungsdaten ungueltig
--    machen (§ 147 AO). Vorher pruefen:
--      SELECT count(*) FROM public.belegliste WHERE zahlart = 'paypal';
--      SELECT count(*) FROM public.prescriptions WHERE zuzahlung_zahlart = 'paypal';
--
--   -- 1. Funktion auf den Stand vor dieser Migration zuruecksetzen. Zuerst
--   --    die 12-Parameter-Fassung (diese Migration) droppen, DANACH den
--   --    kompletten CREATE OR REPLACE aus sql-melih/2026-09-07-…:310-513
--   --    erneut fahren — sonst liegen beide Ueberladungen nebeneinander,
--   --    gleicher Fehler wie oben in TEIL B, nur umgekehrt:
--   DROP FUNCTION IF EXISTS public.rechnung_zahlung_buchen(
--     uuid, uuid, uuid, numeric, date, text, text, text, text, text, text, text);
--
--   -- 2. CHECKs zurueckbauen (nur wenn die Zaehlungen oben beide 0 sind):
--   ALTER TABLE public.belegliste DROP CONSTRAINT IF EXISTS belegliste_zahlart_check;
--   ALTER TABLE public.belegliste ADD CONSTRAINT belegliste_zahlart_check
--     CHECK (zahlart IS NULL OR zahlart IN ('bar','ec','ueberweisung','sonstiges'));
--
--   ALTER TABLE public.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_zuzahlung_zahlart_check;
--   ALTER TABLE public.prescriptions ADD CONSTRAINT prescriptions_zuzahlung_zahlart_check
--     CHECK (zuzahlung_zahlart IS NULL OR zuzahlung_zahlart IN ('bar','ec','ueberweisung','sonstiges'));
