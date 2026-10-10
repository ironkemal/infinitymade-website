-- Migration 0078_zuzahlungsbeleg_invoices.sql
-- SaaS: angewandt 10.10.2026 (MCP: 20261010005316, Freigabe Kemal; geprüft im Rollback: ZU-2026-0001 + issued_at heute, 2. aktive ZU -> 23505,
-- fremder Mandant -> check_violation (S-59), Inhalt gesperrt, Storno ohne Gegenbeleg abgelehnt, draft abgelehnt, Gegenbeleg ZU-2026-0002 + Original cancelled, neue ZU-2026-0003).
-- Auftrag: KUTU_HAZIRLIK_SPRINT.md §4 „ZU".
-- Rechtsgrundlage: compliance/LEGAL_DECISIONS.md Block „2026-10-10 · Zuzahlungsbeleg (ZU) …" (legal-de):
--   ZU = Buchungsbeleg (§ 147 Abs. 1 Nr. 4 AO, 8 J.), eigener Nummernkreis ZU-JJJJ-nnnn, Nummer + Datum einmalig bei
--   erster Ausgabe und dann gesperrt (nicht erst „bezahlt"), Storno = Gegenbeleg mit eigener Nummer + Verweis,
--   Original „storniert", kein Löschen/Ändern.
-- Fachgrundlage: wissensbank/SPEC-RULES.md „Zuzahlungsaufforderung (ZU) = VKZ-03-Urbeleg" (gkv-302): die ZU ist der
--   Urbeleg, der einer VKZ-03-Zuzahlungsforderung (§ 43c SGB V) beigelegt wird — muss identisch nachdruckbar sein.
--
-- Problem: GET /billing/prescription/:id/zuzahlungsrechnung (api-backend/billing/api/abrechnung.routes.js:2637)
-- rendert bei jedem Aufruf neu: Nummer ZU-<uuid8> (:2796, kein Nummernkreis), Datum new Date() (:2797), nichts wird
-- gespeichert. Derselbe Beleg trägt bei jedem Druck ein anderes Datum.
--
-- Entscheidungen (db-ustasi):
-- (1) Typ: invoices_invoice_type_check += 'zuzahlung'. Kein weiterer DB-Ort setzt die vier Werte voraus (live
--     10.10.2026 geprüft: keine Policy, kein View, keine Funktion außer invoice_festschreibung liest invoice_type).
-- (2) Nummer: set_invoice_nummer() zieht für invoice_type = 'zuzahlung' aus Kreis 'zuzahlung' (jahresweise, jahr =
--     Ausstellungsjahr wie 'rechnung'; nummernkreise-Regel „Jahreszahl ODER 0") und schreibt
--     invoice_number = 'ZU-' || jahr || '-' || lpad(nr,4,'0'). Für ZU wird eine mitgegebene Nummer IGNORIERT und
--     issued_at auf das heutige Datum in Europe/Berlin gesetzt (Datum = Ausgabetag, nicht vom Client wählbar;
--     CURRENT_DATE wäre UTC und liefe zwischen 0 und 2 Uhr einen Tag zurück). Bestehende Kreise und Zeilen
--     unverändert: jeder andere Typ zieht wie bisher aus 'rechnung' mit Präfix INV-. Falle 6 bleibt: Nummer nur
--     vom Trigger, kein MAX+1. UNIQUE (owner_id, invoice_number) trennt die Kreise schon über das Präfix.
-- (3) Sperre ab INSERT über den VORHANDENEN Mechanismus: eine ZU-Zeile wird mit status = 'sent' angelegt
--     (CHECK invoices_zuzahlung_nie_entwurf). invoice_festschreibung sperrt ab status <> 'draft' bereits alles
--     Inhaltliche (Positionen, Beträge, issued_at, Snapshots, Nummer, Typ) und verbietet DELETE für
--     authenticated/anon. Die Alternative „Sperre per invoice_type schon im Entwurf" hätte eine zweite
--     Sperrlogik neben 'draft' gebraucht und eine ZU in der Liste als „Entwurf" gezeigt — größer, nicht sicherer.
--     Folge: ZU zählt in den heutigen „festgeschriebene Rechnung?"-Prüfungen (status IN ('sent','paid')) mit —
--     siehe „Bekannte Berührungspunkte" unten.
-- (4) Zusätzlich für ZU in invoice_festschreibung (eigener Block, vor dem Entwurfs-Ausstieg):
--       - Typwechsel AUF 'zuzahlung' per UPDATE verboten (auch aus einem Entwurf) — ZU entsteht nur per INSERT,
--         sonst trüge sie eine INV-Nummer.
--       - 'cancelled' ist für ZU endgültig; Übergang nach 'cancelled' nur, wenn ein Gegenbeleg existiert.
--       - Gegenbeleg: Status unveränderlich.
--       - storno_von unveränderlich; prescription_id nur auf NULL (FK ON DELETE SET NULL), nie auf ein anderes Rezept.
--       Absichtlich in der Form „OLD.x IS DISTINCT FROM NEW.x" geschrieben: der Spiegeltest
--       module/rechnung-festschreibung.test.js liest nur die Form „NEW.<spalte> … OLD.<spalte>" als Browser-Pflichtspalte.
--       Die ZU-Regeln gelten nur für ZU-Zeilen, die saveInvoice() nie schreibt — für Privat-/GKV-Rechnungen
--       ändert sich nichts (prescription_id bleibt dort frei).
--     sent → paid bleibt erlaubt (status/payment_status/paid_at sind nicht gesperrt) — siehe „Zahlung" unten.
-- (5) Höchstens eine aktive ZU je Rezept: UNIQUE INDEX (prescription_id) WHERE invoice_type='zuzahlung' AND
--     storno_von IS NULL AND status <> 'cancelled'. Zweiter gleichzeitiger Erstdruck → 23505 → Code liest die
--     vorhandene Zeile.
-- (6) Storno = Gegenbeleg: neue Spalte storno_von uuid → invoices(id) (NO ACTION, damit ein späterer Purge beide Zeilen
--     in einem Statement löschen kann). Gegenbeleg = eigene invoices-Zeile, invoice_type 'zuzahlung', status 'sent',
--     EIGENE ZU-Nummer aus demselben Kreis, storno_von = Original, gleiche prescription_id, Beträge negativ.
--     Danach Original → status 'cancelled' (+ storno_grund/storno_am, vorhandene Spalten). Je Original höchstens ein
--     Gegenbeleg (UNIQUE INDEX auf storno_von). set_invoice_nummer prüft beim INSERT eines Gegenbelegs: Original
--     existiert, gleicher owner, Typ zuzahlung, selbst kein Gegenbeleg, nicht cancelled, gleiches Rezept — eine
--     generische Meldung, damit die DEFINER-Funktion fremde IDs nicht bestätigt (ein FK prüft keinen Mandanten).
--     Kleinste Lösung: eine Spalte, keine neue Tabelle, kein neuer Typ, kein neuer Kreis.
-- (7) Pflicht beim ZU-INSERT: prescription_id NOT NULL (nur beim INSERT geprüft, nicht als CHECK — sonst würde die
--     FK-Aktion SET NULL beim Löschen eines Rezepts scheitern).
--
-- Zahlung (Code, nicht DB): Kassieren läuft heute über kassiereZuzahlung (dashboard.js:6469 → prescriptions.
-- zuzahlung_kassiert_am + belegliste type 'zuzahlung') und berührt invoices nicht. Eine ZU-Zeile bliebe danach 'sent' +
-- payment_status 'pending' und zeigt in der Rechnungsliste den Knopf „Zahlung" (module/rechnung-ansicht.js:104) →
-- rechnung_zahlung_buchen() würde dieselbe Zuzahlung ein zweites Mal in belegliste buchen (sie prüft
-- zuzahlung_kassiert_am nur für den Rezeptvermerk, nicht für den Beleg). Vorschlag an den Code: nach Kassieren die
-- aktive ZU per markiereRechnungBezahlt() auf paid ziehen (DB erlaubt es) UND ZU-Zeilen aus dem Zahlungsknopf
-- nehmen. Die DB erzwingt hier bewusst nichts — zwei Zahlwege zu verdrahten ist Code-Entscheidung (fonksiyon-ustasi).
--
-- Kolonnen, die der Code beim ZU-INSERT setzt (service_role, abrechnung.routes.js):
--   owner_id, business_id (sonst Trigger-Default), patient_id = rx.patient_id, lead_id = rx.patient_id,
--   prescription_id = rx.id (verordnung_id NULL), patient_name, invoice_type 'zuzahlung', status 'sent',
--   payment_status 'pending', line_items = gedruckte Sitzungen [{datum, position, bezeichnung, brutto, zuzahlung}],
--   subtotal = Summe brutto, kassenzuzahlung = totals.zuzahlung, total_patient = gedruckter Zahlbetrag,
--   leistung_von/_bis = erste/letzte Sitzung, aussteller_snapshot (praxisKopf + steuernummer/ust_id + Bank +
--   Zahlungsbedingungen: zahlungsziel_tage, faellig_am, hinweisText, fusszeile — legal-de 09.10.: „Aussteller wie
--   gkv-302-Liste + Zahlungsbedingungen"), empfaenger_snapshot (Patient wie gedruckt + verordnung{ausstellungsdatum,
--   krankenkasse, arzt}). NICHT setzen: invoice_number, rechnung_nr, issued_at (Trigger).
--   Steuerfelder (tax_summary/steuer_status/…) bleiben leer — ZU ist kein Leistungsentgelt der Praxis (§ 43c SGB V).
--
-- Bekannte Berührungspunkte im Code (vor Anwendung prüfen, nicht Teil dieser Migration):
--   module/rechnung-zur-verordnung.js:44   sucheRechnungZurVerordnung findet eine ZU als „die Rechnung" des Rezepts
--                                          → Filter invoice_type ≠ zuzahlung (PostgREST: or(invoice_type.is.null,
--                                          invoice_type.neq.zuzahlung) — neq allein wirft NULL-Zeilen raus, und
--                                          invoice_type ist in den Altzeilen NULL).
--   module/verordnung-maske.js:303, api-backend/server.js:2776   status IN (sent,paid) → eine ZU sperrt den
--                                          Rezeptart-Wechsel. Vermutlich gewollt (die ZU nennt die Kasse), bestätigen.
--   module/selbstzahler-stufen.js:119      letzte Preise aus line_items → ZU-Positionen würden als Preisvorschlag
--                                          auftauchen; ZU ausfiltern.
--   module/rechnung-summen.js:39 (typKennzeichen) fällt für 'zuzahlung' auf „Privat"; summenAnzeige/
--                                          OHNE_ZUZAHLUNG kennen den Typ nicht.
--   module/rechnung-ansicht.js:104, dashboard.js:13373/8143/1556   ZU erscheint in Rechnungsliste, Patientenakte,
--                                          Aktivitäten — mit Zahlungsknopf (siehe „Zahlung").
--   api-backend/dsgvo/loeschen.js:294      ZU zählt als „behandelt" → Rezept bleibt erhalten. Gewollt (Urbeleg).
--
-- Zähler: +2 Index (invoices_zuzahlung_ein_aktiver_je_rezept, invoices_storno_von_einmal) → index 313 → 315.
-- Funktionen: CREATE OR REPLACE zweier bestehender (set_invoice_nummer DEFINER bleibt, invoice_festschreibung INVOKER
-- bleibt) → fonksiyon unverändert. Trigger unverändert. Spalte, FK, CHECKs, COMMENTs zählt keiner der zehn Zähler.
-- Sicherheit: keine neue SECURITY-DEFINER-Funktion; set_invoice_nummer war schon DEFINER (braucht naechste_nummer,
-- seit 0002 ohne EXECUTE für authenticated) und steht ab jetzt auf PROTECTED in
-- tools/check-security-definer-grants.mjs (drei REVOKEs unten). Keine anon-Rechte, keine neue Policy — RLS
-- owner_and_employee_invoices gilt unverändert.
-- DSGVO: invoices ist in api-backend/dsgvo/klassifikation.js (kategorie beleg); storno_von trägt keine Personendaten.

-- (1) Typ
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type IS NULL OR invoice_type = ANY (ARRAY['gkv'::text, 'privat'::text, 'selbstzahler'::text, 'bg'::text, 'zuzahlung'::text]));

COMMENT ON COLUMN public.invoices.invoice_type IS
  'gkv = GKV Abrechnung (fixed tariff + Zuzahlung), privat = Privatrechnung (practice prices, no Zuzahlung), selbstzahler, bg = UV-Träger (0068), zuzahlung = Zuzahlungsaufforderung/-beleg ZU-JJJJ-nnnn an den Patienten (0078; VKZ-03-Urbeleg, ab INSERT festgeschrieben, nie draft).';

-- (6) Gegenbeleg-Verweis
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS storno_von uuid;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_storno_von_fkey
  FOREIGN KEY (storno_von) REFERENCES public.invoices(id);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_storno_von_nur_zuzahlung
  CHECK (storno_von IS NULL OR (invoice_type = 'zuzahlung' AND storno_von <> id));

COMMENT ON COLUMN public.invoices.storno_von IS
  'Nur ZU (0078): diese Zeile ist der Gegenbeleg (Storno) zur ZU storno_von — eigene ZU-Nummer, negative Beträge, status sent. Das Original steht danach auf cancelled. Je Original höchstens ein Gegenbeleg.';

-- (3) ZU ist nie ein Entwurf
ALTER TABLE public.invoices ADD CONSTRAINT invoices_zuzahlung_nie_entwurf
  CHECK (invoice_type IS DISTINCT FROM 'zuzahlung' OR COALESCE(status, 'draft') <> 'draft');

-- (5) eine aktive ZU je Rezept, ein Gegenbeleg je Original
-- guvenlik S-59 (10.10.2026): Index mandantenbezogen — sonst sperrt eine fremde Zeile die eigene erste ZU.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_zuzahlung_ein_aktiver_je_rezept
  ON public.invoices (owner_id, prescription_id)
  WHERE invoice_type = 'zuzahlung' AND storno_von IS NULL AND status <> 'cancelled';
CREATE UNIQUE INDEX IF NOT EXISTS invoices_storno_von_einmal
  ON public.invoices (storno_von)
  WHERE storno_von IS NOT NULL;

-- (2) + (6) + (7) Nummer, Datum, Gegenbeleg-Prüfung
CREATE OR REPLACE FUNCTION public.set_invoice_nummer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_jahr int; v_nr bigint; v_orig record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.invoice_type = 'zuzahlung' THEN
      -- 0078: ZU — Nummer und Datum immer vom Trigger, nie vom Aufrufer
      IF NEW.prescription_id IS NULL THEN
        RAISE EXCEPTION 'Zuzahlungsbeleg ohne Verordnung.' USING ERRCODE = 'check_violation';
      END IF;
      -- guvenlik S-59: nur zur EIGENEN Verordnung (FK prüft keinen Mandanten); gleiche, allgemeine Meldung.
      IF NOT EXISTS (SELECT 1 FROM public.prescriptions p
                      WHERE p.id = NEW.prescription_id AND p.owner_id = NEW.owner_id) THEN
        RAISE EXCEPTION 'Zuzahlungsbeleg: Verordnung ungueltig.' USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.storno_von IS NOT NULL THEN
        SELECT owner_id, invoice_type, storno_von, status, prescription_id
          INTO v_orig FROM public.invoices WHERE id = NEW.storno_von;
        IF NOT FOUND
           OR v_orig.owner_id IS DISTINCT FROM NEW.owner_id
           OR v_orig.invoice_type IS DISTINCT FROM 'zuzahlung'
           OR v_orig.storno_von IS NOT NULL
           OR v_orig.status = 'cancelled'
           OR v_orig.prescription_id IS DISTINCT FROM NEW.prescription_id THEN
          RAISE EXCEPTION 'Gegenbeleg: Original-Zuzahlungsbeleg ungueltig.' USING ERRCODE = 'check_violation';
        END IF;
      END IF;
      NEW.issued_at      := (now() AT TIME ZONE 'Europe/Berlin')::date;
      v_jahr             := EXTRACT(YEAR FROM NEW.issued_at)::int;
      v_nr               := naechste_nummer(NEW.owner_id, 'zuzahlung', v_jahr);
      NEW.rechnung_nr    := v_nr;
      NEW.invoice_number := 'ZU-' || v_jahr || '-' || lpad(v_nr::text, 4, '0');
      RETURN NEW;
    END IF;

    IF NEW.rechnung_nr IS NULL THEN
      v_jahr := COALESCE(EXTRACT(YEAR FROM NEW.issued_at)::int, EXTRACT(YEAR FROM now())::int);
      v_nr   := naechste_nummer(NEW.owner_id, 'rechnung', v_jahr);
      NEW.rechnung_nr    := v_nr;
      NEW.invoice_number := 'INV-' || v_jahr || '-' || lpad(v_nr::text, 4, '0');
    END IF;
    RETURN NEW;
  END IF;

  -- § 14 Abs. 4 Nr. 4 UStG: einmal vergeben, nie wieder geaendert.
  -- COALESCE statt harter Zuweisung: war noch keine Nummer da (Altbestand),
  -- darf genau einmal eine gesetzt werden.
  NEW.rechnung_nr    := COALESCE(OLD.rechnung_nr, NEW.rechnung_nr);
  NEW.invoice_number := COALESCE(OLD.invoice_number, NEW.invoice_number);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_invoice_nummer() FROM PUBLIC, anon, authenticated;

-- (4) Festschreibung: ZU-Block vor dem Entwurfs-Ausstieg; der allgemeine Teil ist wörtlich 0075.
CREATE OR REPLACE FUNCTION public.invoice_festschreibung()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' AND current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'Festgeschriebene Rechnung % kann nicht geloescht werden. Bitte stornieren.', OLD.invoice_number
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  -- 0078: Zuzahlungsbeleg (ZU). Form „OLD.x … NEW.x" absichtlich — siehe Kopf (4).
  IF NEW.invoice_type = 'zuzahlung' AND OLD.invoice_type IS DISTINCT FROM 'zuzahlung' THEN
    RAISE EXCEPTION 'Rechnung % kann nicht nachtraeglich zum Zuzahlungsbeleg werden.', OLD.invoice_number
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.invoice_type = 'zuzahlung' THEN
    IF OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM 'cancelled' THEN
      RAISE EXCEPTION 'Stornierter Zuzahlungsbeleg % bleibt storniert.', OLD.invoice_number
        USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.storno_von IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'Gegenbeleg % ist festgeschrieben (Status).', OLD.invoice_number
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled'
       AND NOT EXISTS (SELECT 1 FROM public.invoices g WHERE g.storno_von = OLD.id) THEN
      RAISE EXCEPTION 'Zuzahlungsbeleg % nur mit Gegenbeleg stornierbar.', OLD.invoice_number
        USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.storno_von IS DISTINCT FROM NEW.storno_von
       OR (NEW.prescription_id IS NOT NULL AND OLD.prescription_id IS DISTINCT FROM NEW.prescription_id) THEN
      RAISE EXCEPTION 'Zuzahlungsbeleg % kann nicht umgehaengt werden.', OLD.invoice_number
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'draft' THEN
    RAISE EXCEPTION 'Festgeschriebene Rechnung % kann nicht auf Entwurf zurueckgesetzt werden. Bitte stornieren und neu ausstellen.', OLD.invoice_number
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.line_items    IS DISTINCT FROM OLD.line_items
  OR NEW.subtotal      IS DISTINCT FROM OLD.subtotal
  OR NEW.total_patient IS DISTINCT FROM OLD.total_patient
  OR NEW.netto_gesamt  IS DISTINCT FROM OLD.netto_gesamt
  OR NEW.steuer_gesamt IS DISTINCT FROM OLD.steuer_gesamt
  OR NEW.brutto_gesamt IS DISTINCT FROM OLD.brutto_gesamt
  OR NEW.tax_summary   IS DISTINCT FROM OLD.tax_summary
  OR NEW.patient_id    IS DISTINCT FROM OLD.patient_id
  OR NEW.issued_at     IS DISTINCT FROM OLD.issued_at
  OR NEW.steuerhinweis_text IS DISTINCT FROM OLD.steuerhinweis_text
  OR NEW.steuernummer_snapshot IS DISTINCT FROM OLD.steuernummer_snapshot
  OR NEW.ust_id_snapshot       IS DISTINCT FROM OLD.ust_id_snapshot
  OR NEW.steuer_status         IS DISTINCT FROM OLD.steuer_status
  OR NEW.leistung_von          IS DISTINCT FROM OLD.leistung_von
  OR NEW.leistung_bis          IS DISTINCT FROM OLD.leistung_bis
  OR NEW.patient_name          IS DISTINCT FROM OLD.patient_name
  OR NEW.invoice_type          IS DISTINCT FROM OLD.invoice_type
  -- 0075: Aussteller/Empfänger wie gedruckt + Eigenanteil/Kassenzuzahlung direkt
  OR NEW.aussteller_snapshot   IS DISTINCT FROM OLD.aussteller_snapshot
  OR NEW.empfaenger_snapshot   IS DISTINCT FROM OLD.empfaenger_snapshot
  OR NEW.eigenanteil_pct       IS DISTINCT FROM OLD.eigenanteil_pct
  OR NEW.eigenanteil_eur       IS DISTINCT FROM OLD.eigenanteil_eur
  OR NEW.kassenzuzahlung       IS DISTINCT FROM OLD.kassenzuzahlung
  -- 0075: Nummer nur, wenn schon vergeben (eine fehlende Nummer darf einmalig gesetzt werden)
  OR (OLD.invoice_number IS NOT NULL AND NEW.invoice_number IS DISTINCT FROM OLD.invoice_number)
  OR (OLD.rechnung_nr    IS NOT NULL AND NEW.rechnung_nr    IS DISTINCT FROM OLD.rechnung_nr)
  THEN
    RAISE EXCEPTION 'Festgeschriebene Rechnung % kann inhaltlich nicht geaendert werden. Bitte stornieren und neu ausstellen.', OLD.invoice_number
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.invoice_festschreibung() FROM PUBLIC, anon, authenticated;
